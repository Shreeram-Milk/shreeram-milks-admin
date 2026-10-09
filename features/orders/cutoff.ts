import type { IsoDate } from '@/lib/business-time'
import { describeCutoff, type CutoffDescription } from '../production-planning/cutoff'
import type { SubscriptionContext } from '../subscriptions/service'

/**
 * Pure: whether ordering for this slot and date is still before the fulfilment profile's cut-off.
 * Informational only; an admin may still place the order. Null when the slot has no configured cut-off.
 */
export function orderCutoffStatus(context: Pick<SubscriptionContext, 'cutoffRule'>, slotId: string, deliveryDate: IsoDate, now?: Date): (CutoffDescription & { ruleName: string }) | null {
  const rule = context.cutoffRule
  const condition = rule?.conditions.find(item => item.deliverySlotId === slotId)
  if (!rule || !condition) return null
  return { ...describeCutoff({ deliveryDate, dayRelation: condition.dayRelation, cutoffTime: condition.cutoffTime, now }), ruleName: rule.name }
}
