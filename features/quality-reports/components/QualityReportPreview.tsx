'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DetailRows } from '@/components/shared/DetailRows'
import { formatDisplayDate } from '@/lib/business-time'
import { MediaThumb } from '../../media/components/MediaThumb'
import type { QualityReportView } from '../service'
import { REPORT_TYPE_LABELS } from '../types'

/** What staff check before publishing: the details, the summary in both languages, and the attached file. */
export function QualityReportPreview({ view, onClose }: { view: QualityReportView; onClose: () => void }) {
  const { report, asset, productName, productInactive, expired } = view
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <DialogHeader><DialogTitle>{report.titleEn}</DialogTitle><DialogDescription>{REPORT_TYPE_LABELS[report.reportType]} · {report.status === 'published' ? 'Published' : 'Draft'}{expired ? ' · Expired' : ''}</DialogDescription></DialogHeader>
      <DetailRows rows={[
        { label: 'Lab or issuer', value: report.labName },
        { label: 'Product', value: productName ? <>{productLink(report.productId, productName)}{productInactive ? ' (inactive)' : ''}</> : 'Whole range' },
        { label: 'Batch', value: report.batchReference || '—' },
        { label: 'Report date', value: formatDisplayDate(report.reportDate) },
        { label: 'Valid', value: report.validFrom || report.validUntil ? `${report.validFrom ? formatDisplayDate(report.validFrom) : 'Any time'} – ${report.validUntil ? formatDisplayDate(report.validUntil) : 'No end'}` : 'No validity dates' },
        { label: 'File', value: asset ? <span className="media-summary"><MediaThumb asset={asset} /><span>{asset.displayName}</span></span> : report.mediaAssetId ? 'File removed from the library' : 'No file attached' },
      ]} />
      <div className="policy-view">
        <section aria-label="English"><h3>{report.titleEn}</h3><p>{report.summaryEn || 'No English summary yet.'}</p></section>
        <section aria-label="Gujarati"><h3>{report.titleGu || 'Gujarati title not added'}</h3><p>{report.summaryGu || 'No Gujarati summary yet.'}</p></section>
      </div>
      <DialogFooter><Button type="button" className="primary-button" onClick={onClose}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

const productLink = (id: string, name: string) => id ? <Link className="product-name-link" href={`/products/${id}`}>{name}</Link> : name
