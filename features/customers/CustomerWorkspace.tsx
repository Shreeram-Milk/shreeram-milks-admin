'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useMaterializedDeliveries } from '../deliveries/useMaterializedDeliveries'
import { SubscriptionForm } from '../subscriptions/components/SubscriptionForm'
import { CustomerDetail } from './components/CustomerDetail'
import { CustomerForm } from './components/CustomerForm'
import { CustomerList } from './components/CustomerList'

/** Routes /customers/** . Mock data lives in browser storage, so rendering waits for hydration. */
export function CustomerWorkspace({ segments = [] }: { segments?: string[] }) {
  const ready = useMaterializedDeliveries()
  if (!ready) return <PageSkeleton />

  const [first, second, third, fourth] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><CustomerList /></Suspense>
  if (first === 'new' && segments.length === 1) return <CustomerForm key="new" />
  if (segments.length === 1) return <CustomerDetail key={first} id={first} />
  if (second === 'edit' && segments.length === 2) return <CustomerForm key={`edit-${first}`} id={first} />
  if (second === 'subscriptions' && third === 'new' && !fourth) return <SubscriptionForm key={`customer-${first}`} presetCustomerId={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/customers">Back to customers</Link></div>
}
