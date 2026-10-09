import type { IsoDate } from './business-time'

export type WindowState = 'inactive' | 'scheduled' | 'live' | 'expired'

/**
 * Where a record sits relative to its optional start/end dates (both inclusive, business-zone dates).
 * An inactive record is never live, whatever its dates say.
 */
export function windowState(record: { status: 'active' | 'inactive'; startDate: IsoDate | ''; endDate: IsoDate | '' }, today: IsoDate): WindowState {
  if (record.status === 'inactive') return 'inactive'
  if (record.startDate && today < record.startDate) return 'scheduled'
  if (record.endDate && today > record.endDate) return 'expired'
  return 'live'
}

export const WINDOW_STATE_LABELS: Record<WindowState, string> = { inactive: 'Inactive', scheduled: 'Scheduled', live: 'Live', expired: 'Expired' }

/** Returns an error message when the end date is before the start date. */
export function windowError(startDate: IsoDate | '', endDate: IsoDate | ''): string | null {
  return startDate && endDate && endDate < startDate ? 'The end date must be on or after the start date.' : null
}
