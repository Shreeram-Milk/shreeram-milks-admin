import { formatMonthLabel, formatDisplayDate, type IsoMonth } from '@/lib/business-time'
import { toCsv } from '@/lib/csv'
import { formatPaiseDecimal } from '@/lib/money'
import type { StatementSummary } from './ledger'
import { LEDGER_TYPE_LABELS, type LedgerRow } from './types'

/** One month's credit statement as CSV: a summary block, a blank line, then the ledger oldest-first. Amounts are plain rupees. */
export function statementCsv(customerName: string, month: IsoMonth, summary: StatementSummary, rows: LedgerRow[]): string {
  return toCsv([
    ['Customer', customerName],
    ['Statement', formatMonthLabel(month)],
    ['Opening balance (INR)', formatPaiseDecimal(summary.openingBalancePaise)],
    ['Delivery charges (INR)', formatPaiseDecimal(summary.chargesPaise)],
    ['Payments (INR)', formatPaiseDecimal(summary.paymentsPaise)],
    ['Adjustments (INR)', formatPaiseDecimal(summary.adjustmentsPaise)],
    ['Closing balance (INR)', formatPaiseDecimal(summary.closingBalancePaise)],
    [],
    ['Date', 'Type', 'Description', 'Charge (INR)', 'Credit (INR)', 'Balance (INR)'],
    ...rows.map(row => [formatDisplayDate(row.occurredOn), LEDGER_TYPE_LABELS[row.type], row.description, row.direction === 'debit' ? formatPaiseDecimal(row.amountPaise) : '', row.direction === 'credit' ? formatPaiseDecimal(row.amountPaise) : '', formatPaiseDecimal(row.runningBalancePaise)]),
  ])
}
