import Link from 'next/link'
import { DetailRows } from '@/components/shared/DetailRows'
import { formatDisplayDate, formatMonthLabel, monthOfDate, todayInBusinessZone } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { adjustmentTypeLabel, adjustmentValue, AdjustmentStatusBadge } from '../../prepaid-adjustments/components/AdjustmentParts'
import { prepaidAdjustmentService } from '../../prepaid-adjustments/service'
import { LedgerTable } from '../../credit-accounts/components/LedgerTable'
import { creditAccountService } from '../../credit-accounts/service'
import { BILLING_CYCLE_LABELS } from '../../credit-accounts/types'
import { CUSTOMER_TYPE_LABELS, type Customer } from '../types'

/** Credit customers see their ledger summary; prepaid customers deliberately have no credit account. */
export function CustomerAccountTab({ customer }: { customer: Customer }) {
  const overview = creditAccountService.getAccount(customer.id)
  if (customer.customerType !== 'credit' || !overview) return <PrepaidAccountView customer={customer} />
  const month = formatMonthLabel(monthOfDate(todayInBusinessZone()))
  const recent = creditAccountService.getRecentEntries(customer.id, 5)
  return <section className="form-card"><div className="section-title-row"><h2>Credit account</h2><Link className="secondary-button" href={`/credit-accounts/${customer.id}`}>View Full Credit Account</Link></div>
    <DetailRows rows={[
      { label: 'Account type', value: CUSTOMER_TYPE_LABELS[customer.customerType] },
      { label: 'Current balance', value: <strong>{formatINR(overview.balancePaise)}</strong> },
      { label: `${month} charges`, value: formatINR(overview.monthChargesPaise) },
      { label: 'Last payment', value: overview.lastPayment ? `${formatINR(overview.lastPayment.amountPaise)} · ${formatDisplayDate(overview.lastPayment.occurredOn)}` : '—' },
      { label: 'Billing cycle', value: BILLING_CYCLE_LABELS[overview.account.billingCycle] },
    ]} />
    <h3 className="subsection-title">Recent ledger entries</h3>
    {recent.length === 0 ? <p className="product-hint">No ledger entries yet.</p> : <LedgerTable rows={recent} compact />}
  </section>
}

/** Prepaid customers have no credit ledger; they see what they are owed for paid deliveries that weren't consumed. */
function PrepaidAccountView({ customer }: { customer: Customer }) {
  const summary = prepaidAdjustmentService.getCustomerSummary(customer.id)
  const recent = prepaidAdjustmentService.listForCustomer(customer.id, 5)
  return <section className="form-card"><div className="section-title-row"><h2>Prepaid account</h2><Link className="secondary-button" href={`/prepaid-adjustments?customer=${customer.id}`}>View Prepaid Adjustments</Link></div>
    <DetailRows rows={[
      { label: 'Account type', value: CUSTOMER_TYPE_LABELS[customer.customerType] },
      { label: 'Pending credit', value: <strong>{formatINR(summary.pendingCreditPaise)}</strong> },
      { label: 'Unused entitlements (carry-forward)', value: `${summary.pendingEntitlementUnits} ${summary.pendingEntitlementUnits === 1 ? 'delivery' : 'deliveries'}` },
      { label: 'Pending refunds', value: formatINR(summary.pendingRefundPaise) },
      { label: 'Applied credit', value: formatINR(summary.appliedCreditPaise) },
    ]} />
    <p className="product-hint">This is not a credit account: prepaid customers have no ledger balance. Adjustments appear when a paid delivery is skipped or a subscription is cancelled.</p>
    <h3 className="subsection-title">Recent adjustments</h3>
    {recent.length === 0 ? <p className="product-hint">No prepaid adjustments yet.</p>
      : <ul className="breakdown-list">{recent.map(item => <li key={item.id}><span>{adjustmentTypeLabel(item)} <small>{item.reason} · {formatDisplayDate(item.effectiveDate)}</small></span><span className="adjustment-line"><strong>{adjustmentValue(item)}</strong><AdjustmentStatusBadge adjustment={item} /></span></li>)}</ul>}
  </section>
}
