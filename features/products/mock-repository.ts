import type { Product, ProductInput, ProductVariant } from './types'
const KEY = 'shreeram-admin-products-v1'
const now = () => new Date().toISOString()
const variant = (id: string, name: string, pricePaise: number, unit: string, quantity: number, productionUnit: string, productionQuantity: number): ProductVariant => ({ id, name, sku: '', pricePaise, status: 'active', displayUnit: unit, displayQuantity: quantity, productionUnit, productionQuantity })
const seed: Product[] = [
  { id: 'product-cow-milk', name: 'Fresh Cow Milk', category: 'Milk', sku: 'MILK-COW', shortDescription: 'Fresh farm milk delivered locally.', imageUrl: '', status: 'active', variants: [variant('cow-500', '500 ml', 3500, 'ml', 500, 'Litre', .5), variant('cow-1000', '1 L', 7000, 'L', 1, 'Litre', 1)], purchaseMethods: ['buy_once', 'trial', 'subscription'], trialPlanIds: ['trial-3-day', 'trial-7-day'], subscriptionRuleIds: ['rule-daily', 'rule-alternate', 'rule-weekdays'], fulfilmentProfileId: 'profile-gandhinagar', updatedAt: now() },
  { id: 'product-buffalo-milk', name: 'Buffalo Milk', category: 'Milk', sku: 'MILK-BUF', shortDescription: 'Rich buffalo milk.', imageUrl: '', status: 'active', variants: [variant('buf-500', '500 ml', 4000, 'ml', 500, 'Litre', .5), variant('buf-1000', '1 L', 8000, 'L', 1, 'Litre', 1)], purchaseMethods: ['buy_once', 'trial', 'subscription'], trialPlanIds: ['trial-3-day', 'trial-7-day'], subscriptionRuleIds: ['rule-daily', 'rule-alternate', 'rule-weekdays'], fulfilmentProfileId: 'profile-gandhinagar', updatedAt: now() },
  { id: 'product-paneer', name: 'Fresh Paneer', category: 'Paneer', sku: 'PAN-FRESH', shortDescription: 'Freshly prepared paneer.', imageUrl: '', status: 'active', variants: [variant('pan-500', '500 g', 18000, 'g', 500, 'Kilogram', .5), variant('pan-1000', '1 kg', 34000, 'kg', 1, 'Kilogram', 1)], purchaseMethods: ['buy_once'], trialPlanIds: [], subscriptionRuleIds: [], fulfilmentProfileId: 'profile-gandhinagar', updatedAt: now() },
  { id: 'product-ghee', name: 'Cow Ghee', category: 'Ghee', sku: 'GHEE-COW', shortDescription: 'Traditional cow ghee.', imageUrl: '', status: 'active', variants: [variant('ghee-500', '500 g', 35000, 'g', 500, '', 0), variant('ghee-1000', '1 kg', 68000, 'kg', 1, '', 0)], purchaseMethods: ['buy_once'], trialPlanIds: [], subscriptionRuleIds: [], fulfilmentProfileId: 'profile-shipping', updatedAt: now() },
]
const read = (): Product[] => {
  if (typeof window === 'undefined') return seed
  try { const raw = window.localStorage.getItem(KEY); if (!raw) { window.localStorage.setItem(KEY, JSON.stringify(seed)); return seed }; return JSON.parse(raw) as Product[] } catch { return seed }
}
const write = (products: Product[]) => { window.localStorage.setItem(KEY, JSON.stringify(products)) }
export const productRepository = {
  list: () => read(),
  get: (id: string) => read().find(product => product.id === id),
  save(input: ProductInput): Product {
    const products = read()
    const record: Product = { ...input, id: input.id ?? `product-${crypto.randomUUID()}`, updatedAt: now() }
    const next = input.id ? products.map(product => product.id === input.id ? record : product) : [...products, record]
    write(next); return record
  },
  setStatus(id: string, status: Product['status']) { const products = read(); const next = products.map(product => product.id === id ? { ...product, status, updatedAt: now() } : product); write(next) },
}
