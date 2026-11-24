import { sumLoad, type RiderItem } from '../production-admin/api'
import type { DeliveryDetails } from '@/lib/delivery-details'
import type { RiderStop } from '../production-admin/api'

export type RiderStopGroup = { key: string; name: string; source: 'saved' | 'exact-address'; stops: RiderStop[] }
/** Formatting differences only. Never remove flat numbers, punctuation, landmarks or words to guess a building. */
const normalize = (value: string) => value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN')

/** Called within a PIN area. Stable first-appearance order; every stop belongs to exactly one group. */
export function groupRiderStops(stops: RiderStop[]): RiderStopGroup[] {
  const groups = new Map<string, RiderStopGroup>()
  stops.forEach((stop, index) => {
    const placeId = stop.deliveryPlaceGroupId || stop.deliveryPlaceId
    const saved = Boolean(placeId && (stop.addressKind === 'society' || stop.addressKind === 'independent'))
    const written = [stop.addressLine1, stop.addressLine2, stop.city].map(normalize)
    const exact = written[0] || written[1]
    const key = saved ? `${stop.pinCode}|${stop.addressKind}|${placeId}` : exact ? `${stop.pinCode}|exact|${JSON.stringify(written)}` : `${stop.pinCode}|unassigned|${index}`
    const name = saved ? stop.deliveryPlaceGroupName || stop.deliveryPlaceName || '' : ''
    const group = groups.get(key) ?? { key, name, source: saved ? 'saved' : 'exact-address', stops: [] }
    group.stops.push(stop)
    groups.set(key, group)
  })
  return [...groups.values()]
}

/** Original address is retained, with optional location and directions added rather than replacing any line. */
export function riderStopAddress(stop: RiderStop): string {
  const details = stop.deliveryDetails
  const labels: Array<[keyof DeliveryDetails, string]> = [['building', 'Building'], ['towerWing', 'Tower/wing'], ['floor', 'Floor'], ['unit', 'Unit'], ['lane', 'Lane']]
  const writtenDetails = labels.flatMap(([field, label]) => details?.[field]?.trim() ? [`${label}: ${details[field]}`] : [])
  if (writtenDetails.length && !stop.deliveryDetailsConfirmed) writtenDetails.unshift('Details not confirmed')
  return [stop.addressLine1, stop.addressLine2, stop.deliveryPlaceName, stop.locality, ...writtenDetails, stop.landmark, stop.doorstepNote].filter(Boolean).join(', ')
}


export type RiderSection = { key: string; label: string; level: 'place' | 'lane' | 'building' | 'floor'; stops: RiderStop[]; load: RiderItem[]; children: RiderSection[] }
const collator = new Intl.Collator('en-IN', { numeric: true, sensitivity: 'base' })
const confirmed = (stop: RiderStop): DeliveryDetails => stop.deliveryDetailsConfirmed ? stop.deliveryDetails ?? {} : {}
const compareWritten = (left: string, right: string) => !left && right ? 1 : left && !right ? -1 : collator.compare(left, right)
/** Exact identities only; natural ordering changes visit order, never the address or product quantities. */
function partition(stops: RiderStop[], fields: Array<keyof DeliveryDetails>, level: RiderSection['level'], label: (values: string[]) => string): RiderSection[] {
  const buckets = new Map<string, { values: string[]; stops: RiderStop[] }>()
  for (const stop of stops) {
    const values = fields.map(field => (confirmed(stop)[field] ?? '').trim())
    const key = JSON.stringify(values.map(normalize))
    const bucket = buckets.get(key) ?? { values, stops: [] }
    bucket.stops.push(stop); buckets.set(key, bucket)
  }
  return [...buckets].sort(([, a], [, b]) => {
    for (let index = 0; index < fields.length; index++) {
      const order = compareWritten(a.values[index], b.values[index]); if (order) return order
    }
    return 0
  }).map(([key, bucket]) => ({ key: `${level}:${key}`, label: label(bucket.values), level, stops: bucket.stops, load: sumLoad(bucket.stops.map(stop => stop.items)), children: [] }))
}
function byFloor(stops: RiderStop[]): RiderSection[] {
  return partition(stops, ['floor'], 'floor', ([floor]) => floor ? `Floor: ${floor}` : 'Floor not provided').map(section => ({ ...section, stops: section.stops.map((stop, index) => ({ stop, index })).sort((a, b) => compareWritten(confirmed(a.stop).unit ?? '', confirmed(b.stop).unit ?? '') || a.index - b.index).map(({ stop }) => stop) }))
}
function byBuilding(stops: RiderStop[], requiresTower = true): RiderSection[] {
  return partition(stops, ['building', 'towerWing'], 'building', ([building, tower]) => [building ? `Building: ${building}` : '', tower ? `Tower/wing: ${tower}` : requiresTower ? 'Tower/wing not provided — needs clarification' : ''].filter(Boolean).join(' · ') || 'Individual houses').map(section => ({ ...section, children: byFloor(section.stops) }))
}
/** One hierarchy consumed by both PDF renderers. Legacy addresses never acquire guessed structured groups. */
export function riderDeliverySections(stops: RiderStop[]): RiderSection[] {
  return groupRiderStops(stops).map(group => {
    const label = group.source === 'saved' ? group.name || 'Saved delivery place' : group.stops.length > 1 ? 'Same written address (unverified)' : ''
    const section: RiderSection = { key: group.key, label, level: 'place', stops: group.stops, load: sumLoad(group.stops.map(stop => stop.items)), children: [] }
    if (group.source !== 'saved') return section
    section.children = group.stops[0].addressKind === 'independent'
      ? partition(group.stops, ['lane'], 'lane', ([lane]) => lane ? `Lane: ${lane}` : 'Lane not provided').map(lane => ({ ...lane, children: byBuilding(lane.stops, false) }))
      : byBuilding(group.stops)
    return section
  })
}
export function sectionStops(section: RiderSection): RiderStop[] { return section.children.length ? section.children.flatMap(sectionStops) : section.stops }
export const riderLoadText = (items: RiderItem[]): string => items.map(item => `${item.quantity} x ${item.productName} ${item.variantName}`).join(' · ')
export const needsDeliveryClarification = (stop: RiderStop): boolean => !stop.deliveryDetailsConfirmed || (stop.addressKind === 'society' && !stop.deliveryDetails?.towerWing?.trim())
