import type { IsoDate } from '@/lib/business-time'

export type QualityReportType = 'lab_report' | 'quality_certificate' | 'purity_certificate' | 'other'
export type QualityReportStatus = 'draft' | 'published'

export const REPORT_TYPE_LABELS: Record<QualityReportType, string> = { lab_report: 'Lab report', quality_certificate: 'Quality certificate', purity_certificate: 'Purity certificate', other: 'Other' }
export const REPORT_STATUS_LABELS: Record<QualityReportStatus, string> = { draft: 'Draft', published: 'Published' }

/** A lab report or certificate customers can read in the app. The file itself lives in the Media Library. */
export type QualityReport = {
  id: string
  titleEn: string
  titleGu: string
  reportType: QualityReportType
  /** Optional: the product this report is about. Empty when it covers the whole range. */
  productId: string
  batchReference: string
  labName: string
  reportDate: IsoDate
  validFrom: IsoDate | ''
  validUntil: IsoDate | ''
  summaryEn: string
  summaryGu: string
  mediaAssetId: string
  status: QualityReportStatus
  createdAt: string
  updatedAt: string
}

export type QualityReportInput = Omit<QualityReport, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
