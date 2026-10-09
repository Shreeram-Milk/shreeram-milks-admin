'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useHydrated } from '@/hooks/useHydrated'
import { TicketDetail } from './components/TicketDetail'
import { TicketsList } from './components/TicketsList'

/** Routes /support/** . Waits for the browser, where the mock data lives. */
export function SupportWorkspace({ segments = [] }: { segments?: string[] }) {
  const hydrated = useHydrated()
  if (!hydrated) return <PageSkeleton />
  const [first] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><TicketsList /></Suspense>
  if (segments.length === 1) return <TicketDetail key={first} id={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/support">Back to tickets</Link></div>
}
