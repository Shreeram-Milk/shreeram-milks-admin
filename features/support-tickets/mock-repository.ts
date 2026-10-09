import { createMockCollection } from '@/lib/mock-collection'
import type { SupportTicket } from './types'

const message = (id: string, author: 'customer' | 'admin', body: string, createdAt: string) => ({ id, author, body, createdAt })

const seed: SupportTicket[] = [
  { id: 'ticket-seed-1', ticketNumber: 'TKT-1001', customerId: 'customer-rakesh', orderId: 'order-seed-1', category: 'late_delivery', status: 'open', assignee: '',
    messages: [message('m1', 'customer', 'My paneer order arrived well after 7 AM today.', '2026-10-08T03:10:00.000Z')], createdAt: '2026-10-08T03:10:00.000Z', resolvedAt: null, updatedAt: '2026-10-08T03:10:00.000Z' },
  { id: 'ticket-seed-2', ticketNumber: 'TKT-1002', customerId: 'customer-meena', orderId: 'order-seed-2', category: 'payment', status: 'in_progress', assignee: 'Rakesh Shah',
    messages: [message('m2', 'customer', 'I was asked to pay again after confirming the order.', '2026-10-07T05:00:00.000Z'), message('m3', 'admin', 'Thanks for flagging this. We are checking the payment record.', '2026-10-07T06:30:00.000Z')], createdAt: '2026-10-07T05:00:00.000Z', resolvedAt: null, updatedAt: '2026-10-07T06:30:00.000Z' },
]

export const supportTicketRepository = createMockCollection<SupportTicket>('shreeram-admin-support-tickets-v1', seed, 'ticket')
