import { StatusBadge } from '@/components/shared/StatusBadge'
import { CANCELLATION_REASON_LABELS, DELIVERY_STATUS_LABELS, type DeliveryInstance } from '../types'

/** Cancelled deliveries show why (e.g. paused) so they are not mistaken for a plain cancellation. */
export function DeliveryStatusBadge({ delivery }: { delivery: Pick<DeliveryInstance, 'status' | 'cancellationReason'> }) {
  const base = DELIVERY_STATUS_LABELS[delivery.status]
  const label = delivery.status === 'cancelled' && delivery.cancellationReason === 'subscription_paused' ? 'Paused' : base
  const tone = delivery.status === 'not_delivered' ? 'cancelled' : delivery.status
  return <StatusBadge status={tone}><span title={delivery.cancellationReason ? CANCELLATION_REASON_LABELS[delivery.cancellationReason] : undefined}>{label}</span></StatusBadge>
}
