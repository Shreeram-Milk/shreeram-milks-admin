import { todayInBusinessZone } from '@/lib/business-time'
import { customerService } from '../customers/service'
import { subscriptionService } from '../subscriptions/service'
import { NOTIFICATION_EVENTS, PLACEHOLDER_SAMPLES, eventById } from './events'
import { broadcastRepository, templateRepository } from './mock-repository'
import { PUSH_BODY_MAX, PUSH_TITLE_MAX, SMS_BODY_MAX } from './schema'
import { BROADCAST_TRANSITIONS, type Broadcast, type BroadcastAudience, type BroadcastInput, type BroadcastStatus, type NotificationEvent, type NotificationTemplate, type NotificationTemplateInput, type Placeholder } from './types'

export class NotificationRuleError extends Error {}

const TOKEN = /\{\{\s*(\w+)\s*\}\}/g
/** The only detail a broadcast can address, since it is not about one order or delivery. */
const BROADCAST_PLACEHOLDERS: Placeholder[] = ['customerName']

const tokensIn = (text: string): string[] => [...text.matchAll(TOKEN)].map(match => match[1])
const unknownTokens = (texts: string[], allowed: readonly string[]) => [...new Set(texts.flatMap(tokensIn).filter(token => !allowed.includes(token)))]

/** Fills placeholders with sample values so staff can see roughly what a customer will read. */
export function renderPreview(text: string): string {
  return text.replace(TOKEN, (whole, token: string) => PLACEHOLDER_SAMPLES[token as Placeholder] ?? whole)
}

function checkWording(fields: { title: string; titleGujarati: string; body: string; bodyGujarati: string }, allowed: readonly string[], sms: boolean) {
  const texts = [fields.title, fields.titleGujarati, fields.body, fields.bodyGujarati]
  const unknown = unknownTokens(texts, allowed)
  if (unknown.length) throw new NotificationRuleError(`Unknown placeholder: ${unknown.map(token => `{{${token}}}`).join(', ')}. Use only ${allowed.map(token => `{{${token}}}`).join(', ')}.`)
  if (!fields.title.trim() || !fields.body.trim()) throw new NotificationRuleError('Enter a title and a message.')
  if (fields.title.length > PUSH_TITLE_MAX || fields.titleGujarati.length > PUSH_TITLE_MAX) throw new NotificationRuleError(`Keep titles under ${PUSH_TITLE_MAX} characters.`)
  if (fields.body.length > PUSH_BODY_MAX || fields.bodyGujarati.length > PUSH_BODY_MAX) throw new NotificationRuleError(`Keep messages under ${PUSH_BODY_MAX} characters.`)
  if (sms && fields.body.length > SMS_BODY_MAX) throw new NotificationRuleError(`SMS messages must be ${SMS_BODY_MAX} characters or fewer.`)
}

export const templateService = {
  list: (): NotificationTemplate[] => NOTIFICATION_EVENTS.flatMap(event => templateRepository.get(event.id) ?? []),
  getById: (id: NotificationEvent) => templateRepository.get(id),
  save(input: NotificationTemplateInput): NotificationTemplate {
    const event = eventById(input.id)
    if (!event) throw new NotificationRuleError('Unknown notification event.')
    if (input.status === 'active' && !input.pushEnabled && !input.smsEnabled) throw new NotificationRuleError('Turn on at least one channel, or set the template to inactive.')
    checkWording(input, event.placeholders, input.smsEnabled)
    return templateRepository.save({ ...input, title: input.title.trim(), body: input.body.trim(), updatedAt: new Date().toISOString() })
  },
  setStatus(id: NotificationEvent, status: NotificationTemplate['status']) {
    const template = templateRepository.get(id)
    if (!template) throw new NotificationRuleError('Template not found.')
    if (status === 'active' && !template.pushEnabled && !template.smsEnabled) throw new NotificationRuleError('Turn on a channel before activating this template.')
    templateRepository.save({ ...template, status, updatedAt: new Date().toISOString() })
  },
}

/** Whether a business-zone date and time is still ahead of `now`. India has no daylight saving, so the offset is fixed. */
export const isFuture = (date: string, time: string, now: Date = new Date()): boolean => new Date(`${date}T${time}:00+05:30`).getTime() > now.getTime()

export const broadcastService = {
  list: () => [...broadcastRepository.list()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  getById: (id: string) => broadcastRepository.get(id),
  /** How many customers the audience would reach right now (active customers only). */
  audienceCount(audience: BroadcastAudience): number {
    const active = customerService.listAll().filter(customer => customer.status === 'active')
    if (audience === 'prepaid' || audience === 'credit') return active.filter(customer => customer.customerType === audience).length
    if (audience === 'subscribers') { const subscribers = subscriptionService.activeCountsByCustomer(); return active.filter(customer => subscribers.has(customer.id)).length }
    return active.length
  },
  save(input: BroadcastInput): Broadcast {
    const existing = input.id ? broadcastRepository.get(input.id) : undefined
    if (input.id && !existing) throw new NotificationRuleError('Broadcast not found.')
    if (existing && existing.status !== 'draft') throw new NotificationRuleError(existing.status === 'scheduled' ? 'Move this broadcast back to draft before editing it.' : 'A cancelled broadcast cannot be edited.')
    checkWording(input, BROADCAST_PLACEHOLDERS, input.channel !== 'push')
    return broadcastRepository.save({ ...input, status: 'draft', scheduledDate: '', scheduledTime: '', title: input.title.trim(), body: input.body.trim() })
  },
  /** Locks the broadcast for sending at a future time. Sending itself happens once the notification service is connected. */
  schedule(id: string, date: string, time: string, now: Date = new Date()): Broadcast {
    const broadcast = broadcastRepository.get(id)
    if (!broadcast) throw new NotificationRuleError('Broadcast not found.')
    if (!BROADCAST_TRANSITIONS[broadcast.status].includes('scheduled')) throw new NotificationRuleError('Only a draft can be scheduled.')
    if (date < todayInBusinessZone(now) || !isFuture(date, time, now)) throw new NotificationRuleError('Choose a date and time in the future.')
    if (broadcastService.audienceCount(broadcast.audience) === 0) throw new NotificationRuleError('This audience has no customers to reach.')
    return broadcastRepository.save({ ...broadcast, status: 'scheduled', scheduledDate: date, scheduledTime: time })
  },
  changeStatus(id: string, status: BroadcastStatus): Broadcast {
    const broadcast = broadcastRepository.get(id)
    if (!broadcast) throw new NotificationRuleError('Broadcast not found.')
    if (!BROADCAST_TRANSITIONS[broadcast.status].includes(status)) throw new NotificationRuleError(`A ${broadcast.status} broadcast cannot be moved to ${status}.`)
    return broadcastRepository.save({ ...broadcast, status, scheduledDate: status === 'scheduled' ? broadcast.scheduledDate : '', scheduledTime: status === 'scheduled' ? broadcast.scheduledTime : '' })
  },
}
