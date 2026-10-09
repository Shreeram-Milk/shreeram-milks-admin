import type { IsoDate } from '@/lib/business-time'

export type BannerLinkType = 'none' | 'product' | 'category'
export type BannerStatus = 'active' | 'inactive'

/** A promotional banner on the customer app's home screen. */
export type Banner = {
  id: string
  /** Small overline text, e.g. "SEASONAL OFFER". */
  label: string
  title: string
  titleGujarati: string
  subtitle: string
  subtitleGujarati: string
  imageUrl: string
  linkType: BannerLinkType
  /** Product or category id, depending on `linkType`; empty when there is no link. */
  linkTargetId: string
  startDate: IsoDate | ''
  endDate: IsoDate | ''
  /** Lower numbers appear first. */
  sortOrder: number
  status: BannerStatus
  updatedAt: string
}

export type BannerInput = Omit<Banner, 'id' | 'updatedAt'> & { id?: string }
