import { apiRequest } from '@/lib/api-client'
import type { DeliveryMethod, ListResult } from '../configuration/api'
import type { ProductBadge } from './types'

export type ProductStatus = 'draft' | 'active' | 'inactive'
export type PurchaseMethod = 'buy_once' | 'trial' | 'subscription'

export type ProductVariant = {
  id: string; name: string; sku: string; pricePaise: number; compareAtPricePaise: number | null; status: 'active' | 'inactive'
  displayUnit: string; displayQuantity: number; productionUnit: string; productionQuantity: number
}
/** A stored picture: its id (what the product links) and a short-lived link to show it. */
export type ImageRef = { assetId: string; url: string }

export type Product = {
  id: string; name: string; nameGu: string; categoryId: string; sku: string
  shortDescriptionEn: string; shortDescriptionGu: string; longDescriptionEn: string; longDescriptionGu: string; nutritionEn: string; nutritionGu: string
  highlightsEn: string[]; highlightsGu: string[]; badges: ProductBadge[]; purchaseMethods: PurchaseMethod[]
  deliveryMethod: DeliveryMethod | null; serviceAreaId: string | null; cutoffRuleId: string | null; includeInProductionPlanning: boolean; excludedFromCredit: boolean
  trialPlanIds: string[]; subscriptionRuleIds: string[]; status: ProductStatus; updatedAt: string
  variants: ProductVariant[]; primaryImage: ImageRef | null; gallery: ImageRef[]
}

/** One line of the product list. */
export type ProductSummary = {
  id: string; name: string; nameGu: string; categoryId: string; categoryName: string; sku: string; status: ProductStatus; purchaseMethods: PurchaseMethod[]
  deliveryMethod: DeliveryMethod | null; serviceAreaName: string | null; excludedFromCredit: boolean; variantCount: number; priceFromPaise: number | null; imageUrl: string | null; updatedAt: string
}

/** Everything sent to save a product. The server validates all of it again and drops anything not listed here. */
export type ProductPayload = {
  name: string; nameGu: string; categoryId: string; sku: string; shortDescriptionEn: string; shortDescriptionGu: string
  longDescriptionEn: string; longDescriptionGu: string; nutritionEn: string; nutritionGu: string; highlightsEn: string[]; highlightsGu: string[]; badges: ProductBadge[]
  primaryImageAssetId: string | null; galleryAssetIds: string[]; purchaseMethods: PurchaseMethod[]; deliveryMethod: DeliveryMethod | null; serviceAreaId: string | null; cutoffRuleId: string | null; includeInProductionPlanning: boolean; excludedFromCredit: boolean
  trialPlanIds: string[]; subscriptionRuleIds: string[]
  status: ProductStatus
  variants: Array<Omit<ProductVariant, 'id'> & { id?: string }>
}

export type ProductListParams = { search: string; status: ProductStatus | ''; categoryId: string; page: number; pageSize: number }

export const productApi = {
  list: ({ search, status, categoryId, page, pageSize }: ProductListParams) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    if (categoryId) query.set('categoryId', categoryId)
    return apiRequest<ListResult<ProductSummary>>(`/admin/products?${query}`)
  },
  get: (id: string) => apiRequest<{ product: Product }>(`/admin/products/${id}`).then(response => response.product),
  create: (input: ProductPayload) => apiRequest<{ product: Product }>('/admin/products', { method: 'POST', body: input }).then(response => response.product),
  update: (id: string, input: ProductPayload) => apiRequest<{ product: Product }>(`/admin/products/${id}`, { method: 'PUT', body: input }).then(response => response.product),
  /** Marks or unmarks a product as not available on credit, without touching anything else. */
  setCreditExclusion: (id: string, excludedFromCredit: boolean) => apiRequest<{ product: Product }>(`/admin/products/${id}/credit-exclusion`, { method: 'PATCH', body: { excludedFromCredit } }).then(response => response.product),
  /** Switching on is refused (code PRODUCT_NOT_READY) until the product is complete. */
  setStatus: (id: string, status: 'active' | 'inactive') => apiRequest<{ product: Product }>(`/admin/products/${id}/status`, { method: 'PATCH', body: { status } }).then(response => response.product),
}
