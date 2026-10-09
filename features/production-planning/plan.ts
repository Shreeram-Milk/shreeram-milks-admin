import { todayInBusinessZone, type IsoDate } from '@/lib/business-time'
import type { DeliverySlot, FulfilmentProfile } from '../configuration/types'
import type { DeliveryInstance, DeliverySourceType } from '../deliveries/types'
import type { Product } from '../products/types'
import { parseProductionUnit, toBaseQuantity } from './quantity'
import type {
  ProductionAreaItem, ProductionIssueKind, ProductionPlan, ProductionPlanMode, ProductionPlanningIssue, ProductionProductRequirement, ProductionSlotRequirement,
  ProductionSourceRequirement, ProductionUnit, ProductionUnitTotal, ProductionVariantRequirement,
} from './types'

export type BuildProductionPlanInput = {
  /** Delivery instances for the selected date (the function re-checks date and slot defensively). */
  deliveries: DeliveryInstance[]
  products: Product[]
  profiles: FulfilmentProfile[]
  slots: DeliverySlot[]
  date: IsoDate
  /** Empty string means all slots. */
  slotId: string
  today?: IsoDate
}

type ProductAccumulator = { productId: string; productName: string; inactive: boolean; unit: ProductionUnit; deliveryCount: number; requiredBase: number; variants: Map<string, ProductionVariantRequirement>; sources: Map<DeliverySourceType, number> }

const addTo = (map: Map<ProductionUnit, number>, unit: ProductionUnit, amount: number) => map.set(unit, (map.get(unit) ?? 0) + amount)
const toTotals = (map: Map<ProductionUnit, number>): ProductionUnitTotal[] => [...map.entries()].map(([unit, requiredBase]) => ({ unit, requiredBase })).sort((a, b) => a.unit.localeCompare(b.unit))

function modeFor(date: IsoDate, today: IsoDate): ProductionPlanMode {
  if (date > today) return 'forecast'
  return date === today ? 'today' : 'historical'
}

function bumpProduct(map: Map<string, ProductAccumulator>, key: string, seed: Omit<ProductAccumulator, 'deliveryCount' | 'requiredBase' | 'variants' | 'sources'>, variant: { id: string; name: string }, units: number, base: number, sourceType: DeliverySourceType) {
  const entry = map.get(key) ?? { ...seed, deliveryCount: 0, requiredBase: 0, variants: new Map(), sources: new Map() }
  entry.sources.set(sourceType, (entry.sources.get(sourceType) ?? 0) + base)
  entry.deliveryCount += 1
  entry.requiredBase += base
  const row = entry.variants.get(variant.id) ?? { variantId: variant.id, variantName: variant.name, units: 0, deliveryCount: 0, requiredBase: 0 }
  row.units += units; row.deliveryCount += 1; row.requiredBase += base
  entry.variants.set(variant.id, row)
  map.set(key, entry)
}

const finishProducts = (map: Map<string, ProductAccumulator>): ProductionProductRequirement[] =>
  [...map.values()]
    .map(entry => ({ ...entry, variants: [...entry.variants.values()].sort((a, b) => a.variantName.localeCompare(b.variantName)), sources: [...entry.sources.entries()].map(([sourceType, requiredBase]) => ({ sourceType, requiredBase })).sort((a, b) => a.sourceType.localeCompare(b.sourceType)) }))
    .sort((a, b) => a.productName.localeCompare(b.productName) || a.unit.localeCompare(b.unit))

/**
 * Pure: aggregates DeliveryInstance records (never subscriptions) into preparation quantities.
 * Only scheduled deliveries count as demand; for past dates only delivered ones are reported.
 * Units are never combined, and anything that cannot be converted is reported as an issue, not dropped.
 */
export function buildProductionPlan({ deliveries, products, profiles, slots, date, slotId, today = todayInBusinessZone() }: BuildProductionPlanInput): ProductionPlan {
  const mode = modeFor(date, today)
  const countedStatus = mode === 'historical' ? 'delivered' : 'scheduled'
  const productsById = new Map(products.map(product => [product.id, product]))
  const profilesById = new Map(profiles.map(profile => [profile.id, profile]))
  const slotsById = new Map(slots.map(slot => [slot.id, slot]))

  const totals = new Map<ProductionUnit, number>()
  const completed = new Map<ProductionUnit, number>()
  const productMap = new Map<string, ProductAccumulator>()
  const slotMap = new Map<string, { slotId: string | null; slotName: string; deliveryCount: number; totals: Map<ProductionUnit, number>; products: Map<string, ProductAccumulator> }>()
  const areaMap = new Map<string, { pinCode: string; locality: string; deliveryCount: number; items: Map<string, ProductionAreaItem> }>()
  const sourceMap = new Map<string, ProductionSourceRequirement>()
  const issueMap = new Map<string, ProductionPlanningIssue>()
  const serviceAreaIds = new Set<string>()
  let deliveryCount = 0

  const raise = (kind: ProductionIssueKind, productId: string, productName: string, variantId: string, variantName: string, message: string) => {
    const key = `${kind}|${productId}|${variantId}`
    const existing = issueMap.get(key)
    if (existing) existing.deliveryCount += 1
    else issueMap.set(key, { kind, productId, productName, variantId, variantName, deliveryCount: 1, message })
  }

  for (const delivery of deliveries) {
    if (delivery.deliveryDate !== date) continue
    if (slotId && delivery.deliverySlotId !== slotId) continue
    const isCounted = delivery.status === countedStatus
    const isCompleted = mode === 'today' && delivery.status === 'delivered'
    if (!isCounted && !isCompleted) continue

    const profile = profilesById.get(delivery.fulfilmentProfileId)
    if (!profile?.includeInProductionPlanning) continue

    const product = productsById.get(delivery.productId)
    const variant = product?.variants.find(item => item.id === delivery.variantId)
    const productName = product?.name ?? 'Unknown product'
    const variantName = variant?.name ?? 'Unknown variant'
    if (!product || !variant) { if (isCounted) raise('unknown_product', delivery.productId, productName, delivery.variantId, variantName, 'The product or variant no longer exists.'); continue }

    const unit = parseProductionUnit(variant.productionUnit)
    if (!unit || !(variant.productionQuantity > 0)) { if (isCounted) raise('missing_conversion', product.id, product.name, variant.id, variant.name, 'Missing production conversion.'); continue }
    if (!Number.isInteger(delivery.quantity) || delivery.quantity <= 0) { if (isCounted) raise('invalid_quantity', product.id, product.name, variant.id, variant.name, 'The delivery quantity is not a positive whole number.'); continue }

    const base = toBaseQuantity(unit, variant.productionQuantity) * delivery.quantity
    if (isCompleted) { addTo(completed, unit, base); continue }

    deliveryCount += 1
    serviceAreaIds.add(delivery.serviceAreaId)
    addTo(totals, unit, base)
    const seed = { productId: product.id, productName: product.name, inactive: product.status === 'inactive' || variant.status === 'inactive', unit }
    const variantRef = { id: variant.id, name: variant.name }
    bumpProduct(productMap, `${product.id}|${unit}`, seed, variantRef, delivery.quantity, base, delivery.sourceType)

    const slotKey = delivery.deliverySlotId ?? 'none'
    const slotEntry = slotMap.get(slotKey) ?? { slotId: delivery.deliverySlotId, slotName: delivery.deliverySlotId ? slotsById.get(delivery.deliverySlotId)?.name ?? 'Unavailable slot' : 'No slot', deliveryCount: 0, totals: new Map(), products: new Map() }
    slotEntry.deliveryCount += 1
    addTo(slotEntry.totals, unit, base)
    bumpProduct(slotEntry.products, `${product.id}|${unit}`, seed, variantRef, delivery.quantity, base, delivery.sourceType)
    slotMap.set(slotKey, slotEntry)

    const area = areaMap.get(delivery.customerPincode) ?? { pinCode: delivery.customerPincode, locality: delivery.customerAddressSnapshot.locality, deliveryCount: 0, items: new Map() }
    area.deliveryCount += 1
    const itemKey = `${product.id}|${unit}`
    const item = area.items.get(itemKey) ?? { productId: product.id, productName: product.name, unit, requiredBase: 0 }
    item.requiredBase += base
    area.items.set(itemKey, item)
    areaMap.set(delivery.customerPincode, area)

    const sourceKey = `${delivery.sourceType}|${unit}`
    const source = sourceMap.get(sourceKey) ?? { sourceType: delivery.sourceType as DeliverySourceType, unit, requiredBase: 0, deliveryCount: 0 }
    source.requiredBase += base; source.deliveryCount += 1
    sourceMap.set(sourceKey, source)
  }

  const slotStart = (id: string | null) => (id ? slotsById.get(id)?.startTime ?? '' : '99:99')
  const slotRows: ProductionSlotRequirement[] = [...slotMap.values()]
    .map(entry => ({ slotId: entry.slotId, slotName: entry.slotName, deliveryCount: entry.deliveryCount, totalsByUnit: toTotals(entry.totals), products: finishProducts(entry.products) }))
    .sort((a, b) => slotStart(a.slotId).localeCompare(slotStart(b.slotId)))
  const areas = [...areaMap.values()]
    .map(area => ({ pinCode: area.pinCode, locality: area.locality, deliveryCount: area.deliveryCount, items: [...area.items.values()].sort((a, b) => a.productName.localeCompare(b.productName)) }))
    .sort((a, b) => a.pinCode.localeCompare(b.pinCode))
  const productRows = finishProducts(productMap)

  return {
    date, slotId, mode, deliveryCount,
    productCount: new Set(productRows.map(row => row.productId)).size,
    areaCount: serviceAreaIds.size,
    pinCount: areas.length,
    totalsByUnit: toTotals(totals),
    completedTotalsByUnit: toTotals(completed),
    products: productRows,
    slots: slotRows,
    areas,
    sources: [...sourceMap.values()].sort((a, b) => a.sourceType.localeCompare(b.sourceType) || a.unit.localeCompare(b.unit)),
    issues: [...issueMap.values()].sort((a, b) => a.productName.localeCompare(b.productName)),
  }
}
