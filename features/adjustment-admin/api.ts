import { apiRequest } from '@/lib/api-client'
import type { ListResult } from '../configuration/api'

export const ADJUSTMENT_TYPES = ['carry_forward', 'account_credit', 'refund_pending', 'manual_adjustment'] as const
export const ADJUSTMENT_STATUSES = ['pending', 'applied', 'cancelled'] as const
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number]
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number]

/** Something the business owes a prepaid customer: a refund to send, credit to give, or a paid delivery to carry forward. */
export type Adjustment = {
  id: string; customerId: string; customerName: string; customerPhone: string; orderId: string | null; orderNumber: string | null
  type: AdjustmentType; status: AdjustmentStatus; amountPaise: number | null; quantity: number | null; productName: string | null; variantName: string | null
  reason: string; effectiveDate: string; createdAt: string
}
export type AdjustmentListParams = { search: string; status: AdjustmentStatus | ''; type: AdjustmentType | ''; page: number; pageSize: number }

export const adjustmentAdminApi = {
  list({ search, status, type, page, pageSize }: AdjustmentListParams): Promise<ListResult<Adjustment>> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    if (type) query.set('type', type)
    return apiRequest<ListResult<Adjustment>>(`/admin/prepaid-adjustments?${query}`)
  },
  async create(body: { customerId: string; type: 'account_credit' | 'refund_pending' | 'manual_adjustment'; amountPaise: number; reason: string }): Promise<Adjustment> {
    return (await apiRequest<{ adjustment: Adjustment }>('/admin/prepaid-adjustments', { method: 'POST', body })).adjustment
  },
  /** Marks it done. For a refund of a paid order, the reference is the one PhonePe showed when the refund was sent there. */
  async apply(id: string, body: { providerReference: string; note: string }): Promise<Adjustment> {
    return (await apiRequest<{ adjustment: Adjustment }>(`/admin/prepaid-adjustments/${encodeURIComponent(id)}/apply`, { method: 'POST', body })).adjustment
  },
  async cancel(id: string): Promise<Adjustment> { return (await apiRequest<{ adjustment: Adjustment }>(`/admin/prepaid-adjustments/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} })).adjustment },
}

export const TYPE_LABELS: Record<AdjustmentType, string> = { carry_forward: 'Delivery moved later', account_credit: 'Credit on account', refund_pending: 'Refund to send', manual_adjustment: 'Other correction' }
export const STATUS_LABELS: Record<AdjustmentStatus, string> = { pending: 'To do', applied: 'Done', cancelled: 'Cancelled' }
export const STATUS_TONE: Record<AdjustmentStatus, 'pending' | 'delivered' | 'cancelled'> = { pending: 'pending', applied: 'delivered', cancelled: 'cancelled' }
