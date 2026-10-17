import { createMockCollection } from '@/lib/mock-collection'
import type { QualityReport } from './types'

const seed: Array<Omit<QualityReport, 'createdAt'>> = [
  { id: 'report-cow-milk-sept', titleEn: 'Cow milk purity — September', titleGu: '', reportType: 'lab_report', productId: 'product-cow-milk', batchReference: 'CM-2026-09', labName: 'Gujarat Dairy Testing Lab', reportDate: '2026-09-28', validFrom: '2026-09-28', validUntil: '2026-12-28', summaryEn: 'Fat and SNF within expected range. No adulterants detected.', summaryGu: '', mediaAssetId: 'media-lab-report', status: 'published', updatedAt: '2026-09-29T00:00:00.000Z' },
]

export const qualityReportRepository = createMockCollection<QualityReport>('shreeram-admin-quality-reports-v1', seed.map(item => ({ ...item, createdAt: item.updatedAt })), 'report', { tracksCreatedAt: true })
