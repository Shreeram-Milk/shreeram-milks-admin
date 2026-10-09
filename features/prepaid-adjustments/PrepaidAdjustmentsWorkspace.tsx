'use client'

import { Suspense } from 'react'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useMaterializedDeliveries } from '../deliveries/useMaterializedDeliveries'
import { PrepaidAdjustmentsList } from './components/PrepaidAdjustmentsList'

/** Route /prepaid-adjustments. Catches up skipped / cancelled prepaid deliveries first (idempotent). */
export function PrepaidAdjustmentsWorkspace() {
  const ready = useMaterializedDeliveries()
  if (!ready) return <PageSkeleton />
  return <Suspense fallback={<PageSkeleton />}><PrepaidAdjustmentsList /></Suspense>
}
