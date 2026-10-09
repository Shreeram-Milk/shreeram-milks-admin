'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useMaterializedDeliveries } from '../deliveries/useMaterializedDeliveries'
import { SubscriptionDetail } from './components/SubscriptionDetail'
import { SubscriptionForm } from './components/SubscriptionForm'
import { SubscriptionList } from './components/SubscriptionList'

/** Routes /subscriptions/** . Mock data lives in browser storage, so rendering waits for hydration. */
export function SubscriptionWorkspace({ segments = [] }: { segments?: string[] }) {
  const ready = useMaterializedDeliveries()
  if (!ready) return <PageSkeleton />

  const [first, second] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><SubscriptionList /></Suspense>
  if (first === 'new' && segments.length === 1) return <SubscriptionForm key="new" />
  if (segments.length === 1) return <SubscriptionDetail key={first} id={first} />
  if (second === 'edit' && segments.length === 2) return <SubscriptionForm key={`edit-${first}`} subscriptionId={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/subscriptions">Back to subscriptions</Link></div>
}
