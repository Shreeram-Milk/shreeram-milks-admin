import { apiRequest } from '@/lib/api-client'
import type { SupportCategory } from '../support-tickets/categories'
import type { Faq, FaqStatus } from './types'

export type FaqListParams = { search: string; topic: SupportCategory | ''; status: FaqStatus | ''; page: number; pageSize: number }
export type FaqPayload = Omit<Faq, 'id' | 'updatedAt'>

/** Help question calls to the backend. The backend validates everything again, so these never decide what is allowed. */
export const faqApi = {
  list: ({ search, topic, status, page, pageSize }: FaqListParams) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (topic) query.set('topic', topic)
    if (status) query.set('status', status)
    return apiRequest<{ rows: Faq[]; total: number }>(`/admin/help/faqs?${query}`)
  },
  create: (input: FaqPayload) => apiRequest<{ faq: Faq }>('/admin/help/faqs', { method: 'POST', body: input }).then(response => response.faq),
  update: (id: string, input: FaqPayload) => apiRequest<{ faq: Faq }>(`/admin/help/faqs/${id}`, { method: 'PUT', body: input }).then(response => response.faq),
  setStatus: (id: string, status: FaqStatus) => apiRequest<{ faq: Faq }>(`/admin/help/faqs/${id}/status`, { method: 'PATCH', body: { status } }).then(response => response.faq),
}
