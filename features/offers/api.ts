import { apiRequest } from '@/lib/api-client'
import type { Offer, OfferInput } from './types'

/** Offer calls to the backend. The backend validates everything again, so these never decide what is allowed. */
export const offerApi = {
  list: () => apiRequest<{ offers: Offer[] }>('/admin/offers').then(response => response.offers),
  get: (id: string) => apiRequest<{ offer: Offer }>(`/admin/offers/${id}`).then(response => response.offer),
  create: (input: OfferInput) => apiRequest<{ offer: Offer }>('/admin/offers', { method: 'POST', body: input }).then(response => response.offer),
  update: (id: string, input: OfferInput) => apiRequest<{ offer: Offer }>(`/admin/offers/${id}`, { method: 'PUT', body: input }).then(response => response.offer),
  setStatus: (id: string, status: Offer['status']) => apiRequest<{ offer: Offer }>(`/admin/offers/${id}/status`, { method: 'PATCH', body: { status } }).then(response => response.offer),
}
