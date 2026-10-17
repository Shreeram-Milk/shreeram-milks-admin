import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { DeliveryBoard } from '@/features/delivery-admin/DeliveryBoard'

export default async function DeliveriesPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  if (segments.length > 0) return <div className="product-state"><strong>Page not found</strong><Link className="secondary-button" href="/deliveries">Back to deliveries</Link></div>
  return <Suspense fallback={<PageSkeleton />}><DeliveryBoard /></Suspense>
}
