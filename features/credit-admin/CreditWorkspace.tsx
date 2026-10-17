'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { CreditDetail } from './CreditDetail'
import { CreditList } from './CreditList'

/** Routes /credit-accounts/** . Accounts come from the backend: a customer becomes a credit customer on the Customers page. */
export function CreditWorkspace({ segments = [] }: { segments?: string[] }) {
  const [first] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><CreditList /></Suspense>
  if (first && segments.length === 1) return <CreditDetail key={first} customerId={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/credit-accounts">Back to credit accounts</Link></div>
}
