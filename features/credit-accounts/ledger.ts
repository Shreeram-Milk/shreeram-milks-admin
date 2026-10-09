import { endOfMonth, startOfMonth, type IsoMonth } from '@/lib/business-time'
import type { Paise } from '@/lib/money'
import type { CreditLedgerEntry, LedgerRow } from './types'

/** Debits (charges) add to what is owed; credits (payments) reduce it. */
export const signedAmount = (entry: Pick<CreditLedgerEntry, 'amountPaise' | 'direction'>): Paise => (entry.direction === 'debit' ? entry.amountPaise : -entry.amountPaise)

/** Pure: amount owed = sum of every entry. The ledger is the only source of truth for a balance. */
export const calculateBalance = (entries: Pick<CreditLedgerEntry, 'amountPaise' | 'direction'>[]): Paise => entries.reduce((total, entry) => total + signedAmount(entry), 0)

/** Stable chronological order: effective date, then write time, then id. */
export const compareChronologically = (a: CreditLedgerEntry, b: CreditLedgerEntry): number =>
  a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

/**
 * Pure: attaches the balance after each entry. Always computed oldest-first from `openingBalancePaise`,
 * whatever order the caller later displays the rows in.
 */
export function calculateRunningBalance(entries: CreditLedgerEntry[], openingBalancePaise: Paise = 0): LedgerRow[] {
  let running = openingBalancePaise
  return [...entries].sort(compareChronologically).map(entry => {
    running += signedAmount(entry)
    return { ...entry, runningBalancePaise: running }
  })
}

export type StatementSummary = {
  month: IsoMonth
  openingBalancePaise: Paise
  chargesPaise: Paise
  paymentsPaise: Paise
  /** Net of manual adjustments and opening-balance entries; negative when they reduced the amount owed. */
  adjustmentsPaise: Paise
  closingBalancePaise: Paise
  deliveredCount: number
}

/** Pure: monthly statement. Entries before the month form the opening balance; those inside it are bucketed by type. */
export function buildStatement(entries: CreditLedgerEntry[], month: IsoMonth): StatementSummary {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  let opening = 0
  let charges = 0
  let payments = 0
  let adjustments = 0
  let deliveredCount = 0
  for (const entry of entries) {
    if (entry.occurredOn < start) { opening += signedAmount(entry); continue }
    if (entry.occurredOn > end) continue
    if (entry.type === 'delivery_charge') { charges += signedAmount(entry); deliveredCount += 1 }
    else if (entry.type === 'payment_received') payments += -signedAmount(entry)
    else adjustments += signedAmount(entry)
  }
  return { month, openingBalancePaise: opening, chargesPaise: charges, paymentsPaise: payments, adjustmentsPaise: adjustments, closingBalancePaise: opening + charges - payments + adjustments, deliveredCount }
}
