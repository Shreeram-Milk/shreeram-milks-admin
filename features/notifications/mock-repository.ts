import { readCollection, writeCollection } from '@/lib/mock-storage'
import { createMockCollection } from '@/lib/mock-collection'
import { NOTIFICATION_EVENTS } from './events'
import type { Broadcast, NotificationTemplate } from './types'

const TEMPLATES_KEY = 'shreeram-admin-notification-templates-v1'
const seedTemplates: NotificationTemplate[] = NOTIFICATION_EVENTS.map(event => ({ id: event.id, pushEnabled: true, smsEnabled: false, title: event.title, titleGujarati: '', body: event.body, bodyGujarati: '', status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' }))

/** One template per event. Only the wording and switches change, so this is a keyed read and update, never a create. */
export const templateRepository = {
  list: () => readCollection<NotificationTemplate[]>(TEMPLATES_KEY, seedTemplates),
  get: (id: string) => templateRepository.list().find(item => item.id === id),
  save(template: NotificationTemplate) {
    writeCollection(TEMPLATES_KEY, templateRepository.list().map(item => item.id === template.id ? template : item))
    return template
  },
}

export const broadcastRepository = createMockCollection<Broadcast>('shreeram-admin-broadcasts-v1', [], 'broadcast')
