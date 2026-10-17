import { apiRequest } from '@/lib/api-client'
import type { Banner, BannerInput, BannerStatus } from './types'

/** Banner calls to the backend. The backend validates everything again, so these never decide what is allowed. */
export const bannerApi = {
  list: () => apiRequest<{ banners: Banner[] }>('/admin/banners').then(response => response.banners),
  get: (id: string) => apiRequest<{ banner: Banner }>(`/admin/banners/${id}`).then(response => response.banner),
  create: (input: BannerInput) => apiRequest<{ banner: Banner }>('/admin/banners', { method: 'POST', body: input }).then(response => response.banner),
  update: (id: string, input: BannerInput) => apiRequest<{ banner: Banner }>(`/admin/banners/${id}`, { method: 'PUT', body: input }).then(response => response.banner),
  setStatus: (id: string, status: BannerStatus) => apiRequest<{ banner: Banner }>(`/admin/banners/${id}/status`, { method: 'PATCH', body: { status } }).then(response => response.banner),
}
