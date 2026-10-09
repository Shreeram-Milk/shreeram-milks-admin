import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { addDays, todayInBusinessZone } from '@/lib/business-time'
import { creditAccountRepository } from '../credit-accounts/mock-repository'
import { creditLedgerService } from '../credit-accounts/service'
import { customerService } from '../customers/service'
import { deliveryService } from '../deliveries/service'
import { subscriptionService } from '../subscriptions/service'
import type { SubscriptionInput } from '../subscriptions/types'
import { planAdjustment } from './planning'
import { PREPAID_ADJUSTMENT_POLICY, type PrepaidAdjustmentPolicy } from './policy'
import { prepaidAdjustmentRepository } from './mock-repository'
import { prepaidAdjustmentService } from './service'

declare const __resetStorage: () => void

const today = todayInBusinessZone()
const day = (offset: number) => addDays(today, offset)
const subscriptionInput = (customerId: string, changes: Partial<SubscriptionInput> = {}): SubscriptionInput => ({
  customerId, productId: 'product-cow-milk', variantId: 'cow-1000', schedule: { scheduleType: 'daily', weekdays: [], alternatePatternDate: null }, deliverySlotId: 'slot-morning', startDate: day(1), ...changes,
})
const newCreditCustomer = () => customerService.create({ fullName: 'Credit Skipper', mobile: '9000000004', email: '', status: 'active', customerType: 'credit', line1: '1 Road', line2: '', locality: 'Sector 10', city: 'Gandhinagar', state: 'Gujarat', pinCode: '382010', notes: '' })
const all = () => prepaidAdjustmentRepository.list()

beforeEach(() => __resetStorage())

describe('policy and planning (pure)', () => {
  const skipped = { id: 'd1', status: 'skipped' as const, quantity: 1, unitPricePaiseSnapshot: 7000, cancellationReason: null, subscriptionId: 's1' }
  it('is one central object, marked as a mock policy', () => {
    assert.deepEqual(PREPAID_ADJUSTMENT_POLICY, { skipHandling: 'carry_forward', cancelHandling: 'account_credit' })
  })
  it('carry-forward keeps the entitlement in sold units with no money value', () => {
    const plan = planAdjustment({ trigger: 'skip', delivery: { ...skipped, quantity: 2 }, customerType: 'prepaid', policy: PREPAID_ADJUSTMENT_POLICY })
    assert.deepEqual(plan, { kind: 'adjustment', type: 'carry_forward', amountPaise: null, quantity: 2, dedupeKey: 'skip:d1', reason: 'Skipped delivery' })
  })
  it('account credit is exact integer paise from the delivery snapshot (2 × ₹38 = ₹76)', () => {
    const policy: PrepaidAdjustmentPolicy = { skipHandling: 'account_credit', cancelHandling: 'account_credit' }
    const plan = planAdjustment({ trigger: 'skip', delivery: { ...skipped, quantity: 2, unitPricePaiseSnapshot: 3800 }, customerType: 'prepaid', policy })
    assert.equal(plan.kind === 'adjustment' && plan.amountPaise, 7600)
  })
  it('a money credit that cannot be priced is an issue, never ₹0', () => {
    const policy: PrepaidAdjustmentPolicy = { skipHandling: 'account_credit', cancelHandling: 'account_credit' }
    for (const price of [null, undefined, -5, 70.5]) assert.equal(planAdjustment({ trigger: 'skip', delivery: { ...skipped, unitPricePaiseSnapshot: price }, customerType: 'prepaid', policy }).kind, 'issue')
  })
  it('credit customers, non-subscription deliveries and non-matching statuses produce nothing', () => {
    assert.equal(planAdjustment({ trigger: 'skip', delivery: skipped, customerType: 'credit', policy: PREPAID_ADJUSTMENT_POLICY }).kind, 'none')
    assert.equal(planAdjustment({ trigger: 'skip', delivery: { ...skipped, subscriptionId: null }, customerType: 'prepaid', policy: PREPAID_ADJUSTMENT_POLICY }).kind, 'none')
    assert.equal(planAdjustment({ trigger: 'skip', delivery: { ...skipped, status: 'not_delivered' }, customerType: 'prepaid', policy: PREPAID_ADJUSTMENT_POLICY }).kind, 'none')
    assert.equal(planAdjustment({ trigger: 'cancel', delivery: { ...skipped, status: 'cancelled', cancellationReason: 'subscription_paused' }, customerType: 'prepaid', policy: PREPAID_ADJUSTMENT_POLICY }).kind, 'none')
  })
})

describe('skipped and cancelled deliveries', () => {
  it('prepaid skip creates one carry-forward entitlement, not a credit-ledger entry', () => {
    const subscription = subscriptionService.create(subscriptionInput('customer-rakesh'))
    subscriptionService.addDeliveryException({ subscriptionId: subscription.id, date: day(3), type: 'skip' })
    const [adjustment] = all()
    assert.equal(all().length, 1)
    assert.equal(adjustment.type, 'carry_forward')
    assert.equal(adjustment.status, 'pending')
    assert.equal(adjustment.amountPaise, null)
    assert.deepEqual([adjustment.entitlement?.productName, adjustment.entitlement?.variantName, adjustment.entitlement?.quantity], ['Fresh Cow Milk', '1 L', 1])
    assert.equal(adjustment.customerId, 'customer-rakesh')
    assert.equal(creditAccountRepository.listEntriesForCustomer('customer-rakesh').length, 0)
    assert.equal(creditAccountRepository.getByCustomer('customer-rakesh'), undefined)
    assert.equal(creditLedgerService.calculateBalance('customer-rakesh'), 0)
  })
  it('the same skip is never recorded twice, however often reconciliation runs', () => {
    const subscription = subscriptionService.create(subscriptionInput('customer-rakesh'))
    subscriptionService.addDeliveryException({ subscriptionId: subscription.id, date: day(3), type: 'skip' })
    prepaidAdjustmentService.reconcileSubscription(subscription.id)
    prepaidAdjustmentService.reconcileAll()
    deliveryService.materializeUpcoming()
    deliveryService.materializeUpcoming()
    assert.equal(all().filter(item => item.subscriptionId === subscription.id).length, 1)
  })
  it('a credit customer’s skipped delivery creates no charge and no prepaid adjustment', () => {
    const customer = newCreditCustomer()
    const subscription = subscriptionService.create(subscriptionInput(customer.id))
    subscriptionService.addDeliveryException({ subscriptionId: subscription.id, date: day(3), type: 'skip' })
    prepaidAdjustmentService.reconcileAll()
    assert.equal(all().filter(item => item.customerId === customer.id).length, 0)
    assert.equal(creditLedgerService.calculateBalance(customer.id), 0)
  })
  it('cancelling a prepaid subscription credits each cancelled paid delivery in integer paise, separate from the credit ledger', () => {
    const subscription = subscriptionService.create(subscriptionInput('customer-rakesh'))
    subscriptionService.cancel(subscription.id, { effectiveDate: day(3), reason: '' })
    const credits = all().filter(item => item.subscriptionId === subscription.id)
    assert.ok(credits.length > 5)
    assert.ok(credits.every(item => item.type === 'account_credit' && item.status === 'pending' && item.amountPaise === 7000 && Number.isInteger(item.amountPaise) && item.entitlement === null))
    assert.equal(new Set(credits.map(item => item.deliveryId)).size, credits.length)
    deliveryService.materializeUpcoming()
    prepaidAdjustmentService.reconcileAll()
    assert.equal(all().filter(item => item.subscriptionId === subscription.id).length, credits.length)
    assert.equal(creditAccountRepository.listEntriesForCustomer('customer-rakesh').length, 0)
    assert.equal(creditAccountRepository.getByCustomer('customer-rakesh'), undefined)
    assert.equal(prepaidAdjustmentService.getCustomerSummary('customer-rakesh').pendingCreditPaise, 7000 * credits.length)
  })
  it('pausing a prepaid subscription does not create adjustments (policy only covers skips and cancellations)', () => {
    const subscription = subscriptionService.create(subscriptionInput('customer-rakesh'))
    subscriptionService.pause(subscription.id, { fromDate: day(3), resumeDate: null, reason: '' })
    prepaidAdjustmentService.reconcileAll()
    assert.equal(all().length, 0)
  })
  it('a not-delivered prepaid delivery creates no adjustment', () => {
    const subscription = subscriptionService.create(subscriptionInput('customer-rakesh', { startDate: today }))
    const todays = deliveryService.getBySubscription(subscription.id).find(view => view.delivery.deliveryDate === today)?.delivery
    assert.ok(todays)
    deliveryService.markNotDelivered(todays.id, { reason: 'customer_unavailable', notes: '' })
    prepaidAdjustmentService.reconcileAll()
    assert.equal(all().length, 0)
  })
})

describe('adjustment actions', () => {
  function pendingCredit() {
    const subscription = subscriptionService.create(subscriptionInput('customer-rakesh'))
    subscriptionService.cancel(subscription.id, { effectiveDate: day(2), reason: '' })
    const credit = all().find(item => item.type === 'account_credit')
    assert.ok(credit)
    return credit
  }
  it('apply and cancel work only on pending adjustments', () => {
    const credit = pendingCredit()
    assert.equal(prepaidAdjustmentService.apply(credit.id).status, 'applied')
    assert.throws(() => prepaidAdjustmentService.apply(credit.id), /pending/)
    assert.throws(() => prepaidAdjustmentService.cancel(credit.id), /pending/)
  })
  it('a refund is only requested explicitly, stays pending, and completes only on an explicit admin action', () => {
    const credit = pendingCredit()
    const refund = prepaidAdjustmentService.requestRefund(credit.id)
    assert.equal(refund.type, 'refund_pending')
    assert.equal(refund.status, 'pending')
    assert.equal(refund.amountPaise, credit.amountPaise)
    assert.equal(prepaidAdjustmentRepository.get(credit.id)?.status, 'cancelled')
    assert.throws(() => prepaidAdjustmentService.requestRefund(credit.id), /pending/)
    assert.throws(() => prepaidAdjustmentService.apply(refund.id), /Mark refund completed/)
    assert.equal(prepaidAdjustmentService.getCustomerSummary('customer-rakesh').pendingRefundPaise, refund.amountPaise)
    assert.equal(prepaidAdjustmentService.completeRefund(refund.id).status, 'applied')
  })
  it('carry-forward entitlements cannot be refunded', () => {
    const subscription = subscriptionService.create(subscriptionInput('customer-rakesh'))
    subscriptionService.addDeliveryException({ subscriptionId: subscription.id, date: day(3), type: 'skip' })
    assert.throws(() => prepaidAdjustmentService.requestRefund(all()[0].id), /money credit/)
    assert.equal(prepaidAdjustmentService.getCustomerSummary('customer-rakesh').pendingEntitlementUnits, 1)
  })
  it('manual adjustments need a prepaid customer, a reason, and a whole-paise positive amount', () => {
    assert.equal(prepaidAdjustmentService.createManual({ customerId: 'customer-rakesh', amountPaise: 2550, reason: 'Delivery damaged' }).amountPaise, 2550)
    assert.throws(() => prepaidAdjustmentService.createManual({ customerId: 'customer-rakesh', amountPaise: 25.5, reason: 'x' }))
    assert.throws(() => prepaidAdjustmentService.createManual({ customerId: 'customer-rakesh', amountPaise: 0, reason: 'x' }))
    assert.throws(() => prepaidAdjustmentService.createManual({ customerId: 'customer-rakesh', amountPaise: 100, reason: '  ' }), /reason/)
    assert.throws(() => prepaidAdjustmentService.createManual({ customerId: 'customer-meena', amountPaise: 100, reason: 'x' }), /prepaid/)
  })
  it('lists and summarises for the Finance page', () => {
    pendingCredit()
    prepaidAdjustmentService.createManual({ customerId: 'customer-rakesh', amountPaise: 500, reason: 'Goodwill' })
    const list = prepaidAdjustmentService.list({ search: '', status: 'pending', type: '', customerId: 'customer-rakesh', page: 1, pageSize: 50 })
    assert.ok(list.total >= 2 && list.rows.every(row => row.adjustment.status === 'pending'))
    assert.ok(prepaidAdjustmentService.getOverview().pendingValuePaise >= 500)
  })
})
