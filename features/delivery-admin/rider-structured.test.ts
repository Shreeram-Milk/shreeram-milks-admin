import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sumLoad } from '../production-admin/api'
import { needsDeliveryClarification, riderDeliverySections, riderStopAddress, sectionStops, type RiderSection } from './rider-stop-groups'
import { syntheticGandhinagarStops as cases } from './rider-structured.fixtures'
const sections = (rows: RiderSection[]): RiderSection[] => rows.flatMap(row => [row, ...sections(row.children)])
describe('structured rider hierarchy with twenty fictional Gandhinagar deliveries', () => {
  it('keeps every stop and every exact product variant quantity at every grouping level', () => {
    assert.equal(cases.length, 20)
    const before = JSON.stringify(cases)
    const tree = riderDeliverySections(cases)
    const flat = tree.flatMap(sectionStops)
    assert.equal(flat.length, 20)
    assert.deepEqual(flat.map(row => row.orderId).sort(), cases.map(row => row.orderId).sort())
    for (const row of sections(tree)) assert.deepEqual(row.load, sumLoad(row.stops.map(stop => stop.items)))
    assert.deepEqual(sumLoad(flat.map(row => row.items)), sumLoad(cases.map(row => row.items)))
    assert.equal(JSON.stringify(cases), before)
  })
  it('keeps Tower A, B, A/B and AB separate and orders units naturally inside their explicit floor', () => {
    const tree = riderDeliverySections(cases)
    const labels = sections(tree).filter(row => row.level === 'building').map(row => row.label)
    for (const tower of ['A', 'B', 'A/B', 'AB']) assert.ok(labels.some(label => label.endsWith(`Tower/wing: ${tower}`)))
    const firstFloor = sections(tree).find(row => row.level === 'floor' && row.stops.some(stop => stop.orderId === cases[0].orderId))!
    assert.deepEqual(sectionStops(firstFloor).map(stop => stop.deliveryDetails?.unit), ['A-2', 'A-10'])
  })
  it('never derives floor 1 from flat 101 or accepts unconfirmed proposed fields as grouping facts', () => {
    const rows = sections(riderDeliverySections(cases))
    const missingFloor = rows.find(row => row.level === 'floor' && row.stops.some(stop => stop.orderId === cases[19].orderId))!
    assert.equal(missingFloor.label, 'Floor not provided')
    assert.ok(!rows.some(row => row.label.includes('Guessed C') || row.label.includes('Unverified guess') || row.label.includes('Guessed lane')))
    assert.ok(rows.some(row => row.label === 'Floor: 0'))
    assert.ok(rows.some(row => row.label === 'Floor: Ground'))
  })
  it('uses explicit independent-house lanes and keeps raw legacy landmarks out of structured grouping', () => {
    const rows = sections(riderDeliverySections(cases))
    const lane1 = rows.find(row => row.label === 'Lane: Lane 1')!
    assert.deepEqual(sectionStops(lane1).map(stop => stop.deliveryDetails?.unit), ['House 2', 'House 10'])
    assert.ok(!rows.some(row => row.label.includes('Same temple') || row.label.includes('Behind temple')))
    const legacy = riderDeliverySections(cases.filter(stop => stop.addressKind === 'unspecified'))
    assert.ok(legacy.every(row => row.children.length === 0))
  })
  it('prints full original Gujarati and English addresses, directions and structured confirmation status', () => {
    const gu = riderStopAddress(cases[15]); assert.ok(gu.includes('ફ્લેટ બે-201')); assert.ok(gu.includes('ઘંટડી ન વગાડવી'))
    const unconfirmed = riderStopAddress(cases[7]); assert.ok(unconfirmed.includes('Details not confirmed')); assert.ok(unconfirmed.includes(cases[7].addressLine1))
    assert.equal(needsDeliveryClarification(cases[6]), true)
    assert.equal(needsDeliveryClarification(cases[0]), false)
  })
})
