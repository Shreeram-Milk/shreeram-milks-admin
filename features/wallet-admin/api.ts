import { apiRequest } from '@/lib/api-client'
import { liveLabels } from '@/lib/i18n/core'
import { t, type WalletKey } from './messages'

export const REFUND_STATUSES = ['requested', 'sent', 'cancelled'] as const
export type RefundStatus = (typeof REFUND_STATUSES)[number]

/** A customer asked for their wallet balance back. The amount was set aside from their wallet when they asked. */
export type WalletRefund = {
  id: string; customerId: string; customerName: string; customerPhone: string; customerEmail: string
  amountPaise: number; status: RefundStatus; customerNote: string; providerReference: string; staffNote: string
  requestedAt: string; handledAt: string | null
}
/** A PhonePe payment that added money to this customer's wallet: what the refund is sent against. */
export type TopUpPayment = { paymentId: string; merchantOrderId: string; transactionId: string | null; amountPaise: number; paidAt: string | null }
export type WalletRefundDetail = WalletRefund & { topUps: TopUpPayment[] }

export const walletAdminApi = {
  async list({ status, page, pageSize }: { status: RefundStatus | ''; page: number; pageSize: number }): Promise<{ rows: WalletRefund[]; total: number }> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (status) query.set('status', status)
    const result = await apiRequest<{ items: WalletRefund[]; total: number }>(`/admin/wallet/refund-requests?${query}`)
    return { rows: result.items, total: result.total }
  },
  async get(id: string): Promise<WalletRefundDetail> {
    return (await apiRequest<{ request: WalletRefundDetail }>(`/admin/wallet/refund-requests/${encodeURIComponent(id)}`)).request
  },
  /** Only after the money was sent in the PhonePe dashboard. */
  async markSent(id: string, body: { providerReference: string; note: string }): Promise<WalletRefund> {
    return (await apiRequest<{ request: WalletRefund }>(`/admin/wallet/refund-requests/${encodeURIComponent(id)}/sent`, { method: 'POST', body })).request
  },
  async cancel(id: string, body: { note: string }): Promise<WalletRefund> {
    return (await apiRequest<{ request: WalletRefund }>(`/admin/wallet/refund-requests/${encodeURIComponent(id)}/cancel`, { method: 'POST', body })).request
  },
}

export const STATUS_LABELS = liveLabels(t, { requested: 'statusRequested', sent: 'statusSent', cancelled: 'statusCancelled' } satisfies Record<RefundStatus, WalletKey>)
export const STATUS_TONE: Record<RefundStatus, 'pending' | 'delivered' | 'cancelled'> = { requested: 'pending', sent: 'delivered', cancelled: 'cancelled' }
