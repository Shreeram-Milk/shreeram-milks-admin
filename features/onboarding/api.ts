import { apiRequest } from '@/lib/api-client'
import type { OnboardingSlideFields, OnboardingSlideRecord } from './types'

/** Onboarding calls to the backend. The backend validates everything again, so these never decide what is allowed. */
export const onboardingApi = {
  list: () => apiRequest<{ slides: OnboardingSlideRecord[] }>('/admin/onboarding').then(response => response.slides),
  create: (input: OnboardingSlideFields) => apiRequest<{ slide: OnboardingSlideRecord }>('/admin/onboarding', { method: 'POST', body: input }).then(response => response.slide),
  update: (id: string, input: OnboardingSlideFields) => apiRequest<{ slide: OnboardingSlideRecord }>(`/admin/onboarding/${id}`, { method: 'PUT', body: input }).then(response => response.slide),
  move: (id: string, direction: 'up' | 'down') => apiRequest<{ slides: OnboardingSlideRecord[] }>(`/admin/onboarding/${id}/move`, { method: 'POST', body: { direction } }).then(response => response.slides),
}
