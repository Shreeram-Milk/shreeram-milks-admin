import { categoryRepository, categorySeed } from '../categories/mock-repository'
import { emptyProductContent, type Product, type ProductInput, type ProductVariant } from './types'
const KEY = 'shreeram-admin-products-v1'
const now = () => new Date().toISOString()
const variant = (id: string, name: string, pricePaise: number, unit: string, quantity: number, productionUnit: string, productionQuantity: number): ProductVariant => ({ id, name, sku: '', pricePaise, status: 'active', displayUnit: unit, displayQuantity: quantity, productionUnit, productionQuantity })
const seed: Product[] = [
  { id: 'product-cow-milk', name: 'Fresh Cow Milk', nameGujarati: 'તાજું ગાયનું દૂધ', categoryId: 'category-milk', sku: 'MILK-COW', shortDescription: 'Fresh farm milk delivered locally.', shortDescriptionGujarati: 'તાજું ખેતરનું દૂધ સ્થાનિક રીતે પહોંચાડવામાં આવે છે.', content: { ...emptyProductContent(), longDescriptionEn: 'Milked at dawn on our own farm and delivered to your door before 7 AM.', primaryImageAssetId: 'media-milk-bottle', highlightsEn: ['Delivered before 7 AM', 'No preservatives'], nutritionEn: 'Per 100 ml: about 62 kcal, 3.2 g protein, 3.4 g fat.', badges: ['bestseller'] }, status: 'active', variants: [variant('cow-500', '500 ml', 3500, 'ml', 500, 'Litre', .5), variant('cow-1000', '1 L', 7000, 'L', 1, 'Litre', 1)], purchaseMethods: ['buy_once', 'trial', 'subscription'], trialPlanIds: ['trial-3-day', 'trial-7-day'], subscriptionRuleIds: ['rule-daily', 'rule-alternate', 'rule-weekdays'], fulfilmentProfileId: 'profile-gandhinagar', updatedAt: now() },
  { id: 'product-buffalo-milk', name: 'Buffalo Milk', nameGujarati: 'ભેંસનું દૂધ', categoryId: 'category-milk', sku: 'MILK-BUF', shortDescription: 'Rich buffalo milk.', shortDescriptionGujarati: 'ઘટ્ટ ભેંસનું દૂધ.', content: emptyProductContent(), status: 'active', variants: [variant('buf-500', '500 ml', 4000, 'ml', 500, 'Litre', .5), variant('buf-1000', '1 L', 8000, 'L', 1, 'Litre', 1)], purchaseMethods: ['buy_once', 'trial', 'subscription'], trialPlanIds: ['trial-3-day', 'trial-7-day'], subscriptionRuleIds: ['rule-daily', 'rule-alternate', 'rule-weekdays'], fulfilmentProfileId: 'profile-gandhinagar', updatedAt: now() },
  { id: 'product-paneer', name: 'Fresh Paneer', nameGujarati: 'તાજું પનીર', categoryId: 'category-paneer', sku: 'PAN-FRESH', shortDescription: 'Freshly prepared paneer.', shortDescriptionGujarati: 'તાજું બનાવેલું પનીર.', content: emptyProductContent(), status: 'active', variants: [variant('pan-500', '500 g', 18000, 'g', 500, 'Kilogram', .5), variant('pan-1000', '1 kg', 34000, 'kg', 1, 'Kilogram', 1)], purchaseMethods: ['buy_once'], trialPlanIds: [], subscriptionRuleIds: [], fulfilmentProfileId: 'profile-gandhinagar', updatedAt: now() },
  { id: 'product-ghee', name: 'Cow Ghee', nameGujarati: 'ગાયનું ઘી', categoryId: 'category-ghee', sku: 'GHEE-COW', shortDescription: 'Traditional cow ghee.', shortDescriptionGujarati: 'પરંપરાગત ગાયનું ઘી.', content: emptyProductContent(), status: 'active', variants: [variant('ghee-500', '500 g', 35000, 'g', 500, '', 0), variant('ghee-1000', '1 kg', 68000, 'kg', 1, '', 0)], purchaseMethods: ['buy_once'], trialPlanIds: [], subscriptionRuleIds: [], fulfilmentProfileId: 'profile-shipping', updatedAt: now() },
]
/** Products saved before categories were a master list carry a free-text `category`; map it to a category id by name. */
type StoredProduct = Omit<Product, 'content'> & { category?: string; imageUrl?: string; content?: Product['content'] }
const migrate = (stored: StoredProduct): Product => {
  const { category, imageUrl, ...product } = stored
  void imageUrl // dropped: product images now come from the Media Library
  const withGujarati = { ...product, nameGujarati: product.nameGujarati ?? '', shortDescriptionGujarati: product.shortDescriptionGujarati ?? '', content: { ...emptyProductContent(), ...product.content } }
  if (product.categoryId !== undefined) return withGujarati
  const match = [...categoryRepository.list(), ...categorySeed].find(item => item.name.toLowerCase() === (category ?? '').trim().toLowerCase())
  return { ...withGujarati, categoryId: match?.id ?? '' }
}
const read = (): Product[] => {
  if (typeof window === 'undefined') return seed
  try { const raw = window.localStorage.getItem(KEY); if (!raw) { window.localStorage.setItem(KEY, JSON.stringify(seed)); return seed }; return (JSON.parse(raw) as StoredProduct[]).map(migrate) } catch { return seed }
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
