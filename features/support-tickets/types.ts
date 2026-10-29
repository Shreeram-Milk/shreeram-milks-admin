import { liveLabels } from '@/lib/i18n/core'
import { SUPPORT_CATEGORY_LABELS } from './categories'
import { t } from './messages'

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export const TICKET_STATUS_LABELS = liveLabels(t, { open: 'statusOpen', in_progress: 'statusInProgress', resolved: 'statusResolved', closed: 'statusClosed' })
/** Same categories the customer app offers on its Help & Support screen. */
export const TICKET_CATEGORY_LABELS = SUPPORT_CATEGORY_LABELS
/** Which status a ticket may move to next. Closed is final; a resolved ticket can be reopened. The server checks the same rule. */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'resolved'], in_progress: ['resolved'], resolved: ['closed', 'in_progress'], closed: [],
}
