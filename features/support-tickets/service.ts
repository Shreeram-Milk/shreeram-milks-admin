import { customerService } from '../customers/service'
import type { Customer } from '../customers/types'
import { orderService } from '../orders/service'
import { MESSAGE_MAX_LENGTH } from './schema'
import { supportTicketRepository } from './mock-repository'
import { TICKET_CATEGORY_LABELS, TICKET_TRANSITIONS, type SupportTicket, type TicketAuthor, type TicketCategory, type TicketStatus } from './types'

export class TicketRuleError extends Error {}

export type TicketListQuery = { search: string; status: TicketStatus | ''; category: TicketCategory | ''; customerId: string; page: number; pageSize: number }
export type TicketView = { ticket: SupportTicket; customer: Customer | undefined; orderNumber: string }

const now = () => new Date().toISOString()
const nextTicketNumber = (tickets: SupportTicket[]) => `TKT-${Math.max(1000, ...tickets.map(ticket => Number(ticket.ticketNumber.replace('TKT-', '')) || 0)) + 1}`

function toView(ticket: SupportTicket, customers: Map<string, Customer>): TicketView {
  return { ticket, customer: customers.get(ticket.customerId), orderNumber: ticket.orderId ? orderService.getById(ticket.orderId)?.orderNumber ?? 'Unknown order' : '' }
}

function requireTicket(id: string): SupportTicket {
  const ticket = supportTicketRepository.get(id)
  if (!ticket) throw new TicketRuleError('Ticket not found.')
  return ticket
}

export const supportTicketService = {
  list({ search, status, category, customerId, page, pageSize }: TicketListQuery): { rows: TicketView[]; total: number } {
    const customers = new Map(customerService.listAll().map(customer => [customer.id, customer]))
    const term = search.trim().toLowerCase()
    const matches = supportTicketRepository.list()
      .filter(ticket => (!status || ticket.status === status) && (!category || ticket.category === category) && (!customerId || ticket.customerId === customerId))
      .map(ticket => toView(ticket, customers))
      .filter(view => !term || [view.ticket.ticketNumber, view.customer?.fullName, view.customer?.mobile, view.orderNumber, TICKET_CATEGORY_LABELS[view.ticket.category]].join(' ').toLowerCase().includes(term))
      .sort((a, b) => b.ticket.updatedAt.localeCompare(a.ticket.updatedAt) || b.ticket.ticketNumber.localeCompare(a.ticket.ticketNumber))
    return { rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length }
  },
  getView(id: string): TicketView | undefined {
    const ticket = supportTicketRepository.get(id)
    return ticket ? toView(ticket, new Map(customerService.listAll().map(customer => [customer.id, customer]))) : undefined
  },
  /** Orders a ticket for this customer may refer to, newest first. */
  ordersForCustomer: (customerId: string) => orderService.listForCustomer(customerId).map(view => ({ value: view.order.id, label: view.order.orderNumber })),
  /** Counts that still need staff attention, for badges and the dashboard. */
  openCount: () => supportTicketRepository.list().filter(ticket => ticket.status === 'open' || ticket.status === 'in_progress').length,
  create(input: { customerId: string; orderId: string; category: TicketCategory; description: string }): SupportTicket {
    const description = input.description.trim()
    if (!description) throw new TicketRuleError('Describe the issue.')
    if (description.length > MESSAGE_MAX_LENGTH) throw new TicketRuleError(`Keep the description under ${MESSAGE_MAX_LENGTH} characters.`)
    if (!customerService.getById(input.customerId)) throw new TicketRuleError('Choose a customer that exists.')
    if (input.orderId && orderService.getById(input.orderId)?.customerId !== input.customerId) throw new TicketRuleError('That order does not belong to this customer.')
    const tickets = supportTicketRepository.list()
    const createdAt = now()
    return supportTicketRepository.save({
      ticketNumber: nextTicketNumber(tickets), customerId: input.customerId, orderId: input.orderId, category: input.category, status: 'open', assignee: '',
      messages: [{ id: crypto.randomUUID(), author: 'customer', body: description, createdAt }], createdAt, resolvedAt: null,
    })
  },
  /** Adds a message. A staff reply moves an untouched ticket to In progress; nobody can write on a closed ticket. */
  addMessage(id: string, author: TicketAuthor, body: string): SupportTicket {
    const ticket = requireTicket(id)
    const text = body.trim()
    if (!text) throw new TicketRuleError('Write a reply first.')
    if (text.length > MESSAGE_MAX_LENGTH) throw new TicketRuleError(`Keep the reply under ${MESSAGE_MAX_LENGTH} characters.`)
    if (ticket.status === 'closed') throw new TicketRuleError('This ticket is closed. Log a new ticket instead.')
    const status: TicketStatus = author === 'admin' && ticket.status === 'open' ? 'in_progress' : ticket.status
    return supportTicketRepository.save({ ...ticket, status, messages: [...ticket.messages, { id: crypto.randomUUID(), author, body: text, createdAt: now() }] })
  },
  changeStatus(id: string, status: TicketStatus): SupportTicket {
    const ticket = requireTicket(id)
    if (!TICKET_TRANSITIONS[ticket.status].includes(status)) throw new TicketRuleError(`A ${ticket.status.replace('_', ' ')} ticket cannot be moved to ${status.replace('_', ' ')}.`)
    return supportTicketRepository.save({ ...ticket, status, resolvedAt: status === 'resolved' ? now() : status === 'in_progress' ? null : ticket.resolvedAt })
  },
  assign(id: string, assignee: string): SupportTicket {
    const ticket = requireTicket(id)
    if (ticket.status === 'closed') throw new TicketRuleError('This ticket is closed.')
    return supportTicketRepository.save({ ...ticket, assignee: assignee.trim().slice(0, 60) })
  },
}
