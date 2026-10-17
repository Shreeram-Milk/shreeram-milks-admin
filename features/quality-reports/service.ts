import { isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { windowError } from '@/lib/active-window'
import { mediaService } from '../media/service'
import type { MediaAsset } from '../media/types'
import { productService } from '../products/service'
import { qualityReportRepository } from './mock-repository'
import type { QualityReport, QualityReportInput, QualityReportStatus, QualityReportType } from './types'

export class QualityReportRuleError extends Error {}

export type QualityReportListQuery = { search: string; type: QualityReportType | ''; status: QualityReportStatus | ''; productId: string; page: number; pageSize: number }
export type QualityReportView = { report: QualityReport; productName: string; productInactive: boolean; asset: MediaAsset | undefined; expired: boolean }

function toView(report: QualityReport, today: string): QualityReportView {
  const product = report.productId ? productService.getById(report.productId) : undefined
  return {
    report, productName: report.productId ? product?.name ?? 'Removed product' : '', productInactive: Boolean(product && product.status !== 'active'),
    asset: report.mediaAssetId ? mediaService.getById(report.mediaAssetId) : undefined, expired: Boolean(report.validUntil && today > report.validUntil),
  }
}

function findOrThrow(id: string): QualityReport {
  const report = qualityReportRepository.get(id)
  if (!report) throw new QualityReportRuleError('Report not found.')
  return report
}

/** What a report still lacks before customers can see it. */
export function publishProblems(report: Pick<QualityReport, 'titleEn' | 'summaryEn' | 'mediaAssetId'>): string[] {
  return [
    !report.titleEn.trim() && 'a title',
    !report.summaryEn.trim() && 'an English summary',
    !report.mediaAssetId && 'a file from the Media Library',
  ].filter((item): item is string => Boolean(item))
}

export const qualityReportService = {
  list({ search, type, status, productId, page, pageSize }: QualityReportListQuery, today = todayInBusinessZone()): { rows: QualityReportView[]; total: number } {
    const term = search.trim().toLowerCase()
    const matches = qualityReportRepository.list()
      .filter(report => (!type || report.reportType === type) && (!status || report.status === status) && (!productId || report.productId === productId))
      .map(report => toView(report, today))
      .filter(view => !term || [view.report.titleEn, view.report.titleGu, view.report.batchReference, view.report.labName, view.productName].join(' ').toLowerCase().includes(term))
      .sort((a, b) => b.report.reportDate.localeCompare(a.report.reportDate) || b.report.createdAt.localeCompare(a.report.createdAt))
    return { rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length }
  },
  getView: (id: string, today = todayInBusinessZone()): QualityReportView | undefined => { const report = qualityReportRepository.get(id); return report ? toView(report, today) : undefined },
  /** Every product, active or not, so an older report's product still shows; inactive ones are labelled. */
  productOptions(currentId = ''): Array<{ value: string; label: string }> {
    return productService.list().filter(product => product.status === 'active' || product.id === currentId).map(product => ({ value: product.id, label: product.status === 'active' ? product.name : `${product.name} (inactive)` }))
  },
  save(input: QualityReportInput): QualityReport {
    const existing = input.id ? findOrThrow(input.id) : undefined
    if (!input.titleEn.trim()) throw new QualityReportRuleError('Enter the title.')
    if (!input.labName.trim()) throw new QualityReportRuleError('Enter the lab or issuer.')
    if (!isIsoDate(input.reportDate)) throw new QualityReportRuleError('Choose the report date.')
    const range = windowError(input.validFrom, input.validUntil)
    if (range) throw new QualityReportRuleError('The valid-until date must be on or after the valid-from date.')
    if (input.productId) {
      const product = productService.getById(input.productId)
      if (!product) throw new QualityReportRuleError('Choose a product that exists.')
      if (product.status !== 'active' && input.productId !== existing?.productId) throw new QualityReportRuleError('Choose an active product.')
    }
    if (input.mediaAssetId && !mediaService.getById(input.mediaAssetId)) throw new QualityReportRuleError('Choose a file that exists in the Media Library.')
    // Edits to a published report keep it published only if it is still complete.
    const status = existing?.status ?? 'draft'
    if (status === 'published') { const problems = publishProblems(input); if (problems.length) throw new QualityReportRuleError(`A published report needs ${problems.join(' and ')}. Unpublish it first to remove these.`) }
    return qualityReportRepository.save({ ...input, titleEn: input.titleEn.trim(), labName: input.labName.trim(), status, createdAt: existing?.createdAt })
  },
  publish(id: string): QualityReport {
    const report = findOrThrow(id)
    const problems = publishProblems(report)
    if (problems.length) throw new QualityReportRuleError(`Add ${problems.join(' and ')} before publishing.`)
    return qualityReportRepository.save({ ...report, status: 'published' })
  },
  unpublish(id: string): QualityReport {
    return qualityReportRepository.save({ ...findOrThrow(id), status: 'draft' })
  },
}
