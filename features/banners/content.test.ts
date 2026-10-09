import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { windowState } from '@/lib/active-window'
import { appSettingsService, AppSettingsRuleError, isVersionBelow } from '../app-settings/service'
import { faqService, FaqRuleError } from '../faqs/service'
import { offerService, OfferRuleError } from '../offers/service'
import { bannerService, BannerRuleError } from './service'

declare const __resetStorage: () => void

beforeEach(() => __resetStorage())

const banner = { label: '', title: 'Fresh', titleGujarati: '', subtitle: '', subtitleGujarati: '', imageUrl: '', linkType: 'none' as const, linkTargetId: '', startDate: '', endDate: '', sortOrder: 5, status: 'active' as const }
const offer = { name: 'Welcome', nameGujarati: '', description: '', code: 'welcome10', discountType: 'percent' as const, value: 10, minOrderPaise: 0, appliesTo: 'all_orders' as const, startDate: '', endDate: '', status: 'active' as const }

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

describe('banners', () => {
  it('rejects an end date before the start date and a link to something missing', () => {
    assert.throws(() => bannerService.save({ ...banner, startDate: '2026-10-12', endDate: '2026-10-10' }), BannerRuleError)
    assert.throws(() => bannerService.save({ ...banner, linkType: 'product', linkTargetId: 'product-missing' }), BannerRuleError)
    assert.throws(() => bannerService.save({ ...banner, linkType: 'category', linkTargetId: 'category-missing' }), BannerRuleError)
  })
  it('clears the link target when the banner has no link', () => {
    const saved = bannerService.save({ ...banner, linkType: 'none', linkTargetId: 'category-milk' })
    assert.equal(saved.linkTargetId, '')
  })
})

describe('offers', () => {
  it('keeps percentages within 1–100 and flat amounts positive whole paise', () => {
    assert.throws(() => offerService.save({ ...offer, value: 101 }), OfferRuleError)
    assert.throws(() => offerService.save({ ...offer, value: 0 }), OfferRuleError)
    assert.throws(() => offerService.save({ ...offer, discountType: 'flat', value: 50.5 }), OfferRuleError)
    assert.equal(offerService.describeValue(offerService.save({ ...offer, discountType: 'flat', value: 5000 })), '₹50.00 off')
  })
  it('stores codes upper-case and rejects a reused code', () => {
    assert.equal(offerService.save(offer).code, 'WELCOME10')
    assert.throws(() => offerService.save({ ...offer, name: 'Other', code: ' Welcome10 ' }), OfferRuleError)
  })
})

describe('faqs', () => {
  it('rejects a repeated question under the same topic only', () => {
    const base = { topic: 'delivery' as const, question: 'Where is my milk?', questionGujarati: '', answer: 'On its way.', answerGujarati: '', sortOrder: 1, status: 'active' as const }
    faqService.save(base)
    assert.throws(() => faqService.save({ ...base, question: ' where is my milk? ' }), FaqRuleError)
    assert.doesNotThrow(() => faqService.save({ ...base, topic: 'account' }))
  })
})

describe('app settings', () => {
  it('compares versions numerically, not as text', () => {
    assert.equal(isVersionBelow('1.9.0', '1.10.0'), true)
    assert.equal(isVersionBelow('2.0.0', '1.10.0'), false)
    assert.equal(isVersionBelow('1.0.0', '1.0.0'), false)
  })
  it('needs a message to switch maintenance mode on', () => {
    const current = appSettingsService.get()
    const input = { ...current, updatedAt: undefined }
    assert.throws(() => appSettingsService.save({ ...input, maintenanceMode: true, maintenanceMessage: '  ' }), AppSettingsRuleError)
    assert.equal(appSettingsService.save({ ...input, maintenanceMode: true, maintenanceMessage: 'Back soon' }).maintenanceMode, true)
  })
})
