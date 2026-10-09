import type { IsoDate } from '@/lib/business-time'
import type { Paise } from '@/lib/money'

/**
 * What the business owes a PREPAID customer who paid for a delivery that wasn't consumed.
 * This is deliberately unrelated to CreditAccount, which tracks what a POSTPAID customer owes the business.
 */
export type PrepaidAdjustmentType = 'carry_forward' | 'account_credit' | 'refund_pending' | 'manual_adjustment'
export type PrepaidAdjustmentStatus = 'pending' | 'applied' | 'cancelled'
export type AdjustmentTrigger = 'skip' | 'cancel'

/** A paid delivery owed to the customer, in the unit they bought (not production litres). */
export type Entitlement = { productId: string; variantId: string; productName: string; variantName: string; quantity: number }

export type PrepaidAdjustment = {
  id: string
  customerId: string
  subscriptionId: string | null
  deliveryId: string | null
  type: PrepaidAdjustmentType
  status: PrepaidAdjustmentStatus
  /** Money value in integer paise; null for pure carry-forward entitlements. */
  amountPaise: Paise | null
  entitlement: Entitlement | null
  reason: string
  effectiveDate: IsoDate
  /** One adjustment per business event; a repeated event can never create a second one. */
  dedupeKey: string
  createdAt: string
  updatedAt: string
}

export const ADJUSTMENT_TYPE_LABELS: Record<PrepaidAdjustmentType, string> = { carry_forward: 'Carry forward', account_credit: 'Account credit', refund_pending: 'Refund', manual_adjustment: 'Manual adjustment' }
export const ADJUSTMENT_STATUS_LABELS: Record<PrepaidAdjustmentStatus, string> = { pending: 'Pending', applied: 'Applied', cancelled: 'Cancelled' }
