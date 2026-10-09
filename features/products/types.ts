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
export type Product = {
  id: string
  name: string
  category: string
  sku: string
  shortDescription: string
  imageUrl: string
  status: ProductStatus
  variants: ProductVariant[]
  purchaseMethods: PurchaseMethod[]
  trialPlanIds: string[]
  subscriptionRuleIds: string[]
  fulfilmentProfileId: string
  updatedAt: string
}
export type ProductInput = Omit<Product, 'id' | 'updatedAt'> & { id?: string }
