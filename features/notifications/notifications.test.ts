import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { broadcastService, isFuture, NotificationRuleError, renderPreview, templateService } from './service'

declare const __resetStorage: () => void

beforeEach(() => __resetStorage())

const broadcast = { title: 'Happy Diwali', titleGujarati: '', body: 'Hi {{customerName}}, wishing you a bright Diwali.', bodyGujarati: '', audience: 'all' as const, channel: 'push' as const, status: 'draft' as const, scheduledDate: '' as const, scheduledTime: '' }
const NOW = new Date('2026-10-09T06:00:00Z') // 11:30 AM in India

describe('notification templates', () => {
  it('has one template per system event, all active by default', () => {
    const templates = templateService.list()
    assert.equal(templates.length, 8)
    assert.ok(templates.every(template => template.status === 'active'))
  })
  it('only accepts placeholders that event can fill in', () => {
    const template = templateService.getById('out_for_delivery')
    assert.ok(template)
    assert.throws(() => templateService.save({ ...template, body: 'Your {{productName}} is on its way.' }), /Unknown placeholder: \{\{productName\}\}/)
    assert.doesNotThrow(() => templateService.save({ ...template, body: 'Hi {{customerName}}, {{orderNumber}} is on its way.' }))
  })
  it('keeps SMS short and needs a channel while active', () => {
    const template = templateService.getById('delivered')
    assert.ok(template)
    assert.throws(() => templateService.save({ ...template, smsEnabled: true, body: 'x'.repeat(161) }), NotificationRuleError)
    assert.throws(() => templateService.save({ ...template, pushEnabled: false, smsEnabled: false }), /at least one channel/)
    assert.doesNotThrow(() => templateService.save({ ...template, pushEnabled: false, smsEnabled: false, status: 'inactive' }))
  })
  it('fills sample details into a preview and leaves unknown tokens alone', () => {
    assert.equal(renderPreview('Hi {{customerName}}, {{nope}}'), 'Hi Priya, {{nope}}')
  })
})

describe('broadcasts', () => {
  it('only lets a broadcast greet the customer by name', () => {
    assert.throws(() => broadcastService.save({ ...broadcast, body: 'Order {{orderNumber}} is ready.' }), /Unknown placeholder/)
  })
  it('counts only active customers in the audience', () => {
    assert.ok(broadcastService.audienceCount('all') >= broadcastService.audienceCount('prepaid'))
    assert.equal(broadcastService.audienceCount('prepaid') + broadcastService.audienceCount('credit'), broadcastService.audienceCount('all'))
  })
  it('schedules only a draft, in the future, and unschedules back to draft', () => {
    const draft = broadcastService.save(broadcast)
    assert.throws(() => broadcastService.schedule(draft.id, '2026-10-09', '09:00', NOW), /future/)
    assert.throws(() => broadcastService.schedule(draft.id, '2026-10-08', '18:00', NOW), /future/)
    const scheduled = broadcastService.schedule(draft.id, '2026-10-09', '18:00', NOW)
    assert.equal(scheduled.status, 'scheduled')
    assert.throws(() => broadcastService.schedule(draft.id, '2026-10-10', '09:00', NOW), /draft/)
    assert.throws(() => broadcastService.save({ ...broadcast, id: draft.id }), /back to draft/)
    const back = broadcastService.changeStatus(draft.id, 'draft')
    assert.deepEqual([back.status, back.scheduledDate, back.scheduledTime], ['draft', '', ''])
  })
  it('treats a cancelled broadcast as final', () => {
    const draft = broadcastService.save(broadcast)
    broadcastService.changeStatus(draft.id, 'cancelled')
    assert.throws(() => broadcastService.changeStatus(draft.id, 'draft'), NotificationRuleError)
    assert.throws(() => broadcastService.save({ ...broadcast, id: draft.id }), /cancelled/)
  })
  it('compares a business-zone time with the clock correctly', () => {
    assert.equal(isFuture('2026-10-09', '11:31', NOW), true)
    assert.equal(isFuture('2026-10-09', '11:29', NOW), false)
  })
})
