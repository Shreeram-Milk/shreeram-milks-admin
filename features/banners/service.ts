import { windowError } from '@/lib/active-window'
import { categoryService } from '../categories/service'
import { productService } from '../products/service'
import { bannerRepository } from './mock-repository'
import type { Banner, BannerInput, BannerStatus } from './types'

export class BannerRuleError extends Error {}

const sorted = (banners: Banner[]) => [...banners].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))

export const bannerService = {
  list: () => sorted(bannerRepository.list()),
  getById: (id: string) => bannerRepository.get(id),
  /** Display name of whatever the banner opens, for list rows. */
  linkLabel(banner: Banner): string {
    if (banner.linkType === 'product') return productService.getById(banner.linkTargetId)?.name ?? 'Missing product'
    if (banner.linkType === 'category') return categoryService.name(banner.linkTargetId) || 'Missing category'
    return 'No link'
  },
  linkOptions(linkType: Banner['linkType']): Array<{ value: string; label: string }> {
    if (linkType === 'product') return productService.list().filter(product => product.status === 'active').map(product => ({ value: product.id, label: product.name }))
    if (linkType === 'category') return categoryService.options()
    return []
  },
  save(input: BannerInput): Banner {
    const range = windowError(input.startDate, input.endDate)
    if (range) throw new BannerRuleError(range)
    if (input.linkType === 'product' && !productService.getById(input.linkTargetId)) throw new BannerRuleError('Choose a product that exists.')
    if (input.linkType === 'category' && !categoryService.getById(input.linkTargetId)) throw new BannerRuleError('Choose a category that exists.')
    return bannerRepository.save({ ...input, linkTargetId: input.linkType === 'none' ? '' : input.linkTargetId })
  },
  setStatus(id: string, status: BannerStatus) {
    if (!bannerRepository.get(id)) throw new BannerRuleError('Banner not found.')
    bannerRepository.patch(id, { status })
  },
}
