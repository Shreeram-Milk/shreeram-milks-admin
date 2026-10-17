import { onboardingRepository } from '../onboarding/mock-repository'
import { productRepository } from '../products/mock-repository'
import { qualityReportRepository } from '../quality-reports/mock-repository'
import type { MediaReference } from './types'

/**
 * Everything that points at a media asset. Reads feature repositories directly (not their services) because the
 * services depend on the library. Each feature that stores an asset id adds its lookup here.
 */
export function referencesTo(assetId: string): MediaReference[] {
  return [
    ...qualityReportRepository.list().filter(report => report.mediaAssetId === assetId).map(report => ({ feature: 'Quality report', label: report.titleEn, href: '/content/quality-reports' })),
    ...productRepository.list().filter(product => product.content.primaryImageAssetId === assetId || product.content.galleryAssetIds.includes(assetId)).map(product => ({ feature: 'Product', label: product.name, href: `/products/${product.id}` })),
    ...onboardingRepository.list().filter(slide => slide.imageAssetId === assetId).map(slide => ({ feature: 'Onboarding slide', label: slide.titleEn, href: '/content/onboarding' })),
  ]
}
