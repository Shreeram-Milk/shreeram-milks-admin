import { Suspense } from 'react'
import { DeliveryPlacesWorkspace } from '@/features/delivery-places/DeliveryPlacesWorkspace'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
export default function DeliveryPlacesPage() { return <Suspense fallback={<PageSkeleton />}><DeliveryPlacesWorkspace /></Suspense> }
