import { StatusBadge } from '@/components/shared/StatusBadge'
import { TICKET_STATUS_LABELS, type TicketStatus } from '../types'

const BADGE_STATUS: Record<TicketStatus, string> = { open: 'pending', in_progress: 'pending', resolved: 'completed', closed: 'closed' }

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <StatusBadge status={BADGE_STATUS[status]}>{TICKET_STATUS_LABELS[status]}</StatusBadge>
}
