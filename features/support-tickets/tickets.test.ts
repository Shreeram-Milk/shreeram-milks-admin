import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { supportTicketService, TicketRuleError } from './service'

declare const __resetStorage: () => void

beforeEach(() => __resetStorage())

const input = { customerId: 'customer-rakesh', orderId: '', category: 'quality' as const, description: 'The milk smelled off.' }

describe('support tickets', () => {
  it('numbers new tickets after the highest existing one', () => {
    const first = supportTicketService.create(input)
    const second = supportTicketService.create(input)
    assert.equal(first.ticketNumber, 'TKT-1003')
    assert.equal(second.ticketNumber, 'TKT-1004')
    assert.equal(first.status, 'open')
    assert.equal(first.messages.length, 1)
  })
  it('rejects a missing customer, a blank description and another customer’s order', () => {
    assert.throws(() => supportTicketService.create({ ...input, customerId: 'customer-missing' }), TicketRuleError)
    assert.throws(() => supportTicketService.create({ ...input, description: '   ' }), TicketRuleError)
    assert.throws(() => supportTicketService.create({ ...input, orderId: 'order-seed-2' }), /does not belong/)
    assert.doesNotThrow(() => supportTicketService.create({ ...input, orderId: 'order-seed-1' }))
  })
  it('moves an open ticket to in progress on the first staff reply, but not on a customer message', () => {
    const ticket = supportTicketService.create(input)
    assert.equal(supportTicketService.addMessage(ticket.id, 'customer', 'Also the cap was loose.').status, 'open')
    assert.equal(supportTicketService.addMessage(ticket.id, 'admin', 'Sorry about that — looking into it.').status, 'in_progress')
  })
  it('only allows the legal status transitions', () => {
    const ticket = supportTicketService.create(input)
    assert.throws(() => supportTicketService.changeStatus(ticket.id, 'closed'), TicketRuleError)
    const resolved = supportTicketService.changeStatus(ticket.id, 'resolved')
    assert.equal(resolved.status, 'resolved')
    assert.ok(resolved.resolvedAt)
    assert.equal(supportTicketService.changeStatus(ticket.id, 'in_progress').resolvedAt, null)
    supportTicketService.changeStatus(ticket.id, 'resolved')
    assert.equal(supportTicketService.changeStatus(ticket.id, 'closed').status, 'closed')
    assert.throws(() => supportTicketService.changeStatus(ticket.id, 'in_progress'), TicketRuleError)
  })
  it('blocks replies and assignment once a ticket is closed', () => {
    const ticket = supportTicketService.create(input)
    supportTicketService.changeStatus(ticket.id, 'resolved')
    supportTicketService.changeStatus(ticket.id, 'closed')
    assert.throws(() => supportTicketService.addMessage(ticket.id, 'admin', 'Hello?'), /closed/)
    assert.throws(() => supportTicketService.assign(ticket.id, 'Someone'), TicketRuleError)
  })
  it('filters by status and finds tickets by customer name', () => {
    assert.equal(supportTicketService.list({ search: '', status: 'open', category: '', customerId: '', page: 1, pageSize: 10 }).total, 1)
    assert.equal(supportTicketService.list({ search: 'meena', status: '', category: '', customerId: '', page: 1, pageSize: 10 }).total, 1)
    assert.equal(supportTicketService.openCount(), 2)
  })
})
