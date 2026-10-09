import { isValidPaise, type Paise } from '@/lib/money'
import type { DeliveryInstance } from '../deliveries/types'
import type { CustomerType } from '../customers/types'

export type DeliveryChargeDecision =
  | { kind: 'charge'; amountPaise: Paise; unitPricePaise: Paise; quantity: number }
  | { kind: 'not_chargeable'; reason: string }
  | { kind: 'issue'; message: string }

/**
 * Pure: whether a delivery creates a customer charge, and for how much.
 * Only DELIVERED deliveries of CREDIT customers are charged, at the price snapshot taken for that delivery
 * (never today's product price). A delivered credit delivery that can't be priced is an issue, never ₹0.
 * Production quantities play no part: the charge is sold-variant price × delivered quantity.
 */
export function computeDeliveryCharge(delivery: Pick<DeliveryInstance, 'status' | 'quantity' | 'unitPricePaiseSnapshot'>, customerType: CustomerType | undefined): DeliveryChargeDecision {
  if (customerType !== 'credit') return { kind: 'not_chargeable', reason: customerType ? 'Customer is not a credit customer.' : 'Customer not found.' }
  if (delivery.status !== 'delivered') return { kind: 'not_chargeable', reason: 'Only delivered deliveries are chargeable.' }
  const price = delivery.unitPricePaiseSnapshot
  if (!isValidPaise(price) || price < 0) return { kind: 'issue', message: 'Marked Delivered but has no valid price snapshot.' }
  if (!Number.isInteger(delivery.quantity) || delivery.quantity <= 0) return { kind: 'issue', message: 'Marked Delivered but has an invalid quantity.' }
  return { kind: 'charge', amountPaise: price * delivery.quantity, unitPricePaise: price, quantity: delivery.quantity }
}
