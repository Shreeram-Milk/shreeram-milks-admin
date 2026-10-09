import type { IsoDate } from '@/lib/business-time'
import type { Subscription } from '../subscriptions/types'
import { isDateInPause } from './generation'
import type { DeliveryCancellationReason, DeliveryChanges, DeliveryDraft, DeliveryInstance } from './types'
import { deliveryKey } from './types'

export type ReconcileInput = {
  subscription: Subscription
  /** Records already stored for this subscription (any date). */
  existing: DeliveryInstance[]
  /** What the schedule says should exist in the window. */
  drafts: DeliveryDraft[]
  /** Window being reconciled. Only dates inside it, and not before `today`, are ever touched. */
  windowFrom: IsoDate
  windowTo: IsoDate
  today: IsoDate
}

/** Reasons that mean "put it back if the schedule allows it again" (a resume or a schedule fix). */
const REVIVABLE: DeliveryCancellationReason[] = ['subscription_paused', 'schedule_changed']

function whyNoLongerDue(subscription: Subscription, date: IsoDate): DeliveryCancellationReason {
  if (subscription.cancellation && date > subscription.cancellation.effectiveDate) return 'subscription_cancelled'
  if (isDateInPause(subscription, date)) return 'subscription_paused'
  return 'schedule_changed'
}

/**
 * Pure: the minimal inserts/updates that make stored deliveries match the schedule.
 * Delivered, not-delivered and past records are never changed, and nothing is ever deleted,
 * so history stays intact. Re-running with the same input yields no changes (idempotent).
 */
export function reconcileDeliveries({ subscription, existing, drafts, windowFrom, windowTo, today }: ReconcileInput): DeliveryChanges {
  const floor = windowFrom > today ? windowFrom : today
  const byKey = new Map(existing.map(item => [deliveryKey(item.subscriptionId ?? '', item.deliveryDate, item.deliverySlotId), item]))
  const draftKeys = new Set(drafts.map(draft => draft.key))
  const changes: DeliveryChanges = { inserts: [], updates: [] }

  for (const draft of drafts) {
    if (draft.deliveryDate < floor || draft.deliveryDate > windowTo) continue
    const stored = byKey.get(draft.key)
    if (!stored) { changes.inserts.push(draft); continue }
    if (stored.status === 'delivered' || stored.status === 'not_delivered') continue
    const patch: Partial<DeliveryInstance> = {}
    if (stored.status === 'cancelled') {
      if (stored.cancellationReason && REVIVABLE.includes(stored.cancellationReason)) { patch.status = draft.status; patch.cancellationReason = null; patch.skipReason = draft.skipReason }
      else continue
    } else if (stored.status === 'scheduled' && draft.status === 'skipped') {
      patch.status = 'skipped'; patch.skipReason = draft.skipReason
    }
    const staysScheduled = (stored.status === 'scheduled' && draft.status === 'scheduled') || patch.status === 'scheduled'
    if (staysScheduled) {
      if (stored.productId !== draft.productId) patch.productId = draft.productId
      if (stored.variantId !== draft.variantId) patch.variantId = draft.variantId
      if (stored.quantity !== draft.quantity) patch.quantity = draft.quantity
    }
    if (Object.keys(patch).length) changes.updates.push({ id: stored.id, patch })
  }

  for (const stored of existing) {
    if (stored.status !== 'scheduled' || stored.deliveryDate < floor || stored.deliveryDate > windowTo) continue
    if (draftKeys.has(deliveryKey(stored.subscriptionId ?? '', stored.deliveryDate, stored.deliverySlotId))) continue
    changes.updates.push({ id: stored.id, patch: { status: 'cancelled', cancellationReason: whyNoLongerDue(subscription, stored.deliveryDate) } })
  }
  return changes
}
