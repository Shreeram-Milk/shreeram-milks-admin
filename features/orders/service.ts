import { addDays, isIsoDate, todayInBusinessZone, type IsoDate } from '@/lib/business-time'
import { deliverySlotService } from '../configuration/mock-store'
import type { DeliverySlot } from '../configuration/types'
import { getPrimaryAddress } from '../customers/address'
import { customerService } from '../customers/service'
import type { Customer } from '../customers/types'
import { deliveryRepository } from '../deliveries/mock-repository'
import { deliveryService } from '../deliveries/service'
import type { DeliveryInstance } from '../deliveries/types'
import { productService } from '../products/service'
import type { Product } from '../products/types'
import { subscriptionService, type SubscriptionContext } from '../subscriptions/service'
import { calculateOrderTotals, MAX_ITEM_QUANTITY } from './pricing'
import { orderRepository } from './mock-repository'
import type { Order, OrderInput, OrderItem, OrderItemInput, OrderStatus } from './types'

export class OrderRuleError extends Error {}

export const MAX_ORDER_ITEMS = 20

export type OrderView = {
  order: Order
  status: OrderStatus
  customer: Customer | undefined
  slot: DeliverySlot | undefined
  deliveries: DeliveryInstance[]
}

export type OrderListQuery = { search: string; status: OrderStatus | ''; date: IsoDate | ''; customerId: string; productId: string; page: number; pageSize: number }
export type OrderPreviewLine = { unitPricePaise: number | null; lineTotalPaise: number | null }
export type OrderPreview = { lines: OrderPreviewLine[]; subtotalPaise: number; totalPaise: number }
export type OrderSummary = { deliveringToday: number; scheduledTomorrow: number; pendingConfirmation: number }

/** Stored draft/confirmed/cancelled plus what the order's deliveries say: scheduled until all are delivered, then fulfilled. */
export function deriveOrderStatus(order: Pick<Order, 'status' | 'deliveryDate'>, deliveries: Pick<DeliveryInstance, 'status'>[]): OrderStatus {
  if (order.status !== 'confirmed') return order.status
  const live = deliveries.filter(delivery => delivery.status !== 'cancelled')
  if (live.length > 0 && live.every(delivery => delivery.status === 'delivered')) return 'fulfilled'
  return live.length > 0 ? 'scheduled' : 'confirmed'
}

function groupDeliveriesByOrder(): Map<string, DeliveryInstance[]> {
  const groups = new Map<string, DeliveryInstance[]>()
  for (const delivery of deliveryRepository.list()) {
    if (!delivery.orderId) continue
    const list = groups.get(delivery.orderId)
    if (list) list.push(delivery); else groups.set(delivery.orderId, [delivery])
  }
  return groups
}

function toView(order: Order, deliveries: DeliveryInstance[], slots: Map<string, DeliverySlot>): OrderView {
  return {
    order, deliveries, status: deriveOrderStatus(order, deliveries), customer: customerService.getById(order.customerId),
    slot: order.deliverySlotId ? slots.get(order.deliverySlotId) : undefined,
  }
}

const snapshotAddress = (customer: Customer) => {
  const address = getPrimaryAddress(customer)
  return { line1: address?.line1 ?? '', line2: address?.line2 ?? '', locality: address?.locality ?? '', city: address?.city ?? '', state: address?.state ?? '', pinCode: address?.pinCode ?? '' }
}

function requireOrder(id: string): Order {
  const order = orderRepository.get(id)
  if (!order) throw new OrderRuleError('Order not found.')
  return order
}

function hasDelivered(orderId: string): boolean {
  return deliveryRepository.listForOrder(orderId).some(delivery => delivery.status === 'delivered')
}

/** Authoritative validation and pricing. The form mirrors some of this for UX only. */
function buildOrder(input: OrderInput, existing: Order | undefined, today: IsoDate): Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'status' | 'cancellation'> & { items: OrderItem[] } {
  const customer = customerService.getById(existing?.customerId ?? input.customerId)
  if (!customer) throw new OrderRuleError('Select a customer.')
  if (!existing && customer.status !== 'active') throw new OrderRuleError('Orders can only be created for active customers.')
  if (!input.items.length) throw new OrderRuleError('Add at least one item.')
  if (input.items.length > MAX_ORDER_ITEMS) throw new OrderRuleError(`An order can have at most ${MAX_ORDER_ITEMS} items.`)

  const context = subscriptionService.resolveContext({ customerId: customer.id, productId: input.items[0].productId, purchaseMethod: 'buy_once' })
  const { eligibility, product: firstProduct } = context
  if (!firstProduct || !eligibility) throw new OrderRuleError('Select a product.')
  if (!eligibility.serviceable) throw new OrderRuleError(eligibility.reason ?? 'This order cannot be delivered.')

  const previousById = new Map((existing?.items ?? []).map(item => [item.id, item]))
  const items: OrderItem[] = []
  for (const line of input.items) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_ITEM_QUANTITY) throw new OrderRuleError(`Quantity must be a whole number from 1 to ${MAX_ITEM_QUANTITY}.`)
    const product = productService.getById(line.productId)
    if (!product || product.status !== 'active') throw new OrderRuleError('Every item must be an active product.')
    if (!product.purchaseMethods.includes('buy_once')) throw new OrderRuleError(`${product.name} cannot be bought as a one-time order.`)
    if (product.fulfilmentProfileId !== firstProduct.fulfilmentProfileId) throw new OrderRuleError('All items in one order must share the same fulfilment profile.')
    const previous = line.id ? previousById.get(line.id) : undefined
    const variant = product.variants.find(candidate => candidate.id === line.variantId)
    if (!variant || (variant.status !== 'active' && previous?.variantId !== variant.id)) throw new OrderRuleError('Select an active variant for every item.')
    // Unchanged lines keep the price they were sold at; new or changed lines are priced from today's catalog.
    const keepsSnapshot = previous && previous.variantId === variant.id && previous.productId === product.id
    const unit = keepsSnapshot ? previous.unitPricePaiseSnapshot : variant.pricePaise
    const itemId = line.id && previousById.has(line.id) ? line.id : `item-${crypto.randomUUID()}`
    items.push({
      id: itemId, orderId: existing?.id ?? '', productId: product.id, variantId: variant.id,
      productNameSnapshot: keepsSnapshot ? previous.productNameSnapshot : product.name, variantNameSnapshot: keepsSnapshot ? previous.variantNameSnapshot : variant.name, skuSnapshot: keepsSnapshot ? previous.skuSnapshot : variant.sku || product.sku,
      unitPricePaiseSnapshot: unit, quantity: line.quantity, lineTotalPaise: 0,
    })
  }
  const totals = calculateOrderTotals(items.map(item => ({ unitPricePaise: item.unitPricePaiseSnapshot, quantity: item.quantity })), existing?.adjustmentPaise ?? 0)
  items.forEach((item, index) => { item.lineTotalPaise = totals.lineTotalsPaise[index] })

  let deliverySlotId: string | null = null
  if (eligibility.slotRequired) {
    const unchanged = existing?.deliverySlotId === input.deliverySlotId
    if (!input.deliverySlotId || !(eligibility.allowedSlotIds.includes(input.deliverySlotId) || (unchanged && eligibility.inactiveSlotIds.includes(input.deliverySlotId)))) throw new OrderRuleError('Select a delivery slot available for the customer’s PIN code.')
    deliverySlotId = input.deliverySlotId
  }
  if (!isIsoDate(input.deliveryDate)) throw new OrderRuleError('Choose a delivery date.')
  if ((!existing || input.deliveryDate !== existing.deliveryDate) && input.deliveryDate < today) throw new OrderRuleError('The delivery date cannot be in the past.')

  const snapshot = existing ? existing.addressSnapshot : snapshotAddress(customer)
  return {
    customerId: customer.id, orderType: 'buy_once', paymentMode: customer.customerType, fulfilmentProfileId: firstProduct.fulfilmentProfileId,
    deliverySlotId, deliveryDate: input.deliveryDate, addressSnapshot: snapshot, pincode: snapshot.pinCode, items,
    subtotalPaise: totals.subtotalPaise, adjustmentPaise: totals.adjustmentPaise, totalPaise: totals.totalPaise,
  }
}

export const orderService = {
  list({ search, status, date, customerId, productId, page, pageSize }: OrderListQuery): { rows: OrderView[]; total: number } {
    const grouped = groupDeliveriesByOrder()
    const slots = new Map(deliverySlotService.list().map(slot => [slot.id, slot]))
    const term = search.trim().toLowerCase()
    const matches = orderRepository.list()
      .filter(order => (!customerId || order.customerId === customerId) && (!date || order.deliveryDate === date) && (!productId || order.items.some(item => item.productId === productId)))
      .map(order => toView(order, grouped.get(order.id) ?? [], slots))
      .filter(view => (!status || view.status === status) && (!term || [view.order.orderNumber, view.customer?.fullName, view.customer?.mobile, ...view.order.items.map(item => item.productNameSnapshot)].join(' ').toLowerCase().includes(term)))
      .sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt) || b.order.orderNumber.localeCompare(a.order.orderNumber))
    return { rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length }
  },
  getView(id: string): OrderView | undefined {
    const order = orderRepository.get(id)
    if (!order) return undefined
    return toView(order, deliveryRepository.listForOrder(id), new Map(deliverySlotService.list().map(slot => [slot.id, slot])))
  },
  getById: (id: string) => orderRepository.get(id),
  listForCustomer(customerId: string): OrderView[] {
    const slots = new Map(deliverySlotService.list().map(slot => [slot.id, slot]))
    return orderRepository.listForCustomer(customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(order => toView(order, deliveryRepository.listForOrder(order.id), slots))
  },
  /** Active Buy Once products, optionally limited to one fulfilment profile (items in an order must share it). */
  listOrderableProducts(fulfilmentProfileId?: string): Product[] {
    return productService.list().filter(product => product.status === 'active' && product.purchaseMethods.includes('buy_once') && (!fulfilmentProfileId || product.fulfilmentProfileId === fulfilmentProfileId))
  },
  /** Fulfilment context (serviceability, slots, cut-off) for a customer buying the given product once. */
  resolveContext: ({ customerId, productId }: { customerId: string; productId: string }): SubscriptionContext => subscriptionService.resolveContext({ customerId, productId, purchaseMethod: 'buy_once' }),

  create(input: OrderInput, { confirm }: { confirm: boolean }): Order {
    const built = buildOrder(input, undefined, todayInBusinessZone())
    const id = `order-${crypto.randomUUID()}`
    const created = orderRepository.insert({ ...built, id, orderNumber: orderRepository.nextOrderNumber(), status: confirm ? 'confirmed' : 'draft', cancellation: null, items: built.items.map(item => ({ ...item, orderId: id })) })
    if (confirm) deliveryService.reconcileOrderChanges(created.id)
    return created
  },
  update(id: string, input: OrderInput): Order {
    const existing = requireOrder(id)
    if (existing.status === 'cancelled') throw new OrderRuleError('Cancelled orders cannot be edited.')
    if (hasDelivered(id)) throw new OrderRuleError('Orders with delivered items can no longer be edited.')
    const built = buildOrder({ ...input, customerId: existing.customerId }, existing, todayInBusinessZone())
    const updated = orderRepository.replace(id, { ...built, items: built.items.map(item => ({ ...item, orderId: id })) })
    if (!updated) throw new OrderRuleError('Order not found.')
    deliveryService.reconcileOrderChanges(id)
    return updated
  },
  /** draft -> confirmed. Confirming is what creates the delivery. */
  confirm(id: string): Order {
    const existing = requireOrder(id)
    if (existing.status !== 'draft') throw new OrderRuleError('Only draft orders can be confirmed.')
    if (!existing.deliveryDate || existing.deliveryDate < todayInBusinessZone()) throw new OrderRuleError('The delivery date has passed. Edit the order and choose a new date before confirming.')
    const updated = orderRepository.replace(id, { status: 'confirmed' })
    if (!updated) throw new OrderRuleError('Order not found.')
    deliveryService.reconcileOrderChanges(id)
    return updated
  },
  /** draft/confirmed -> cancelled. Scheduled deliveries are cancelled and kept as history; delivered items block cancellation. */
  cancel(id: string, reason: string): Order {
    const existing = requireOrder(id)
    if (existing.status === 'cancelled') throw new OrderRuleError('This order is already cancelled.')
    if (hasDelivered(id)) throw new OrderRuleError('Orders with delivered items cannot be cancelled.')
    const updated = orderRepository.replace(id, { status: 'cancelled', cancellation: { reason: reason.trim(), cancelledOn: todayInBusinessZone() } })
    if (!updated) throw new OrderRuleError('Order not found.')
    deliveryService.reconcileOrderChanges(id)
    return updated
  },
  /** Live totals for the form: unchanged lines of an existing order keep their sold price, others use the catalog. Display only. */
  previewTotals(items: OrderItemInput[], existingOrderId?: string): OrderPreview {
    const previous = new Map((existingOrderId ? orderRepository.get(existingOrderId)?.items ?? [] : []).map(item => [item.id, item]))
    const lines: OrderPreviewLine[] = items.map(line => {
      const kept = line.id ? previous.get(line.id) : undefined
      const catalog = productService.getById(line.productId)?.variants.find(variant => variant.id === line.variantId)?.pricePaise
      const unit = kept && kept.variantId === line.variantId && kept.productId === line.productId ? kept.unitPricePaiseSnapshot : catalog
      const valid = typeof unit === 'number' && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= MAX_ITEM_QUANTITY
      return { unitPricePaise: typeof unit === 'number' ? unit : null, lineTotalPaise: valid ? calculateOrderTotals([{ unitPricePaise: unit, quantity: line.quantity }]).totalPaise : null }
    })
    const subtotalPaise = lines.reduce((sum, line) => sum + (line.lineTotalPaise ?? 0), 0)
    return { lines, subtotalPaise, totalPaise: subtotalPaise + (existingOrderId ? orderRepository.get(existingOrderId)?.adjustmentPaise ?? 0 : 0) }
  },
  /** Aggregate counts for the dashboard (no row lists). */
  getSummary(today: IsoDate = todayInBusinessZone()): OrderSummary {
    const tomorrow = addDays(today, 1)
    const orders = orderRepository.list()
    return {
      deliveringToday: orders.filter(order => order.status === 'confirmed' && order.deliveryDate === today).length,
      scheduledTomorrow: orders.filter(order => order.status === 'confirmed' && order.deliveryDate === tomorrow).length,
      pendingConfirmation: orders.filter(order => order.status === 'draft').length,
    }
  },
}
