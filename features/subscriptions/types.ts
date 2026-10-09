import type { IsoDate } from '@/lib/business-time'

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'upcoming'
/** `upcoming` is derived (active + start date in the future); only the other three are stored. */
export type StoredSubscriptionStatus = Exclude<SubscriptionStatus, 'upcoming'>
export type ScheduleType = 'daily' | 'alternate_days' | 'custom_weekdays'
export type DeliveryExceptionType = 'skip'
export type DeliveryInstanceState = 'scheduled' | 'skipped' | 'paused'

/** Weekdays are 0 (Sunday) … 6 (Saturday) so they can be compared with `weekdayOf`. */
export type SubscriptionScheduleConfig = {
  scheduleType: ScheduleType
  weekdays: number[]
  /** Required for alternate_days: delivery lands on this date and every second day from it. */
  alternatePatternDate: IsoDate | null
}

/** A pause covers `fromDate` up to, but not including, `resumeDate`. Open-ended while `resumeDate` is null. */
export type SubscriptionPause = {
  id: string
  fromDate: IsoDate
  resumeDate: IsoDate | null
  reason: string
}

export type SubscriptionCancellation = {
  /** Last day on which a delivery may still occur. */
  effectiveDate: IsoDate
  reason: string
}

export type Subscription = {
  id: string
  customerId: string
  productId: string
  variantId: string
  schedule: SubscriptionScheduleConfig
  /** Null only for shipping fulfilment profiles, which have no delivery slots. */
  deliverySlotId: string | null
  /** Units per delivery. Absent on older records, which means 1. */
  quantity?: number
  startDate: IsoDate
  status: StoredSubscriptionStatus
  pauses: SubscriptionPause[]
  cancellation: SubscriptionCancellation | null
  createdAt: string
  updatedAt: string
}

export type SubscriptionInput = {
  customerId: string
  productId: string
  variantId: string
  schedule: SubscriptionScheduleConfig
  deliverySlotId: string | null
  startDate: IsoDate
}

/** One-off exception to a recurring schedule. The recurring schedule itself is never modified. */
export type SubscriptionDeliveryException = {
  id: string
  subscriptionId: string
  date: IsoDate
  slotId: string | null
  type: DeliveryExceptionType
  reason: string
  createdAt: string
}

export type DeliveryPreviewRow = {
  date: IsoDate
  slotId: string | null
  state: DeliveryInstanceState
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = { active: 'Active', paused: 'Paused', cancelled: 'Cancelled', upcoming: 'Upcoming' }
export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = { daily: 'Daily', alternate_days: 'Alternate Days', custom_weekdays: 'Custom Weekdays' }
export const WEEKDAY_SHORT_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** Display order starts on Monday, matching the business week. */
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
