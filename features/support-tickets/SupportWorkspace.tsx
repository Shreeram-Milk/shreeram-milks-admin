'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { TicketDetail } from './components/TicketDetail'
import { TicketList } from './components/TicketList'

/** Routes /support/** . Tickets come from the backend; customers raise them in the app, so there is no "log ticket" page. */
export function SupportWorkspace({ segments = [] }: { segments?: string[] }) {
  const [first] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><TicketList /></Suspense>
  if (first && segments.length === 1) return <TicketDetail key={first} id={first} />
  return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/support">Back to tickets</Link></div>
}
