'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { PaymentDetail } from './PaymentDetail'
import { PaymentList } from './PaymentList'

/** Routes /online-payments/** : the list, and one payment by id. */
export function PaymentWorkspace({ segments = [] }: { segments?: string[] }) {
  const [first] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><PaymentList /></Suspense>
  if (first && segments.length === 1) return <PaymentDetail key={first} id={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/online-payments">Back to online payments</Link></div>
}
