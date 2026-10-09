import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Subscription, SubscriptionDeliveryException } from '../subscriptions/types'
import { generateSubscriptionDeliveries } from './generation'
import { reconcileDeliveries } from './reconcile'
import { deliveryIdFor, deliveryKey, type DeliveryInstance } from './types'

const base: Subscription = {
  id: 'sub-1', customerId: 'c1', productId: 'p1', variantId: 'v1', deliverySlotId: 'slot-morning', startDate: '2026-10-01', status: 'active',
  schedule: { scheduleType: 'daily', weekdays: [], alternatePatternDate: null }, pauses: [], cancellation: null, createdAt: '', updatedAt: '',
}
const sub = (changes: Partial<Subscription>): Subscription => ({ ...base, ...changes })
const dates = (drafts: { deliveryDate: string }[]) => drafts.map(draft => draft.deliveryDate)
const window = (subscription: Subscription, exceptions: SubscriptionDeliveryException[] = [], from = '2026-10-10', to = '2026-10-16') =>
  generateSubscriptionDeliveries({ subscription, fromDate: from, toDate: to, existingExceptions: exceptions })

const stored = (draft: { deliveryDate: string }, changes: Partial<DeliveryInstance> = {}): DeliveryInstance => ({
  id: deliveryIdFor('sub-1', draft.deliveryDate, 'slot-morning'), deliveryDate: draft.deliveryDate, customerId: 'c1', subscriptionId: 'sub-1', productId: 'p1', variantId: 'v1', quantity: 1,
  deliverySlotId: 'slot-morning', fulfilmentProfileId: 'f1', serviceAreaId: 'a1',
  customerAddressSnapshot: { line1: '', line2: '', locality: '', city: '', state: '', pinCode: '382010' }, customerPincode: '382010',
  status: 'scheduled', sourceType: 'subscription', createdAt: '', updatedAt: '', deliveredAt: null, notDeliveredReason: null, skipReason: '', cancellationReason: null, adminNotes: '', ...changes,
})

describe('generateSubscriptionDeliveries', () => {
  it('daily produces every day in the window with slot, variant and quantity', () => {
    const drafts = window(base)
    assert.deepEqual(dates(drafts), ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'])
    assert.equal(drafts[0].deliverySlotId, 'slot-morning')
    assert.equal(drafts[0].variantId, 'v1')
    assert.equal(drafts[0].quantity, 1)
    assert.equal(drafts[0].key, deliveryKey('sub-1', '2026-10-10', 'slot-morning'))
  })
  it('custom weekdays only yields Mon/Wed/Fri', () => {
    const drafts = window(sub({ schedule: { scheduleType: 'custom_weekdays', weekdays: [1, 3, 5], alternatePatternDate: null } }))
    assert.deepEqual(dates(drafts), ['2026-10-12', '2026-10-14', '2026-10-16'])
  })
  it('alternate days alternate from the pattern date', () => {
    const drafts = window(sub({ schedule: { scheduleType: 'alternate_days', weekdays: [], alternatePatternDate: '2026-10-10' } }))
    assert.deepEqual(dates(drafts), ['2026-10-10', '2026-10-12', '2026-10-14', '2026-10-16'])
  })
  it('respects the start date', () => {
    assert.deepEqual(dates(window(sub({ startDate: '2026-10-14' }))), ['2026-10-14', '2026-10-15', '2026-10-16'])
  })
  it('does not generate paused days; resume date is the first day back', () => {
    const drafts = window(sub({ pauses: [{ id: 'p', fromDate: '2026-10-12', resumeDate: '2026-10-15', reason: '' }] }))
    assert.deepEqual(dates(drafts), ['2026-10-10', '2026-10-11', '2026-10-15', '2026-10-16'])
  })
  it('stops after the cancellation effective date (that day still delivers)', () => {
    const drafts = window(sub({ status: 'cancelled', cancellation: { effectiveDate: '2026-10-12', reason: '' } }))
    assert.deepEqual(dates(drafts), ['2026-10-10', '2026-10-11', '2026-10-12'])
  })
  it('keeps a skipped occurrence visible as skipped without changing the schedule', () => {
    const exception: SubscriptionDeliveryException = { id: 'e', subscriptionId: 'sub-1', date: '2026-10-12', slotId: 'slot-morning', type: 'skip', reason: 'away', createdAt: '' }
    const drafts = window(base, [exception])
    assert.equal(drafts.length, 7)
    assert.deepEqual(drafts.map(draft => draft.status), ['scheduled', 'scheduled', 'skipped', 'scheduled', 'scheduled', 'scheduled', 'scheduled'])
    assert.equal(drafts[2].skipReason, 'away')
  })
  it('uses the subscription quantity when present', () => {
    assert.equal(window(sub({ quantity: 2 }))[0].quantity, 2)
  })
  it('caps the window so long ranges are never materialised', () => {
    assert.ok(window(base, [], '2026-10-10', '2027-10-10').length <= 31)
  })
})

describe('reconcileDeliveries', () => {
  const today = '2026-10-10'
  const run = (subscription: Subscription, existing: DeliveryInstance[], exceptions: SubscriptionDeliveryException[] = []) =>
    reconcileDeliveries({ subscription, existing, drafts: window(subscription, exceptions, today, '2026-10-16'), windowFrom: today, windowTo: '2026-10-16', today })

  it('inserts everything on first run and nothing on the second (no duplicates)', () => {
    const first = run(base, [])
    assert.equal(first.inserts.length, 7)
    const second = run(base, first.inserts.map(draft => stored(draft)))
    assert.equal(second.inserts.length, 0)
    assert.equal(second.updates.length, 0)
  })
  it('turns a scheduled delivery into skipped when a skip is added', () => {
    const existing = run(base, []).inserts.map(draft => stored(draft))
    const exception: SubscriptionDeliveryException = { id: 'e', subscriptionId: 'sub-1', date: '2026-10-12', slotId: 'slot-morning', type: 'skip', reason: '', createdAt: '' }
    const changes = run(base, existing, [exception])
    assert.equal(changes.updates.length, 1)
    assert.equal(changes.updates[0].patch.status, 'skipped')
    assert.equal(changes.updates[0].id, deliveryIdFor('sub-1', '2026-10-12', 'slot-morning'))
  })
  it('cancels scheduled deliveries that fall into a new pause, then revives them on resume', () => {
    const existing = run(base, []).inserts.map(draft => stored(draft))
    const paused = sub({ pauses: [{ id: 'p', fromDate: '2026-10-12', resumeDate: '2026-10-15', reason: '' }] })
    const pauseChanges = run(paused, existing)
    assert.deepEqual(pauseChanges.updates.map(update => update.id).sort(), ['2026-10-12', '2026-10-13', '2026-10-14'].map(date => deliveryIdFor('sub-1', date, 'slot-morning')))
    assert.ok(pauseChanges.updates.every(update => update.patch.status === 'cancelled' && update.patch.cancellationReason === 'subscription_paused'))

    const afterPause = existing.map(item => pauseChanges.updates.some(update => update.id === item.id) ? { ...item, status: 'cancelled' as const, cancellationReason: 'subscription_paused' as const } : item)
    const resumed = sub({ pauses: [{ id: 'p', fromDate: '2026-10-12', resumeDate: '2026-10-12', reason: '' }] })
    const resumeChanges = run(resumed, afterPause)
    assert.equal(resumeChanges.updates.length, 3)
    assert.ok(resumeChanges.updates.every(update => update.patch.status === 'scheduled' && update.patch.cancellationReason === null))
  })
  it('cancels future deliveries after the cancellation date and never revives them', () => {
    const existing = run(base, []).inserts.map(draft => stored(draft))
    const cancelled = sub({ status: 'cancelled', cancellation: { effectiveDate: '2026-10-12', reason: '' } })
    const changes = run(cancelled, existing)
    assert.equal(changes.updates.length, 4)
    assert.ok(changes.updates.every(update => update.patch.cancellationReason === 'subscription_cancelled'))
    const afterCancel = existing.map(item => changes.updates.some(update => update.id === item.id) ? { ...item, status: 'cancelled' as const, cancellationReason: 'subscription_cancelled' as const } : item)
    assert.equal(run(base, afterCancel).updates.filter(update => update.patch.status === 'scheduled').length, 0)
  })
  it('never touches delivered, not-delivered or past records', () => {
    const existing = [
      stored({ deliveryDate: '2026-10-10' }, { status: 'delivered' }),
      stored({ deliveryDate: '2026-10-11' }, { status: 'not_delivered' }),
      stored({ deliveryDate: '2026-10-09' }),
    ]
    const cancelled = sub({ status: 'cancelled', cancellation: { effectiveDate: '2026-10-08', reason: '' } })
    const changes = reconcileDeliveries({ subscription: cancelled, existing, drafts: [], windowFrom: today, windowTo: '2026-10-16', today })
    assert.equal(changes.updates.length, 0)
  })
  it('re-cancels a changed slot and inserts the new one, never deleting', () => {
    const existing = run(base, []).inserts.map(draft => stored(draft))
    const moved = sub({ deliverySlotId: 'slot-evening' })
    const changes = run(moved, existing)
    assert.equal(changes.inserts.length, 7)
    assert.equal(changes.updates.length, 7)
    assert.ok(changes.updates.every(update => update.patch.cancellationReason === 'schedule_changed'))
  })
  it('updates variant and quantity on still-scheduled deliveries', () => {
    const existing = run(base, []).inserts.map(draft => stored(draft))
    const changes = run(sub({ variantId: 'v2', quantity: 2 }), existing)
    assert.equal(changes.updates.length, 7)
    assert.deepEqual(changes.updates[0].patch, { variantId: 'v2', quantity: 2 })
  })
})
