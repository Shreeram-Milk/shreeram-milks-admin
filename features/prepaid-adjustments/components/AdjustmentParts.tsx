import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatINR } from '@/lib/money'
import { describeEntitlement } from '../planning'
import { ADJUSTMENT_STATUS_LABELS, ADJUSTMENT_TYPE_LABELS, type PrepaidAdjustment } from '../types'

export function AdjustmentStatusBadge({ adjustment }: { adjustment: PrepaidAdjustment }) {
  // A completed refund reads "Refunded" so it is never mistaken for an ordinary applied credit.
  const label = adjustment.type === 'refund_pending' && adjustment.status === 'applied' ? 'Refunded' : adjustment.type === 'refund_pending' && adjustment.status === 'pending' ? 'Refund pending' : ADJUSTMENT_STATUS_LABELS[adjustment.status]
  return <StatusBadge status={adjustment.type === 'refund_pending' && adjustment.status === 'pending' ? 'refund_pending' : adjustment.status}>{label}</StatusBadge>
}

/** Money for credits and refunds; the paid delivery itself for carry-forward. Never mixes the two. */
export function adjustmentValue(adjustment: PrepaidAdjustment): string {
  if (adjustment.entitlement) return describeEntitlement(adjustment.entitlement)
  return adjustment.amountPaise === null ? '—' : formatINR(adjustment.amountPaise)
}

export const adjustmentTypeLabel = (adjustment: PrepaidAdjustment) => ADJUSTMENT_TYPE_LABELS[adjustment.type]
