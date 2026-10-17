import { apiRequest } from '@/lib/api-client'
import type { ListResult } from '../configuration/api'
import type { SupportCategory } from './categories'
import type { TicketStatus } from './types'

/** One ticket as the backend describes it. Customers raise tickets in the app; staff read, reply and manage them here. */
export type SupportTicketRecord = {
  id: string; ticketNumber: number; customerId: string; customerName: string; customerPhone: string | null
  category: SupportCategory; status: TicketStatus; assigneeAdminId: string | null; assigneeEmail: string | null
  messageCount: number; createdAt: string; updatedAt: string; resolvedAt: string | null; closedAt: string | null
}
export type SupportTicketMessage = { id: string; author: 'customer' | 'admin'; authorName: string; body: string; createdAt: string }
export type SupportTicketThread = { ticket: SupportTicketRecord; messages: SupportTicketMessage[] }

export type SupportTicketListParams = { search: string; status: TicketStatus | ''; category: SupportCategory | ''; customerId: string; page: number; pageSize: number }

const base = (id: string) => `/admin/support-tickets/${encodeURIComponent(id)}`

export const supportTicketApi = {
  list({ search, status, category, customerId, page, pageSize }: SupportTicketListParams): Promise<ListResult<SupportTicketRecord>> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    if (category) query.set('category', category)
    if (customerId) query.set('customerId', customerId)
    return apiRequest<ListResult<SupportTicketRecord>>(`/admin/support-tickets?${query}`)
  },
  get: (id: string): Promise<SupportTicketThread> => apiRequest<SupportTicketThread>(base(id)),
  reply: (id: string, body: string): Promise<SupportTicketThread> => apiRequest<SupportTicketThread>(`${base(id)}/messages`, { method: 'POST', body: { body } }),
  setStatus: (id: string, status: TicketStatus): Promise<SupportTicketThread> => apiRequest<SupportTicketThread>(`${base(id)}/status`, { method: 'PATCH', body: { status } }),
  assign: (id: string, assigned: boolean): Promise<SupportTicketThread> => apiRequest<SupportTicketThread>(`${base(id)}/assignee`, { method: 'PUT', body: { assigned } }),
}

export const formatTicketNumber = (ticketNumber: number): string => `TKT-${ticketNumber}`
