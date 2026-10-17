import type { ProductStatus, PurchaseMethod } from './api'

export const METHOD_LABELS: Record<PurchaseMethod, string> = { buy_once: 'Buy Once', trial: 'Trial', subscription: 'Subscription' }
export const STATUS_LABELS: Record<ProductStatus, string> = { draft: 'Draft · Unpublished', active: 'Active', inactive: 'Inactive' }
