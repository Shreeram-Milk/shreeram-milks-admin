import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cutoffPreview, describeUsage, formatTime, readUsages } from './format'
import { parsePinList } from './pin-list'
import { buildSchema, parseLengths, toPayload, type FormValues } from './form-values'

const values = (extra: Partial<FormValues> = {}): FormValues => ({
  name: ' Morning ', description: ' note ', status: 'active', durationDays: 3, systemType: 'daily', lengthOptions: '30, 15, 15', minDays: 5, maxDays: 180, startTime: '05:00', endTime: '07:00',
  coverageType: 'pin_code', state: ' Gujarat ', city: ' Gandhinagar ',
  conditions: [{ deliverySlotId: 'slot-1', dayRelation: 'previous_day', cutoffTime: '15:00', cancelDayRelation: '', cancelTime: '' }], ...extra,
})

describe('pasting many PIN codes', () => {
  it('splits on lines, commas, semicolons and spaces, and drops blanks and repeats', () => {
    assert.deepEqual(parsePinList('382010\n382011, 382012;382010  \n\n 382013 '), ['382010', '382011', '382012', '382013'])
    assert.deepEqual(parsePinList('   '), [])
  })
})

describe('what the server is told to switch off', () => {
  it('reads the usage list from an in-use refusal and ignores anything malformed', () => {
    assert.deepEqual(readUsages([{ label: 'products', count: 2, examples: ['Gandhinagar', 7] }, { nonsense: true }, null]), [{ label: 'products', count: 2, examples: ['Gandhinagar'] }])
    assert.deepEqual(readUsages('oops'), [])
    assert.equal(describeUsage({ label: 'products', count: 2, examples: ['A', 'B'] }), '2 products: A, B')
    assert.equal(describeUsage({ label: 'cut-off rules', count: 1, examples: [] }), '1 cut-off rules')
  })
})

describe('time wording', () => {
  it('shows 12-hour times, including midnight and noon', () => {
    assert.equal(formatTime('00:05'), '12:05 AM')
    assert.equal(formatTime('12:00'), '12:00 PM')
    assert.equal(formatTime('17:30'), '5:30 PM')
    assert.match(cutoffPreview({ dayRelation: 'previous_day', cutoffTime: '15:00' }, { name: 'Morning' }), /tomorrow’s Morning delivery must be placed before 3:00 PM today/)
  })
})

describe('what is sent to the server', () => {
  it('trims text and clears fields the kind of area does not use', () => {
    assert.deepEqual(toPayload('service-areas', values({ coverageType: 'state' }), false), { name: 'Morning', description: 'note', status: 'active', coverageType: 'state', state: 'Gujarat', city: '', confirmRemovePins: false })
    assert.deepEqual(toPayload('service-areas', values({ coverageType: 'pan_india' }), true), { name: 'Morning', description: 'note', status: 'active', coverageType: 'pan_india', state: '', city: '', confirmRemovePins: true })
  })
})

describe('quick checks before saving', () => {
  it('catches an end time that is not after the start', () => {
    assert.equal(buildSchema('delivery-slots').safeParse(values({ startTime: '09:00', endTime: '09:00' })).success, false)
    assert.equal(buildSchema('delivery-slots').safeParse(values()).success, true)
  })
  it('catches a repeated slot in a cut-off rule', () => {
    const twice = [{ deliverySlotId: 's', dayRelation: 'same_day' as const, cutoffTime: '10:00', cancelDayRelation: '' as const, cancelTime: '' }, { deliverySlotId: 's', dayRelation: 'previous_day' as const, cutoffTime: '20:00', cancelDayRelation: '' as const, cancelTime: '' }]
    assert.equal(buildSchema('cutoff-rules').safeParse(values({ conditions: twice })).success, false)
  })

  it('sends an earlier cancel deadline, refuses one after the cut-off, and sends none when it is the same as the cut-off', () => {
    const condition = { deliverySlotId: 's', dayRelation: 'previous_day' as const, cutoffTime: '15:00' }
    const earlier = values({ conditions: [{ ...condition, cancelDayRelation: 'previous_day', cancelTime: '12:00' }] })
    assert.equal(buildSchema('cutoff-rules').safeParse(earlier).success, true)
    assert.deepEqual((toPayload('cutoff-rules', earlier, false) as { conditions: unknown[] }).conditions, [{ ...condition, cancelDayRelation: 'previous_day', cancelTime: '12:00' }])
    assert.equal(buildSchema('cutoff-rules').safeParse(values({ conditions: [{ ...condition, cancelDayRelation: 'same_day', cancelTime: '05:00' }] })).success, false)
    assert.deepEqual((toPayload('cutoff-rules', values({ conditions: [{ ...condition, cancelDayRelation: '', cancelTime: '09:00' }] }), false) as { conditions: unknown[] }).conditions, [{ ...condition, cancelDayRelation: null, cancelTime: null }])
  })

  it('reads a subscription rule\'s lengths as sorted unique numbers, and refuses anything else', () => {
    assert.deepEqual(toPayload('subscription-rules', values(), false), { name: 'Morning', description: 'note', status: 'active', systemType: 'daily', lengthOptions: [15, 30], minDays: 5, maxDays: 180 })
    assert.deepEqual(parseLengths('7 15,30'), [7, 15, 30])
    for (const bad of ['', '0', '15, abc', '400', '1,2,3,4,5,6,7']) assert.equal(parseLengths(bad), null, bad)
    assert.equal(buildSchema('subscription-rules').safeParse(values({ lengthOptions: '15.5' })).success, false)
    assert.equal(buildSchema('subscription-rules').safeParse(values({ minDays: 30, maxDays: 10 })).success, false)
    assert.equal(buildSchema('subscription-rules').safeParse(values({ minDays: 0 })).success, false)
    assert.equal(buildSchema('subscription-rules').safeParse(values({ minDays: 5, maxDays: 730 })).success, true)
  })
})
