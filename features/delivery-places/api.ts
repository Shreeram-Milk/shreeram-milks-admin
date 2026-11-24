import { apiRequest } from '@/lib/api-client'

export type DeliveryPlace = { id: string; name: string; locality: string; pinCode: string; kind: 'society' | 'locality'; status: 'pending' | 'approved' | 'merged'; mergedIntoId: string | null; createdAt: string; updatedAt: string }
export type PlaceFilters = { search?: string; pinCode?: string; kind?: string; status?: string; page?: number; pageSize?: number }
export const deliveryPlacesApi = {
  list(filters: PlaceFilters): Promise<{ rows: DeliveryPlace[]; total: number }> {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value !== '' && value !== undefined) query.set(key, String(value))
    return apiRequest(`/admin/delivery-places?${query}`)
  },
  create: (body: { name: string; locality: string; pinCode: string; kind: DeliveryPlace['kind']; status: 'pending' | 'approved' }) => apiRequest<{ place: DeliveryPlace }>('/admin/delivery-places', { method: 'POST', body }),
  update: (id: string, body: { name: string; locality: string; status: 'pending' | 'approved' }) => apiRequest<{ place: DeliveryPlace }>(`/admin/delivery-places/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  merge: (id: string, targetId: string) => apiRequest(`/admin/delivery-places/${encodeURIComponent(id)}/merge`, { method: 'POST', body: { targetId } }),
}
