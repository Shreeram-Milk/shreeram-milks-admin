import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { addDays, todayInBusinessZone } from '@/lib/business-time'
import { formatINR, paiseToRupeeInput, parseRupeesToPaise } from '@/lib/money'
import { customerService } from '../customers/service'
import type { CustomerFormValues } from '../customers/schema'
import { deliveryRepository } from '../deliveries/mock-repository'
import { deliveryService } from '../deliveries/service'
import { deliveryIdFor, type DeliveryInstance, type DeliveryStatus } from '../deliveries/types'
import { productService } from '../products/service'
import { subscriptionService } from '../subscriptions/service'
import { computeDeliveryCharge } from './charges'
import { buildStatement, calculateBalance, calculateRunningBalance } from './ledger'
import { creditAccountRepository } from './mock-repository'
import { creditAccountService, creditLedgerService } from './service'
import type { CreditLedgerEntry } from './types'

declare const __resetStorage: () => void

const today = todayInBusinessZone()
const creditValues: CustomerFormValues = { fullName: 'Credit Tester', mobile: '9000000001', email: '', status: 'active', customerType: 'credit', line1: '1 Test Road', line2: '', locality: 'Sector 10', city: 'Gandhinagar', state: 'Gujarat', pinCode: '382010', notes: '' }

let counter = 0
function delivery(customerId: string, status: DeliveryStatus = 'delivered', changes: Partial<DeliveryInstance> = {}): DeliveryInstance {
  counter += 1
  const date = addDays(today, -((counter - 1) % 25) - 1)
  return {
    id: deliveryIdFor(`sub-test-${counter}`, date, 'slot-morning'), deliveryDate: date, customerId, subscriptionId: `sub-test-${counter}`, productId: 'product-cow-milk', variantId: 'cow-1000', quantity: 1,
    unitPricePaiseSnapshot: 7000, deliverySlotId: 'slot-morning', fulfilmentProfileId: 'profile-gandhinagar', serviceAreaId: 'area-gandhinagar',
    customerAddressSnapshot: { line1: '', line2: '', locality: 'Sector 10', city: '', state: '', pinCode: '382010' }, customerPincode: '382010',
    status, sourceType: 'subscription', createdAt: '', updatedAt: '', deliveredAt: null, notDeliveredReason: null, skipReason: '', cancellationReason: null, adminNotes: '', ...changes,
  }
}
const entry = (changes: Partial<CreditLedgerEntry>): CreditLedgerEntry => ({
  id: `e-${Math.random()}`, customerId: 'c', accountId: 'a', type: 'delivery_charge', amountPaise: 7000, direction: 'debit', occurredOn: '2026-10-05', referenceType: 'delivery', referenceId: 'd', description: '', metadata: {}, createdAt: '2026-10-05T00:00:00.000Z', ...changes,
})
const newCreditCustomer = (changes: Partial<CustomerFormValues> = {}) => customerService.create({ ...creditValues, ...changes })

beforeEach(() => { __resetStorage(); counter = 0 })

describe('money', () => {
  it('formats and parses integer paise without floats', () => {
    assert.equal(formatINR(7000), '₹70.00')
    assert.equal(formatINR(126000), '₹1,260.00')
    assert.equal(formatINR(-5000), '-₹50.00')
    assert.equal(parseRupeesToPaise('500'), 50000)
    assert.equal(parseRupeesToPaise('70.5'), 7050)
    assert.equal(parseRupeesToPaise('0.07'), 7)
    assert.equal(parseRupeesToPaise('-5'), null)
    assert.equal(parseRupeesToPaise('abc'), null)
    assert.equal(parseRupeesToPaise('1.234'), null)
    assert.equal(paiseToRupeeInput(7000), '70')
    assert.equal(paiseToRupeeInput(7050), '70.50')
    assert.equal(paiseToRupeeInput(7), '0.07')
    assert.equal(parseRupeesToPaise(paiseToRupeeInput(123456)), 123456, 'round-trips exactly')
  })
})

describe('computeDeliveryCharge', () => {
  const base = { quantity: 1, unitPricePaiseSnapshot: 7000 as number | null | undefined }
  it('charges ₹70 for one delivered ₹70 unit', () => {
    assert.deepEqual(computeDeliveryCharge({ ...base, status: 'delivered' }, 'credit'), { kind: 'charge', amountPaise: 7000, unitPricePaise: 7000, quantity: 1 })
  })
  it('multiplies by quantity: 2 × ₹38 = ₹76', () => {
    const result = computeDeliveryCharge({ quantity: 2, unitPricePaiseSnapshot: 3800, status: 'delivered' }, 'credit')
    assert.equal(result.kind === 'charge' && result.amountPaise, 7600)
  })
  it('never charges scheduled, skipped, cancelled or not-delivered deliveries', () => {
    for (const status of ['scheduled', 'skipped', 'cancelled', 'not_delivered'] as const) assert.equal(computeDeliveryCharge({ ...base, status }, 'credit').kind, 'not_chargeable', status)
  })
  it('never charges prepaid customers', () => {
    assert.equal(computeDeliveryCharge({ ...base, status: 'delivered' }, 'prepaid').kind, 'not_chargeable')
  })
  it('treats a missing or invalid price or quantity as an issue, not ₹0', () => {
    for (const price of [null, undefined, -1, 70.5]) assert.equal(computeDeliveryCharge({ quantity: 1, unitPricePaiseSnapshot: price, status: 'delivered' }, 'credit').kind, 'issue')
    assert.equal(computeDeliveryCharge({ quantity: 0, unitPricePaiseSnapshot: 7000, status: 'delivered' }, 'credit').kind, 'issue')
  })
})

describe('ledger maths', () => {
  it('balance is the sum of debits minus credits', () => {
    assert.equal(calculateBalance([entry({ amountPaise: 7000 }), entry({ amountPaise: 7000 }), entry({ type: 'payment_received', direction: 'credit', amountPaise: 50000 })]), -36000)
  })
  it('running balance is computed oldest-first, independent of display order', () => {
    const rows = calculateRunningBalance([
      entry({ id: 'c', occurredOn: '2026-10-08', amountPaise: 7000 }),
      entry({ id: 'a', occurredOn: '2026-10-05', amountPaise: 126000 }),
      entry({ id: 'b', occurredOn: '2026-10-06', type: 'payment_received', direction: 'credit', amountPaise: 50000 }),
    ], 0)
    assert.deepEqual(rows.map(row => [row.id, row.runningBalancePaise]), [['a', 126000], ['b', 76000], ['c', 83000]])
    const newestFirst = [...rows].reverse()
    assert.deepEqual(newestFirst.map(row => row.runningBalancePaise), [83000, 76000, 126000])
  })
  it('monthly statement: opening 200 + charges 1000 - payments 500 - adjustment 100 = 600', () => {
    const entries = [
      entry({ id: 'open', occurredOn: '2026-09-20', amountPaise: 20000, type: 'opening_balance', referenceType: 'opening' }),
      entry({ id: 'c1', occurredOn: '2026-10-02', amountPaise: 60000 }),
      entry({ id: 'c2', occurredOn: '2026-10-09', amountPaise: 40000 }),
      entry({ id: 'p', occurredOn: '2026-10-10', type: 'payment_received', direction: 'credit', amountPaise: 50000, referenceType: 'payment' }),
      entry({ id: 'adj', occurredOn: '2026-10-11', type: 'manual_adjustment', direction: 'credit', amountPaise: 10000, referenceType: 'adjustment' }),
      entry({ id: 'later', occurredOn: '2026-11-01', amountPaise: 99999 }),
    ]
    assert.deepEqual(buildStatement(entries, '2026-10'), { month: '2026-10', openingBalancePaise: 20000, chargesPaise: 100000, paymentsPaise: 50000, adjustmentsPaise: -10000, closingBalancePaise: 60000, deliveredCount: 2 })
  })
  it('groups by effective date, not by when the row was created', () => {
    const backDated = entry({ occurredOn: '2026-09-30', createdAt: '2026-10-09T00:00:00.000Z', type: 'payment_received', direction: 'credit', amountPaise: 1000 })
    assert.equal(buildStatement([backDated], '2026-10').paymentsPaise, 0)
    assert.equal(buildStatement([backDated], '2026-10').openingBalancePaise, -1000)
  })
})

describe('delivery charge posting', () => {
  it('posts exactly one charge per delivered credit delivery, even when processed repeatedly', () => {
    const customer = newCreditCustomer()
    const item = delivery(customer.id)
    deliveryRepository.apply([item], [])
    assert.equal(creditLedgerService.postDeliveryCharge(item).status, 'posted')
    assert.equal(creditLedgerService.postDeliveryCharge(item).status, 'already_posted')
    creditAccountService.reconcileDeliveredCharges()
    creditAccountService.reconcileDeliveredCharges()
    const entries = creditLedgerService.listEntries(customer.id).filter(row => row.type === 'delivery_charge')
    assert.equal(entries.length, 1)
    assert.equal(entries[0].amountPaise, 7000)
    assert.equal(entries[0].direction, 'debit')
    assert.equal(entries[0].referenceId, item.id)
  })
  it('uses the delivery price snapshot, not the current product price', () => {
    const customer = newCreditCustomer()
    const product = productService.getById('product-cow-milk')
    assert.ok(product)
    productService.save({ ...product, variants: product.variants.map(variant => variant.id === 'cow-1000' ? { ...variant, pricePaise: 7500 } : variant) })
    const item = delivery(customer.id, 'delivered', { unitPricePaiseSnapshot: 7000 })
    creditLedgerService.postDeliveryCharge(item)
    assert.equal(creditLedgerService.calculateBalance(customer.id), 7000)
    // A later change never rewrites the posted entry.
    productService.save({ ...product, variants: product.variants.map(variant => variant.id === 'cow-1000' ? { ...variant, pricePaise: 8000 } : variant) })
    assert.equal(creditLedgerService.calculateBalance(customer.id), 7000)
  })
  it('does not post charges for skipped, not-delivered, cancelled or scheduled deliveries', () => {
    const customer = newCreditCustomer()
    for (const status of ['skipped', 'not_delivered', 'cancelled', 'scheduled'] as const) {
      const item = delivery(customer.id, status)
      deliveryRepository.apply([item], [])
      assert.equal(creditLedgerService.postDeliveryCharge(item).status, 'not_chargeable')
    }
    assert.equal(creditLedgerService.listEntries(customer.id).length, 0)
  })
  it('does not post for prepaid customers and never creates a credit account for them', () => {
    const item = delivery('customer-rakesh')
    creditLedgerService.postDeliveryCharge(item)
    creditAccountService.reconcileDeliveredCharges()
    assert.equal(creditAccountRepository.listEntriesForCustomer('customer-rakesh').length, 0)
    assert.equal(creditAccountRepository.getByCustomer('customer-rakesh'), undefined)
    assert.equal(creditAccountService.getAccount('customer-rakesh'), undefined)
  })
  it('reports a delivered delivery with no price snapshot as an issue instead of a ₹0 charge', () => {
    const customer = newCreditCustomer()
    const item = delivery(customer.id, 'delivered', { unitPricePaiseSnapshot: null })
    deliveryRepository.apply([item], [])
    assert.equal(creditLedgerService.postDeliveryCharge(item).status, 'issue')
    creditAccountService.reconcileDeliveredCharges()
    assert.equal(creditLedgerService.listEntries(customer.id).length, 0)
    const issues = creditAccountService.getIssues(customer.id)
    assert.equal(issues.length, 1)
    assert.equal(issues[0].deliveryId, item.id)
    assert.match(issues[0].message, /price snapshot/)
  })
  it('marking a real credit delivery delivered posts its charge; marking it not delivered afterwards is blocked', () => {
    const customer = newCreditCustomer()
    const sub = subscriptionService.create({ customerId: customer.id, productId: 'product-cow-milk', variantId: 'cow-1000', schedule: { scheduleType: 'daily', weekdays: [], alternatePatternDate: null }, deliverySlotId: 'slot-morning', startDate: today })
    const todays = deliveryService.getBySubscription(sub.id).find(view => view.delivery.deliveryDate === today)?.delivery
    assert.ok(todays)
    assert.equal(todays.unitPricePaiseSnapshot, 7000)
    deliveryService.markDelivered(todays.id)
    assert.equal(creditLedgerService.calculateBalance(customer.id), 7000)
    deliveryService.materializeUpcoming()
    assert.equal(creditLedgerService.listEntries(customer.id).filter(row => row.type === 'delivery_charge').length, 1)
    assert.throws(() => deliveryService.markNotDelivered(todays.id, { reason: 'customer_unavailable', notes: '' }), /financial ledger entry/)
  })
  it('prepaid delivered deliveries create no ledger entry through the real flow', () => {
    const sub = subscriptionService.create({ customerId: 'customer-rakesh', productId: 'product-cow-milk', variantId: 'cow-1000', schedule: { scheduleType: 'daily', weekdays: [], alternatePatternDate: null }, deliverySlotId: 'slot-morning', startDate: today })
    const todays = deliveryService.getBySubscription(sub.id).find(view => view.delivery.deliveryDate === today)?.delivery
    assert.ok(todays)
    deliveryService.markDelivered(todays.id)
    assert.equal(creditAccountRepository.listEntries().length, 0)
  })
})

describe('credit account scenario (acceptance A–F)', () => {
  function seedOctober() {
    const customer = newCreditCustomer()
    const delivered = Array.from({ length: 18 }, () => delivery(customer.id, 'delivered'))
    deliveryRepository.apply([...delivered, delivery(customer.id, 'skipped'), delivery(customer.id, 'not_delivered')], [])
    creditAccountService.reconcileDeliveredCharges()
    return customer
  }
  it('18 delivered × ₹70 = ₹1,260; the skipped and not-delivered ones add nothing', () => {
    const customer = seedOctober()
    assert.equal(creditLedgerService.calculateBalance(customer.id), 126000)
    assert.equal(creditLedgerService.listEntries(customer.id).length, 18)
  })
  it('a ₹500 UPI payment leaves ₹760; further payments cannot exceed the balance', () => {
    const customer = seedOctober()
    const payment = creditAccountService.recordPayment(customer.id, { amountPaise: 50000, paymentDate: today, method: 'upi', reference: 'TXN1', notes: '' })
    assert.equal(payment.direction, 'credit')
    assert.equal(payment.type, 'payment_received')
    assert.equal(creditLedgerService.calculateBalance(customer.id), 76000)
    assert.throws(() => creditAccountService.recordPayment(customer.id, { amountPaise: 76001, paymentDate: today, method: 'cash', reference: '', notes: '' }), /cannot exceed/)
    assert.throws(() => creditAccountService.recordPayment(customer.id, { amountPaise: 0, paymentDate: today, method: 'cash', reference: '', notes: '' }))
    assert.throws(() => creditAccountService.recordPayment(customer.id, { amountPaise: Number.NaN, paymentDate: today, method: 'cash', reference: '', notes: '' }))
  })
  it('a ₹60 reduction takes ₹760 to ₹700 by appending an entry and leaving history untouched', () => {
    const customer = seedOctober()
    creditAccountService.recordPayment(customer.id, { amountPaise: 50000, paymentDate: today, method: 'upi', reference: '', notes: '' })
    const before = JSON.stringify(creditLedgerService.listEntries(customer.id))
    const adjustment = creditAccountService.addAdjustment(customer.id, { direction: 'reduce', amountPaise: 6000, reason: 'goodwill', notes: '' })
    assert.equal(creditLedgerService.calculateBalance(customer.id), 70000)
    assert.equal(adjustment.type, 'manual_adjustment')
    const after = creditLedgerService.listEntries(customer.id)
    assert.equal(JSON.stringify(after.filter(row => row.id !== adjustment.id)), before)
    assert.throws(() => creditAccountService.addAdjustment(customer.id, { direction: 'reduce', amountPaise: 999999, reason: 'goodwill', notes: '' }), /cannot exceed/)
    assert.throws(() => creditAccountService.addAdjustment(customer.id, { direction: 'increase', amountPaise: 100, reason: 'other', notes: '' }), /note/)
  })
  it('the statement for the delivery month shows charges, payments and closing balance', () => {
    const customer = seedOctober()
    creditAccountService.recordPayment(customer.id, { amountPaise: 50000, paymentDate: today, method: 'upi', reference: '', notes: '' })
    const month = today.slice(0, 7)
    const { summary, rows } = creditAccountService.getStatement(customer.id, month)
    assert.equal(summary.paymentsPaise, 50000)
    assert.equal(summary.openingBalancePaise + summary.chargesPaise - summary.paymentsPaise + summary.adjustmentsPaise, summary.closingBalancePaise)
    assert.equal(rows[rows.length - 1].runningBalancePaise, summary.closingBalancePaise)
  })
  it('blocks Credit → Prepaid while money is owed, and allows it once settled', () => {
    const customer = seedOctober()
    const toPrepaid = { ...creditValues, mobile: creditValues.mobile, customerType: 'prepaid' as const }
    assert.throws(() => customerService.update(customer.id, toPrepaid), /Settle or adjust the outstanding credit balance/)
    assert.equal(customerService.getById(customer.id)?.customerType, 'credit')
    creditAccountService.recordPayment(customer.id, { amountPaise: 126000, paymentDate: today, method: 'bank_transfer', reference: '', notes: '' })
    assert.equal(customerService.update(customer.id, toPrepaid).customerType, 'prepaid')
  })
  it('Prepaid → Credit opens a credit account', () => {
    const existing = customerService.getById('customer-rakesh')
    assert.ok(existing)
    assert.equal(creditAccountRepository.getByCustomer('customer-rakesh'), undefined)
    customerService.update('customer-rakesh', { ...creditValues, fullName: existing.fullName, mobile: existing.mobile, customerType: 'credit' })
    assert.ok(creditAccountRepository.getByCustomer('customer-rakesh'))
  })
  it('lists only credit customers and totals receivables from the ledger', () => {
    seedOctober()
    const list = creditAccountService.listAccounts({ search: '', status: '', balanceState: '', sort: 'balance_desc', page: 1, pageSize: 20 })
    assert.ok(list.rows.every(row => row.customer.customerType === 'credit'))
    assert.ok(!list.rows.some(row => row.customer.id === 'customer-rakesh'))
    const summary = creditAccountService.getSummary()
    assert.equal(summary.totalReceivablePaise, 126000)
    assert.equal(summary.outstandingAccounts, 1)
    assert.equal(list.rows[0].balancePaise, 126000)
  })
  it('only an empty account can be closed, and closed accounts accept no new entries', () => {
    const customer = seedOctober()
    assert.throws(() => creditAccountService.setStatus(customer.id, 'closed'), /Settle or adjust/)
    creditAccountService.recordPayment(customer.id, { amountPaise: 126000, paymentDate: today, method: 'cash', reference: '', notes: '' })
    creditAccountService.setStatus(customer.id, 'closed')
    assert.throws(() => creditAccountService.addAdjustment(customer.id, { direction: 'increase', amountPaise: 100, reason: 'goodwill', notes: '' }), /closed/)
  })
})
