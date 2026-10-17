import { apiRequest } from '@/lib/api-client'
import type { WebsiteHome, WebsiteHomeFormValues } from './schema'

export const websiteApi = {
  getHome: () => apiRequest<{ home: WebsiteHome }>('/admin/website/home').then(response => response.home),
  saveHome: (input: WebsiteHomeFormValues) => apiRequest<{ home: WebsiteHome }>('/admin/website/home', { method: 'PUT', body: input }).then(response => response.home),
}
