import { addDays, endOfMonth, isIsoDate, isIsoMonth, monthOfDate, startOfMonth, todayInBusinessZone, type IsoDate, type IsoMonth } from '@/lib/business-time'
import { formatINR, isValidPaise, type Paise } from '@/lib/money'
import { deliveryRepository } from '../deliveries/mock-repository'
import type { DeliveryInstance } from '../deliveries/types'
import { customerService } from '../customers/service'
import type { Customer } from '../customers/types'
import { productService } from '../products/service'
import { computeDeliveryCharge } from './charges'
import { buildStatement, calculateBalance, calculateRunningBalance, compareChronologically, type StatementSummary } from './ledger'
import { creditAccountRepository } from './mock-repository'
import type { AccountingIssue, AdjustmentReason, CreditAccount, CreditAccountStatus, CreditLedgerEntry, LedgerRow, PaymentMethod } from './types'
import { PAYMENT_METHOD_LABELS, ADJUSTMENT_REASON_LABELS } from './types'

export class CreditRuleError extends Error {}

export type PostChargeResult =
  | { status: 'posted'; entry: CreditLedgerEntry }
  | { status: 'already_posted'; entry: CreditLedgerEntry }
  | { status: 'not_chargeable'; reason: string }
  | { status: 'issue'; message: string }

const deliveryDescription = (delivery: DeliveryInstance, productName: string, variantName: string) => `${productName} · ${variantName} × ${delivery.quantity}`

/** Ledger-level operations. Posting is idempotent: one delivered delivery yields at most one delivery_charge. */
export const creditLedgerService = {
  listEntries: (customerId: string): CreditLedgerEntry[] => creditAccountRepository.listEntriesForCustomer(customerId).sort(compareChronologically),
  getEntryByReference: (referenceType: CreditLedgerEntry['referenceType'], referenceId: string, type: CreditLedgerEntry['type'] = 'delivery_charge') => creditAccountRepository.findEntry(type, referenceType, referenceId),
  calculateBalance: (customerId: string): Paise => calculateBalance(creditAccountRepository.listEntriesForCustomer(customerId)),

  postDeliveryCharge(delivery: DeliveryInstance): PostChargeResult {
    const customer = customerService.getById(delivery.customerId)
    const decision = computeDeliveryCharge(delivery, customer?.customerType)
    if (decision.kind === 'not_chargeable') return { status: 'not_chargeable', reason: decision.reason }
    if (decision.kind === 'issue') return { status: 'issue', message: decision.message }
    const existing = creditAccountRepository.findEntry('delivery_charge', 'delivery', delivery.id)
    if (existing) return { status: 'already_posted', entry: existing }
    const account = creditAccountRepository.ensure(delivery.customerId)
    const product = productService.getById(delivery.productId)
    const variant = product?.variants.find(item => item.id === delivery.variantId)
    const [entry] = creditAccountRepository.append([{
      id: `ledger-delivery-${delivery.id}`, customerId: delivery.customerId, accountId: account.id, type: 'delivery_charge', amountPaise: decision.amountPaise, direction: 'debit',
      occurredOn: delivery.deliveryDate, referenceType: 'delivery', referenceId: delivery.id,
      description: deliveryDescription(delivery, product?.name ?? 'Delivery', variant?.name ?? ''),
      metadata: { unitPricePaise: decision.unitPricePaise, quantity: decision.quantity, referenceLabel: `DEL-${delivery.deliveryDate.replaceAll('-', '')}` },
    }])
    return entry ? { status: 'posted', entry } : { status: 'already_posted', entry: creditAccountRepository.findEntry('delivery_charge', 'delivery', delivery.id) as CreditLedgerEntry }
  },
}

export type AccountOverview = {
  account: CreditAccount
  customer: Customer
  balancePaise: Paise
  monthChargesPaise: Paise
  monthPaymentsPaise: Paise
  lastActivityOn: IsoDate | null
  lastPayment: { amountPaise: Paise; occurredOn: IsoDate } | null
  deliveredThisMonth: number
  availableCreditPaise: Paise | null
  overLimit: boolean
}

export type AccountListQuery = { search: string; status: CreditAccountStatus | ''; balanceState: '' | 'outstanding' | 'zero'; sort: 'balance_desc' | 'balance_asc' | 'name' | 'recent'; page: number; pageSize: number }
export type AccountsSummary = { creditCustomers: number; outstandingAccounts: number; totalReceivablePaise: Paise; paymentsThisMonthPaise: Paise }

function groupByCustomer(entries: CreditLedgerEntry[]): Map<string, CreditLedgerEntry[]> {
  const groups = new Map<string, CreditLedgerEntry[]>()
  for (const entry of entries) { const list = groups.get(entry.customerId); if (list) list.push(entry); else groups.set(entry.customerId, [entry]) }
  return groups
}

function overviewFrom(account: CreditAccount, customer: Customer, entries: CreditLedgerEntry[], month: IsoMonth): AccountOverview {
  const statement = buildStatement(entries, month)
  const payments = entries.filter(entry => entry.type === 'payment_received').sort(compareChronologically)
  const lastPaymentEntry = payments[payments.length - 1]
  const lastActivity = entries.reduce<IsoDate | null>((latest, entry) => (!latest || entry.occurredOn > latest ? entry.occurredOn : latest), null)
  const balance = calculateBalance(entries)
  return {
    account, customer, balancePaise: balance, monthChargesPaise: statement.chargesPaise, monthPaymentsPaise: statement.paymentsPaise,
    lastActivityOn: lastActivity, lastPayment: lastPaymentEntry ? { amountPaise: lastPaymentEntry.amountPaise, occurredOn: lastPaymentEntry.occurredOn } : null,
    deliveredThisMonth: statement.deliveredCount,
    availableCreditPaise: account.creditLimitPaise === null ? null : account.creditLimitPaise - balance,
    overLimit: account.creditLimitPaise !== null && balance > account.creditLimitPaise,
  }
}

function requireAccount(customerId: string): { account: CreditAccount; customer: Customer } {
  const customer = customerService.getById(customerId)
  if (!customer) throw new CreditRuleError('Customer not found.')
  if (customer.customerType !== 'credit') throw new CreditRuleError('Only credit customers have a credit account.')
  return { account: creditAccountRepository.ensure(customerId), customer }
}

function requireOpenAccount(customerId: string) {
  const found = requireAccount(customerId)
  if (found.account.status === 'closed') throw new CreditRuleError('This credit account is closed. Reopen it before posting new entries.')
  return found
}

function nextPaymentLabel(): string {
  return `PAY-${String(creditAccountRepository.countPayments() + 1).padStart(4, '0')}`
}

export const creditAccountService = {
  /** Accounts exist only for credit customers; they are created on first need, never for prepaid customers. */
  listAccounts({ search, status, balanceState, sort, page, pageSize }: AccountListQuery): { rows: AccountOverview[]; total: number } {
    const month = monthOfDate(todayInBusinessZone())
    const customers = customerService.listAll().filter(customer => customer.customerType === 'credit')
    const grouped = groupByCustomer(creditAccountRepository.listEntries())
    const term = search.trim().toLowerCase()
    const overviews = customers
      .map(customer => overviewFrom(creditAccountRepository.ensure(customer.id), customer, grouped.get(customer.id) ?? [], month))
      .filter(item => (!status || item.account.status === status)
        && (balanceState !== 'outstanding' || item.balancePaise !== 0)
        && (balanceState !== 'zero' || item.balancePaise === 0)
        && (!term || [item.customer.fullName, item.customer.mobile].join(' ').toLowerCase().includes(term)))
    const byName = (a: AccountOverview, b: AccountOverview) => a.customer.fullName.localeCompare(b.customer.fullName)
    overviews.sort((a, b) => {
      if (sort === 'balance_desc') return b.balancePaise - a.balancePaise || byName(a, b)
      if (sort === 'balance_asc') return a.balancePaise - b.balancePaise || byName(a, b)
      if (sort === 'recent') return (b.lastActivityOn ?? '').localeCompare(a.lastActivityOn ?? '') || byName(a, b)
      return byName(a, b)
    })
    return { rows: overviews.slice((page - 1) * pageSize, page * pageSize), total: overviews.length }
  },

  getSummary(): AccountsSummary {
    const month = monthOfDate(todayInBusinessZone())
    const customers = customerService.listAll().filter(customer => customer.customerType === 'credit')
    const grouped = groupByCustomer(creditAccountRepository.listEntries())
    let outstanding = 0
    let receivable = 0
    let payments = 0
    for (const customer of customers) {
      const entries = grouped.get(customer.id) ?? []
      const balance = calculateBalance(entries)
      if (balance !== 0) outstanding += 1
      if (balance > 0) receivable += balance
      payments += buildStatement(entries, month).paymentsPaise
    }
    return { creditCustomers: customers.length, outstandingAccounts: outstanding, totalReceivablePaise: receivable, paymentsThisMonthPaise: payments }
  },

  /** Returns undefined for prepaid or unknown customers: they have no credit account. */
  getAccount(customerId: string): AccountOverview | undefined {
    const customer = customerService.getById(customerId)
    if (!customer || customer.customerType !== 'credit') return undefined
    return overviewFrom(creditAccountRepository.ensure(customerId), customer, creditAccountRepository.listEntriesForCustomer(customerId), monthOfDate(todayInBusinessZone()))
  },

  /** One month of ledger rows with correct running balances, plus the statement summary. Oldest-first. */
  getStatement(customerId: string, month: IsoMonth): { summary: StatementSummary; rows: LedgerRow[] } {
    if (!isIsoMonth(month)) throw new CreditRuleError('Choose a valid month.')
    const entries = creditAccountRepository.listEntriesForCustomer(customerId)
    const summary = buildStatement(entries, month)
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const inMonth = entries.filter(entry => entry.occurredOn >= start && entry.occurredOn <= end)
    return { summary, rows: calculateRunningBalance(inMonth, summary.openingBalancePaise) }
  },

  /** Newest-first entries across all months, each with its true running balance. */
  getRecentEntries(customerId: string, limit: number): LedgerRow[] {
    return calculateRunningBalance(creditAccountRepository.listEntriesForCustomer(customerId), 0).reverse().slice(0, limit)
  },

  /** Delivered credit deliveries that could not be priced or posted; never silently charged as zero. */
  getIssues(customerId: string): AccountingIssue[] {
    const customer = customerService.getById(customerId)
    if (!customer || customer.customerType !== 'credit') return []
    return deliveryRepository.listForCustomer(customerId)
      .filter(delivery => delivery.status === 'delivered')
      .flatMap(delivery => {
        const decision = computeDeliveryCharge(delivery, customer.customerType)
        return decision.kind === 'issue' ? [{ deliveryId: delivery.id, deliveryDate: delivery.deliveryDate, message: decision.message }] : []
      })
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
  },

  /** Posting issues across every credit customer (dashboard); each carries the customer it belongs to. */
  getAllIssues(): Array<AccountingIssue & { customerId: string }> {
    return customerService.listAll().filter(customer => customer.customerType === 'credit').flatMap(customer => creditAccountService.getIssues(customer.id).map(issue => ({ ...issue, customerId: customer.id })))
  },

  /** Catch-up for delivered credit deliveries that predate the ledger. Safe to run repeatedly. */
  reconcileDeliveredCharges(): void {
    const creditIds = new Set(customerService.listAll().filter(customer => customer.customerType === 'credit').map(customer => customer.id))
    if (!creditIds.size) return
    const posted = new Set(creditAccountRepository.listEntries().filter(entry => entry.type === 'delivery_charge').map(entry => entry.referenceId))
    const minDate = addDays(todayInBusinessZone(), -62)
    for (const delivery of deliveryRepository.list()) {
      if (delivery.status !== 'delivered' || !creditIds.has(delivery.customerId) || posted.has(delivery.id) || delivery.deliveryDate < minDate) continue
      creditLedgerService.postDeliveryCharge(delivery)
    }
  },

  /**
   * TEMPORARY POLICY: a payment may not exceed the outstanding balance, because a negative balance
   * (customer advance / wallet) has no agreed business meaning yet.
   */
  recordPayment(customerId: string, input: { amountPaise: Paise; paymentDate: IsoDate; method: PaymentMethod; reference: string; notes: string }): CreditLedgerEntry {
    const { account } = requireOpenAccount(customerId)
    if (!isValidPaise(input.amountPaise) || input.amountPaise <= 0) throw new CreditRuleError('Enter an amount greater than zero.')
    if (!isIsoDate(input.paymentDate)) throw new CreditRuleError('Choose a valid payment date.')
    if (input.paymentDate > todayInBusinessZone()) throw new CreditRuleError('The payment date cannot be in the future.')
    if (!(input.method in PAYMENT_METHOD_LABELS)) throw new CreditRuleError('Select a payment method.')
    const balance = creditLedgerService.calculateBalance(customerId)
    if (input.amountPaise > balance) throw new CreditRuleError(balance > 0 ? `Payments cannot exceed the outstanding balance of ${formatINR(balance)}.` : 'There is no outstanding balance to pay.')
    const label = nextPaymentLabel()
    const [entry] = creditAccountRepository.append([{
      id: `ledger-payment-${crypto.randomUUID()}`, customerId, accountId: account.id, type: 'payment_received', amountPaise: input.amountPaise, direction: 'credit',
      occurredOn: input.paymentDate, referenceType: 'payment', referenceId: label, description: `Payment received · ${PAYMENT_METHOD_LABELS[input.method]}`,
      metadata: { method: input.method, reference: input.reference.trim(), notes: input.notes.trim(), referenceLabel: label },
    }])
    return entry
  },

  /** Appends a new entry; history is never edited. Reductions may not take the balance below zero (no advance balances yet). */
  addAdjustment(customerId: string, input: { direction: 'increase' | 'reduce'; amountPaise: Paise; reason: AdjustmentReason; notes: string }): CreditLedgerEntry {
    const { account } = requireOpenAccount(customerId)
    if (!isValidPaise(input.amountPaise) || input.amountPaise <= 0) throw new CreditRuleError('Enter an amount greater than zero.')
    if (!(input.reason in ADJUSTMENT_REASON_LABELS)) throw new CreditRuleError('Select a reason.')
    if (input.reason === 'other' && !input.notes.trim()) throw new CreditRuleError('Add a note when the reason is Other.')
    const balance = creditLedgerService.calculateBalance(customerId)
    if (input.direction === 'reduce' && input.amountPaise > balance) throw new CreditRuleError(`The reduction cannot exceed the outstanding balance of ${formatINR(Math.max(balance, 0))}.`)
    const [entry] = creditAccountRepository.append([{
      id: `ledger-adjustment-${crypto.randomUUID()}`, customerId, accountId: account.id, type: 'manual_adjustment', amountPaise: input.amountPaise, direction: input.direction === 'increase' ? 'debit' : 'credit',
      occurredOn: todayInBusinessZone(), referenceType: 'adjustment', referenceId: `ADJ-${Date.now()}`,
      description: `${ADJUSTMENT_REASON_LABELS[input.reason]}${input.notes.trim() ? ` — ${input.notes.trim()}` : ''}`,
      metadata: { reason: input.reason, notes: input.notes.trim(), referenceLabel: 'Adjustment' },
    }])
    return entry
  },

  setStatus(customerId: string, status: CreditAccountStatus): CreditAccount {
    requireAccount(customerId)
    if (status === 'closed' && creditLedgerService.calculateBalance(customerId) !== 0) throw new CreditRuleError('Settle or adjust the outstanding balance before closing this account.')
    const updated = creditAccountRepository.updateAccount(customerId, { status })
    if (!updated) throw new CreditRuleError('Credit account not found.')
    return updated
  },

  updateSettings(customerId: string, input: { creditLimitPaise: Paise | null }): CreditAccount {
    requireAccount(customerId)
    if (input.creditLimitPaise !== null && (!isValidPaise(input.creditLimitPaise) || input.creditLimitPaise <= 0)) throw new CreditRuleError('The credit limit must be greater than zero, or left empty.')
    const updated = creditAccountRepository.updateAccount(customerId, { creditLimitPaise: input.creditLimitPaise })
    if (!updated) throw new CreditRuleError('Credit account not found.')
    return updated
  },

}
