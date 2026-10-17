import type { IsoDate } from '@/lib/business-time'

export type BannerType = 'promotion' | 'warning' | 'maintenance' | 'informational'
export type BannerAudience = 'all_users' | 'prepaid' | 'credit' | 'subscribers'
export type BannerCtaType = 'none' | 'product' | 'category' | 'offers'
export type BannerStatus = 'active' | 'inactive'

export const BANNER_TYPE_LABELS: Record<BannerType, string> = { promotion: 'Promotion', warning: 'Warning', maintenance: 'Maintenance', informational: 'Information' }
/** Banner types in tab order, with the plural name used on the tab and a line saying what the type is for. */
export const BANNER_TYPES: BannerType[] = ['promotion', 'warning', 'maintenance', 'informational']
export const BANNER_TAB_LABELS: Record<BannerType, string> = { promotion: 'Promotions', warning: 'Warnings', maintenance: 'Maintenance', informational: 'Information' }
export const BANNER_TYPE_DESCRIPTIONS: Record<BannerType, string> = {
  promotion: 'Offers shown as a swipeable slideshow at the top of the home screen. Each one can carry a photo.',
  warning: 'Plain text for something that needs attention, such as a delay or a changed delivery time. No picture.',
  maintenance: 'Shown while a service is paused or being worked on. It can carry a small SVG icon.',
  informational: 'Helpful, low-priority information. It can carry a small SVG icon.',
}
export const isBannerType = (value: string | null): value is BannerType => BANNER_TYPES.includes(value as BannerType)

export const BANNER_AUDIENCE_LABELS: Record<BannerAudience, string> = { all_users: 'Everyone', prepaid: 'Prepaid customers', credit: 'Credit customers', subscribers: 'Customers with a subscription' }
export const BANNER_CTA_LABELS: Record<BannerCtaType, string> = { none: 'No link', product: 'A product', category: 'A category', offers: 'The Offers page' }

/**
 * A message on the customer app's home screen: a promotion, or a notice such as a delay or maintenance window.
 * It is stored by the backend; this is the shape the API returns.
 */
export type Banner = {
  id: string
  type: BannerType
  audience: BannerAudience
  titleEn: string
  titleGu: string
  messageEn: string
  messageGu: string
  /** A short optional tag on the card, such as "SEASONAL OFFER". Empty shows no tag. */
  labelEn: string
  labelGu: string
  /** The uploaded picture, if any. Saved by id; `imageUrl` is a short-lived link the backend adds for showing it. */
  imageAssetId: string | null
  imageUrl: string | null
  ctaType: BannerCtaType
  /** Product or category id, depending on `ctaType`; empty when there is no link. */
  ctaTarget: string
  startDate: IsoDate | null
  endDate: IsoDate | null
  /** Lower numbers appear first. */
  sortOrder: number
  status: BannerStatus
  createdAt: string
  updatedAt: string
}

export type BannerInput = Omit<Banner, 'id' | 'createdAt' | 'updatedAt' | 'imageUrl'>
