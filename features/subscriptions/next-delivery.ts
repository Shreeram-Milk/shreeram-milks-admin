import { formatRelativeDate } from '@/lib/relative-date'
import type { SubscriptionView } from './service'

/** List/detail label for the next delivery: a date, or why there isn't one. */
export function nextDeliveryLabel(view: SubscriptionView): string {
  if (view.nextDelivery) return formatRelativeDate(view.nextDelivery)
  if (view.status === 'cancelled') return 'Cancelled'
  if (view.status === 'paused') return 'Paused'
  return 'None scheduled'
}
