export type ProductStatus = 'draft' | 'active' | 'inactive'
export type PurchaseMethod = 'buy_once' | 'trial' | 'subscription'
export type ProductVariant = {
  id: string
  name: string
  sku: string
  pricePaise: number
  compareAtPricePaise?: number
  status: 'active' | 'inactive'
  displayUnit: string
  displayQuantity: number
  productionUnit: string
  productionQuantity: number
}
import { liveLabels } from '@/lib/i18n/core'
import { t } from './messages'

export type ProductBadge = 'bestseller' | 'new' | 'seasonal'
export const PRODUCT_BADGE_LABELS = liveLabels<ProductBadge, 'badgeBestseller' | 'badgeNew' | 'badgeSeasonal'>(t, { bestseller: 'badgeBestseller', new: 'badgeNew', seasonal: 'badgeSeasonal' })
/** How many gallery images and highlight lines a product page can show. */
export const MAX_GALLERY_IMAGES = 10
export const MAX_HIGHLIGHTS = 6
export const MAX_HIGHLIGHT_LENGTH = 60

/** Everything customers read and see about a product, apart from price and how it is sold. Images come from the Media Library. */
export type ProductContent = {
  longDescriptionEn: string
  longDescriptionGu: string
  primaryImageAssetId: string
  galleryAssetIds: string[]
  nutritionEn: string
  nutritionGu: string
  highlightsEn: string[]
  highlightsGu: string[]
  badges: ProductBadge[]
}
export const emptyProductContent = (): ProductContent => ({ longDescriptionEn: '', longDescriptionGu: '', primaryImageAssetId: '', galleryAssetIds: [], nutritionEn: '', nutritionGu: '', highlightsEn: [], highlightsGu: [], badges: [] })

export type Product = {
  id: string
  name: string
  nameGujarati: string
  categoryId: string
  sku: string
  shortDescription: string
  shortDescriptionGujarati: string
  content: ProductContent
  status: ProductStatus
  variants: ProductVariant[]
  purchaseMethods: PurchaseMethod[]
  trialPlanIds: string[]
  subscriptionRuleIds: string[]
  fulfilmentProfileId: string
  updatedAt: string
}
export type ProductInput = Omit<Product, 'id' | 'updatedAt'> & { id?: string }
