import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sizeName, suggestedProduction } from './units'

describe('the size name built from a size', () => {
  it('reads like a person would write it', () => {
    assert.equal(sizeName('Millilitre', 500), '500 ml')
    assert.equal(sizeName('Litre', 1), '1 L')
    assert.equal(sizeName('Gram', 250), '250 g')
    assert.equal(sizeName('Kilogram', 0.5), '0.5 kg')
  })
  it('uses the singular for one and the plural for more', () => {
    assert.equal(sizeName('Packet', 1), '1 packet')
    assert.equal(sizeName('Packet', 2), '2 packets')
    assert.equal(sizeName('Dozen', 2), '2 dozen')
  })
  it('is empty until both a unit and an amount are chosen, and keeps an older unit as typed', () => {
    assert.equal(sizeName('', 500), '')
    assert.equal(sizeName('Litre', 0), '')
    assert.equal(sizeName('Sachet', 3), '3 Sachet')
  })
})

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
