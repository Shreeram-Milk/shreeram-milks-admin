import { addDays, todayInBusinessZone, type IsoDate } from '@/lib/business-time'
import { deliverySlotService, fulfilmentProfileService, serviceAreaService } from '../configuration/mock-store'
import type { DeliverySlot, FulfilmentProfile, ServiceArea } from '../configuration/types'
import { getPrimaryAddress } from '../customers/address'
import { customerService } from '../customers/service'
import type { Customer } from '../customers/types'
import { productService } from '../products/service'
import type { Product, ProductVariant } from '../products/types'
import { resolveSubscriptionEligibility } from '../subscriptions/eligibility'
import { subscriptionRepository } from '../subscriptions/mock-repository'
import type { Subscription } from '../subscriptions/types'
import type { Order } from '../orders/types'
import type { TrialEnrollment } from '../trials/types'
import { creditAccountService, creditLedgerService } from '../credit-accounts/service'
import { prepaidAdjustmentService } from '../prepaid-adjustments/service'
import { buildOrderDeliveryDrafts } from '../orders/delivery-drafts'
import { orderRepository } from '../orders/mock-repository'
import { buildTrialDeliveryDrafts } from '../trials/generation'
import { trialRepository } from '../trials/mock-repository'
import { generateSubscriptionDeliveries } from './generation'
import { deliveryRepository } from './mock-repository'
import { reconcileOneOffDeliveries, type OneOffDeliveryDraft } from './oneoff'
import { reconcileDeliveries } from './reconcile'
import { deliveryIdFor, type CustomerAddressSnapshot, type DeliveryDraft, type DeliveryInstance, type DeliveryStatus, type NotDeliveredReasonCode } from './types'

export class DeliveryRuleError extends Error {}

/** How far ahead deliveries are materialised. Short on purpose: months of records are never created. */
export const MATERIALIZE_DAYS = 14
const HISTORY_BACKFILL_DAYS = 7

export type DeliveryView = {
  delivery: DeliveryInstance
  customer: Customer | undefined
  product: Product | undefined
  variant: ProductVariant | undefined
  slot: DeliverySlot | undefined
  profile: FulfilmentProfile | undefined
  area: ServiceArea | undefined
  /** Operational warning such as an unserviceable PIN; never blocks display. */
  warning: string | null
  inactive: { product: boolean; variant: boolean; slot: boolean; profile: boolean; area: boolean }
}

export type DeliveryListQuery = {
  date: IsoDate
  slotId: string
  status: DeliveryStatus | ''
  productId: string
  search: string
  page: number
  pageSize: number
}

export type DaySlotSummary = { slotId: string | null; slotName: string; planned: number; delivered: number; remaining: number; notDelivered: number; skipped: number }
export type DaySummary = DaySlotSummary & { bySlot: DaySlotSummary[] }

export type DeliverySummary = { total: number; delivered: number; remaining: number; bySlot: Array<{ slotId: string | null; slotName: string; count: number }> }

type Lookups = {
  customers: Map<string, Customer>
  products: Map<string, Product>
  slots: Map<string, DeliverySlot>
  profiles: Map<string, FulfilmentProfile>
  areas: Map<string, ServiceArea>
}

function loadLookups(): Lookups {
  return {
    customers: new Map(customerService.listAll().map(item => [item.id, item])),
    products: new Map(productService.list().map(item => [item.id, item])),
    slots: new Map(deliverySlotService.list().map(item => [item.id, item])),
    profiles: new Map(fulfilmentProfileService.list().map(item => [item.id, item])),
    areas: new Map(serviceAreaService.list().map(item => [item.id, item])),
  }
}

function toSnapshot(customer: Customer): CustomerAddressSnapshot {
  const address = getPrimaryAddress(customer)
  return { line1: address?.line1 ?? '', line2: address?.line2 ?? '', locality: address?.locality ?? '', city: address?.city ?? '', state: address?.state ?? '', pinCode: address?.pinCode ?? '' }
}

function warningFor(delivery: DeliveryInstance, lookups: Lookups, product: Product | undefined, profile: FulfilmentProfile | undefined, area: ServiceArea | undefined): string | null {
  if (delivery.status !== 'scheduled') return null
  if (!product || !profile) return 'The product or its fulfilment profile no longer exists.'
  const snapshot = delivery.customerAddressSnapshot
  const eligibility = resolveSubscriptionEligibility({
    customer: { addresses: [{ id: 'snapshot', ...snapshot, isPrimary: true }] },
    product: { status: 'active', purchaseMethods: ['subscription'] },
    fulfilmentProfile: profile,
    serviceArea: area,
    deliverySlots: [...lookups.slots.values()],
  })
  if (!eligibility.serviceable) return eligibility.reason
  if (eligibility.slotRequired && delivery.deliverySlotId && !eligibility.allowedSlotIds.includes(delivery.deliverySlotId)) {
    const slotName = lookups.slots.get(delivery.deliverySlotId)?.name ?? 'This delivery slot'
    return `${slotName} is no longer available for PIN ${snapshot.pinCode}.`
  }
  return null
}

/** Resolves every relationship once per call (maps), never per row. */
function toViews(deliveries: DeliveryInstance[]): DeliveryView[] {
  const lookups = loadLookups()
  return deliveries.map(delivery => {
    const product = lookups.products.get(delivery.productId)
    const variant = product?.variants.find(item => item.id === delivery.variantId)
    const slot = delivery.deliverySlotId ? lookups.slots.get(delivery.deliverySlotId) : undefined
    const profile = lookups.profiles.get(delivery.fulfilmentProfileId)
    const area = lookups.areas.get(delivery.serviceAreaId)
    return {
      delivery, product, variant, slot, profile, area,
      customer: lookups.customers.get(delivery.customerId),
      warning: warningFor(delivery, lookups, product, profile, area),
      inactive: { product: product?.status === 'inactive', variant: variant?.status === 'inactive', slot: slot?.status === 'inactive', profile: profile?.status === 'inactive', area: area?.status === 'inactive' },
    }
  })
}

function draftToInstance(draft: DeliveryDraft, subscription: Subscription, lookups: Lookups): DeliveryInstance | null {
  const customer = lookups.customers.get(subscription.customerId)
  const product = lookups.products.get(draft.productId)
  if (!customer || !product) return null
  const profile = lookups.profiles.get(product.fulfilmentProfileId)
  const snapshot = toSnapshot(customer)
  const price = product.variants.find(item => item.id === draft.variantId)?.pricePaise
  const stamp = new Date().toISOString()
  return {
    id: deliveryIdFor(draft.subscriptionId, draft.deliveryDate, draft.deliverySlotId),
    deliveryDate: draft.deliveryDate, customerId: customer.id, subscriptionId: draft.subscriptionId,
    productId: draft.productId, variantId: draft.variantId, quantity: draft.quantity, unitPricePaiseSnapshot: typeof price === 'number' ? price : null, deliverySlotId: draft.deliverySlotId,
    fulfilmentProfileId: product.fulfilmentProfileId, serviceAreaId: profile?.serviceAreaId ?? '',
    customerAddressSnapshot: snapshot, customerPincode: snapshot.pinCode,
    status: draft.status, sourceType: 'subscription', createdAt: stamp, updatedAt: stamp,
    deliveredAt: null, notDeliveredReason: null, skipReason: draft.skipReason, cancellationReason: null, adminNotes: '',
  }
}

/** One-time demo history so customer/subscription history tabs have content. Marked delivered, never scheduled. */
function backfillHistory(today: IsoDate, lookups: Lookups) {
  if (deliveryRepository.isBootstrapped()) return
  const from = addDays(today, -HISTORY_BACKFILL_DAYS)
  const to = addDays(today, -1)
  const inserts: DeliveryInstance[] = []
  for (const subscription of subscriptionRepository.list()) {
    const drafts = generateSubscriptionDeliveries({ subscription, fromDate: from, toDate: to, existingExceptions: subscriptionRepository.listExceptions(subscription.id) })
    for (const draft of drafts) {
      const instance = draftToInstance(draft, subscription, lookups)
      if (!instance) continue
      inserts.push(draft.status === 'skipped' ? instance : { ...instance, status: 'delivered', deliveredAt: `${draft.deliveryDate}T02:30:00.000Z` })
    }
  }
  deliveryRepository.apply(inserts, [])
  deliveryRepository.markBootstrapped()
}

/** One-time upgrade of records written before price snapshots existed; records already marked `null` stay flagged. */
function migrateLegacyPriceSnapshots(lookups: Lookups): void {
  const legacy = deliveryRepository.list().filter(item => item.unitPricePaiseSnapshot === undefined)
  if (!legacy.length) return
  deliveryRepository.apply([], legacy.map(item => {
    const price = lookups.products.get(item.productId)?.variants.find(variant => variant.id === item.variantId)?.pricePaise
    return { id: item.id, patch: { unitPricePaiseSnapshot: typeof price === 'number' ? price : null } }
  }))
}

function reconcileSubscriptions(subscriptions: Subscription[], days: number): void {
  const today = todayInBusinessZone()
  const windowTo = addDays(today, days - 1)
  const lookups = loadLookups()
  backfillHistory(today, lookups)
  migrateLegacyPriceSnapshots(lookups)
  const stored = deliveryRepository.listBetween(today, windowTo)
  const inserts: DeliveryInstance[] = []
  const updates: Array<{ id: string; patch: Partial<DeliveryInstance> }> = []
  for (const subscription of subscriptions) {
    const existing = stored.filter(item => item.subscriptionId === subscription.id)
    const drafts = generateSubscriptionDeliveries({ subscription, fromDate: today, toDate: windowTo, existingExceptions: subscriptionRepository.listExceptions(subscription.id) })
    const changes = reconcileDeliveries({ subscription, existing, drafts, windowFrom: today, windowTo, today })
    for (const draft of changes.inserts) { const instance = draftToInstance(draft, subscription, lookups); if (instance) inserts.push(instance) }
    updates.push(...changes.updates)
  }
  deliveryRepository.apply(inserts, updates)
}

function oneOffToInstance(draft: OneOffDeliveryDraft, lookups: Lookups): DeliveryInstance | null {
  const customer = lookups.customers.get(draft.customerId)
  const product = lookups.products.get(draft.productId)
  if (!customer || !product) return null
  const profile = lookups.profiles.get(product.fulfilmentProfileId)
  const snapshot = draft.addressSnapshot ?? toSnapshot(customer)
  const stamp = new Date().toISOString()
  return {
    id: draft.id, deliveryDate: draft.deliveryDate, customerId: customer.id, subscriptionId: null,
    orderId: draft.orderId, orderItemId: draft.orderItemId, trialEnrollmentId: draft.trialEnrollmentId,
    productId: draft.productId, variantId: draft.variantId, quantity: draft.quantity, unitPricePaiseSnapshot: draft.unitPricePaise, deliverySlotId: draft.deliverySlotId,
    fulfilmentProfileId: product.fulfilmentProfileId, serviceAreaId: profile?.serviceAreaId ?? '',
    customerAddressSnapshot: snapshot, customerPincode: snapshot.pinCode,
    status: 'scheduled', sourceType: draft.sourceType, createdAt: stamp, updatedAt: stamp,
    deliveredAt: null, notDeliveredReason: null, skipReason: '', cancellationReason: null, adminNotes: '',
  }
}

/** Orders and trials own their deliveries the same way subscriptions do: reconcile, never delete. */
function reconcileOneOffOwners(owners: Array<{ drafts: OneOffDeliveryDraft[]; existing: DeliveryInstance[]; cancelReason: 'order_cancelled' | 'trial_cancelled' }>): void {
  const today = todayInBusinessZone()
  const lookups = loadLookups()
  const inserts: DeliveryInstance[] = []
  const updates: Array<{ id: string; patch: Partial<DeliveryInstance> }> = []
  for (const owner of owners) {
    const changes = reconcileOneOffDeliveries({ existing: owner.existing, drafts: owner.drafts, today, cancelReason: owner.cancelReason })
    for (const draft of changes.inserts) { const instance = oneOffToInstance(draft, lookups); if (instance) inserts.push(instance) }
    updates.push(...changes.updates)
  }
  deliveryRepository.apply(inserts, updates)
}

function reconcileOrders(orders: Order[]): void {
  reconcileOneOffOwners(orders.map(order => ({ drafts: buildOrderDeliveryDrafts(order), existing: deliveryRepository.listForOrder(order.id), cancelReason: 'order_cancelled' as const })))
}

function reconcileTrials(trials: TrialEnrollment[]): void {
  reconcileOneOffOwners(trials.map(trial => ({ drafts: buildTrialDeliveryDrafts(trial), existing: deliveryRepository.listForTrial(trial.id), cancelReason: 'trial_cancelled' as const })))
}

function requireScheduled(id: string): DeliveryInstance {
  const delivery = deliveryRepository.get(id)
  if (!delivery) throw new DeliveryRuleError('Delivery not found.')
  if (delivery.status === 'delivered' && creditLedgerService.getEntryByReference('delivery', id)) throw new DeliveryRuleError('This delivery has already created a financial ledger entry. Use a financial correction workflow.')
  if (delivery.status !== 'scheduled') throw new DeliveryRuleError('Only scheduled deliveries can be updated.')
  if (delivery.deliveryDate > todayInBusinessZone()) throw new DeliveryRuleError('This delivery is in the future and cannot be marked yet.')
  return delivery
}

export const deliveryService = {
  list({ date, slotId, status, productId, search, page, pageSize }: DeliveryListQuery): { rows: DeliveryView[]; total: number; summary: DeliverySummary } {
    const dayViews = toViews(deliveryRepository.listForDate(date))
    const term = search.trim().toLowerCase()
    const matches = dayViews.filter(view => {
      const { delivery } = view
      if (slotId && delivery.deliverySlotId !== slotId) return false
      if (status && delivery.status !== status) return false
      if (productId && delivery.productId !== productId) return false
      if (!term) return true
      return [view.customer?.fullName, view.customer?.mobile, view.product?.name, view.variant?.name, delivery.customerPincode].join(' ').toLowerCase().includes(term)
    }).sort((a, b) => (a.slot?.startTime ?? '').localeCompare(b.slot?.startTime ?? '') || (a.customer?.fullName ?? '').localeCompare(b.customer?.fullName ?? ''))

    const counted = dayViews.filter(view => ['scheduled', 'delivered', 'not_delivered'].includes(view.delivery.status))
    const slotCounts = new Map<string | null, number>()
    for (const view of counted) slotCounts.set(view.delivery.deliverySlotId, (slotCounts.get(view.delivery.deliverySlotId) ?? 0) + 1)
    const summary: DeliverySummary = {
      total: counted.length,
      delivered: counted.filter(view => view.delivery.status === 'delivered').length,
      remaining: counted.filter(view => view.delivery.status === 'scheduled').length,
      bySlot: [...slotCounts.entries()].map(([id, count]) => ({ slotId: id, slotName: id ? loadSlotName(id) : 'No slot', count })),
    }
    return { rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, summary }
  },
  /** Counts for one day, overall and per slot. `planned` = scheduled + delivered + not delivered (skipped and cancelled aren't planned work). */
  getDaySummary(date: IsoDate): DaySummary {
    const slotNames = new Map(deliverySlotService.list().map(slot => [slot.id, slot.name]))
    const blank = (slotId: string | null, slotName: string): DaySlotSummary => ({ slotId, slotName, planned: 0, delivered: 0, remaining: 0, notDelivered: 0, skipped: 0 })
    const total = blank(null, 'All slots')
    const slots = new Map<string | null, DaySlotSummary>()
    for (const delivery of deliveryRepository.listForDate(date)) {
      const slot = slots.get(delivery.deliverySlotId) ?? blank(delivery.deliverySlotId, delivery.deliverySlotId ? slotNames.get(delivery.deliverySlotId) ?? 'Unavailable slot' : 'No slot')
      slots.set(delivery.deliverySlotId, slot)
      for (const target of [total, slot]) {
        if (delivery.status === 'scheduled') { target.planned += 1; target.remaining += 1 }
        else if (delivery.status === 'delivered') { target.planned += 1; target.delivered += 1 }
        else if (delivery.status === 'not_delivered') { target.planned += 1; target.notDelivered += 1 }
        else if (delivery.status === 'skipped') target.skipped += 1
      }
    }
    return { ...total, bySlot: [...slots.values()].sort((a, b) => a.slotName.localeCompare(b.slotName)) }
  },
  getById(id: string): DeliveryView | undefined {
    const delivery = deliveryRepository.get(id)
    return delivery ? toViews([delivery])[0] : undefined
  },
  /** Raw records for one day, for aggregation features such as Production Planning. */
  listForDate: (date: IsoDate, slotId?: string) => deliveryRepository.listForDate(date).filter(item => !slotId || item.deliverySlotId === slotId),
  getByDate: (date: IsoDate) => toViews(deliveryRepository.listForDate(date)),
  getByOrder: (orderId: string) => toViews(deliveryRepository.listForOrder(orderId).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))),
  getByTrial: (trialId: string) => toViews(deliveryRepository.listForTrial(trialId).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))),
  getBySubscription: (subscriptionId: string) => toViews(deliveryRepository.listForSubscription(subscriptionId).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))),
  getByCustomer: (customerId: string) => toViews(deliveryRepository.listForCustomer(customerId).sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))),
  /** Mock stand-in for a scheduled job: idempotently ensures the next `days` days of deliveries exist. */
  materializeUpcoming(days: number = MATERIALIZE_DAYS): void {
    reconcileSubscriptions(subscriptionRepository.list(), Math.min(days, MATERIALIZE_DAYS * 2))
    reconcileOrders(orderRepository.list())
    reconcileTrials(trialRepository.list())
    // Catch-up for delivered credit deliveries that predate the ledger; idempotent.
    creditAccountService.reconcileDeliveredCharges()
    prepaidAdjustmentService.reconcileAll()
  },
  /** Called whenever a subscription changes (create/edit/pause/resume/cancel/skip). */
  reconcileSubscriptionChanges(subscriptionId: string, days: number = MATERIALIZE_DAYS): void {
    const subscription = subscriptionRepository.get(subscriptionId)
    if (subscription) reconcileSubscriptions([subscription], days)
  },
  /** Called whenever an order changes (confirm, edit, cancel). */
  reconcileOrderChanges(orderId: string): void {
    const order = orderRepository.get(orderId)
    if (order) reconcileOrders([order])
  },
  /** Called whenever a trial changes (create, cancel). */
  reconcileTrialChanges(trialId: string): void {
    const trial = trialRepository.get(trialId)
    if (trial) reconcileTrials([trial])
  },
  markDelivered(id: string): DeliveryInstance {
    const delivery = requireScheduled(id)
    deliveryRepository.apply([], [{ id, patch: { status: 'delivered', deliveredAt: new Date().toISOString() } }])
    const delivered = deliveryRepository.get(id) ?? { ...delivery, status: 'delivered' as const }
    // Credit customers are charged only once a delivery is actually delivered (idempotent; prepaid is ignored).
    // An unpriceable delivery is reported on the account as an accounting issue and never blocks the delivery itself.
    creditLedgerService.postDeliveryCharge(delivered)
    return delivered
  },
  markNotDelivered(id: string, { reason, notes }: { reason: NotDeliveredReasonCode; notes: string }): DeliveryInstance {
    const delivery = requireScheduled(id)
    if (reason === 'other' && !notes.trim()) throw new DeliveryRuleError('Add a note when the reason is Other.')
    // A not-delivered delivery creates no refund, credit or prepaid adjustment: the business has not defined that policy.
    deliveryRepository.apply([], [{ id, patch: { status: 'not_delivered', notDeliveredReason: reason, adminNotes: notes.trim() } }])
    return { ...delivery, status: 'not_delivered' }
  },
}

function loadSlotName(id: string): string {
  return deliverySlotService.getById(id)?.name ?? 'Unavailable slot'
}
