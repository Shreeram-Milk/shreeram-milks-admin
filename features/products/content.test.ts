import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { mediaService } from '../media/service'
import { normalizeContent, productService } from './service'
import { emptyProductContent, MAX_GALLERY_IMAGES } from './types'

declare const __resetStorage: () => void

beforeEach(() => __resetStorage())

describe('product content', () => {
  it('trims highlight lines, drops blanks and repeats, and keeps the gallery free of the primary image', () => {
    const content = normalizeContent({ ...emptyProductContent(), highlightsEn: [' Fresh ', '', 'Fresh', 'No preservatives', ''], primaryImageAssetId: 'media-milk-bottle', galleryAssetIds: ['media-milk-bottle', 'media-farm-morning', 'media-farm-morning'], badges: ['new', 'new'] })
    assert.deepEqual(content.highlightsEn, ['Fresh', 'No preservatives'])
    assert.deepEqual(content.galleryAssetIds, ['media-farm-morning'])
    assert.deepEqual(content.badges, ['new'])
  })
  it('rejects too many highlights, a missing image and a document used as an image', () => {
    assert.throws(() => normalizeContent({ ...emptyProductContent(), highlightsEn: Array.from({ length: 7 }, (_, index) => `Point ${index}`) }), /at most 6/)
    assert.throws(() => normalizeContent({ ...emptyProductContent(), primaryImageAssetId: 'media-missing' }), /no longer in the Media Library/)
    assert.throws(() => normalizeContent({ ...emptyProductContent(), primaryImageAssetId: 'media-lab-report' }), /is a document/)
    const extra = Array.from({ length: MAX_GALLERY_IMAGES + 1 }, (_, index) => mediaService.add({ displayName: `Image ${index}`, altTextEn: '', altTextGu: '', fileName: `i${index}.png`, mimeType: 'image/png', fileSizeBytes: 1000 }).id)
    assert.throws(() => normalizeContent({ ...emptyProductContent(), galleryAssetIds: extra }), /at most 10/)
  })
  it('saves normalised content and makes the Media Library report the product as a user of its images', () => {
    const cow = productService.getById('product-cow-milk')
    assert.ok(cow)
    productService.save({ ...cow, content: { ...cow.content, galleryAssetIds: ['media-farm-morning'], highlightsEn: ['  Fresh  ', ''] } })
    assert.deepEqual(productService.getById('product-cow-milk')?.content.highlightsEn, ['Fresh'])
    assert.ok(mediaService.references('media-farm-morning').some(item => item.feature === 'Product' && item.label === 'Fresh Cow Milk'))
    assert.throws(() => mediaService.remove('media-milk-bottle'), /Product “Fresh Cow Milk”/)
  })
  it('gives products saved before this change empty content', () => {
    window.localStorage.setItem('shreeram-admin-products-v1', JSON.stringify([{ ...productService.list()[0], content: undefined, imageUrl: 'https://old.example/x.png' }]))
    const migrated = productService.list()[0]
    assert.deepEqual(migrated.content, emptyProductContent())
    assert.ok(!('imageUrl' in migrated))
  })
})
