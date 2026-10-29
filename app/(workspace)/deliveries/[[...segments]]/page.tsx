import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { DeliveryBoard } from '@/features/delivery-admin/DeliveryBoard'
import { RiderSheet } from '@/features/delivery-admin/RiderSheet'
import { deliveryMessages } from '@/features/delivery-admin/messages'
import { translateFor } from '@/lib/i18n/core'
import { requestLanguage } from '@/lib/i18n/server'

export default async function DeliveriesPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  if (segments.length === 1 && segments[0] === 'rider-sheet') return <Suspense fallback={<PageSkeleton />}><RiderSheet /></Suspense>
  if (segments.length > 0) {
    // Drawn on the server, so the words come from this browser's language cookie.
    const t = translateFor(deliveryMessages, await requestLanguage())
    return <div className="product-state"><strong>{t('pageNotFound')}</strong><Link className="secondary-button" href="/deliveries">{t('backToDeliveries')}</Link></div>
  }
  return <Suspense fallback={<PageSkeleton />}><DeliveryBoard /></Suspense>
}
