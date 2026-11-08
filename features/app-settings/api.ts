import { apiRequest } from '@/lib/api-client'
import type { AppSettings, AppSettingsInput } from './types'

/** App settings calls to the backend. The backend validates everything again, so these never decide what is allowed. */
export const appSettingsApi = {
  get: () => apiRequest<{ settings: AppSettings }>('/admin/app-settings').then(response => response.settings),
  save: (input: AppSettingsInput) => apiRequest<{ settings: AppSettings }>('/admin/app-settings', { method: 'PUT', body: input }).then(response => response.settings),
}

/** How many scratch cards were given, scratched and used. */
export const rewardStatsApi = {
  get: () => apiRequest<{ stats: { given: number; scratched: number; used: number } }>('/admin/rewards/stats').then(response => response.stats),
}
