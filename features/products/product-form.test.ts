import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emptyForm, newVariant, productSchema, statusChoices, toPayload, type ProductFormValues } from './schema'

const variant = (extra: Partial<ReturnType<typeof newVariant>> = {}) => ({ ...newVariant(), name: ' 500 ml ', displayUnit: 'ml', displayQuantity: 500, pricePaise: 3500, ...extra })
const filled = (extra: Partial<ProductFormValues> = {}): ProductFormValues => ({
  ...emptyForm(), name: ' Cow Milk ', categoryId: 'cat-1', status: 'active', purchaseMethods: ['buy_once', 'trial'], trialPlanIds: ['trial-1'], subscriptionRuleIds: ['rule-1'], deliveryMethod: 'local_delivery', serviceAreaId: 'area-1', variants: [variant()], ...extra,
})

describe('what the product form sends', () => {
  it('trims text, drops blank and repeated highlights, and keeps the main picture out of the gallery', () => {
    const values = filled({ content: { ...emptyForm().content, highlightsEn: [' Fresh ', '', 'Fresh', 'No preservatives'], primaryImageAssetId: 'a', galleryAssetIds: ['a', 'b'] } })
    const payload = toPayload(values)
    assert.equal(payload.name, 'Cow Milk')
    assert.deepEqual(payload.highlightsEn, ['Fresh', 'No preservatives'])
    assert.equal(payload.primaryImageAssetId, 'a')
    assert.deepEqual(payload.galleryAssetIds, ['b'])
  })
  it('sends no plans for a way of buying the product does not offer, and no delivery details for no delivery method', () => {
    const payload = toPayload(filled({ deliveryMethod: '', serviceAreaId: '' }))
    assert.deepEqual(payload.trialPlanIds, ['trial-1'])
    assert.deepEqual(payload.subscriptionRuleIds, [])
    assert.equal(payload.deliveryMethod, null)
    assert.equal(payload.serviceAreaId, null)
  })
  it('sends a saved variant with its id and a new one without, and never the form-only key', () => {
    const saved = variant({ id: 'variant-1' })
    const payload = toPayload(filled({ variants: [saved, variant({ name: '1 L' })] }))
    assert.equal(payload.variants[0]?.id, 'variant-1')
    assert.equal('id' in (payload.variants[1] ?? {}), false)
    assert.equal(JSON.stringify(payload).includes('clientKey'), false)
    assert.equal(payload.variants[0]?.name, '500 ml')
  })
})

describe('quick checks before saving', () => {
  it('lets a draft be half-finished but asks a live product for variants, methods and a delivery setup', () => {
    assert.equal(productSchema.safeParse({ ...emptyForm(), name: 'Draft', categoryId: 'cat-1' }).success, true)
    const live = productSchema.safeParse({ ...emptyForm(), name: 'Live', categoryId: 'cat-1', status: 'active' })
    assert.equal(live.success, false)
    const fields = live.success ? [] : live.error.issues.map(issue => issue.path[0])
    assert.deepEqual(new Set(fields), new Set(['variants', 'purchaseMethods', 'deliveryMethod', 'serviceAreaId']))
    assert.equal(productSchema.safeParse(filled()).success, true)
  })
  it('keeps shipping simple: no cut-off or production plan is sent', () => {
    assert.equal(productSchema.safeParse(filled({ deliveryMethod: 'shipping', cutoffRuleId: 'rule-1' })).success, false)
    const payload = toPayload(filled({ deliveryMethod: 'shipping', cutoffRuleId: '', includeInProductionPlanning: true }))
    assert.equal(payload.cutoffRuleId, null)
    assert.equal(payload.includeInProductionPlanning, false)
  })
  it('catches repeated variant names and an old price that is not higher', () => {
    assert.equal(productSchema.safeParse(filled({ variants: [variant(), variant({ name: '500 ML' })] })).success, false)
    assert.equal(productSchema.safeParse(filled({ variants: [variant({ compareAtPricePaise: 3000 })] })).success, false)
    assert.equal(productSchema.safeParse(filled({ variants: [variant({ compareAtPricePaise: 4000 })] })).success, true)
  })
  it('needs a trial plan when trials are offered', () => {
    assert.equal(productSchema.safeParse(filled({ trialPlanIds: [] })).success, false)
  })
})

describe('which status a product can be saved as', () => {
  it('starts as a draft or live, and once published can only be switched on or off', () => {
    assert.deepEqual(statusChoices(undefined), ['draft', 'active'])
    assert.deepEqual(statusChoices('draft'), ['draft', 'active'])
    assert.deepEqual(statusChoices('active'), ['active', 'inactive'])
    assert.deepEqual(statusChoices('inactive'), ['active', 'inactive'])
  })
})
