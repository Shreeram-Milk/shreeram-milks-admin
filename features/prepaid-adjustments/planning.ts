import { isValidPaise } from '@/lib/money'
import type { CustomerType } from '../customers/types'
import type { DeliveryInstance } from '../deliveries/types'
import type { PrepaidAdjustmentPolicy } from './policy'
import type { AdjustmentTrigger, Entitlement, PrepaidAdjustmentType } from './types'

export type AdjustmentPlan =
  | { kind: 'adjustment'; type: PrepaidAdjustmentType; amountPaise: number | null; quantity: number; dedupeKey: string; reason: string }
  | { kind: 'none'; reason: string }
  | { kind: 'issue'; message: string }

/**
 * Pure: what (if anything) a skipped or subscription-cancelled delivery owes a prepaid customer under a policy.
 * Credit customers never get one (they are only ever charged for delivered items), and the amount comes from the
 * delivery's own price snapshot in integer paise. A money adjustment that cannot be priced is an issue, never ₹0.
 */
export function planAdjustment({ trigger, delivery, customerType, policy }: { trigger: AdjustmentTrigger; delivery: Pick<DeliveryInstance, 'id' | 'status' | 'quantity' | 'unitPricePaiseSnapshot' | 'cancellationReason' | 'subscriptionId'>; customerType: CustomerType | undefined; policy: PrepaidAdjustmentPolicy }): AdjustmentPlan {
  if (customerType !== 'prepaid') return { kind: 'none', reason: 'Only prepaid customers receive prepaid adjustments.' }
  if (!delivery.subscriptionId) return { kind: 'none', reason: 'Only subscription deliveries are covered.' }
  const matches = trigger === 'skip' ? delivery.status === 'skipped' : delivery.status === 'cancelled' && delivery.cancellationReason === 'subscription_cancelled'
  if (!matches) return { kind: 'none', reason: trigger === 'skip' ? 'The delivery is not skipped.' : 'The delivery was not cancelled with its subscription.' }
  const type = trigger === 'skip' ? policy.skipHandling : policy.cancelHandling
  const reason = trigger === 'skip' ? 'Skipped delivery' : 'Subscription cancelled'
  const dedupeKey = `${trigger}:${delivery.id}`
  if (!Number.isInteger(delivery.quantity) || delivery.quantity <= 0) return { kind: 'issue', message: 'The delivery has an invalid quantity.' }
  if (type === 'carry_forward') return { kind: 'adjustment', type, amountPaise: null, quantity: delivery.quantity, dedupeKey, reason }
  const price = delivery.unitPricePaiseSnapshot
  if (!isValidPaise(price) || price < 0) return { kind: 'issue', message: 'The delivery has no valid price snapshot, so its value cannot be credited.' }
  return { kind: 'adjustment', type, amountPaise: price * delivery.quantity, quantity: delivery.quantity, dedupeKey, reason }
}

export const describeEntitlement = (entitlement: Entitlement): string => `${entitlement.quantity} × ${entitlement.productName} · ${entitlement.variantName}`
