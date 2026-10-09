import type { IsoDate } from '@/lib/business-time'
import type { Paise } from '@/lib/money'
import type { CustomerAddressSnapshot } from '../deliveries/types'

/** Controlled so further order types can be added later; only Buy Once exists today (trials have their own lifecycle). */
export type OrderType = 'buy_once'
/** `draft`, `confirmed`, `cancelled` are stored; `scheduled` and `fulfilled` are derived from the order's deliveries. */
export type OrderStatus = 'draft' | 'confirmed' | 'scheduled' | 'fulfilled' | 'cancelled'
export type StoredOrderStatus = Extract<OrderStatus, 'draft' | 'confirmed' | 'cancelled'>
/** Captured from the customer's account model at creation. */
export type OrderPaymentMode = 'prepaid' | 'credit'

/** Product, variant and price are copied at creation so later catalog edits never rewrite history. */
export type OrderItem = {
  id: string
  orderId: string
  productId: string
  variantId: string
  productNameSnapshot: string
  variantNameSnapshot: string
  skuSnapshot: string
  unitPricePaiseSnapshot: Paise
  quantity: number
  lineTotalPaise: Paise
}

export type Order = {
  id: string
  /** Human-friendly number, e.g. ORD-1004. */
  orderNumber: string
  customerId: string
  status: StoredOrderStatus
  orderType: OrderType
  paymentMode: OrderPaymentMode
  /** All items of one order share this fulfilment profile. */
  fulfilmentProfileId: string
  deliverySlotId: string | null
  deliveryDate: IsoDate | null
  addressSnapshot: CustomerAddressSnapshot
  pincode: string
  items: OrderItem[]
  subtotalPaise: Paise
  adjustmentPaise: Paise
  totalPaise: Paise
  cancellation: { reason: string; cancelledOn: IsoDate } | null
  createdAt: string
  updatedAt: string
}

/** What the admin submits. Names, prices and totals are always computed by the service, never trusted from the client. */
export type OrderItemInput = { id?: string; productId: string; variantId: string; quantity: number }
export type OrderInput = {
  customerId: string
  items: OrderItemInput[]
  deliverySlotId: string | null
  deliveryDate: IsoDate
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = { draft: 'Draft', confirmed: 'Confirmed', scheduled: 'Scheduled', fulfilled: 'Fulfilled', cancelled: 'Cancelled' }
export const ORDER_TYPE_LABELS: Record<OrderType, string> = { buy_once: 'Buy Once' }
