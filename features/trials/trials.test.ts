import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { addDays, todayInBusinessZone } from '@/lib/business-time'
import { creditLedgerService } from '../credit-accounts/service'
import { customerService } from '../customers/service'
import { deliveryService } from '../deliveries/service'
import { productService } from '../products/service'
import { subscriptionService } from '../subscriptions/service'
import { buildTrialDeliveryDrafts, deriveTrialStatus, trialDeliveryDates, trialEndDate } from './generation'
import { trialRepository } from './mock-repository'
import { trialService } from './service'
import type { TrialEnrollment, TrialInput } from './types'

declare const __resetStorage: () => void

const today = todayInBusinessZone()
const input = (changes: Partial<TrialInput> = {}): TrialInput => ({ customerId: 'customer-rakesh', productId: 'product-cow-milk', variantId: 'cow-1000', trialPlanId: 'trial-3-day', deliverySlotId: 'slot-morning', startDate: addDays(today, 1), ...changes })
const deliveriesOf = (trialId: string) => deliveryService.getByTrial(trialId).map(view => view.delivery)
const trialFields = (changes: Partial<Omit<TrialEnrollment, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<TrialEnrollment, 'id' | 'createdAt' | 'updatedAt'> => ({
  customerId: 'c', productId: 'p', variantId: 'v', trialPlanId: 'plan', trialPlanNameSnapshot: '3-Day Trial', durationDaysSnapshot: 3, fulfilmentProfileId: 'f', deliverySlotId: 'slot-morning', quantity: 1,
  unitPricePaiseSnapshot: 7000, startDate: '2026-10-10', endDate: '2026-10-12', lifecycle: 'open', cancellation: null, convertedSubscriptionId: null, ...changes,
})
const baseTrial = (changes: Partial<TrialEnrollment> = {}): TrialEnrollment => ({ id: 't1', createdAt: '', updatedAt: '', ...trialFields(), ...changes })

beforeEach(() => __resetStorage())

describe('trial generation (pure)', () => {
  it('a 3-day trial from 10 Oct delivers on 10, 11 and 12 Oct and ends on 12 Oct', () => {
    assert.equal(trialEndDate('2026-10-10', 3), '2026-10-12')
    assert.deepEqual(trialDeliveryDates(baseTrial()), ['2026-10-10', '2026-10-11', '2026-10-12'])
    const drafts = buildTrialDeliveryDrafts(baseTrial())
    assert.ok(drafts.every(draft => draft.sourceType === 'trial' && draft.trialEnrollmentId === 't1' && draft.orderId === null && draft.unitPricePaise === 7000))
    assert.equal(new Set(drafts.map(draft => draft.id)).size, 3)
  })
  it('a 7-day trial has 7 deliveries; a cancellation keeps the effective day and drops later ones', () => {
    assert.equal(trialDeliveryDates(baseTrial({ durationDaysSnapshot: 7 })).length, 7)
    assert.deepEqual(trialDeliveryDates(baseTrial({ durationDaysSnapshot: 7, cancellation: { effectiveDate: '2026-10-11', reason: '' } })), ['2026-10-10', '2026-10-11'])
  })
  it('derives upcoming / active / completed from dates; cancelled and converted always win', () => {
    const trial = baseTrial()
    assert.equal(deriveTrialStatus(trial, '2026-10-09'), 'upcoming')
    assert.equal(deriveTrialStatus(trial, '2026-10-10'), 'active')
    assert.equal(deriveTrialStatus(trial, '2026-10-12'), 'active')
    assert.equal(deriveTrialStatus(trial, '2026-10-13'), 'completed')
    assert.equal(deriveTrialStatus({ ...trial, lifecycle: 'cancelled' }, '2026-10-11'), 'cancelled')
    assert.equal(deriveTrialStatus({ ...trial, lifecycle: 'converted' }, '2026-10-20'), 'converted')
  })
})

describe('creating trials', () => {
  it('creates a 3-day trial with exactly 3 linked trial deliveries and never duplicates them', () => {
    const trial = trialService.create(input())
    assert.equal(trial.durationDaysSnapshot, 3)
    assert.equal(trial.endDate, addDays(today, 3))
    deliveryService.materializeUpcoming()
    deliveryService.materializeUpcoming()
    const deliveries = deliveriesOf(trial.id)
    assert.equal(deliveries.length, 3)
    assert.deepEqual(deliveries.map(item => item.deliveryDate), [addDays(today, 1), addDays(today, 2), addDays(today, 3)])
    assert.ok(deliveries.every(item => item.sourceType === 'trial' && item.trialEnrollmentId === trial.id && item.status === 'scheduled' && item.customerPincode === '382010' && item.deliverySlotId === 'slot-morning'))
  })
  it('creates a 7-day trial with 7 deliveries', () => {
    const trial = trialService.create(input({ trialPlanId: 'trial-7-day' }))
    assert.equal(deliveriesOf(trial.id).length, 7)
  })
  it('validates PIN and slot like any delivery', () => {
    assert.throws(() => trialService.create(input({ customerId: 'customer-kiran' })), /PIN 382999/)
    assert.throws(() => trialService.create(input({ customerId: 'customer-meena', deliverySlotId: 'slot-evening' })), /delivery slot/)
    assert.throws(() => trialService.create(input({ deliverySlotId: null })), /delivery slot/)
  })
  it('offers only trial-enabled products and only the plans linked to the product', () => {
    assert.ok(trialService.listTrialProducts().every(product => product.purchaseMethods.includes('trial')))
    assert.ok(!trialService.listTrialProducts().some(product => product.id === 'product-paneer'))
    const cow = productService.getById('product-cow-milk')
    assert.ok(cow)
    productService.save({ ...cow, trialPlanIds: ['trial-3-day'] })
    assert.deepEqual(trialService.resolveContext({ customerId: 'customer-rakesh', productId: 'product-cow-milk' }).plans.map(plan => plan.id), ['trial-3-day'])
    assert.throws(() => trialService.create(input({ trialPlanId: 'trial-7-day' })), /trial plans offered/)
    assert.throws(() => trialService.create(input({ productId: 'product-paneer', variantId: 'pan-500' })), /does not support trials/)
  })
  it('rejects past start dates, inactive customers and a repeat trial of the same product', () => {
    assert.throws(() => trialService.create(input({ startDate: addDays(today, -1) })), /past/)
    trialService.create(input())
    assert.throws(() => trialService.create(input({ startDate: addDays(today, 10) })), /already taken/)
    customerService.deactivate('customer-meena')
    assert.throws(() => trialService.create(input({ customerId: 'customer-meena', deliverySlotId: 'slot-morning' })), /active customers/)
  })
  it('snapshots the plan and a price; a credit customer is charged for delivered trial days at that price', () => {
    const customer = customerService.create({ fullName: 'Trial Credit', mobile: '9000000003', email: '', status: 'active', customerType: 'credit', line1: '1 Road', line2: '', locality: 'Sector 10', city: 'Gandhinagar', state: 'Gujarat', pinCode: '382010', notes: '' })
    const trial = trialService.create(input({ customerId: customer.id, startDate: today }))
    assert.equal(trial.unitPricePaiseSnapshot, 7000)
    assert.equal(trial.trialPlanNameSnapshot, '3-Day Trial')
    const first = deliveriesOf(trial.id)[0]
    deliveryService.markDelivered(first.id)
    assert.equal(creditLedgerService.calculateBalance(customer.id), 7000)
  })
})

describe('cancelling and converting', () => {
  it('cancel keeps the effective day, cancels later deliveries as history, and survives re-materialising', () => {
    const trial = trialService.create(input({ trialPlanId: 'trial-7-day', startDate: today }))
    trialService.cancel(trial.id, { effectiveDate: addDays(today, 2), reason: 'Moved away' })
    const statuses = deliveriesOf(trial.id).map(item => item.status)
    assert.deepEqual(statuses, ['scheduled', 'scheduled', 'scheduled', 'cancelled', 'cancelled', 'cancelled', 'cancelled'])
    assert.ok(deliveriesOf(trial.id).filter(item => item.status === 'cancelled').every(item => item.cancellationReason === 'trial_cancelled'))
    deliveryService.materializeUpcoming()
    assert.equal(deliveriesOf(trial.id).length, 7)
    assert.equal(trialService.getView(trial.id)?.status, 'cancelled')
    assert.throws(() => trialService.cancel(trial.id, { effectiveDate: today, reason: '' }), /cancelled/)
  })
  it('cannot cancel once the trial has ended or when nothing remains', () => {
    const trial = trialService.create(input({ startDate: today }))
    assert.throws(() => trialService.cancel(trial.id, { effectiveDate: trial.endDate, reason: '' }), /nothing left/)
    assert.throws(() => trialService.cancel(trial.id, { effectiveDate: addDays(today, -1), reason: '' }), /past/)
  })
  it('a trial whose last day has passed is Completed, and nothing converts it automatically', () => {
    const finished = trialRepository.insert(trialFields({ customerId: 'customer-rakesh', productId: 'product-cow-milk', variantId: 'cow-1000', startDate: addDays(today, -5), endDate: addDays(today, -3) }))
    assert.equal(trialService.getView(finished.id)?.status, 'completed')
    const subscriptionsBefore = subscriptionService.listForCustomer('customer-rakesh').length
    deliveryService.materializeUpcoming()
    assert.equal(subscriptionService.listForCustomer('customer-rakesh').length, subscriptionsBefore, 'no subscription is created automatically')
    assert.equal(trialService.getView(finished.id)?.trial.convertedSubscriptionId, null)
    assert.equal(trialService.getSummary(today).completedAwaitingConversion, 1)
  })
  it('conversion needs a real schedule, creates a proper subscription, marks the trial converted and keeps its history', () => {
    const trial = trialService.create(input({ startDate: today }))
    assert.equal(trialService.conversionBlock(trial), null)
    const subscriptionInput = { customerId: trial.customerId, productId: trial.productId, variantId: trial.variantId, schedule: { scheduleType: 'custom_weekdays' as const, weekdays: [1, 3, 5], alternatePatternDate: null }, deliverySlotId: trial.deliverySlotId, startDate: addDays(today, 5) }
    assert.throws(() => trialService.convertToSubscription(trial.id, { ...subscriptionInput, customerId: 'customer-meena' }), /same customer/)
    assert.throws(() => trialService.convertToSubscription(trial.id, { ...subscriptionInput, schedule: { scheduleType: 'custom_weekdays', weekdays: [], alternatePatternDate: null } }))
    assert.equal(trialService.getView(trial.id)?.status, 'active', 'a failed conversion leaves the trial untouched')
    const subscription = trialService.convertToSubscription(trial.id, subscriptionInput)
    assert.equal(subscription.schedule.scheduleType, 'custom_weekdays')
    assert.deepEqual(subscription.schedule.weekdays, [1, 3, 5])
    const view = trialService.getView(trial.id)
    assert.equal(view?.status, 'converted')
    assert.equal(view?.trial.convertedSubscriptionId, subscription.id)
    assert.equal(deliveriesOf(trial.id).length, 3)
    assert.match(trialService.conversionBlock(trialService.getById(trial.id) as TrialEnrollment) ?? '', /already been converted/)
    assert.throws(() => trialService.convertToSubscription(trial.id, subscriptionInput), /already been converted/)
  })
  it('a cancelled trial cannot be converted', () => {
    const trial = trialService.create(input({ trialPlanId: 'trial-7-day', startDate: today }))
    trialService.cancel(trial.id, { effectiveDate: addDays(today, 1), reason: '' })
    assert.match(trialService.conversionBlock(trialService.getById(trial.id) as TrialEnrollment) ?? '', /cancelled/)
  })
  it('summarises active, ending-soon and completed-awaiting for the dashboard', () => {
    trialService.create(input({ startDate: today }))
    const summary = trialService.getSummary(today)
    assert.ok(summary.active >= 1)
    assert.ok(summary.endingSoon >= 1)
  })
})
