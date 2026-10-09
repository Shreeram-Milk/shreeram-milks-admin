import { StatusBadge } from '@/components/shared/StatusBadge'
import { ACCOUNT_STATUS_LABELS, type CreditAccountStatus } from '../types'

export function AccountStatusBadge({ status }: { status: CreditAccountStatus }) {
  return <StatusBadge status={status}>{ACCOUNT_STATUS_LABELS[status]}</StatusBadge>
}
