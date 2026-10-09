import { addDays, diffInDays, type IsoDate } from '@/lib/business-time'
import { getUpcomingSubscriptionDates } from '../subscriptions/schedule'
import type { Subscription, SubscriptionDeliveryException } from '../subscriptions/types'
import { deliveryKey, type DeliveryDraft } from './types'

export type GenerateDeliveriesInput = {
  subscription: Subscription
  /** First day of the window (inclusive). */
  fromDate: IsoDate
  /** Last day of the window (inclusive). */
  toDate: IsoDate
  existingExceptions: SubscriptionDeliveryException[]
}

/** Upper bound on one generation window; materialisation is deliberately short-range. */
export const MAX_GENERATION_DAYS = 31

const inPause = (subscription: Subscription, date: IsoDate) =>
  subscription.pauses.some(pause => date >= pause.fromDate && (pause.resumeDate === null || date < pause.resumeDate))

/**
 * Pure: the deliveries a subscription's recurring rule produces inside a window.
 * Paused days and days after cancellation are not generated. Skip exceptions yield `skipped` drafts
 * so the occurrence stays visible. Quantity defaults to 1 until subscriptions carry their own.
 */
export function generateSubscriptionDeliveries({ subscription, fromDate, toDate, existingExceptions }: GenerateDeliveriesInput): DeliveryDraft[] {
  const windowDays = Math.min(MAX_GENERATION_DAYS, Math.max(0, diffInDays(fromDate, toDate) + 1))
  if (windowDays === 0) return []
  const lastDay = subscription.cancellation && subscription.cancellation.effectiveDate < toDate ? subscription.cancellation.effectiveDate : addDays(fromDate, windowDays - 1)
  if (lastDay < fromDate) return []
  const dates = getUpcomingSubscriptionDates({ schedule: subscription.schedule, startDate: subscription.startDate, from: fromDate, until: lastDay, limit: windowDays })
  const skips = new Map(existingExceptions.filter(item => item.type === 'skip').map(item => [item.date, item.reason]))
  return dates.filter(date => !inPause(subscription, date)).map(date => ({
    key: deliveryKey(subscription.id, date, subscription.deliverySlotId),
    subscriptionId: subscription.id,
    deliveryDate: date,
    deliverySlotId: subscription.deliverySlotId,
    productId: subscription.productId,
    variantId: subscription.variantId,
    quantity: subscription.quantity ?? 1,
    status: skips.has(date) ? 'skipped' : 'scheduled',
    skipReason: skips.get(date) ?? '',
  }))
}

export { inPause as isDateInPause }
