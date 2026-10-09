import Link from 'next/link'
import { DetailRows } from '@/components/shared/DetailRows'
import { formatINR } from '@/lib/money'
import { computeDeliveryCharge } from '../../credit-accounts/charges'
import { creditLedgerService } from '../../credit-accounts/service'
import type { Customer } from '../../customers/types'
import { adjustmentTypeLabel, adjustmentValue } from '../../prepaid-adjustments/components/AdjustmentParts'
import { prepaidAdjustmentService } from '../../prepaid-adjustments/service'
import type { DeliveryInstance } from '../types'

/** Shows how this delivery relates to the customer's credit ledger. Prepaid customers have no ledger link. */
export function DeliveryFinancialStatus({ delivery, customer }: { delivery: DeliveryInstance; customer: Customer | undefined }) {
  if (!customer || customer.customerType !== 'credit') {
    const adjustments = customer ? prepaidAdjustmentService.getForDelivery(delivery.id) : []
    return <section className="form-card"><h2>Financial</h2>
      <DetailRows rows={[
        { label: 'Account type', value: customer ? 'Prepaid' : '—' },
        { label: 'Credit charge', value: 'Not applicable' },
        ...adjustments.map(item => ({ label: 'Prepaid adjustment', value: <Link className="product-name-link" href={`/prepaid-adjustments?customer=${item.customerId}`}>{adjustmentTypeLabel(item)} · {adjustmentValue(item)}</Link> })),
      ]} />
    </section>
  }
  const entry = creditLedgerService.getEntryByReference('delivery', delivery.id)
  const decision = computeDeliveryCharge(delivery, customer.customerType)
  const unit = delivery.unitPricePaiseSnapshot
  return <section className="form-card"><h2>Financial</h2>
    <DetailRows rows={[
      { label: 'Financial status', value: entry ? 'Charged' : decision.kind === 'issue' ? 'Posting issue' : 'Not Charged' },
      { label: 'Unit price (snapshot)', value: typeof unit === 'number' ? formatINR(unit) : 'Missing' },
      ...(entry ? [
        { label: 'Charge', value: <strong>{formatINR(entry.amountPaise)}</strong> },
        { label: 'Ledger reference', value: <Link className="product-name-link" href={`/credit-accounts/${customer.id}`}>{String(entry.metadata.referenceLabel ?? entry.id)} · View account</Link> },
      ] : []),
    ]} />
    {decision.kind === 'issue' && <p className="field-error" role="alert">Financial posting issue: {decision.message} No charge was created.</p>}
    {!entry && decision.kind === 'not_chargeable' && <p className="product-hint">A charge is created only when the delivery is marked Delivered.</p>}
    {entry && <p className="product-hint">This delivery has a financial ledger entry. Use a financial correction workflow to change it.</p>}
  </section>
}
