import { createMockCollection } from '@/lib/mock-collection'
import type { OnboardingSlide } from './types'

const stamp = '2026-01-01T00:00:00.000Z'

const seed: OnboardingSlide[] = [
  { id: 'onboarding-1', imageAssetId: 'media-farm-morning', titleEn: 'Farm fresh milk, delivered before dawn.', titleGu: '', descriptionEn: 'Pure A2 cow milk and artisan dairy at your doorstep every morning by 7:00 AM.', descriptionGu: '', sortOrder: 1, status: 'active', createdAt: stamp, updatedAt: stamp },
]

export const onboardingRepository = createMockCollection<OnboardingSlide>('shreeram-admin-onboarding-v1', seed, 'onboarding', { tracksCreatedAt: true })
