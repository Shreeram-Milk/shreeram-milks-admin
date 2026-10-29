import type { IsoDate } from './business-time'
import { tc } from './i18n/common'

export type WindowState = 'inactive' | 'scheduled' | 'live' | 'expired'

/**
 * Where a record sits relative to its optional start/end dates (both inclusive, business-zone dates).
 * An inactive record is never live, whatever its dates say.
 */
export function windowState(record: { status: 'active' | 'inactive'; startDate: IsoDate | '' | null; endDate: IsoDate | '' | null }, today: IsoDate): WindowState {
  if (record.status === 'inactive') return 'inactive'
  if (record.startDate && today < record.startDate) return 'scheduled'
  if (record.endDate && today > record.endDate) return 'expired'
  return 'live'
}

/** Inactive / Scheduled / Live / Expired, in the admin's language. */
export const windowStateLabel = (state: WindowState): string => tc(state)

/** Returns an error message when the end date is before the start date. */
export function windowError(startDate: IsoDate | '' | null, endDate: IsoDate | '' | null): string | null {
  return startDate && endDate && endDate < startDate ? tc('endBeforeStart') : null
}
