import { apiRequest } from '@/lib/api-client'
import { liveLabels } from '@/lib/i18n/core'
import { t, type OrderKey } from './messages'
import type { ListResult } from '../configuration/api'

export const ORDER_STATUSES = ['placed', 'out_for_delivery', 'delivered', 'missed', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type OrderItem = {
  id: string; productId: string; variantId: string; productName: string; productNameGu: string; variantName: string
  purchaseMethod: 'buy_once' | 'trial' | 'subscription'; unitPricePaise: number; quantity: number; lineTotalPaise: number
  /** A free gift from an offer. */
  isGift: boolean
}
/** An order as the backend describes it. Every price and date was decided by the server when it was placed. */
/** The PhonePe payment behind an online order, for staff. */
export type OrderPayment = {
  id: string; merchantOrderId: string; providerOrderId: string | null; providerTransactionId: string | null; status: string; amountPaise: number; paidAt: string | null
  mode: string | null; instrument: string | null; bank: string | null; bankReference: string | null
}
export type AdminOrder = {
  id: string; orderNumber: string; status: OrderStatus; deliveryMethod: 'local_delivery' | 'shipping'
  deliveryDate: string; slot: { id: string; name: string; startTime: string; endTime: string } | null; orderBy: string | null
  recipientName: string; recipientPhone: string; addressLine1: string; addressLine2: string; landmark: string; city: string; pinCode: string; doorstepNote: string
  subtotalPaise: number; discountPaise: number; totalPaise: number
  /** The offer the order used ('' when none). */
  offerTitle: string
  paymentMethod: 'credit' | 'online'; paymentStatus: 'unpaid' | 'paid' | 'partially_refunded' | 'refunded'
  placedAt: string; cancelledAt: string | null; cancelReason: string; items: OrderItem[]
  /** Online orders: the PhonePe payment. Null for credit orders. */
  onlinePayment?: OrderPayment | null
  /** Set when this order is one delivery of a subscription or trial. */
  subscriptionId: string | null
  /** Courier orders: who carries it and the tracking link ('' when not set). */
  courierName: string; trackingUrl: string
  /** When staff returned the money of a missed or delivered order (once only). */
  moneyReturnedAt: string | null
  customerId: string; customerName: string; customerPhone: string
}

export const ORDER_TYPES = ['subscription', 'one_time', 'trial'] as const
export type OrderType = (typeof ORDER_TYPES)[number]
export type OrderListParams = { search: string; status: OrderStatus | ''; date: string; page: number; pageSize: number; slotId?: string; source?: OrderType | ''; productId?: string; payment?: 'credit' | 'online' | '' }
/**
 * A page of orders, how many match in each status (all filters but the status) and how many of each type (all filters but
 * the status and the type), for the summary.
 */
export type OrderListResult = ListResult<AdminOrder> & { counts: Record<OrderStatus, number>; typeCounts: Record<OrderType, number> }

export const orderAdminApi = {
  list({ search, status, date, page, pageSize, slotId, source, productId, payment }: OrderListParams): Promise<OrderListResult> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    if (date) query.set('date', date)
    if (slotId) query.set('slotId', slotId)
    if (source) query.set('source', source)
    if (productId) query.set('productId', productId)
    if (payment) query.set('payment', payment)
    return apiRequest<OrderListResult>(`/admin/orders?${query}`)
  },
  async get(id: string): Promise<AdminOrder> { return (await apiRequest<{ order: AdminOrder }>(`/admin/orders/${encodeURIComponent(id)}`)).order },
  /** Moves an order along. The server checks the step is legal; only a cancelled order gives the money back by itself. */
  async setStatus(id: string, status: Exclude<OrderStatus, 'placed'>, note: string): Promise<AdminOrder> {
    return (await apiRequest<{ order: AdminOrder }>(`/admin/orders/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status, note } })).order
  },
  /** One step for many orders at once. Orders that cannot take the step are reported back, the others move. */
  bulkStatus(orderIds: string[], status: Exclude<OrderStatus, 'placed' | 'cancelled'>, note = ''): Promise<{ updated: number; failed: Array<{ orderId: string; code: string }> }> {
    return apiRequest('/admin/orders/bulk-status', { method: 'POST', body: { orderIds, status, note } })
  },
  /** Staff's decision to give back the money of a missed or delivered order: credit back, or a refund to send in PhonePe. */
  async returnMoney(id: string, reason: string): Promise<AdminOrder> {
    return (await apiRequest<{ order: AdminOrder }>(`/admin/orders/${encodeURIComponent(id)}/return-money`, { method: 'POST', body: { reason } })).order
  },
  async setCourier(id: string, courierName: string, trackingUrl: string): Promise<AdminOrder> {
    return (await apiRequest<{ order: AdminOrder }>(`/admin/orders/${encodeURIComponent(id)}/courier`, { method: 'PUT', body: { courierName, trackingUrl } })).order
  },
}

export const ORDER_STATUS_LABELS = liveLabels(t, { placed: 'statusPlaced', out_for_delivery: 'statusOutForDelivery', delivered: 'statusDelivered', missed: 'statusMissed', cancelled: 'statusCancelled' } satisfies Record<OrderStatus, OrderKey>)
/** The badge colour for each status, using the shared badge's three tones. */
export const ORDER_STATUS_TONE: Record<OrderStatus, 'pending' | 'delivered' | 'cancelled'> = { placed: 'pending', out_for_delivery: 'pending', delivered: 'delivered', missed: 'cancelled', cancelled: 'cancelled' }
/** The steps staff can take from each status (the server enforces the same rules). */
export const NEXT_STATUSES: Record<OrderStatus, ReadonlyArray<Exclude<OrderStatus, 'placed'>>> = { placed: ['out_for_delivery', 'missed', 'cancelled'], out_for_delivery: ['delivered', 'missed', 'cancelled'], delivered: [], missed: [], cancelled: [] }
export const PAYMENT_LABELS = liveLabels(t, { credit: 'payCredit', online: 'payOnline' })
export const PAYMENT_STATUS_LABELS = liveLabels(t, { unpaid: 'payUnpaid', paid: 'payPaid', partially_refunded: 'payPartlyRefunded', refunded: 'payRefunded' } satisfies Record<AdminOrder['paymentStatus'], OrderKey>)

/** How an order was bought: a one-time purchase, or one delivery of a subscription or trial. */
export const orderType = (order: Pick<AdminOrder, 'subscriptionId' | 'items'>): OrderType => (!order.subscriptionId ? 'one_time' : order.items[0]?.purchaseMethod === 'trial' ? 'trial' : 'subscription')
export const ORDER_TYPE_LABELS = liveLabels(t, { one_time: 'typeOneTime', subscription: 'typeSubscription', trial: 'typeTrial' } satisfies Record<OrderType, OrderKey>)
