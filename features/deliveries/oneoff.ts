import type { IsoDate } from '@/lib/business-time'
import type { CustomerAddressSnapshot, DeliveryCancellationReason, DeliveryInstance } from './types'

/**
 * A delivery that exists because of a Buy Once order item or a trial day (not a recurring subscription).
 * The id is stable per owner, so repeating materialisation can never create a second record.
 */
export type OneOffDeliveryDraft = {
  id: string
  deliveryDate: IsoDate
  customerId: string
  sourceType: 'buy_once' | 'trial'
  orderId: string | null
  orderItemId: string | null
  trialEnrollmentId: string | null
  productId: string
  variantId: string
  quantity: number
  /** Price snapshot for the delivery; null when the catalog price is unavailable (reported, never charged as zero). */
  unitPricePaise: number | null
  deliverySlotId: string | null
  /** Frozen delivery address when the owner has its own (orders do); otherwise the customer's address at creation. */
  addressSnapshot?: CustomerAddressSnapshot
}

export type OneOffChanges = {
  inserts: OneOffDeliveryDraft[]
  updates: Array<{ id: string; patch: Partial<DeliveryInstance> }>
}

/** Cancelled-by-schedule-change records come back if the owner wants them again; owner cancellations are final. */
const REVIVABLE: DeliveryCancellationReason[] = ['schedule_changed']

/**
 * Pure: aligns the stored deliveries of ONE owner (an order or a trial) with what that owner wants.
 * - missing and due today or later -> insert
 * - still scheduled but changed (date, slot, variant, quantity, price) -> update
 * - still scheduled but no longer wanted -> cancel with `cancelReason` (kept as history, never deleted)
 * Delivered, not-delivered and skipped records are never touched. Running twice yields no changes.
 */
export function reconcileOneOffDeliveries({ existing, drafts, today, cancelReason }: { existing: DeliveryInstance[]; drafts: OneOffDeliveryDraft[]; today: IsoDate; cancelReason: DeliveryCancellationReason }): OneOffChanges {
  const byId = new Map(existing.map(item => [item.id, item]))
  const wanted = new Set(drafts.map(draft => draft.id))
  const changes: OneOffChanges = { inserts: [], updates: [] }

  for (const draft of drafts) {
    const stored = byId.get(draft.id)
    if (!stored) { if (draft.deliveryDate >= today) changes.inserts.push(draft); continue }
    const revive = stored.status === 'cancelled' && stored.cancellationReason !== null && REVIVABLE.includes(stored.cancellationReason)
    if (stored.status !== 'scheduled' && !revive) continue
    const patch: Partial<DeliveryInstance> = {}
    if (revive) { patch.status = 'scheduled'; patch.cancellationReason = null }
    if (stored.deliveryDate !== draft.deliveryDate) patch.deliveryDate = draft.deliveryDate
    if (stored.deliverySlotId !== draft.deliverySlotId) patch.deliverySlotId = draft.deliverySlotId
    if (stored.productId !== draft.productId) patch.productId = draft.productId
    if (stored.variantId !== draft.variantId) patch.variantId = draft.variantId
    if (stored.quantity !== draft.quantity) patch.quantity = draft.quantity
    if ((stored.unitPricePaiseSnapshot ?? null) !== draft.unitPricePaise) patch.unitPricePaiseSnapshot = draft.unitPricePaise
    if (Object.keys(patch).length) changes.updates.push({ id: stored.id, patch })
  }

  for (const stored of existing) {
    if (stored.status !== 'scheduled' || wanted.has(stored.id) || stored.deliveryDate < today) continue
    changes.updates.push({ id: stored.id, patch: { status: 'cancelled', cancellationReason: cancelReason } })
  }
  return changes
}
