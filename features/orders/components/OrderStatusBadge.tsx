import { StatusBadge } from '@/components/shared/StatusBadge'
import { ORDER_STATUS_LABELS, type OrderStatus } from '../types'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusBadge status={status}>{ORDER_STATUS_LABELS[status]}</StatusBadge>
}
