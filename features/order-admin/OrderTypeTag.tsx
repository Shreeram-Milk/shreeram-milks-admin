import { ORDER_TYPE_LABELS, type OrderType } from './api'

/** A small coloured tag saying how an order was bought, so subscription and trial deliveries stand out from one-time orders. */
export function OrderTypeTag({ type }: { type: OrderType }) {
  return <span className={`order-type-tag order-type-${type}`}>{ORDER_TYPE_LABELS[type]}</span>
}
