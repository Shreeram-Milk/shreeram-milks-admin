import { addDays, diffInDays, weekdayOf, type IsoDate } from '@/lib/business-time'
import { SCHEDULE_TYPE_LABELS, WEEKDAY_DISPLAY_ORDER, WEEKDAY_SHORT_LABELS, type DeliveryPreviewRow, type Subscription, type SubscriptionDeliveryException, type SubscriptionScheduleConfig } from './types'

/** Upper bound on days scanned so an empty weekday list can never loop forever. */
const MAX_SCAN_DAYS = 730

type ScheduledDatesInput = {
  schedule: SubscriptionScheduleConfig
  startDate: IsoDate
  /** First day to consider (inclusive); the effective start is the later of `startDate` and `from`. */
  from: IsoDate
  /** Last day to consider (inclusive). */
  until?: IsoDate
  limit: number
}

function occursOn(schedule: SubscriptionScheduleConfig, date: IsoDate): boolean {
  switch (schedule.scheduleType) {
    case 'daily':
      return true
    case 'custom_weekdays':
      return schedule.weekdays.includes(weekdayOf(date))
    case 'alternate_days': {
      if (!schedule.alternatePatternDate) return false
      return Math.abs(diffInDays(schedule.alternatePatternDate, date)) % 2 === 0
    }
  }
}

/** Pure: the next `limit` delivery dates a schedule produces, before any pause, skip or cancellation is applied. */
export function getUpcomingSubscriptionDates({ schedule, startDate, from, until, limit }: ScheduledDatesInput): IsoDate[] {
  const first = from > startDate ? from : startDate
  const dates: IsoDate[] = []
  for (let offset = 0; offset < MAX_SCAN_DAYS && dates.length < limit; offset += 1) {
    const date = addDays(first, offset)
    if (until && date > until) break
    if (occursOn(schedule, date)) dates.push(date)
  }
  return dates
}

export function describeSchedule(schedule: SubscriptionScheduleConfig): string {
  if (schedule.scheduleType !== 'custom_weekdays') return SCHEDULE_TYPE_LABELS[schedule.scheduleType]
  return describeWeekdays(schedule.weekdays)
}

export function describeWeekdays(weekdays: number[]): string {
  const selected = WEEKDAY_DISPLAY_ORDER.filter(day => weekdays.includes(day))
  return selected.length ? selected.map(day => WEEKDAY_SHORT_LABELS[day]).join(', ') : '—'
}

type PreviewInput = {
  subscription: Subscription
  exceptions: SubscriptionDeliveryException[]
  today: IsoDate
  limit: number
}

/** Pure: delivery rows from today onwards with pause, skip and cancellation applied. Nothing is persisted. */
export function buildDeliveryPreview({ subscription, exceptions, today, limit }: PreviewInput): DeliveryPreviewRow[] {
  const until = subscription.cancellation?.effectiveDate
  const dates = getUpcomingSubscriptionDates({ schedule: subscription.schedule, startDate: subscription.startDate, from: today, until, limit })
  const skipped = new Set(exceptions.filter(item => item.type === 'skip').map(item => item.date))
  return dates.map(date => {
    const paused = subscription.pauses.some(pause => date >= pause.fromDate && (pause.resumeDate === null || date < pause.resumeDate))
    const state = paused ? 'paused' : skipped.has(date) ? 'skipped' : 'scheduled'
    return { date, slotId: subscription.deliverySlotId, state }
  })
}

export function getNextDeliveryDate(subscription: Subscription, exceptions: SubscriptionDeliveryException[], today: IsoDate): IsoDate | null {
  const rows = buildDeliveryPreview({ subscription, exceptions, today, limit: 60 })
  return rows.find(row => row.state === 'scheduled')?.date ?? null
}
