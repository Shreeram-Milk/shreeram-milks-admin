import { apiRequest } from '@/lib/api-client'
import type { ListResult } from '../configuration/api'

export type MessageKey = 'order_placed' | 'order_cancelled' | 'out_for_delivery' | 'delivered' | 'day_skipped' | 'credit_limit_reached' | 'payment_requested' | 'refund_sent'

/** One automatic message: when it is sent, what it may mention, and its wording. The events are fixed; staff edit only the wording. */
export type MessageTemplate = {
  key: MessageKey; label: string; trigger: string; placeholders: string[]
  title: string; titleGujarati: string; body: string; bodyGujarati: string; enabled: boolean; updatedAt: string
}
export type TemplateInput = Pick<MessageTemplate, 'title' | 'titleGujarati' | 'body' | 'bodyGujarati' | 'enabled'>

/** Who a message goes to: everyone, a group chosen by filters, or customers picked one by one. */
export type Audience =
  | { type: 'all' }
  | { type: 'filter'; customerType?: 'prepaid' | 'credit'; pinCodes?: string[]; hasActiveSubscription?: boolean }
  | { type: 'customers'; customerIds: string[] }

export type AudienceReach = { customers: number; withDevices: number }

export type BroadcastRecord = {
  id: string; title: string; titleGujarati: string; body: string; bodyGujarati: string; audience: Audience
  recipients: number; pushed: number; status: 'sending' | 'sent' | 'failed'; createdAt: string; finishedAt: string | null
}
export type BroadcastInput = { title: string; titleGujarati: string; body: string; bodyGujarati: string; audience: Audience; opensOffers: boolean }

export const notificationApi = {
  async templates(): Promise<MessageTemplate[]> { return (await apiRequest<{ templates: MessageTemplate[] }>('/admin/notifications/templates')).templates },
  async saveTemplate(key: MessageKey, input: TemplateInput): Promise<MessageTemplate> {
    return (await apiRequest<{ template: MessageTemplate }>(`/admin/notifications/templates/${key}`, { method: 'PUT', body: input })).template
  },
  /** How many customers a group reaches right now, and how many of them have notifications switched on in the app. */
  audienceReach(audience: Audience): Promise<AudienceReach> { return apiRequest<AudienceReach>('/admin/notifications/audience', { method: 'POST', body: { audience } }) },
  broadcasts(page: number, pageSize: number): Promise<ListResult<BroadcastRecord>> {
    return apiRequest<ListResult<BroadcastRecord>>(`/admin/notifications/broadcasts?page=${page}&pageSize=${pageSize}`)
  },
  async send(input: BroadcastInput): Promise<BroadcastRecord> {
    return (await apiRequest<{ broadcast: BroadcastRecord }>('/admin/notifications/broadcasts', { method: 'POST', body: input })).broadcast
  },
}
