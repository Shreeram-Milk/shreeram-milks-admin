import type { IsoDate } from '@/lib/business-time'
import type { Paise } from '@/lib/money'

export type OfferDiscountType = 'percent' | 'flat'
export type OfferAppliesTo = 'all_orders' | 'subscriptions' | 'first_order'

export const OFFER_APPLIES_TO_LABELS: Record<OfferAppliesTo, string> = { all_orders: 'All orders', subscriptions: 'Subscriptions only', first_order: 'First order only' }

/**
 * A discount the customer app shows and the server applies. This is configuration only:
 * the server recalculates every order total and decides whether an offer applies.
 */
export type Offer = {
  id: string
  name: string
  nameGujarati: string
  description: string
  /** Optional code the customer types; empty means the offer applies automatically. */
  code: string
  discountType: OfferDiscountType
  /** Whole percent (1–100) when `discountType` is percent, otherwise integer paise. */
  value: number
  minOrderPaise: Paise
  appliesTo: OfferAppliesTo
  startDate: IsoDate | ''
  endDate: IsoDate | ''
  status: 'active' | 'inactive'
  updatedAt: string
}

export type OfferInput = Omit<Offer, 'id' | 'updatedAt'> & { id?: string }
