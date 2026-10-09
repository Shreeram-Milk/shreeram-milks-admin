import { StatusBadge } from '@/components/shared/StatusBadge'
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from '../types'

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <StatusBadge status={status}>{SUBSCRIPTION_STATUS_LABELS[status]}</StatusBadge>
}
