import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { suggestedProduction } from './units'

describe('the production amount suggested from a size', () => {
  it('turns small units into the big unit the dairy makes in', () => {
    assert.deepEqual(suggestedProduction('Millilitre', 500), { productionUnit: 'Litre', productionQuantity: 0.5 })
    assert.deepEqual(suggestedProduction('Gram', 250), { productionUnit: 'Kilogram', productionQuantity: 0.25 })
  })
  it('keeps every other unit as it is', () => {
    assert.deepEqual(suggestedProduction('Litre', 1), { productionUnit: 'Litre', productionQuantity: 1 })
    assert.deepEqual(suggestedProduction('Packet', 2), { productionUnit: 'Packet', productionQuantity: 2 })
  })
})
