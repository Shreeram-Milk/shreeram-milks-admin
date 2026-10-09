import { createMockCollection } from '@/lib/mock-collection'
import type { Faq, FaqTopic } from './types'

const faq = (id: string, topic: FaqTopic, sortOrder: number, question: string, answer: string): Faq => ({ id, topic, question, questionGujarati: '', answer, answerGujarati: '', sortOrder, status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' })

const seed: Faq[] = [
  faq('faq-arrival', 'delivery', 1, 'When will my delivery arrive?', 'Your scheduled delivery window appears in your order details and delivery calendar.'),
  faq('faq-pause', 'subscription', 1, 'How do I pause a subscription?', 'Open your subscription and choose Pause subscription to select the dates you will be away.'),
  faq('faq-refunds', 'payments', 1, 'How do payments and refunds work?', 'Payments are confirmed when your order is placed. Refunds are returned to the original payment method.'),
]

export const faqRepository = createMockCollection<Faq>('shreeram-admin-faqs-v1', seed, 'faq')
