export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketCategory = 'delivery_missing' | 'late_delivery' | 'wrong_product' | 'quality' | 'payment' | 'subscription' | 'address' | 'other'
export type TicketAuthor = 'customer' | 'admin'

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
/** Same categories the customer app offers on its Help & Support screen. */
export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  delivery_missing: 'Delivery not received', late_delivery: 'Late delivery', wrong_product: 'Wrong product', quality: 'Quality issue',
  payment: 'Payment issue', subscription: 'Subscription issue', address: 'Address issue', other: 'Other',
}
/** Which status a ticket may move to next. Closed is final; a resolved ticket can be reopened. */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'resolved'], in_progress: ['resolved'], resolved: ['closed', 'in_progress'], closed: [],
}

export type TicketMessage = { id: string; author: TicketAuthor; body: string; createdAt: string }

export type SupportTicket = {
  id: string
  /** Human reference like TKT-1001. */
  ticketNumber: string
  customerId: string
  /** Optional order the issue is about; always belongs to `customerId`. */
  orderId: string
  category: TicketCategory
  status: TicketStatus
  /** Free-text staff name; real staff accounts arrive with admin login. */
  assignee: string
  messages: TicketMessage[]
  createdAt: string
  resolvedAt: string | null
  updatedAt: string
}

export type SupportTicketInput = Omit<SupportTicket, 'id' | 'updatedAt'> & { id?: string }
