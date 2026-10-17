import { format } from 'date-fns'

/** All delivery/cut-off/schedule logic runs in this zone, never the machine's local zone. */
export const BUSINESS_TIMEZONE = 'Asia/Kolkata'

/** Calendar date without a time component: `yyyy-MM-dd`. */
export type IsoDate = string

const DAY_MS = 86_400_000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const toUtcMs = (date: IsoDate) => {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}
const fromUtcMs = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10)

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  return fromUtcMs(toUtcMs(value)) === value
}

export function todayInBusinessZone(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export const addDays = (date: IsoDate, days: number): IsoDate => fromUtcMs(toUtcMs(date) + days * DAY_MS)
/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const diffInDays = (from: IsoDate, to: IsoDate): number => Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS)
/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (date: IsoDate): number => new Date(toUtcMs(date)).getUTCDay()

export function formatDisplayDate(date: IsoDate): string {
  if (!isIsoDate(date)) return '—'
  const [year, month, day] = date.split('-').map(Number)
  return format(new Date(year, month - 1, day), 'd MMM yyyy')
}
export function formatWeekdayDate(date: IsoDate): string {
  if (!isIsoDate(date)) return '—'
  const [year, month, day] = date.split('-').map(Number)
  return format(new Date(year, month - 1, day), 'EEE, d MMM yyyy')
}
export function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}
export function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? '—' : formatShortDate(parsed)
}
/** "Sat 17 Oct, 9:00 pm": a moment in business time, for deadlines where the hour matters. */
export function formatDateTime(timestamp: string): string {
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(parsed)
}
const formatShortDate = (value: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(value)

/** Bridge between the `yyyy-MM-dd` domain value and the Date objects react-day-picker works with. */
export function isoToCalendarDate(date: IsoDate): Date | undefined {
  if (!isIsoDate(date)) return undefined
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}
export const calendarDateToIso = (value: Date): IsoDate => format(value, 'yyyy-MM-dd')

/** Calendar month as `yyyy-MM`. */
export type IsoMonth = string
const ISO_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/
export const isIsoMonth = (value: string): boolean => ISO_MONTH.test(value)
export const monthOfDate = (date: IsoDate): IsoMonth => date.slice(0, 7)
export const startOfMonth = (month: IsoMonth): IsoDate => `${month}-01`
export function endOfMonth(month: IsoMonth): IsoDate {
  const [year, monthNumber] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, '0')}`
}
export function shiftMonth(month: IsoMonth, delta: number): IsoMonth {
  const [year, monthNumber] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}
export function formatMonthLabel(month: IsoMonth): string {
  if (!isIsoMonth(month)) return '—'
  const [year, monthNumber] = month.split('-').map(Number)
  return format(new Date(year, monthNumber - 1, 1), 'MMMM yyyy')
}
