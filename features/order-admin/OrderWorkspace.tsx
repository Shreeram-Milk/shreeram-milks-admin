'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { OrderDetail } from './OrderDetail'
import { OrderList } from './OrderList'

/** Routes /orders/** . Orders come from the backend; customers place them in the app, so there is no "new order" page. */
export function OrderWorkspace({ segments = [] }: { segments?: string[] }) {
  const [first] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><OrderList /></Suspense>
  if (first && segments.length === 1) return <OrderDetail key={first} id={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/orders">Back to orders</Link></div>
}
