import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

const statusTone: Record<string, 'pending' | 'delivered' | 'cancelled'> = {
  active: 'delivered',
  delivered: 'delivered',
  scheduled: 'delivered',
  pending: 'pending',
  draft: 'pending',
  paused: 'pending',
  upcoming: 'pending',
  skipped: 'cancelled',
  suspended: 'pending',
  confirmed: 'delivered',
  fulfilled: 'delivered',
  completed: 'delivered',
  converted: 'delivered',
  applied: 'delivered',
  refund_pending: 'pending',
  closed: 'cancelled',
  'in progress': 'pending',
  inactive: 'cancelled',
  cancelled: 'cancelled',
}

export function StatusBadge({ status, children }: { status: string; children?: ReactNode }) {
  const tone = statusTone[status.toLowerCase()] ?? 'pending'
  return <Badge variant="secondary" className={`status-pill ${tone}`}>{children ?? status}</Badge>
}
