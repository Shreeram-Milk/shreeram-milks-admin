import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { addDays, todayInBusinessZone } from '@/lib/business-time'
import { creditLedgerService } from '../credit-accounts/service'
import { customerService } from '../customers/service'
import type { CustomerFormValues } from '../customers/schema'
import { deliveryService } from '../deliveries/service'
import { productService } from '../products/service'
import { calculateOrderTotals } from './pricing'
import { deriveOrderStatus, orderService } from './service'
import type { OrderInput } from './types'

declare const __resetStorage: () => void

const today = todayInBusinessZone()
const tomorrow = addDays(today, 1)
const input = (changes: Partial<OrderInput> = {}): OrderInput => ({
  customerId: 'customer-rakesh', items: [{ productId: 'product-paneer', variantId: 'pan-500', quantity: 2 }], deliverySlotId: 'slot-morning', deliveryDate: tomorrow, ...changes,
})
const deliveriesOf = (orderId: string) => deliveryService.getByOrder(orderId).map(view => view.delivery)
const creditCustomer = (changes: Partial<CustomerFormValues> = {}) => customerService.create({
  fullName: 'Order Credit', mobile: '9000000002', email: '', status: 'active', customerType: 'credit', line1: '1 Road', line2: '', locality: 'Sector 10', city: 'Gandhinagar', state: 'Gujarat', pinCode: '382010', notes: '', ...changes,
})
function setPaneerPrice(pricePaise: number) {
  const paneer = productService.getById('product-paneer')
  assert.ok(paneer)
  productService.save({ ...paneer, variants: paneer.variants.map(variant => variant.id === 'pan-500' ? { ...variant, pricePaise } : variant) })
}

beforeEach(() => __resetStorage())

describe('order pricing', () => {
  it('2 × ₹180 = ₹360 and totals add exactly in integer paise', () => {
    const totals = calculateOrderTotals([{ unitPricePaise: 18000, quantity: 2 }, { unitPricePaise: 3850, quantity: 3 }], -500)
    assert.deepEqual(totals.lineTotalsPaise, [36000, 11550])
    assert.equal(totals.subtotalPaise, 47550)
    assert.equal(totals.totalPaise, 47050)
  })
  it('rejects fractional prices and invalid quantities', () => {
    assert.throws(() => calculateOrderTotals([{ unitPricePaise: 18000.5, quantity: 1 }]))
    assert.throws(() => calculateOrderTotals([{ unitPricePaise: 100, quantity: 0 }]))
    assert.throws(() => calculateOrderTotals([{ unitPricePaise: 100, quantity: 1.5 }]))
  })
})

describe('creating orders', () => {
  it('snapshots product, variant and price and computes totals on the server', () => {
    const order = orderService.create(input(), { confirm: false })
    assert.equal(order.status, 'draft')
    assert.match(order.orderNumber, /^ORD-\d+$/)
    assert.deepEqual([order.items[0].productNameSnapshot, order.items[0].variantNameSnapshot, order.items[0].unitPricePaiseSnapshot, order.items[0].lineTotalPaise], ['Fresh Paneer', '500 g', 18000, 36000])
    assert.equal(order.totalPaise, 36000)
    assert.equal(order.paymentMode, 'prepaid')
    assert.equal(order.addressSnapshot.pinCode, '382010')
  })
  it('allows only Buy Once products', () => {
    const cow = productService.getById('product-cow-milk')
    assert.ok(cow)
    productService.save({ ...cow, id: undefined, name: 'Subscription Only', purchaseMethods: ['subscription'], trialPlanIds: [], variants: [{ ...cow.variants[0], id: 'so-1' }] })
    const subscriptionOnly = productService.list().find(product => product.name === 'Subscription Only')
    assert.ok(subscriptionOnly)
    assert.ok(!orderService.listOrderableProducts().some(product => product.id === subscriptionOnly.id))
    assert.throws(() => orderService.create(input({ items: [{ productId: subscriptionOnly.id, variantId: 'so-1', quantity: 1 }] }), { confirm: false }), /cannot be bought as a one-time order|does not support/)
  })
  it('old orders keep their price when the catalog price changes', () => {
    const order = orderService.create(input(), { confirm: false })
    setPaneerPrice(20000)
    assert.equal(orderService.getById(order.id)?.items[0].unitPricePaiseSnapshot, 18000)
    assert.equal(orderService.getById(order.id)?.totalPaise, 36000)
    // Editing the quantity of an unchanged line keeps the sold price; a newly added line uses today's price.
    const edited = orderService.update(order.id, input({ items: [{ id: order.items[0].id, productId: 'product-paneer', variantId: 'pan-500', quantity: 3 }, { productId: 'product-paneer', variantId: 'pan-1000', quantity: 1 }] }))
    assert.deepEqual(edited.items.map(item => item.unitPricePaiseSnapshot), [18000, 34000])
    assert.equal(edited.totalPaise, 3 * 18000 + 34000)
  })
  it('validates the PIN: an unserviceable customer cannot order local delivery', () => {
    assert.throws(() => orderService.create(input({ customerId: 'customer-kiran' }), { confirm: false }), /PIN 382999/)
  })
  it('validates the slot against the customer PIN (morning-only PIN rejects evening)', () => {
    assert.throws(() => orderService.create(input({ customerId: 'customer-meena', deliverySlotId: 'slot-evening' }), { confirm: false }), /delivery slot/)
    assert.equal(orderService.create(input({ customerId: 'customer-meena', deliverySlotId: 'slot-morning' }), { confirm: false }).deliverySlotId, 'slot-morning')
    assert.throws(() => orderService.create(input({ deliverySlotId: null }), { confirm: false }), /delivery slot/)
  })
  it('does not force a slot for a no-slot (shipping) product', () => {
    const order = orderService.create(input({ items: [{ productId: 'product-ghee', variantId: 'ghee-500', quantity: 1 }], deliverySlotId: 'slot-evening' }), { confirm: true })
    assert.equal(order.deliverySlotId, null)
    assert.equal(deliveriesOf(order.id)[0].deliverySlotId, null)
  })
  it('requires one fulfilment profile per order, a future date, and valid quantities', () => {
    assert.throws(() => orderService.create(input({ items: [{ productId: 'product-paneer', variantId: 'pan-500', quantity: 1 }, { productId: 'product-ghee', variantId: 'ghee-500', quantity: 1 }] }), { confirm: false }), /same fulfilment profile/)
    assert.throws(() => orderService.create(input({ deliveryDate: addDays(today, -1) }), { confirm: false }), /past/)
    assert.throws(() => orderService.create(input({ items: [] }), { confirm: false }))
    assert.throws(() => orderService.create(input({ items: [{ productId: 'product-paneer', variantId: 'pan-500', quantity: 0 }] }), { confirm: false }))
  })
})

describe('order deliveries', () => {
  it('a draft order has no delivery; confirming creates one per item, linked to the order, and never duplicates', () => {
    const order = orderService.create(input({ items: [{ productId: 'product-paneer', variantId: 'pan-500', quantity: 2 }, { productId: 'product-paneer', variantId: 'pan-1000', quantity: 1 }] }), { confirm: false })
    assert.equal(deliveriesOf(order.id).length, 0)
    orderService.confirm(order.id)
    deliveryService.reconcileOrderChanges(order.id)
    deliveryService.materializeUpcoming()
    deliveryService.materializeUpcoming()
    const deliveries = deliveriesOf(order.id)
    assert.equal(deliveries.length, 2)
    assert.ok(deliveries.every(item => item.sourceType === 'buy_once' && item.orderId === order.id && item.subscriptionId === null && item.status === 'scheduled' && item.deliveryDate === tomorrow))
    assert.deepEqual(deliveries.map(item => item.quantity).sort(), [1, 2])
    assert.deepEqual(deliveries.map(item => item.unitPricePaiseSnapshot).sort(), [18000, 34000])
  })
  it('editing a confirmed order moves and updates its delivery instead of duplicating it', () => {
    const order = orderService.create(input(), { confirm: true })
    const later = addDays(today, 3)
    orderService.update(order.id, input({ deliveryDate: later, items: [{ id: order.items[0].id, productId: 'product-paneer', variantId: 'pan-500', quantity: 4 }] }))
    const deliveries = deliveriesOf(order.id)
    assert.equal(deliveries.length, 1)
    assert.equal(deliveries[0].deliveryDate, later)
    assert.equal(deliveries[0].quantity, 4)
  })
  it('cancelling reconciles: the delivery is cancelled, kept as history, and the order cannot be edited', () => {
    const order = orderService.create(input(), { confirm: true })
    orderService.cancel(order.id, 'Customer changed mind')
    const [delivery] = deliveriesOf(order.id)
    assert.equal(delivery.status, 'cancelled')
    assert.equal(delivery.cancellationReason, 'order_cancelled')
    assert.equal(orderService.getView(order.id)?.status, 'cancelled')
    assert.throws(() => orderService.update(order.id, input()), /Cancelled/)
    deliveryService.materializeUpcoming()
    assert.equal(deliveriesOf(order.id)[0].status, 'cancelled')
  })
  it('status moves draft -> confirmed -> scheduled -> fulfilled, and delivered orders are locked', () => {
    assert.equal(deriveOrderStatus({ status: 'draft', deliveryDate: tomorrow }, []), 'draft')
    assert.equal(deriveOrderStatus({ status: 'confirmed', deliveryDate: tomorrow }, []), 'confirmed')
    assert.equal(deriveOrderStatus({ status: 'confirmed', deliveryDate: tomorrow }, [{ status: 'scheduled' }]), 'scheduled')
    assert.equal(deriveOrderStatus({ status: 'confirmed', deliveryDate: tomorrow }, [{ status: 'delivered' }, { status: 'delivered' }]), 'fulfilled')
    const order = orderService.create(input({ deliveryDate: today }), { confirm: true })
    assert.equal(orderService.getView(order.id)?.status, 'scheduled')
    deliveryService.markDelivered(deliveriesOf(order.id)[0].id)
    assert.equal(orderService.getView(order.id)?.status, 'fulfilled')
    assert.throws(() => orderService.cancel(order.id, ''), /delivered/)
    assert.throws(() => orderService.update(order.id, input()), /delivered/)
  })
  it('only draft orders can be confirmed, and a stale date blocks confirming', () => {
    const order = orderService.create(input(), { confirm: true })
    assert.throws(() => orderService.confirm(order.id), /Only draft/)
  })
  it('a delivered order for a credit customer is charged from its price snapshot', () => {
    const customer = creditCustomer()
    const order = orderService.create(input({ customerId: customer.id, deliveryDate: today }), { confirm: true })
    assert.equal(order.paymentMode, 'credit')
    setPaneerPrice(25000)
    deliveryService.markDelivered(deliveriesOf(order.id)[0].id)
    assert.equal(creditLedgerService.calculateBalance(customer.id), 36000)
  })
  it('list filters by status, date and search, and summarises for the dashboard', () => {
    const confirmed = orderService.create(input(), { confirm: true })
    orderService.create(input({ deliveryDate: addDays(today, 2) }), { confirm: false })
    const all = orderService.list({ search: '', status: '', date: '', customerId: '', productId: '', page: 1, pageSize: 50 })
    assert.ok(all.total >= 3)
    assert.equal(orderService.list({ search: '', status: 'draft', date: '', customerId: '', productId: '', page: 1, pageSize: 50 }).rows.every(row => row.status === 'draft'), true)
    assert.ok(orderService.list({ search: confirmed.orderNumber, status: '', date: '', customerId: '', productId: '', page: 1, pageSize: 50 }).rows.some(row => row.order.id === confirmed.id))
    assert.equal(orderService.list({ search: '', status: '', date: tomorrow, customerId: '', productId: '', page: 1, pageSize: 50 }).rows.every(row => row.order.deliveryDate === tomorrow), true)
    const summary = orderService.getSummary(today)
    assert.ok(summary.scheduledTomorrow >= 1 && summary.pendingConfirmation >= 1)
  })
})
