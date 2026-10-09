import { orderDeliveryId } from '../deliveries/types'
import type { OneOffDeliveryDraft } from '../deliveries/oneoff'
import type { Order } from './types'

/**
 * Pure: the deliveries an order wants. Only a confirmed order with a delivery date produces any
 * (one per item); drafts and cancelled orders want none, which makes reconciliation cancel stale ones.
 */
export function buildOrderDeliveryDrafts(order: Order): OneOffDeliveryDraft[] {
  if (order.status !== 'confirmed' || !order.deliveryDate) return []
  const deliveryDate = order.deliveryDate
  return order.items.map(item => ({
    id: orderDeliveryId(order.id, item.id), deliveryDate, customerId: order.customerId, sourceType: 'buy_once' as const,
    orderId: order.id, orderItemId: item.id, trialEnrollmentId: null,
    productId: item.productId, variantId: item.variantId, quantity: item.quantity,
    unitPricePaise: item.unitPricePaiseSnapshot, deliverySlotId: order.deliverySlotId, addressSnapshot: order.addressSnapshot,
  }))
}
