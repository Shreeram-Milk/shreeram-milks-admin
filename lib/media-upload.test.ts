import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fitWithin, imageProblem } from './media-upload'

describe('picture sizes', () => {
  it('scales a large picture down to the longest side and keeps its shape', () => {
    assert.deepEqual(fitWithin(4000, 3000, 1200), { width: 1200, height: 900 })
    assert.deepEqual(fitWithin(3000, 4000, 1200), { width: 900, height: 1200 })
  })
  it('never enlarges a small picture', () => {
    assert.deepEqual(fitWithin(800, 600, 1200), { width: 800, height: 600 })
  })
})

describe('what can be picked', () => {
  it('lets a phone-camera photo be picked because it is shrunk before upload, but not a huge one', () => {
    assert.equal(imageProblem({ type: 'image/jpeg', size: 8 * 1024 * 1024 }, 'product'), null)
    assert.equal(imageProblem({ type: 'image/jpeg', size: 20 * 1024 * 1024 }, 'product'), 'Choose a picture under 15 MB.')
  })
  it('still limits icons to 100 KB and only accepts SVG for them', () => {
    assert.equal(imageProblem({ type: 'image/svg+xml', size: 200 * 1024 }, 'banner_icon'), 'Keep the icon under 100 KB.')
    assert.equal(imageProblem({ type: 'image/png', size: 1000 }, 'banner_icon'), 'Icons must be SVG files.')
  })
})
