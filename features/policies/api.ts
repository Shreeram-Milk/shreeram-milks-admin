import { apiRequest } from '@/lib/api-client'
import type { PolicyDocument, PolicyInput } from './types'

/** Policy calls to the backend. The backend validates everything again, so these never decide what is allowed. */
export const policyApi = {
  list: () => apiRequest<{ policies: PolicyDocument[] }>('/admin/policies').then(response => response.policies),
  create: (input: PolicyInput) => apiRequest<{ policy: PolicyDocument }>('/admin/policies', { method: 'POST', body: input }).then(response => response.policy),
  updateDraft: (id: string, input: PolicyInput) => apiRequest<{ policy: PolicyDocument }>(`/admin/policies/${id}`, { method: 'PUT', body: input }).then(response => response.policy),
  newVersion: (id: string) => apiRequest<{ policy: PolicyDocument }>(`/admin/policies/${id}/new-version`, { method: 'POST' }).then(response => response.policy),
  publish: (id: string) => apiRequest<{ policy: PolicyDocument }>(`/admin/policies/${id}/publish`, { method: 'POST' }).then(response => response.policy),
  archive: (id: string) => apiRequest<{ policy: PolicyDocument }>(`/admin/policies/${id}/archive`, { method: 'POST' }).then(response => response.policy),
  discard: (id: string) => apiRequest(`/admin/policies/${id}`, { method: 'DELETE' }),
}
