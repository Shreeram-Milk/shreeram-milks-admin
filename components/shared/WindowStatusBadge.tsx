import { StatusBadge } from '@/components/shared/StatusBadge'
import { windowStateLabel, type WindowState } from '@/lib/active-window'

const BADGE_STATUS: Record<WindowState, string> = { live: 'active', scheduled: 'pending', expired: 'cancelled', inactive: 'inactive' }

/** Live / Scheduled / Expired / Inactive, for records that run between two optional dates. */
export function WindowStatusBadge({ state }: { state: WindowState }) {
  return <StatusBadge status={BADGE_STATUS[state]}>{windowStateLabel(state)}</StatusBadge>
}
