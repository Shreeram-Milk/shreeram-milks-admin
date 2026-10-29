import type { IsoDate } from '@/lib/business-time'
import { liveLabels } from '@/lib/i18n/core'
import { t, type BannerKey } from './messages'

export type BannerType = 'promotion' | 'warning' | 'maintenance' | 'informational'
export type BannerAudience = 'all_users' | 'prepaid' | 'credit' | 'subscribers'
export type BannerCtaType = 'none' | 'product' | 'category' | 'offers'
export type BannerStatus = 'active' | 'inactive'

export const BANNER_TYPE_LABELS = liveLabels(t, { promotion: 'typePromotion', warning: 'typeWarning', maintenance: 'typeMaintenance', informational: 'typeInformational' } satisfies Record<BannerType, BannerKey>)
/** Banner types in tab order, with the plural name used on the tab and a line saying what the type is for. */
export const BANNER_TYPES: BannerType[] = ['promotion', 'warning', 'maintenance', 'informational']
export const BANNER_TAB_LABELS = liveLabels(t, { promotion: 'tabPromotion', warning: 'tabWarning', maintenance: 'tabMaintenance', informational: 'tabInformational' } satisfies Record<BannerType, BannerKey>)
export const BANNER_TYPE_DESCRIPTIONS = liveLabels(t, {
  promotion: 'descPromotion', warning: 'descWarning', maintenance: 'descMaintenance', informational: 'descInformational',
} satisfies Record<BannerType, BannerKey>)
export const isBannerType = (value: string | null): value is BannerType => BANNER_TYPES.includes(value as BannerType)

export const BANNER_AUDIENCE_LABELS = liveLabels(t, { all_users: 'audienceAll', prepaid: 'audiencePrepaid', credit: 'audienceCredit', subscribers: 'audienceSubscribers' } satisfies Record<BannerAudience, BannerKey>)
export const BANNER_CTA_LABELS = liveLabels(t, { none: 'ctaNone', product: 'ctaProduct', category: 'ctaCategory', offers: 'ctaOffers' } satisfies Record<BannerCtaType, BannerKey>)

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
