import { apiRequest } from '@/lib/api-client'
import { liveLabels } from '@/lib/i18n/core'
import { t, type WalletKey } from './messages'

export type RefundStatus = 'requested' | 'sent' | 'cancelled'
/** What staff see: "sent" becomes "In their bank" once PhonePe confirms the money arrived (live keys only). */
export type RefundStage = RefundStatus | 'completed'
export const stageOf = (refund: { status: RefundStatus; completedAt: string | null }): RefundStage => (refund.status === 'sent' && refund.completedAt ? 'completed' : refund.status)

/** One PhonePe refund staff sent for a request, against one top-up payment. */
export type RefundPart = { paymentId: string; merchantOrderId: string; amountPaise: number; providerReference: string; createdAt: string }
export type WalletRefund = {
  id: string; customerId: string; amountPaise: number; status: RefundStatus; customerNote: string; providerReference: string; staffNote: string
  requestedAt: string; handledAt: string | null; completedAt: string | null; parts: RefundPart[]
}
/** A PhonePe payment that added money: what a refund is sent against. */
export type TopUpPayment = { paymentId: string; merchantOrderId: string; transactionId: string | null; amountPaise: number; paidAt: string | null; refundedPaise: number; leftPaise: number }
/** balance = added − spent + returned − refunded − waiting + adjusted */
export type WalletTotals = { addedPaise: number; spentPaise: number; returnedPaise: number; refundedPaise: number; waitingPaise: number; adjustedPaise: number; balancePaise: number }
export type WalletCustomer = { customerId: string; name: string; phone: string; email: string; customerType: string; status: string }
export type WalletRow = WalletCustomer & WalletTotals & { lastActivityAt: string }
export type WalletOverview = { heldPaise: number; customersHolding: number; waitingCount: number; waitingPaise: number; refundedPaise: number }
export type WalletRecord = { customer: WalletCustomer; totals: WalletTotals; topUps: TopUpPayment[]; refunds: WalletRefund[] }
export type WalletEntryType = 'top_up' | 'order_payment' | 'order_return' | 'refund_hold' | 'refund_release' | 'manual_adjustment'
export type WalletEntry = { id: string; type: WalletEntryType; direction: 'credit' | 'debit'; amountPaise: number; description: string; orderNumber: string | null; createdAt: string }
export type RefundDetail = WalletRefund & { customerName: string; customerPhone: string; customerEmail: string; topUps: TopUpPayment[]; totals: WalletTotals | null; suggested: Array<{ paymentId: string; amountPaise: number }> }
export type WalletShow = 'all' | 'waiting' | 'balance'

const id = encodeURIComponent

export const walletAdminApi = {
  async list({ search, show, page, pageSize }: { search: string; show: WalletShow; page: number; pageSize: number }) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), show })
    if (search) query.set('search', search)
    return apiRequest<{ items: WalletRow[]; total: number; overview: WalletOverview }>(`/admin/wallet/customers?${query}`)
  },
  async record(customerId: string, page: number, pageSize: number) {
    return apiRequest<{ record: WalletRecord; history: { items: WalletEntry[]; total: number } }>(`/admin/wallet/customers/${id(customerId)}?page=${page}&pageSize=${pageSize}`)
  },
  async refund(refundId: string): Promise<RefundDetail> {
    return (await apiRequest<{ request: RefundDetail }>(`/admin/wallet/refund-requests/${id(refundId)}`)).request
  },
  /** Only after each refund was sent in the PhonePe dashboard. */
  async markSent(refundId: string, body: { parts: Array<{ paymentId: string; amountPaise: number; providerReference: string }>; note: string }): Promise<WalletRefund> {
    return (await apiRequest<{ request: WalletRefund }>(`/admin/wallet/refund-requests/${id(refundId)}/sent`, { method: 'POST', body })).request
  },
  async cancel(refundId: string, body: { note: string }): Promise<WalletRefund> {
    return (await apiRequest<{ request: WalletRefund }>(`/admin/wallet/refund-requests/${id(refundId)}/cancel`, { method: 'POST', body })).request
  },
  async adjust(customerId: string, body: { direction: 'credit' | 'debit'; amountPaise: number; reason: string }) {
    return apiRequest<{ wallet: { balancePaise: number } }>(`/admin/wallet/customers/${id(customerId)}/adjustments`, { method: 'POST', body })
  },
}

export const STAGE_LABELS = liveLabels(t, { requested: 'statusRequested', sent: 'statusSent', completed: 'statusCompleted', cancelled: 'statusCancelled' } satisfies Record<RefundStage, WalletKey>)
export const STAGE_TONE: Record<RefundStage, 'pending' | 'delivered' | 'cancelled'> = { requested: 'pending', sent: 'delivered', completed: 'delivered', cancelled: 'cancelled' }
