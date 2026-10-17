import { apiRequest } from '@/lib/api-client'
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

const MODE_LABELS: Record<string, string> = {
  UPI_INTENT: 'UPI app', UPI_COLLECT: 'UPI request', UPI_QR: 'UPI QR code', CARD: 'Card', NET_BANKING: 'Net banking', TOKEN: 'Saved card', WALLET: 'PhonePe wallet', TEST: 'Test payment (no money moved)',
}
const INSTRUMENT_LABELS: Record<string, string> = { DEBIT_CARD: 'Debit card', CREDIT_CARD: 'Credit card', ACCOUNT: 'Bank account', NET_BANKING: 'Net banking', WALLET: 'Wallet' }

/** "Debit card", "UPI app · Bank account", "Net banking · HDFC Bank": how a payment was made, in plain words. */
export function describeMethod(mode: string | null | undefined, instrument?: string | null, bank?: string | null): string {
  if (!mode) return 'Not recorded'
  const how = mode === 'CARD' && instrument && INSTRUMENT_LABELS[instrument] ? INSTRUMENT_LABELS[instrument] : (MODE_LABELS[mode] ?? mode.replaceAll('_', ' ').toLowerCase())
  const through = mode.startsWith('UPI') && instrument && INSTRUMENT_LABELS[instrument] ? INSTRUMENT_LABELS[instrument] : ''
  return [how, through, bank ?? ''].filter(Boolean).join(' · ')
}
/** What the bank's reference is called for this method. */
export const bankReferenceLabel = (mode: string | null | undefined): string => (mode?.startsWith('UPI') ? 'UTR (bank reference)' : 'Bank reference')

export type PaymentListParams = { search: string; status: string; purpose: string; page: number; pageSize: number }

export const STATUS_LABELS: Record<PaymentStatus, string> = { pending: 'Waiting for PhonePe', paid: 'Paid', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Partly refunded' }
export const STATUS_TONE: Record<PaymentStatus, 'pending' | 'delivered' | 'cancelled'> = { pending: 'pending', paid: 'delivered', failed: 'cancelled', refunded: 'cancelled', partially_refunded: 'pending' }
export const PURPOSE_LABELS: Record<PaymentPurpose, string> = { order: 'Order', credit_settlement: 'Credit payment request', subscription: 'Subscription or trial (paid upfront)' }
export const FULFILMENT_LABELS: Record<Fulfilment, string> = { none: '—', fulfilled: 'Delivered (orders placed / request settled)', refund_due: 'Refund needed' }
/** Each step of a payment's history, in plain words. */
export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  started: 'Customer started paying', provider_order_created: 'PhonePe payment created', provider_error: 'PhonePe could not be reached',
  status_checked: 'Checked with PhonePe', webhook_received: 'PhonePe sent a notification', paid: 'PhonePe confirmed the payment',
  failed: 'Payment failed', fulfilled: 'Orders placed / request settled', refund_due: 'Refund needed (see Money → Owed to customers)',
}

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
