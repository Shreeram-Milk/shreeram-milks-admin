import type { IsoDate } from '@/lib/business-time'
import type { Paise } from '@/lib/money'
import { liveLabels } from '@/lib/i18n/core'
import { t, type OfferKey } from './messages'

export type OfferKind = 'percent' | 'flat' | 'free_gift'
export type OfferScope = 'order' | 'products'

export const OFFER_KIND_LABELS = liveLabels(t, { percent: 'kindPercent', flat: 'kindFlat', free_gift: 'kindGift' } satisfies Record<OfferKind, OfferKey>)
export const OFFER_KIND_HINTS = liveLabels(t, { percent: 'hintPercent', flat: 'hintFlat', free_gift: 'hintGift' } satisfies Record<OfferKind, OfferKey>)

/** An offer as the server stores it. The server decides every amount at checkout; this is only the setup. */
export type Offer = {
  id: string
  title: string; titleGu: string; description: string; descriptionGu: string
  kind: OfferKind
  percent: number | null
  flatPaise: Paise | null
  maxDiscountPaise: Paise | null
  minOrderPaise: Paise
  scope: OfferScope
  /** Products that count (scope "products") or that earn the gift (free gift). */
  productIds: string[]
  appliesOneTime: boolean; appliesTrial: boolean; appliesSubscription: boolean
  minPlanDays: number | null
  giftVariantId: string | null
  /** The product the gift size belongs to, so the form can show it. */
  giftProductId: string | null
  giftQuantity: number
  /** Empty means the offer applies by itself. */
  code: string | null
  startsOn: IsoDate | null; endsOn: IsoDate | null
  totalLimit: number | null; perCustomerLimit: number | null
  status: 'active' | 'inactive'
  /** "Cow Ghee - 250 g": the gift, named for the list. */
  giftLabel: string | null
  createdAt: string; updatedAt: string
}

/** What is sent to save an offer. */
export type OfferInput = Omit<Offer, 'id' | 'giftLabel' | 'giftProductId' | 'createdAt' | 'updatedAt'>
