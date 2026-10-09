'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useMaterializedDeliveries } from '../deliveries/useMaterializedDeliveries'
import { CreditAccountDetail } from './components/CreditAccountDetail'
import { CreditAccountsOverview } from './components/CreditAccountsOverview'

/** Routes /credit-accounts/** . Catches up delivered credit deliveries first so balances are current (idempotent). */
export function CreditAccountsWorkspace({ segments = [] }: { segments?: string[] }) {
  const ready = useMaterializedDeliveries()
  if (!ready) return <PageSkeleton />
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><CreditAccountsOverview /></Suspense>
  if (segments.length === 1) return <Suspense fallback={<PageSkeleton />}><CreditAccountDetail key={segments[0]} customerId={segments[0]} /></Suspense>
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/credit-accounts">Back to credit accounts</Link></div>
}
