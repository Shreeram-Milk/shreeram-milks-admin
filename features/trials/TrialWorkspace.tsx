'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useMaterializedDeliveries } from '../deliveries/useMaterializedDeliveries'
import { SubscriptionForm } from '../subscriptions/components/SubscriptionForm'
import { TrialDetail } from './components/TrialDetail'
import { TrialForm } from './components/TrialForm'
import { TrialsList } from './components/TrialsList'

/** Routes /trials/** , including /trials/[id]/convert which reuses the subscription form pre-filled from the trial. */
export function TrialWorkspace({ segments = [] }: { segments?: string[] }) {
  const ready = useMaterializedDeliveries()
  if (!ready) return <PageSkeleton />
  const [first, second] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><TrialsList /></Suspense>
  if (first === 'new' && segments.length === 1) return <Suspense fallback={<PageSkeleton />}><NewTrial /></Suspense>
  if (segments.length === 1) return <TrialDetail key={first} id={first} />
  if (second === 'convert' && segments.length === 2) return <SubscriptionForm key={`convert-${first}`} fromTrialId={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/trials">Back to trials</Link></div>
}

/** `/trials/new?customer=<id>` pre-selects the customer. */
function NewTrial() {
  const customer = useSearchParams().get('customer') ?? undefined
  return <TrialForm key={`new-${customer ?? ''}`} presetCustomerId={customer} />
}
