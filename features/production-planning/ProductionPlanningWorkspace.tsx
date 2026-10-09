'use client'

import { Suspense } from 'react'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useMaterializedDeliveries } from '../deliveries/useMaterializedDeliveries'
import { ProductionPlanningView } from './components/ProductionPlanningView'

/** Route /production-planning. Read-only; ensures the next 14 days of deliveries exist before aggregating. */
export function ProductionPlanningWorkspace() {
  const ready = useMaterializedDeliveries()
  if (!ready) return <PageSkeleton rows={4} />
  return <Suspense fallback={<PageSkeleton rows={4} />}><ProductionPlanningView /></Suspense>
}
