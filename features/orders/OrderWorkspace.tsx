'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useMaterializedDeliveries } from '../deliveries/useMaterializedDeliveries'
import { OrderDetail } from './components/OrderDetail'
import { OrderForm } from './components/OrderForm'
import { OrdersList } from './components/OrdersList'

/** Routes /orders/** . Waits for the browser and keeps order deliveries materialised. */
export function OrderWorkspace({ segments = [] }: { segments?: string[] }) {
  const ready = useMaterializedDeliveries()
  if (!ready) return <PageSkeleton />
  const [first, second] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><OrdersList /></Suspense>
  if (first === 'new' && segments.length === 1) return <Suspense fallback={<PageSkeleton />}><NewOrder /></Suspense>
  if (segments.length === 1) return <OrderDetail key={first} id={first} />
  if (second === 'edit' && segments.length === 2) return <OrderForm key={`edit-${first}`} orderId={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/orders">Back to orders</Link></div>
}

/** `/orders/new?customer=<id>` pre-selects the customer (used from the customer page). */
function NewOrder() {
  const customer = useSearchParams().get('customer') ?? undefined
  return <OrderForm key={`new-${customer ?? ''}`} presetCustomerId={customer} />
}
