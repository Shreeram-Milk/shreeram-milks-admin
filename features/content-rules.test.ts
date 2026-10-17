import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { windowState } from '@/lib/active-window'
import { appSettingsSchema } from './app-settings/schema'
import { parseKeywords } from './faqs/keywords'
import { offerSchema, blankOffer, toInput } from './offers/schema'


describe('active window', () => {
  it('is live only between the dates, inclusive, and never when inactive', () => {
    const run = { status: 'active' as const, startDate: '2026-10-10', endDate: '2026-10-12' }
    assert.equal(windowState(run, '2026-10-09'), 'scheduled')
    assert.equal(windowState(run, '2026-10-10'), 'live')
    assert.equal(windowState(run, '2026-10-12'), 'live')
    assert.equal(windowState(run, '2026-10-13'), 'expired')
    assert.equal(windowState({ ...run, status: 'inactive' }, '2026-10-11'), 'inactive')
    assert.equal(windowState({ status: 'active', startDate: '', endDate: '' }, '2026-10-11'), 'live')
  })
})

describe('offer form', () => {
  const percent = { ...blankOffer, title: 'Welcome', kind: 'percent' as const, percent: '20', maxDiscount: '100', minOrder: '1000' }
  const problems = (change: object) => {
    const result = offerSchema.safeParse({ ...percent, ...change })
    return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'))
  }
  it('accepts a percent offer and turns rupees into paise for the server', () => {
    assert.deepEqual(problems({}), [])
    const input = toInput(offerSchema.parse(percent))
    assert.equal(input.percent, 20)
    assert.equal(input.maxDiscountPaise, 10000)
    assert.equal(input.minOrderPaise, 100000)
    assert.equal(input.code, null)
  })
  it('keeps percentages within 1-99 and flat amounts above zero', () => {
    assert.deepEqual(problems({ percent: '100' }), ['percent'])
    assert.deepEqual(problems({ percent: '0' }), ['percent'])
    assert.deepEqual(problems({ kind: 'flat', flat: '' }), ['flat'])
    assert.deepEqual(problems({ kind: 'flat', flat: '50.5' }), [])
  })
  it('stores codes upper-case and refuses codes with spaces', () => {
    assert.equal(toInput(offerSchema.parse({ ...percent, code: ' welcome10 ' })).code, 'WELCOME10')
    assert.deepEqual(problems({ code: 'no spaces' }), ['code'])
  })
  it('needs a free product and the products that earn it for a gift', () => {
    assert.deepEqual(problems({ kind: 'free_gift' }).sort(), ['giftVariantId', 'productIds'])
    const gift = toInput(offerSchema.parse({ ...percent, kind: 'free_gift', giftVariantId: 'v1', productIds: ['p1'] }))
    assert.equal(gift.percent, null)
    assert.equal(gift.scope, 'products')
    assert.equal(gift.giftVariantId, 'v1')
  })
  it('needs a place to work, and a plan length only for subscriptions', () => {
    assert.deepEqual(problems({ appliesOneTime: false }), ['appliesOneTime'])
    assert.deepEqual(problems({ minPlanDays: '30' }), ['minPlanDays'])
    assert.deepEqual(problems({ minPlanDays: '30', appliesSubscription: true }), [])
  })
})

describe('faq keywords', () => {
  it('cleans keyword text: trimmed, lower-case, no blanks or repeats', () => {
    assert.deepEqual(parseKeywords('milk, Late ,milk,'), ['milk', 'late'])
    assert.deepEqual(parseKeywords(''), [])
  })
})

describe('app settings form checks', () => {
  // The backend checks the same rules again before saving; these give staff instant feedback.
  const valid = {
    supportPhone: '', supportEmail: '', supportWhatsApp: '', callEnabled: false, chatEnabled: false, whatsappEnabled: false,
    supportHoursEn: '', supportHoursGu: '', afterHoursMessageEn: '', afterHoursMessageGu: '', deliveryPromiseEn: '', deliveryPromiseGu: '',
    minimumAppVersion: '1.0.0', maintenanceMode: false, maintenanceMessageEn: '', maintenanceMessageGu: '', showMaintenanceContact: false,
    flags: { showTrials: true, showSubscriptions: true, showOffers: true, showQualityReports: true, showSeasonalBanner: true },
  }
  const problems = (change: object) => {
    const result = appSettingsSchema.safeParse({ ...valid, ...change })
    return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'))
  }
  it('accepts the default settings', () => assert.deepEqual(problems({}), []))
  it('needs a message to switch maintenance mode on', () => assert.deepEqual(problems({ maintenanceMode: true, maintenanceMessageEn: '  ' }), ['maintenanceMessageEn']))
  it('only turns a support channel on when its contact number is set', () => {
    assert.deepEqual(problems({ callEnabled: true }), ['supportPhone'])
    assert.deepEqual(problems({ whatsappEnabled: true }), ['supportWhatsApp'])
    assert.deepEqual(problems({ supportPhone: '12345' }), ['supportPhone'])
    assert.deepEqual(problems({ supportPhone: '+91 98765 43210', callEnabled: true }), [])
  })
  it('needs a contact before the maintenance screen can show one', () => assert.deepEqual(problems({ showMaintenanceContact: true }), ['showMaintenanceContact']))
  it('needs a version like 1.0.0', () => assert.deepEqual(problems({ minimumAppVersion: '1.0' }), ['minimumAppVersion']))
})
