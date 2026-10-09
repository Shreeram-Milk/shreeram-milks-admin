import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { addDays, todayInBusinessZone } from '@/lib/business-time'
import { deliveryService } from '../deliveries/service'
import { subscriptionService } from './service'
import type { SubscriptionInput } from './types'

declare const __resetStorage: () => void

const today = todayInBusinessZone()
const day = (offset: number) => addDays(today, offset)
const daily: SubscriptionInput['schedule'] = { scheduleType: 'daily', weekdays: [], alternatePatternDate: null }
const input = (changes: Partial<SubscriptionInput> = {}): SubscriptionInput => ({
  customerId: 'customer-rakesh', productId: 'product-cow-milk', variantId: 'cow-1000', schedule: daily, deliverySlotId: 'slot-morning', startDate: day(1), ...changes,
})
const forSubscription = (id: string) => deliveryService.getBySubscription(id).map(view => view.delivery)
const statusOn = (id: string, date: string) => forSubscription(id).find(item => item.deliveryDate === date)?.status

beforeEach(() => __resetStorage())

describe('subscription rules', () => {
  it('daily: PIN with both slots offers both; morning-only PIN rejects evening', () => {
    assert.equal(subscriptionService.resolveContext({ customerId: 'customer-rakesh', productId: 'product-cow-milk' }).eligibility?.allowedSlotIds.length, 2)
    assert.deepEqual(subscriptionService.resolveContext({ customerId: 'customer-meena', productId: 'product-cow-milk' }).eligibility?.allowedSlotIds, ['slot-morning'])
    assert.throws(() => subscriptionService.create(input({ customerId: 'customer-meena', deliverySlotId: 'slot-evening' })))
  })
  it('blocks unserviceable PINs, non-subscription products, past starts and empty weekday lists', () => {
    const blocked = subscriptionService.resolveContext({ customerId: 'customer-kiran', productId: 'product-cow-milk' })
    assert.equal(blocked.eligibility?.serviceable, false)
    assert.match(blocked.eligibility?.reason ?? '', /PIN 382999/)
    assert.throws(() => subscriptionService.create(input({ customerId: 'customer-kiran' })))
    assert.throws(() => subscriptionService.create(input({ productId: 'product-paneer' })))
    assert.throws(() => subscriptionService.create(input({ startDate: day(-2) })))
    assert.throws(() => subscriptionService.create(input({ schedule: { scheduleType: 'custom_weekdays', weekdays: [], alternatePatternDate: null } })))
  })
})

describe('delivery materialization', () => {
  it('creates deliveries for the next 14 days and never duplicates them', () => {
    const sub = subscriptionService.create(input({ startDate: day(1) }))
    assert.equal(forSubscription(sub.id).length, 13)
    deliveryService.materializeUpcoming()
    deliveryService.materializeUpcoming()
    deliveryService.reconcileSubscriptionChanges(sub.id)
    assert.equal(forSubscription(sub.id).length, 13)
    assert.ok(forSubscription(sub.id).every(item => item.status === 'scheduled' && item.sourceType === 'subscription' && item.customerPincode === '382010'))
  })
  it('freezes the address snapshot on the delivery', () => {
    const sub = subscriptionService.create(input())
    assert.equal(forSubscription(sub.id)[0].customerAddressSnapshot.locality, 'Sector 10')
  })
  it('custom weekdays only materialize on selected days', () => {
    const sub = subscriptionService.create(input({ startDate: day(1), schedule: { scheduleType: 'custom_weekdays', weekdays: [1, 3, 5], alternatePatternDate: null } }))
    const days = forSubscription(sub.id).map(item => new Date(`${item.deliveryDate}T00:00:00Z`).getUTCDay())
    assert.ok(days.length > 0 && days.every(value => [1, 3, 5].includes(value)))
  })
  it('alternate days alternate from the pattern date', () => {
    const sub = subscriptionService.create(input({ startDate: day(1), schedule: { scheduleType: 'alternate_days', weekdays: [], alternatePatternDate: day(1) } }))
    assert.deepEqual(forSubscription(sub.id).slice(0, 4).map(item => item.deliveryDate), [day(1), day(3), day(5), day(7)])
  })
})

describe('skip, pause, resume and cancel reconcile deliveries', () => {
  it('skip marks one delivery skipped and leaves the schedule daily', () => {
    const sub = subscriptionService.create(input({ startDate: day(1) }))
    subscriptionService.addDeliveryException({ subscriptionId: sub.id, date: day(3), type: 'skip' })
    assert.equal(statusOn(sub.id, day(2)), 'scheduled')
    assert.equal(statusOn(sub.id, day(3)), 'skipped')
    assert.equal(statusOn(sub.id, day(4)), 'scheduled')
    assert.equal(subscriptionService.getById(sub.id)?.schedule.scheduleType, 'daily')
  })
  it('pause cancels in-window deliveries (reason: paused); resume brings them back', () => {
    const sub = subscriptionService.create(input({ startDate: day(1) }))
    subscriptionService.pause(sub.id, { fromDate: day(3), resumeDate: null, reason: '' })
    assert.equal(statusOn(sub.id, day(2)), 'scheduled')
    for (const offset of [3, 4, 5, 9]) assert.equal(statusOn(sub.id, day(offset)), 'cancelled')
    assert.equal(forSubscription(sub.id).find(item => item.deliveryDate === day(4))?.cancellationReason, 'subscription_paused')
    subscriptionService.resume(sub.id, { resumeDate: day(6) })
    assert.equal(statusOn(sub.id, day(5)), 'cancelled')
    assert.equal(statusOn(sub.id, day(6)), 'scheduled')
    assert.equal(statusOn(sub.id, day(10)), 'scheduled')
  })
  it('cancel stops later deliveries but keeps them as cancelled history', () => {
    const sub = subscriptionService.create(input({ startDate: day(1) }))
    const total = forSubscription(sub.id).length
    subscriptionService.cancel(sub.id, { effectiveDate: day(5), reason: '' })
    assert.equal(statusOn(sub.id, day(5)), 'scheduled')
    assert.equal(statusOn(sub.id, day(6)), 'cancelled')
    assert.equal(forSubscription(sub.id).length, total)
  })
})

describe('delivery status actions', () => {
  it("marks today's delivery delivered with a timestamp and will not toggle it back", () => {
    const sub = subscriptionService.create(input({ startDate: today }))
    const todays = forSubscription(sub.id).find(item => item.deliveryDate === today)
    assert.ok(todays)
    deliveryService.markDelivered(todays.id)
    const after = deliveryService.getById(todays.id)?.delivery
    assert.equal(after?.status, 'delivered')
    assert.ok(after?.deliveredAt)
    assert.throws(() => deliveryService.markDelivered(todays.id))
    assert.throws(() => deliveryService.markNotDelivered(todays.id, { reason: 'customer_unavailable', notes: '' }))
  })
  it('marks not delivered with a reason, creates no financial side effects, and survives reconciliation', () => {
    const sub = subscriptionService.create(input({ startDate: today }))
    const todays = forSubscription(sub.id).find(item => item.deliveryDate === today)
    assert.ok(todays)
    assert.throws(() => deliveryService.markNotDelivered(todays.id, { reason: 'other', notes: '' }))
    deliveryService.markNotDelivered(todays.id, { reason: 'customer_unavailable', notes: 'Gate locked' })
    subscriptionService.cancel(sub.id, { effectiveDate: today, reason: '' })
    const stored = deliveryService.getById(todays.id)?.delivery
    assert.equal(stored?.status, 'not_delivered')
    assert.equal(stored?.notDeliveredReason, 'customer_unavailable')
    assert.equal(stored?.adminNotes, 'Gate locked')
  })
  it('does not allow marking a future delivery', () => {
    const sub = subscriptionService.create(input({ startDate: day(2) }))
    assert.throws(() => deliveryService.markDelivered(forSubscription(sub.id)[0].id))
  })
  it('list filters by date and slot and counts remaining vs delivered', () => {
    subscriptionService.create(input({ startDate: today }))
    subscriptionService.create(input({ startDate: today, deliverySlotId: 'slot-evening', variantId: 'cow-500' }))
    const all = deliveryService.list({ date: today, slotId: '', status: '', productId: '', search: '', page: 1, pageSize: 50 })
    const morning = deliveryService.list({ date: today, slotId: 'slot-morning', status: '', productId: '', search: '', page: 1, pageSize: 50 })
    const evening = deliveryService.list({ date: today, slotId: 'slot-evening', status: '', productId: '', search: '', page: 1, pageSize: 50 })
    assert.ok(morning.rows.every(row => row.delivery.deliverySlotId === 'slot-morning'))
    assert.ok(evening.rows.every(row => row.delivery.deliverySlotId === 'slot-evening'))
    assert.equal(morning.total + evening.total, all.total)
    assert.equal(all.summary.total, all.summary.remaining + all.summary.delivered)
  })
})
