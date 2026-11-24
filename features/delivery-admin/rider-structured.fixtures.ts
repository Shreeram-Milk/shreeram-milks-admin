import type { RiderStop } from '../production-admin/api'
import type { DeliveryDetails } from '@/lib/delivery-details'

/** Fictional Gandhinagar examples for tests and local PDF review, never used by production screens. */
export const syntheticGandhinagarStops: RiderStop[] = Array.from({ length: 20 }, (_, index) => ({
  orderId: `synthetic-${index + 1}`, orderNumber: `DEMO-${index + 1}`, recipientName: `Synthetic customer ${index + 1}`, recipientPhone: '0000000000',
  addressLine1: `Flat ${index + 1}`, addressLine2: 'Shreeji Society', landmark: 'Community garden', city: 'Gandhinagar', pinCode: '382007', doorstepNote: index % 3 === 0 ? 'Leave in milk box; do not ring bell.' : '', kind: index % 4 === 0 ? 'trial' : 'one_time', addressKind: 'society', deliveryPlaceId: 'shreeji', deliveryPlaceName: 'Shreeji Society', locality: 'Sector 7', deliveryDetailsConfirmed: true,
  deliveryDetails: { building: 'Shreeji Heights', towerWing: 'A', floor: '1', unit: String(index + 1), lane: '' },
  items: [{ productId: 'cow-milk', variantId: index % 2 === 0 ? '500ml' : '1litre', productName: 'Cow Milk', variantName: index % 2 === 0 ? '500 ml' : '1 litre', quantity: index % 3 + 1 }, ...(index % 5 === 0 ? [{ productId: 'curd', variantId: '200g', productName: 'Curd', variantName: '200 g', quantity: 2 }] : [])],
}))
const details: DeliveryDetails[] = [
  { building: 'Heights', towerWing: 'A', floor: '1', unit: 'A-2' },
  { building: 'Heights', towerWing: 'A', floor: '1', unit: 'A-10' },
  { building: 'Heights', towerWing: 'A', floor: '2', unit: '201' },
  { building: 'Heights', towerWing: 'B', floor: '1', unit: '101' },
  { building: 'Heights', towerWing: 'A/B', floor: '1', unit: '101' },
  { building: 'Heights', towerWing: 'AB', floor: '1', unit: '101' },
  { building: 'Heights', floor: '5', unit: '501' },
  { building: 'Unverified guess', towerWing: 'Guessed C', floor: '9', unit: '901' },
  { building: 'Heights', towerWing: 'A', floor: '0', unit: 'G-2' },
  { building: 'Heights', towerWing: 'A', floor: 'Ground', unit: 'G-1' },
  { building: 'Other Heights', towerWing: 'A', floor: '1', unit: '102' },
  { lane: 'Lane 1', unit: 'House 2' },
  { lane: 'Lane 1', unit: 'House 10' },
  { lane: 'Lane 2', unit: 'House 3' },
  { lane: 'Guessed lane', unit: 'House 4' },
  { building: 'શ્રીજી હાઇટ્સ', towerWing: 'બી', floor: '2', unit: 'બે-201' },
  { building: 'Heights', towerWing: 'A', floor: '1', unit: 'A-2' },
  {}, {},
  { building: 'Heights', towerWing: 'A', unit: '101' },
]
syntheticGandhinagarStops.forEach((stop, index) => { stop.deliveryDetails = details[index] })
syntheticGandhinagarStops[7].deliveryDetailsConfirmed = false
for (const index of [11, 12, 13, 14]) Object.assign(syntheticGandhinagarStops[index], { addressKind: 'independent', deliveryPlaceId: 'vavol', deliveryPlaceName: 'Vavol', addressLine2: 'Vavol', locality: 'Vavol' })
syntheticGandhinagarStops[14].deliveryDetailsConfirmed = false
Object.assign(syntheticGandhinagarStops[15], { deliveryPlaceId: 'sector4', deliveryPlaceName: 'શ્રીજી સોસાયટી', addressLine1: 'ફ્લેટ બે-201', addressLine2: 'શ્રીજી સોસાયટી', doorstepNote: 'ઘંટડી ન વગાડવી', locality: 'સેક્ટર 4' })
syntheticGandhinagarStops[16].pinCode = '382010'
for (const index of [17, 18]) Object.assign(syntheticGandhinagarStops[index], { addressKind: 'unspecified', deliveryPlaceId: null, deliveryPlaceName: '', addressLine1: `House ${index}`, addressLine2: 'Behind temple', landmark: 'Same temple', deliveryDetailsConfirmed: false })
