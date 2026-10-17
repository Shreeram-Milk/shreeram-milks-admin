'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { KIND_TEXT, type SubscriptionKind } from './api'
import { SubscriptionAdminDetail } from './SubscriptionAdminDetail'
import { SubscriptionAdminList } from './SubscriptionAdminList'

/** Routes /subscriptions/** and /trials/** : the list of that kind and one by id. Customers start them in the app. */
export function SubscriptionAdminWorkspace({ kind, segments = [] }: { kind: SubscriptionKind; segments?: string[] }) {
  const [first, second] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><SubscriptionAdminList kind={kind} /></Suspense>
  if (first && segments.length === 1) return <SubscriptionAdminDetail key={first} id={first} />
  // The days used to be a page of their own; old links now open the subscription, where the days are.
  if (first && second === 'days' && segments.length === 2) return <SubscriptionAdminDetail key={first} id={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href={KIND_TEXT[kind].path}>Back to {KIND_TEXT[kind].plural.toLowerCase()}</Link></div>
}
