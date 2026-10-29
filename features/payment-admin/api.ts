import { apiRequest } from '@/lib/api-client'
import { liveLabels } from '@/lib/i18n/core'
import { t, type PaymentKey } from './messages'
import type { ListResult } from '../configuration/api'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
export type PaymentPurpose = 'order' | 'credit_settlement' | 'subscription'
export type Fulfilment = 'none' | 'fulfilled' | 'refund_due'
export type ActivityKind = 'started' | 'provider_order_created' | 'provider_error' | 'status_checked' | 'webhook_received' | 'paid' | 'failed' | 'fulfilled' | 'refund_due'

/** One online (PhonePe) payment as staff see it. */
export type OnlinePayment = {
  id: string; customerId: string; customerName: string; customerPhone: string
  purpose: PaymentPurpose; amountPaise: number; status: PaymentStatus; fulfilment: Fulfilment
  /** Our reference for the payment at PhonePe (what PhonePe's dashboard calls the merchant order id). */
  merchantOrderId: string; providerOrderId: string | null; providerTransactionId: string | null; paymentRequestId: string | null
  expiresAt: string | null; failureReason: string; createdAt: string; paidAt: string | null
  method: PaymentMethod | null
}
export type PaymentDetail = OnlinePayment & {
  activity: Array<{ kind: ActivityKind; detail: Record<string, unknown>; createdAt: string }>
  orders: Array<{ id: string; orderNumber: string; status: string; totalPaise: number }>
  refunds: Array<{ amountPaise: number; providerReference: string; createdAt: string }>
  refundDue: Array<{ id: string; amountPaise: number; status: string; reason: string }>
}
/** How a payment was made, as PhonePe reported it. Null until it is paid (and for payments made before this was recorded). */
export type PaymentMethod = { mode: string; instrument: string; bank: string; bankReference: string }

const MODE_LABELS: Readonly<Record<string, string>> = liveLabels(t, {
  UPI_INTENT: 'modeUpiIntent', UPI_COLLECT: 'modeUpiCollect', UPI_QR: 'modeUpiQr', CARD: 'modeCard', NET_BANKING: 'modeNetBanking', TOKEN: 'modeToken', WALLET: 'modeWallet', TEST: 'modeTest',
})
const INSTRUMENT_LABELS: Readonly<Record<string, string>> = liveLabels(t, { DEBIT_CARD: 'instDebit', CREDIT_CARD: 'instCredit', ACCOUNT: 'instAccount', NET_BANKING: 'instNetBanking', WALLET: 'instWallet' })

/** "Debit card", "UPI app · Bank account", "Net banking · HDFC Bank": how a payment was made, in plain words. */
export function describeMethod(mode: string | null | undefined, instrument?: string | null, bank?: string | null): string {
  if (!mode) return t('notRecorded')
  const how = mode === 'CARD' && instrument && INSTRUMENT_LABELS[instrument] ? INSTRUMENT_LABELS[instrument] : (MODE_LABELS[mode] ?? mode.replaceAll('_', ' ').toLowerCase())
  const through = mode.startsWith('UPI') && instrument && INSTRUMENT_LABELS[instrument] ? INSTRUMENT_LABELS[instrument] : ''
  return [how, through, bank ?? ''].filter(Boolean).join(' · ')
}
/** What the bank's reference is called for this method. */
export const bankReferenceLabel = (mode: string | null | undefined): string => (mode?.startsWith('UPI') ? t('utr') : t('bankReference'))

export type PaymentListParams = { search: string; status: string; purpose: string; page: number; pageSize: number }

export const STATUS_LABELS = liveLabels(t, { pending: 'statusPending', paid: 'statusPaid', failed: 'statusFailed', refunded: 'statusRefunded', partially_refunded: 'statusPartly' } satisfies Record<PaymentStatus, PaymentKey>)
export const STATUS_TONE: Record<PaymentStatus, 'pending' | 'delivered' | 'cancelled'> = { pending: 'pending', paid: 'delivered', failed: 'cancelled', refunded: 'cancelled', partially_refunded: 'pending' }
export const PURPOSE_LABELS = liveLabels(t, { order: 'purposeOrder', credit_settlement: 'purposeCredit', subscription: 'purposeSubscription' } satisfies Record<PaymentPurpose, PaymentKey>)
export const FULFILMENT_LABELS = liveLabels(t, { none: 'fulfilNone', fulfilled: 'fulfilDone', refund_due: 'fulfilRefund' } satisfies Record<Fulfilment, PaymentKey>)
/** Each step of a payment's history, in plain words. */
export const ACTIVITY_LABELS = liveLabels(t, {
  started: 'actStarted', provider_order_created: 'actProviderOrder', provider_error: 'actProviderError',
  status_checked: 'actStatusChecked', webhook_received: 'actWebhook', paid: 'actPaid',
  failed: 'actFailed', fulfilled: 'actFulfilled', refund_due: 'actRefundDue',
} satisfies Record<ActivityKind, PaymentKey>)

export const paymentAdminApi = {
  list({ search, status, purpose, page, pageSize }: PaymentListParams): Promise<ListResult<OnlinePayment>> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    if (purpose) query.set('purpose', purpose)
    return apiRequest<ListResult<OnlinePayment>>(`/admin/payments?${query}`)
  },
  async get(id: string): Promise<PaymentDetail> { return (await apiRequest<{ payment: PaymentDetail }>(`/admin/payments/${encodeURIComponent(id)}`)).payment },
  /** Asks PhonePe again about a payment that is still waiting. */
  async check(id: string): Promise<PaymentDetail> { return (await apiRequest<{ payment: PaymentDetail }>(`/admin/payments/${encodeURIComponent(id)}/check`, { method: 'POST', body: {} })).payment },
}
