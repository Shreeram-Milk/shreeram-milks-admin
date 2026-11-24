import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { RiderStop } from '../production-admin/api'
import { groupRiderStops, riderStopAddress } from './rider-stop-groups'

const stop = (orderId: string, overrides: Partial<RiderStop> = {}): RiderStop => ({ orderId, orderNumber: orderId, recipientName: orderId, recipientPhone: '', addressLine1: 'Flat 1', addressLine2: 'Tower A', landmark: '', city: 'Gandhinagar', pinCode: '382007', doorstepNote: '', kind: 'one_time', items: [{ productId: 'milk', variantId: '500', productName: 'Milk', variantName: '500 ml', quantity: 1 }], ...overrides })
describe('rider delivery groups', () => {
  it('gathers a saved building without dropping intervening houses or product quantities', () => {
    const input = [stop('A', { addressKind: 'society', deliveryPlaceId: 'place1', deliveryPlaceName: 'Aster', addressLine1: 'Flat 1' }), stop('B', { addressLine1: 'House 42' }), stop('C', { addressKind: 'society', deliveryPlaceId: 'place1', deliveryPlaceName: 'Aster', addressLine1: 'Flat 77', items: [{ productId: 'curd', variantId: '1', productName: 'Curd', variantName: '1 kg', quantity: 5 }] })]
    const result = groupRiderStops(input)
    assert.deepEqual(result.map(group => group.stops.map(item => item.orderId)), [['A', 'C'], ['B']])
    assert.equal(result.flatMap(group => group.stops).length, input.length)
    assert.deepEqual(result.flatMap(group => group.stops).map(item => item.items), [input[0].items, input[2].items, input[1].items])
  })
  it('uses canonical merge identity but preserves original customer address text', () => {
    const first = stop('A', { addressKind: 'society', deliveryPlaceId: 'old1', deliveryPlaceGroupId: 'canonical', deliveryPlaceName: 'જૂનું નામ', deliveryPlaceGroupName: 'સાચું નામ', locality: 'સેક્ટર 7', doorstepNote: 'ઘંટડી ન વગાડવી' })
    const second = stop('B', { addressKind: 'society', deliveryPlaceId: 'old2', deliveryPlaceGroupId: 'canonical' })
    assert.equal(groupRiderStops([first, second]).length, 1)
    assert.equal(groupRiderStops([first, second])[0].name, 'સાચું નામ')
    assert.equal(riderStopAddress(first), 'Flat 1, Tower A, જૂનું નામ, સેક્ટર 7, ઘંટડી ન વગાડવી')
    assert.equal(first.deliveryPlaceId, 'old1')
  })
  it('never combines different PIN codes, kinds or saved identities with the same name', () => {
    const first = stop('A', { addressKind: 'society', deliveryPlaceId: 'one', deliveryPlaceName: 'Sunrise' })
    assert.equal(groupRiderStops([first, { ...first, orderId: 'B', pinCode: '382010' }, { ...first, orderId: 'C', deliveryPlaceId: 'two' }, { ...first, orderId: 'D', addressKind: 'independent' }]).length, 4)
  })
  it('legacy matching only normalizes whitespace and case of the complete written address', () => {
    const first = stop('A', { addressLine1: ' Flat 5 ', addressLine2: 'Aster   Tower' })
    const second = stop('B', { addressLine1: 'flat 5', addressLine2: 'aster tower' })
    const third = stop('C', { addressLine1: 'Flat 6', addressLine2: 'Aster Tower', landmark: 'Temple' })
    const fourth = stop('D', { addressLine1: 'House 77', addressLine2: 'Other building', landmark: 'Temple' })
    assert.deepEqual(groupRiderStops([first, second, third, fourth]).map(group => group.stops.length), [2, 1, 1])
  })
  it('empty addresses remain separate and independent houses use an explicit locality identity', () => {
    assert.equal(groupRiderStops([stop('A', { addressLine1: '', addressLine2: '', landmark: 'Temple' }), stop('B', { addressLine1: '', addressLine2: '', landmark: 'Temple' })]).length, 2)
    assert.equal(groupRiderStops([stop('C', { addressKind: 'independent', deliveryPlaceId: 'sector7' }), stop('D', { addressKind: 'independent', deliveryPlaceId: 'sector7', addressLine1: 'House 20' })]).length, 1)
  })
})
