import { addDays, formatDisplayDate, todayInBusinessZone, type IsoDate } from './business-time'

/** "Today", "Tomorrow", otherwise the formatted date. */
export function formatRelativeDate(date: IsoDate, today: IsoDate = todayInBusinessZone()): string {
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return formatDisplayDate(date)
}
