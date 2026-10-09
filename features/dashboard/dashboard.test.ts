import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { addDays, todayInBusinessZone } from '@/lib/business-time'
import { customerService } from '../customers/service'
import { deliveryRepository } from '../deliveries/mock-repository'
import { deliveryService } from '../deliveries/service'
import { deliveryIdFor, type DeliveryInstance, type DeliveryStatus } from '../deliveries/types'
import { productService } from '../products/service'
import { subscriptionService } from '../subscriptions/service'
import { dashboardService } from './service'

declare const __resetStorage: () => void

const today = todayInBusinessZone()
const tomorrow = addDays(today, 1)

function delivery(id: string, status: DeliveryStatus, changes: Partial<DeliveryInstance> = {}): DeliveryInstance {
  return {
    id: deliveryIdFor(id, today, 'slot-morning'), deliveryDate: today, customerId: 'customer-rakesh', subscriptionId: id, productId: 'product-cow-milk', variantId: 'cow-1000', quantity: 1, unitPricePaiseSnapshot: 7000,
    deliverySlotId: 'slot-morning', fulfilmentProfileId: 'profile-gandhinagar', serviceAreaId: 'area-gandhinagar',
    customerAddressSnapshot: { line1: '', line2: '', locality: 'Sector 10', city: '', state: '', pinCode: '382010' }, customerPincode: '382010',
    status, sourceType: 'subscription', createdAt: '', updatedAt: '', deliveredAt: null, notDeliveredReason: null, skipReason: '', cancellationReason: null, adminNotes: '', ...changes,
  }
}

beforeEach(() => { __resetStorage(); deliveryService.materializeUpcoming() })

describe('dashboard summary', () => {
  it('delivery counts split planned / delivered / remaining / not delivered / skipped, overall and per slot', () => {
    const before = deliveryService.getDaySummary(today)
    const slot = (summary: typeof before, id: string) => summary.bySlot.find(item => item.slotId === id) ?? { planned: 0, delivered: 0, remaining: 0, notDelivered: 0, skipped: 0 }
    deliveryRepository.apply([delivery('a', 'scheduled'), delivery('b', 'delivered'), delivery('c', 'not_delivered'), delivery('d', 'skipped'), delivery('e', 'cancelled'), delivery('f', 'scheduled', { deliverySlotId: 'slot-evening' })], [])
    const after = deliveryService.getDaySummary(today)
    // Morning gained: 1 scheduled, 1 delivered, 1 not delivered, 1 skipped (cancelled counts for nothing).
    assert.deepEqual([slot(after, 'slot-morning').remaining - slot(before, 'slot-morning').remaining, slot(after, 'slot-morning').delivered - slot(before, 'slot-morning').delivered, slot(after, 'slot-morning').notDelivered - slot(before, 'slot-morning').notDelivered, slot(after, 'slot-morning').skipped - slot(before, 'slot-morning').skipped], [1, 1, 1, 1])
    assert.equal(slot(after, 'slot-evening').remaining - slot(before, 'slot-evening').remaining, 1)
    assert.equal(after.planned - before.planned, 4, 'skipped and cancelled are not planned work')
    assert.equal(after.planned, after.delivered + after.remaining + after.notDelivered)
    assert.equal(after.planned, after.bySlot.reduce((total, item) => total + item.planned, 0))
    assert.equal(dashboardService.getSummary().deliveriesToday.planned, after.planned)
  })
  it('tomorrow’s production lists per-slot quantities without mixing units', () => {
    const production = dashboardService.getSummary().tomorrowProduction
    assert.ok(production.length >= 1)
    for (const slot of production) {
      const keys = slot.items.map(item => `${item.productName}|${item.unit}`)
      assert.equal(new Set(keys).size, keys.length)
    }
  })
})

describe('dashboard issues', () => {
  it('is empty when nothing is wrong with the data it checks', () => {
    const summary = dashboardService.getSummary()
    assert.ok(summary.issues.every(issue => issue.kind === 'subscription' || issue.kind === 'production'))
  })
  it('reports missing production conversion for tomorrow, linked to the product', () => {
    const cow = productService.getById('product-cow-milk')
    assert.ok(cow)
    productService.save({ ...cow, variants: cow.variants.map(variant => variant.id === 'cow-1000' ? { ...variant, productionUnit: '', productionQuantity: 0 } : variant) })
    subscriptionService.create({ customerId: 'customer-rakesh', productId: 'product-cow-milk', variantId: 'cow-1000', schedule: { scheduleType: 'daily', weekdays: [], alternatePatternDate: null }, deliverySlotId: 'slot-morning', startDate: tomorrow })
    const issue = dashboardService.getSummary().issues.find(item => item.kind === 'production')
    assert.ok(issue)
    assert.equal(issue.href, '/products/product-cow-milk')
    assert.match(issue.detail, /Missing production conversion/)
  })
  it('reports a delivered credit delivery with no price snapshot as a failed financial posting', () => {
    const customer = customerService.create({ fullName: 'Issue Credit', mobile: '9000000005', email: '', status: 'active', customerType: 'credit', line1: '1 Road', line2: '', locality: 'Sector 10', city: 'Gandhinagar', state: 'Gujarat', pinCode: '382010', notes: '' })
    const broken = delivery('broken', 'delivered', { customerId: customer.id, unitPricePaiseSnapshot: null, deliveryDate: addDays(today, -1), id: 'delivery-broken' })
    deliveryRepository.apply([broken], [])
    const issue = dashboardService.getSummary().issues.find(item => item.kind === 'credit_posting')
    assert.ok(issue)
    assert.equal(issue.href, '/deliveries/delivery-broken')
    assert.match(issue.detail, /not charged/)
  })
  it('reports inactive referenced configuration on upcoming deliveries', () => {
    subscriptionService.create({ customerId: 'customer-rakesh', productId: 'product-cow-milk', variantId: 'cow-1000', schedule: { scheduleType: 'daily', weekdays: [], alternatePatternDate: null }, deliverySlotId: 'slot-morning', startDate: tomorrow })
    const cow = productService.getById('product-cow-milk')
    assert.ok(cow)
    productService.save({ ...cow, variants: cow.variants.map(variant => variant.id === 'cow-1000' ? { ...variant, status: 'inactive' as const } : variant) })
    assert.ok(dashboardService.getSummary().issues.some(item => item.kind === 'inactive_config' && /variant/.test(item.detail)))
  })
  it('caps the list but still counts every issue', () => {
    const rows = Array.from({ length: 12 }, (_, index) => delivery(`bad-${index}`, 'scheduled', { customerPincode: '999999', customerAddressSnapshot: { line1: '', line2: '', locality: 'X', city: '', state: '', pinCode: '999999' } }))
    deliveryRepository.apply(rows, [])
    const summary = dashboardService.getSummary()
    assert.ok(summary.issues.length <= 8)
    assert.ok(summary.issueTotal >= 12)
  })
})
