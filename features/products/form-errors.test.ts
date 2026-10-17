import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { collectProblems, stepForField } from './form-errors'

describe('finding what stops a save', () => {
  it('sends each field to the step it is on', () => {
    assert.equal(stepForField('name'), 'basics')
    assert.equal(stepForField('content.longDescriptionEn'), 'content')
    assert.equal(stepForField('variants.0.displayUnit'), 'variants')
    assert.equal(stepForField('purchaseMethods'), 'selling')
    assert.equal(stepForField('serviceAreaId'), 'delivery')
  })
  it('lists every message, including those inside list rows', () => {
    const problems = collectProblems({
      name: { type: 'too_small', message: 'Product name is required.' },
      variants: [{ displayUnit: { type: 'too_small', message: 'Display unit is required.' } }],
      serviceAreaId: { type: 'custom', message: 'Choose a delivery area.' },
    } as never)
    assert.deepEqual(problems.map(item => [item.path, item.step]), [['name', 'basics'], ['variants.0.displayUnit', 'variants'], ['serviceAreaId', 'delivery']])
  })
})
