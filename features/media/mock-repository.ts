import { createMockCollection } from '@/lib/mock-collection'
import type { MediaAsset } from './types'

/** A flat coloured placeholder with a label, so seeded images preview without shipping real files. */
const placeholder = (color: string, label: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="${color}"/><text x="320" y="210" font-family="sans-serif" font-size="34" fill="#ffffff" text-anchor="middle">${label}</text></svg>`)}`
const stamp = '2026-01-01T00:00:00.000Z'

const seed: MediaAsset[] = [
  { id: 'media-farm-morning', type: 'image', fileName: 'farm-morning.png', displayName: 'Farm at sunrise', mimeType: 'image/png', fileSizeBytes: 98_000, url: placeholder('#c2703d', 'Farm at sunrise'), altTextEn: 'Cows grazing at sunrise', altTextGu: '', createdAt: stamp, updatedAt: stamp },
  { id: 'media-milk-bottle', type: 'image', fileName: 'milk-bottle.png', displayName: 'Milk bottle', mimeType: 'image/png', fileSizeBytes: 72_000, url: placeholder('#0a1628', 'Fresh milk'), altTextEn: 'A glass bottle of fresh milk', altTextGu: '', createdAt: stamp, updatedAt: stamp },
  { id: 'media-lab-report', type: 'document', fileName: 'lab-report-sample.pdf', displayName: 'Sample lab report', mimeType: 'application/pdf', fileSizeBytes: 412_000, url: 'mock://lab-report-sample.pdf', altTextEn: 'Milk purity lab report', altTextGu: '', createdAt: stamp, updatedAt: stamp },
]

export const mediaRepository = createMockCollection<MediaAsset>('shreeram-admin-media-v1', seed, 'media', { tracksCreatedAt: true })
