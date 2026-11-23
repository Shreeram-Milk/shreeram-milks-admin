import { apiRequest } from '@/lib/api-client'

export type RefundSource = { kind: 'adjustment' | 'wallet'; id: string }
export type RefundPart = { paymentId: string; merchantOrderId: string; amountPaise: number }
export type RefundAttempt = RefundPart & {
  id: string; merchantRefundId: string; status: 'created' | 'unknown' | 'pending' | 'completed' | 'failed'
  providerReference: string; errorCode: string
}
export type RefundBatch = {
  id: string; amountPaise: number; status: 'processing' | 'completed' | 'failed'; attempts: RefundAttempt[]
}
export type RefundReview = {
  plan: { customerName: string; customerContact: string; amountPaise: number; reason: string; parts: RefundPart[]; batch: RefundBatch | null }
  reviewToken: string | null; expiresAt: string
}
const pathOf = (source: RefundSource) => `/admin/refunds/${source.kind}/${encodeURIComponent(source.id)}`
export const refundAdminApi = {
  review: (source: RefundSource) => apiRequest<RefundReview>(`${pathOf(source)}/review`, { method: 'POST' }),
  confirm: (source: RefundSource, body: { reviewToken: string; password: string; acknowledged: true }) =>
    apiRequest<{ batch: RefundBatch }>(`${pathOf(source)}/confirm`, { method: 'POST', body }),
  check: (source: RefundSource) => apiRequest<{ batch: RefundBatch }>(`${pathOf(source)}/check`, { method: 'POST' }),
}
