import { addDays, formatDisplayDate, formatTime12h, todayInBusinessZone, type IsoDate } from '@/lib/business-time'
import type { DayRelation } from '../configuration/types'
import type { CutoffState } from './types'

/** Business timezone is fixed IST (+05:30, no DST), so the instant can be built without a timezone library. */
const BUSINESS_OFFSET = '+05:30'

export type CutoffDescription = { state: CutoffState; label: string }

function dayWord(date: IsoDate, today: IsoDate): string {
  if (date === today) return 'today'
  if (date === addDays(today, -1)) return 'yesterday'
  if (date === addDays(today, 1)) return 'tomorrow'
  return `on ${formatDisplayDate(date)}`
}

/** Pure: whether the ordering cut-off for a delivery date has passed, plus a plain-language label. */
export function describeCutoff({ deliveryDate, dayRelation, cutoffTime, now = new Date() }: { deliveryDate: IsoDate; dayRelation: DayRelation; cutoffTime: string; now?: Date }): CutoffDescription {
  const cutoffDate = dayRelation === 'previous_day' ? addDays(deliveryDate, -1) : deliveryDate
  const instant = new Date(`${cutoffDate}T${cutoffTime}:00${BUSINESS_OFFSET}`)
  const today = todayInBusinessZone(now)
  const time = formatTime12h(cutoffTime)
  return now.getTime() >= instant.getTime()
    ? { state: 'passed', label: `Passed at ${time} ${dayWord(cutoffDate, today)}` }
    : { state: 'open', label: `Open until ${time} ${dayWord(cutoffDate, today)}` }
}
