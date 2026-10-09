import { createMockCollection } from '@/lib/mock-collection'
import type { Banner } from './types'

const seed: Banner[] = [
  { id: 'banner-seasonal', label: 'SEASONAL OFFER', title: 'Farm-fresh A2 milk — delivered before 7 AM', titleGujarati: 'ફાર્મ-ફ્રેશ A2 દૂધ — સવારે 7 પહેલાં ઘરે', subtitle: 'Pure goodness straight from our organic farm.', subtitleGujarati: 'અમારા ઓર્ગેનિક ફાર્મમાંથી સીધી શુદ્ધતા.', imageUrl: '', linkType: 'category', linkTargetId: 'category-milk', startDate: '', endDate: '', sortOrder: 1, status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' },
]

export const bannerRepository = createMockCollection<Banner>('shreeram-admin-banners-v1', seed, 'banner')
