import { Suspense } from 'react'
import { BannerWorkspace } from '@/features/banners/BannerWorkspace'

export default function BannersPage() {
  // useSearchParams (the selected tab) needs a Suspense boundary.
  return <Suspense><BannerWorkspace /></Suspense>
}
