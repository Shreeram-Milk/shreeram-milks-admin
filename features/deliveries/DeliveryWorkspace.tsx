'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { DeliveryDetail } from './components/DeliveryDetail'
import { DeliverySchedule } from './components/DeliverySchedule'
import { useMaterializedDeliveries } from './useMaterializedDeliveries'

/** Routes /deliveries/** . Mock data lives in browser storage, so rendering waits for hydration. */
export function DeliveryWorkspace({ segments = [] }: { segments?: string[] }) {
  const ready = useMaterializedDeliveries()
  if (!ready) return <PageSkeleton />
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><DeliverySchedule /></Suspense>
  if (segments.length === 1) return <DeliveryDetail key={segments[0]} id={segments[0]} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/deliveries">Back to deliveries</Link></div>
}
