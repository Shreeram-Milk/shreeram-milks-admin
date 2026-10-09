import type { IsoDate } from '@/lib/business-time'

export type DeliveryStatus = 'scheduled' | 'delivered' | 'skipped' | 'cancelled' | 'not_delivered'
/** `trial` and `buy_once` exist for future integration; only `subscription` produces deliveries today. */
export type DeliverySourceType = 'subscription' | 'trial' | 'buy_once'
/** Why a delivery was cancelled. System reasons let a later resume or schedule fix revive the record. */
export type DeliveryCancellationReason = 'subscription_cancelled' | 'subscription_paused' | 'schedule_changed' | 'order_cancelled' | 'trial_cancelled'
export type NotDeliveredReasonCode = 'customer_unavailable' | 'address_issue' | 'product_unavailable' | 'other'

/** Where the delivery was meant to go, frozen at generation time so later address edits don't rewrite history. */
export type CustomerAddressSnapshot = {
  line1: string
  line2: string
  locality: string
  city: string
  state: string
  pinCode: string
}

export type DeliveryInstance = {
  /** Deterministic from subscription + date + slot, so regeneration can never duplicate. */
  id: string
  deliveryDate: IsoDate
  customerId: string
  /** Set only for subscription deliveries. */
  subscriptionId: string | null
  /** Set for Buy Once order deliveries (one delivery per order item). */
  orderId?: string | null
  orderItemId?: string | null
  /** Set for trial deliveries. */
  trialEnrollmentId?: string | null
  productId: string
  variantId: string
  quantity: number
  /**
   * Sold-variant unit price (paise) at the time the delivery was created. Charges use this, never today's price.
   * `null` means the price is known to be missing; `undefined` only exists on records from before this field.
   */
  unitPricePaiseSnapshot?: number | null
  deliverySlotId: string | null
  fulfilmentProfileId: string
  serviceAreaId: string
  customerAddressSnapshot: CustomerAddressSnapshot
  customerPincode: string
  status: DeliveryStatus
  sourceType: DeliverySourceType
  createdAt: string
  updatedAt: string
  deliveredAt: string | null
  notDeliveredReason: NotDeliveredReasonCode | null
  skipReason: string
  cancellationReason: DeliveryCancellationReason | null
  adminNotes: string
}

/** A delivery the schedule says should exist, before it is stored. */
export type DeliveryDraft = {
  key: string
  subscriptionId: string
  deliveryDate: IsoDate
  deliverySlotId: string | null
  productId: string
  variantId: string
  quantity: number
  status: 'scheduled' | 'skipped'
  skipReason: string
}

export type DeliveryChanges = {
  inserts: DeliveryDraft[]
  updates: Array<{ id: string; patch: Partial<DeliveryInstance> }>
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = { scheduled: 'Scheduled', delivered: 'Delivered', skipped: 'Skipped', cancelled: 'Cancelled', not_delivered: 'Not Delivered' }
export const DELIVERY_SOURCE_LABELS: Record<DeliverySourceType, string> = { subscription: 'Subscription', trial: 'Trial', buy_once: 'Buy Once' }
export const NOT_DELIVERED_REASON_LABELS: Record<NotDeliveredReasonCode, string> = { customer_unavailable: 'Customer unavailable', address_issue: 'Address issue', product_unavailable: 'Product unavailable', other: 'Other' }
export const CANCELLATION_REASON_LABELS: Record<DeliveryCancellationReason, string> = { subscription_cancelled: 'Subscription cancelled', subscription_paused: 'Subscription paused', schedule_changed: 'Schedule changed', order_cancelled: 'Order cancelled', trial_cancelled: 'Trial cancelled' }

export const deliveryKey = (subscriptionId: string, deliveryDate: IsoDate, slotId: string | null) => `${subscriptionId}|${deliveryDate}|${slotId ?? 'none'}`
export const deliveryIdFor = (subscriptionId: string, deliveryDate: IsoDate, slotId: string | null) => `delivery-${subscriptionId}-${deliveryDate}-${slotId ?? 'none'}`

export const orderDeliveryId = (orderId: string, orderItemId: string) => `delivery-order-${orderId}-${orderItemId}`
export const trialDeliveryId = (trialId: string, deliveryDate: IsoDate) => `delivery-trial-${trialId}-${deliveryDate}`
