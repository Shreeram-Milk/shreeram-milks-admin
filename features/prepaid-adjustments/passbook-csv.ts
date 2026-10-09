import { formatDisplayDate } from '@/lib/business-time'
import { toCsv } from '@/lib/csv'
import { formatPaiseDecimal } from '@/lib/money'
import { ADJUSTMENT_STATUS_LABELS, ADJUSTMENT_TYPE_LABELS, type PrepaidAdjustment } from './types'

/** A prepaid customer's adjustments as CSV, newest first. Carry-forward rows list the delivery owed instead of an amount. */
export function passbookCsv(customerName: string, adjustments: PrepaidAdjustment[]): string {
  return toCsv([
    ['Customer', customerName],
    ['Account', 'Prepaid adjustments'],
    [],
    ['Date', 'Type', 'Status', 'Amount (INR)', 'Delivery owed', 'Reason'],
    ...adjustments.map(item => [
      formatDisplayDate(item.effectiveDate), ADJUSTMENT_TYPE_LABELS[item.type], ADJUSTMENT_STATUS_LABELS[item.status],
      item.amountPaise === null ? '' : formatPaiseDecimal(item.amountPaise),
      item.entitlement ? `${item.entitlement.quantity} × ${item.entitlement.productName} ${item.entitlement.variantName}` : '', item.reason,
    ]),
  ])
}
