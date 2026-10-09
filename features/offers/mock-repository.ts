import { createMockCollection } from '@/lib/mock-collection'
import type { Offer } from './types'

const seed: Offer[] = [
  { id: 'offer-dawn', name: 'Dawn discount', nameGujarati: 'પ્રભાત ડિસ્કાઉન્ટ', description: 'Applied to subscription orders.', code: '', discountType: 'percent', value: 10, minOrderPaise: 0, appliesTo: 'subscriptions', startDate: '', endDate: '', status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' },
]

export const offerRepository = createMockCollection<Offer>('shreeram-admin-offers-v1', seed, 'offer')
