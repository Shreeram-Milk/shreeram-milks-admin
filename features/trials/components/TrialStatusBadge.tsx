import { StatusBadge } from '@/components/shared/StatusBadge'
import { TRIAL_STATUS_LABELS, type TrialStatus } from '../types'

export function TrialStatusBadge({ status }: { status: TrialStatus }) {
  return <StatusBadge status={status}>{TRIAL_STATUS_LABELS[status]}</StatusBadge>
}
