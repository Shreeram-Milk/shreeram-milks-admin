import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DeliverySlot, FulfilmentProfile } from '../configuration/types'
import type { DeliveryInstance } from '../deliveries/types'
import type { Product, ProductVariant } from '../products/types'
import { describeCutoff } from './cutoff'
import { buildProductionPlan } from './plan'
import { formatProductionQuantity, parseProductionUnit, toBaseQuantity } from './quantity'

const DATE = '2026-10-10'
const TODAY = '2026-10-09'

const variant = (id: string, name: string, productionUnit: string, productionQuantity: number): ProductVariant =>
  ({ id, name, sku: '', pricePaise: 0, status: 'active', displayUnit: '', displayQuantity: 1, productionUnit, productionQuantity })
const product = (id: string, name: string, variants: ProductVariant[], profileId = 'profile-local'): Product =>
  ({ id, name, category: '', sku: '', shortDescription: '', imageUrl: '', status: 'active', variants, purchaseMethods: ['subscription'], trialPlanIds: [], subscriptionRuleIds: [], fulfilmentProfileId: profileId, updatedAt: '' })
const profile = (id: string, includeInProductionPlanning: boolean): FulfilmentProfile =>
  ({ id, name: id, description: '', status: 'active', updatedAt: '', deliveryMethod: 'local_delivery', serviceAreaId: 'area-1', cutoffRuleId: '', includeInProductionPlanning })
const slot = (id: string, name: string, startTime: string): DeliverySlot => ({ id, name, description: '', status: 'active', updatedAt: '', startTime, endTime: '' })

const products: Product[] = [
  product('milk', 'Fresh Cow Milk', [variant('milk-500', '500 ml', 'Litre', 0.5), variant('milk-1000', '1 L', 'Litre', 1)]),
  product('paneer', 'Fresh Paneer', [variant('pan-500', '500 g', 'Kilogram', 0.5), variant('pan-1000', '1 kg', 'Kilogram', 1), variant('pan-250', '250 g', '', 0)]),
  product('ghee', 'Cow Ghee', [variant('ghee-500', '500 g', '', 0)], 'profile-shipping'),
]
const profiles = [profile('profile-local', true), profile('profile-shipping', false)]
const slots = [slot('slot-evening', 'Evening', '17:00'), slot('slot-morning', 'Morning', '06:00')]

let counter = 0
const delivery = (productId: string, variantId: string, changes: Partial<DeliveryInstance> = {}): DeliveryInstance => {
  counter += 1
  return {
    id: `d-${counter}`, deliveryDate: DATE, customerId: 'c', subscriptionId: 's', productId, variantId, quantity: 1, deliverySlotId: 'slot-morning',
    fulfilmentProfileId: productId === 'ghee' ? 'profile-shipping' : 'profile-local', serviceAreaId: 'area-1',
    customerAddressSnapshot: { line1: '', line2: '', locality: 'Sector 10', city: '', state: '', pinCode: '382010' }, customerPincode: '382010',
    status: 'scheduled', sourceType: 'subscription', createdAt: '', updatedAt: '', deliveredAt: null, notDeliveredReason: null, skipReason: '', cancellationReason: null, adminNotes: '', ...changes,
  }
}
const many = (count: number, productId: string, variantId: string, changes: Partial<DeliveryInstance> = {}) => Array.from({ length: count }, () => delivery(productId, variantId, changes))
const plan = (deliveries: DeliveryInstance[], slotId = '') => buildProductionPlan({ deliveries, products, profiles, slots, date: DATE, slotId, today: TODAY })
const requirement = (result: ReturnType<typeof plan>, productId: string) => result.products.find(row => row.productId === productId)

describe('quantity normalization', () => {
  it('maps free-text units to controlled units', () => {
    assert.equal(parseProductionUnit('Litre'), 'litre')
    assert.equal(parseProductionUnit(' kg '), 'kilogram')
    assert.equal(parseProductionUnit(''), null)
    assert.equal(parseProductionUnit('barrel'), null)
  })
  it('keeps fractional conversions exact in integer base units', () => {
    assert.equal(toBaseQuantity('litre', 0.5), 500)
    assert.equal(toBaseQuantity('litre', 0.1) + toBaseQuantity('litre', 0.2), 300)
    assert.equal(formatProductionQuantity('litre', 130000), '130 L')
    assert.equal(formatProductionQuantity('kilogram', 24000), '24 kg')
    assert.equal(formatProductionQuantity('litre', 500), '0.5 L')
  })
})

describe('buildProductionPlan', () => {
  it('500 ml × 100 = 50 L, 1 L × 80 = 80 L, product total 130 L', () => {
    const result = plan([...many(100, 'milk', 'milk-500'), ...many(80, 'milk', 'milk-1000')])
    const milk = requirement(result, 'milk')
    assert.equal(milk?.requiredBase, 130000)
    assert.equal(milk?.variants.find(row => row.variantId === 'milk-500')?.requiredBase, 50000)
    assert.equal(milk?.variants.find(row => row.variantId === 'milk-1000')?.requiredBase, 80000)
    assert.equal(milk?.deliveryCount, 180)
    assert.deepEqual(result.totalsByUnit, [{ unit: 'litre', requiredBase: 130000 }])
  })
  it('uses the delivery quantity: 500 ml × 2 contributes 1 L', () => {
    assert.equal(requirement(plan([delivery('milk', 'milk-500', { quantity: 2 })]), 'milk')?.requiredBase, 1000)
  })
  it('paneer 500 g × 20 + 1 kg × 14 = 24 kg and never mixes with litres', () => {
    const result = plan([...many(20, 'paneer', 'pan-500'), ...many(14, 'paneer', 'pan-1000'), ...many(2, 'milk', 'milk-1000')])
    assert.equal(requirement(result, 'paneer')?.requiredBase, 24000)
    assert.deepEqual(result.totalsByUnit, [{ unit: 'kilogram', requiredBase: 24000 }, { unit: 'litre', requiredBase: 2000 }])
  })
  it('counts only scheduled deliveries: skipped, cancelled and not-delivered are excluded', () => {
    const result = plan([delivery('milk', 'milk-1000'), delivery('milk', 'milk-1000', { status: 'skipped' }), delivery('milk', 'milk-1000', { status: 'cancelled' }), delivery('milk', 'milk-1000', { status: 'not_delivered' })])
    assert.equal(requirement(result, 'milk')?.requiredBase, 1000)
  })
  it('skipping one 1 L delivery lowers the total by exactly 1 L; cancelling a 500 ml one by 0.5 L', () => {
    const all = [...many(3, 'milk', 'milk-1000'), ...many(2, 'milk', 'milk-500')]
    const before = requirement(plan(all), 'milk')?.requiredBase ?? 0
    const skipped = all.map((item, index) => index === 0 ? { ...item, status: 'skipped' as const } : item)
    assert.equal(before - (requirement(plan(skipped), 'milk')?.requiredBase ?? 0), 1000)
    const cancelled = all.map((item, index) => index === 3 ? { ...item, status: 'cancelled' as const } : item)
    assert.equal(before - (requirement(plan(cancelled), 'milk')?.requiredBase ?? 0), 500)
  })
  it('excludes products whose fulfilment profile is not production-tracked', () => {
    const result = plan([delivery('ghee', 'ghee-500'), delivery('milk', 'milk-1000')])
    assert.equal(requirement(result, 'ghee'), undefined)
    assert.equal(result.issues.length, 0)
  })
  it('reports missing conversion as an issue instead of dropping it silently', () => {
    const result = plan([delivery('paneer', 'pan-250'), delivery('paneer', 'pan-250'), delivery('milk', 'milk-1000')])
    assert.equal(result.issues.length, 1)
    assert.equal(result.issues[0].kind, 'missing_conversion')
    assert.equal(result.issues[0].variantName, '250 g')
    assert.equal(result.issues[0].deliveryCount, 2)
    assert.equal(requirement(result, 'paneer'), undefined)
    assert.equal(requirement(result, 'milk')?.requiredBase, 1000)
  })
  it('separates morning and evening and filters by slot', () => {
    const rows = [...many(130, 'milk', 'milk-1000'), ...many(72, 'milk', 'milk-1000', { deliverySlotId: 'slot-evening' })]
    const all = plan(rows)
    assert.deepEqual(all.slots.map(row => [row.slotName, row.totalsByUnit[0].requiredBase]), [['Morning', 130000], ['Evening', 72000]])
    assert.equal(requirement(all, 'milk')?.requiredBase, 202000)
    assert.equal(requirement(plan(rows, 'slot-morning'), 'milk')?.requiredBase, 130000)
    assert.equal(requirement(plan(rows, 'slot-evening'), 'milk')?.requiredBase, 72000)
  })
  it('groups by PIN and the PIN quantities add back up to the product total', () => {
    const rows = [...many(40, 'milk', 'milk-1000', { customerPincode: '382010' }), ...many(28, 'milk', 'milk-1000', { customerPincode: '382011' }), ...many(12, 'milk', 'milk-1000', { customerPincode: '382012' })]
    const result = plan(rows)
    assert.deepEqual(result.areas.map(area => area.pinCode), ['382010', '382011', '382012'])
    const sum = result.areas.flatMap(area => area.items).reduce((total, item) => total + item.requiredBase, 0)
    assert.equal(sum, requirement(result, 'milk')?.requiredBase)
    assert.equal(result.pinCount, 3)
  })
  it('breaks demand down by source and only for sources that exist', () => {
    const result = plan(many(3, 'milk', 'milk-1000'))
    assert.deepEqual(result.sources.map(row => [row.sourceType, row.requiredBase]), [['subscription', 3000]])
  })
  it('is deterministic regardless of input order', () => {
    const rows = [...many(5, 'milk', 'milk-500'), ...many(4, 'paneer', 'pan-1000'), ...many(3, 'milk', 'milk-1000', { deliverySlotId: 'slot-evening' })]
    assert.deepEqual(plan(rows), plan([...rows].reverse()))
  })
  it('ignores other dates and reports delivered quantity for historical dates', () => {
    const rows = [delivery('milk', 'milk-1000', { deliveryDate: '2026-10-11' }), delivery('milk', 'milk-1000')]
    assert.equal(requirement(plan(rows), 'milk')?.requiredBase, 1000)
    const historical = buildProductionPlan({ deliveries: [delivery('milk', 'milk-1000', { status: 'delivered' }), delivery('milk', 'milk-1000')], products, profiles, slots, date: DATE, slotId: '', today: '2026-10-12' })
    assert.equal(historical.mode, 'historical')
    assert.equal(requirement(historical, 'milk')?.requiredBase, 1000)
  })
  it("shows today's already-delivered quantity separately, not as requirement", () => {
    const rows = [delivery('milk', 'milk-1000', { deliveryDate: TODAY }), delivery('milk', 'milk-1000', { deliveryDate: TODAY, status: 'delivered' })]
    const result = buildProductionPlan({ deliveries: rows, products, profiles, slots, date: TODAY, slotId: '', today: TODAY })
    assert.equal(result.mode, 'today')
    assert.equal(requirement(result, 'milk')?.requiredBase, 1000)
    assert.deepEqual(result.completedTotalsByUnit, [{ unit: 'litre', requiredBase: 1000 }])
  })
})

describe('describeCutoff', () => {
  const at = (iso: string) => new Date(iso)
  it('previous-day cut-off is open before 3 PM the day before and passed after', () => {
    const open = describeCutoff({ deliveryDate: '2026-10-10', dayRelation: 'previous_day', cutoffTime: '15:00', now: at('2026-10-09T09:00:00+05:30') })
    assert.deepEqual(open, { state: 'open', label: 'Open until 3:00 PM today' })
    const passed = describeCutoff({ deliveryDate: '2026-10-10', dayRelation: 'previous_day', cutoffTime: '15:00', now: at('2026-10-09T16:00:00+05:30') })
    assert.deepEqual(passed, { state: 'passed', label: 'Passed at 3:00 PM today' })
  })
  it('same-day cut-off uses the delivery date and relative wording', () => {
    const passed = describeCutoff({ deliveryDate: '2026-10-09', dayRelation: 'previous_day', cutoffTime: '15:00', now: at('2026-10-09T10:00:00+05:30') })
    assert.deepEqual(passed, { state: 'passed', label: 'Passed at 3:00 PM yesterday' })
    const open = describeCutoff({ deliveryDate: '2026-10-10', dayRelation: 'same_day', cutoffTime: '11:00', now: at('2026-10-09T10:00:00+05:30') })
    assert.deepEqual(open, { state: 'open', label: 'Open until 11:00 AM tomorrow' })
  })
  it('uses the business timezone, not the machine clock, at the day boundary', () => {
    // 20:00 UTC on the 9th is already 01:30 IST on the 10th.
    const result = describeCutoff({ deliveryDate: '2026-10-10', dayRelation: 'previous_day', cutoffTime: '15:00', now: at('2026-10-09T20:00:00Z') })
    assert.equal(result.state, 'passed')
    assert.equal(result.label, 'Passed at 3:00 PM yesterday')
  })
})
