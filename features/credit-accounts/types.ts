import type { IsoDate } from '@/lib/business-time'
import type { Paise } from '@/lib/money'

export type CreditAccountStatus = 'active' | 'suspended' | 'closed'
/** Controlled so further cycles can be added later without touching callers. */
export type BillingCycle = 'monthly'

/** Postpaid accounting account. Distinct from Customer.status and never used for prepaid adjustments. */
export type CreditAccount = {
  id: string
  customerId: string
  status: CreditAccountStatus
  billingCycle: BillingCycle
  /** Optional ceiling; only surfaced as a warning, never enforced in this phase. */
  creditLimitPaise: Paise | null
  createdAt: string
  updatedAt: string
}

export type LedgerEntryType = 'delivery_charge' | 'payment_received' | 'manual_adjustment' | 'opening_balance'
/** debit increases what the customer owes; credit reduces it. */
export type LedgerDirection = 'debit' | 'credit'
export type LedgerReferenceType = 'delivery' | 'payment' | 'adjustment' | 'opening'
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other'
export type AdjustmentReason = 'billing_correction' | 'goodwill' | 'migration_correction' | 'other'

/** Immutable: entries are only ever appended. Mistakes are fixed with a new adjustment entry. */
export type CreditLedgerEntry = {
  id: string
  customerId: string
  accountId: string
  type: LedgerEntryType
  /** Always a positive integer; the direction carries the sign. */
  amountPaise: Paise
  direction: LedgerDirection
  /** Effective financial date (business timezone). Statements group by this, not by createdAt. */
  occurredOn: IsoDate
  referenceType: LedgerReferenceType
  referenceId: string
  description: string
  metadata: Record<string, string | number>
  /** Audit timestamp of when the row was written. */
  createdAt: string
}

export type LedgerRow = CreditLedgerEntry & { runningBalancePaise: Paise }

export type AccountingIssue = { deliveryId: string; deliveryDate: IsoDate; message: string }

export const ACCOUNT_STATUS_LABELS: Record<CreditAccountStatus, string> = { active: 'Active', suspended: 'Suspended', closed: 'Closed' }
export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = { monthly: 'Monthly' }
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank Transfer', other: 'Other' }
export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = { billing_correction: 'Billing correction', goodwill: 'Goodwill adjustment', migration_correction: 'Migration correction', other: 'Other' }
export const LEDGER_TYPE_LABELS: Record<LedgerEntryType, string> = { delivery_charge: 'Delivery', payment_received: 'Payment', manual_adjustment: 'Adjustment', opening_balance: 'Opening balance' }
