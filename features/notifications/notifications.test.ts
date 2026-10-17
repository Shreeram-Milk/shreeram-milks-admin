import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blankBroadcast, broadcastSchema, describeAudience, parsePinCodes, readyAudience, templateSchema, toAudience } from './schema'

const valid = { ...blankBroadcast, title: 'Diwali', body: 'Happy Diwali!' }

describe('who a message goes to', () => {
  it('reads PIN codes typed with commas, spaces or new lines, once each', () => {
    assert.deepEqual(parsePinCodes('382010, 382011\n382010;382012'), ['382010', '382011', '382012'])
    assert.deepEqual(parsePinCodes('   '), [])
  })

  it('builds only the part of the audience that was chosen', () => {
    assert.deepEqual(toAudience({ ...valid, audienceType: 'all', customerType: 'credit' }), { type: 'all' })
    assert.deepEqual(toAudience({ ...valid, audienceType: 'filter', customerType: 'credit', pinCodes: '382010 382011', subscription: 'with' }), { type: 'filter', customerType: 'credit', pinCodes: ['382010', '382011'], hasActiveSubscription: true })
    assert.deepEqual(toAudience({ ...valid, audienceType: 'filter', customerType: '', pinCodes: '', subscription: 'without' }), { type: 'filter', hasActiveSubscription: false })
    assert.deepEqual(toAudience({ ...valid, audienceType: 'customers', customerIds: ['a', 'b'], customerType: 'credit' }), { type: 'customers', customerIds: ['a', 'b'] })
  })

  it('is ready to count only when the group is complete and valid', () => {
    assert.ok(readyAudience({ ...valid, audienceType: 'all' }))
    assert.equal(readyAudience({ ...valid, audienceType: 'filter' }), null)
    assert.equal(readyAudience({ ...valid, audienceType: 'filter', pinCodes: '12345' }), null)
    assert.ok(readyAudience({ ...valid, audienceType: 'filter', pinCodes: '382010' }))
    assert.equal(readyAudience({ ...valid, audienceType: 'customers', customerIds: [] }), null)
    assert.ok(readyAudience({ ...valid, audienceType: 'customers', customerIds: ['a'] }))
  })

  it('describes the group in plain words', () => {
    assert.equal(describeAudience({ type: 'all' }), 'Everyone')
    assert.equal(describeAudience({ type: 'customers', customerIds: ['a'] }), '1 chosen customer')
    assert.equal(describeAudience({ type: 'filter', customerType: 'credit', pinCodes: ['382010'], hasActiveSubscription: true }), 'Credit customers in 382010 with a subscription')
  })
})

describe('the forms', () => {
  it('needs a title and a message, and keeps them short', () => {
    assert.equal(broadcastSchema.safeParse(valid).success, true)
    assert.equal(broadcastSchema.safeParse({ ...valid, title: '' }).success, false)
    assert.equal(broadcastSchema.safeParse({ ...valid, title: 'x'.repeat(61) }).success, false)
    assert.equal(broadcastSchema.safeParse({ ...valid, body: 'x'.repeat(241) }).success, false)
  })

  it('refuses a group with nothing to narrow it, bad PIN codes, or no chosen customers', () => {
    assert.equal(broadcastSchema.safeParse({ ...valid, audienceType: 'filter' }).success, false)
    assert.equal(broadcastSchema.safeParse({ ...valid, audienceType: 'filter', pinCodes: '38201' }).success, false)
    assert.equal(broadcastSchema.safeParse({ ...valid, audienceType: 'filter', customerType: 'prepaid' }).success, true)
    assert.equal(broadcastSchema.safeParse({ ...valid, audienceType: 'customers' }).success, false)
  })

  it('lets an automatic message keep an empty Gujarati wording', () => {
    assert.equal(templateSchema.safeParse({ title: 'On its way', titleGujarati: '', body: 'Order {{order}} is out.', bodyGujarati: '', enabled: true }).success, true)
    assert.equal(templateSchema.safeParse({ title: '', titleGujarati: '', body: 'x', bodyGujarati: '', enabled: true }).success, false)
  })
})
