'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { WalletList } from './WalletList'
import { WalletRecord } from './WalletRecord'
import { t } from './messages'

/** Routes /wallet-refunds/** : the list of every wallet, and one customer's full wallet record. */
export function WalletWorkspace({ segments = [] }: { segments?: string[] }) {
  const [first] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><WalletList /></Suspense>
  if (first && segments.length === 1) return <WalletRecord key={first} customerId={first} />
  return <div className="product-state"><strong>{t('recordFailed')}</strong><Link className="secondary-button" href="/wallet-refunds">{t('back')}</Link></div>
}
