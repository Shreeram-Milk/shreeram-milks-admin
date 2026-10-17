'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Edit2, Eye, EyeOff, MoreHorizontal, Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { useHydrated } from '@/hooks/useHydrated'
import { formatDisplayDate } from '@/lib/business-time'
import { QualityReportDialog } from './components/QualityReportDialog'
import { QualityReportPreview } from './components/QualityReportPreview'
import { qualityReportService, type QualityReportView } from './service'
import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, type QualityReport, type QualityReportStatus, type QualityReportType } from './types'

const PAGE_SIZE = 10
const ALL = '__all__'

function QualityReportContent() {
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<QualityReportType | ''>('')
  const [status, setStatus] = useState<QualityReportStatus | ''>('')
  const [productId, setProductId] = useState('')
  const [page, setPage] = useState(1)
  // `undefined` = editor closed, `null` = creating, a report = editing it.
  const [editing, setEditing] = useState<QualityReport | null | undefined>(undefined)
  const [previewing, setPreviewing] = useState<QualityReportView | null>(null)
  const result = useMemo(() => { void revision; return qualityReportService.list({ search, type, status, productId, page, pageSize: PAGE_SIZE }) }, [revision, search, type, status, productId, page])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const filtered = Boolean(search || type || status || productId)
  const refresh = () => setRevision(value => value + 1)
  const run = (action: () => void, success: string) => {
    try { action(); toast.success(success); refresh() } catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Something went wrong.') }
  }
  const onFilter = <Value extends string>(set: (value: Value | '') => void) => (value: string) => { set(value === ALL ? '' : value as Value); setPage(1) }
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Quality & Reports' }]} /><h1>Quality &amp; Reports</h1><p className="page-description">Lab reports and certificates customers can read in the app.</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={15} /> Add Report</Button>
    </header>
    <section className="product-list-section">
      <ListSearchInput label="Search reports" value={search} onCommit={value => { setSearch(value); setPage(1) }} placeholder="Search by title, batch, lab, or product..." />
      <div className="product-filter-row">
        <SelectField label="Type" className="product-select-trigger" value={type} onChange={onFilter<QualityReportType>(setType)} placeholder="All types" options={[{ value: ALL, label: 'All types' }, ...(Object.keys(REPORT_TYPE_LABELS) as QualityReportType[]).map(value => ({ value, label: REPORT_TYPE_LABELS[value] }))]} />
        <SelectField label="Status" className="product-select-trigger" value={status} onChange={onFilter<QualityReportStatus>(setStatus)} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(REPORT_STATUS_LABELS) as QualityReportStatus[]).map(value => ({ value, label: REPORT_STATUS_LABELS[value] }))]} />
        <SelectField label="Product" className="product-select-trigger" value={productId} onChange={onFilter(setProductId)} placeholder="All products" options={[{ value: ALL, label: 'All products' }, ...qualityReportService.productOptions()]} />
      </div>
      {result.total === 0
        ? <div className="product-state"><strong>{filtered ? 'No reports match these filters' : 'No reports yet'}</strong><span>{filtered ? 'Try changing your search or filters.' : 'Add a lab report or certificate to share with customers.'}</span></div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>Report</TableHead><TableHead>Type</TableHead><TableHead>Product</TableHead><TableHead>Lab</TableHead><TableHead>Report date</TableHead><TableHead>Valid until</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
            <TableBody>{result.rows.map(view => <TableRow key={view.report.id}>
              <TableCell><Button variant="ghost" className="table-link" onClick={() => setPreviewing(view)}>{view.report.titleEn}</Button>{view.report.batchReference && <small className="cell-note">Batch {view.report.batchReference}</small>}</TableCell>
              <TableCell>{REPORT_TYPE_LABELS[view.report.reportType]}</TableCell>
              <TableCell>{view.productName ? `${view.productName}${view.productInactive ? ' (inactive)' : ''}` : 'Whole range'}</TableCell>
              <TableCell>{view.report.labName}</TableCell>
              <TableCell>{formatDisplayDate(view.report.reportDate)}</TableCell>
              <TableCell>{view.report.validUntil ? <>{formatDisplayDate(view.report.validUntil)}{view.expired && <small className="cell-note">Expired</small>}</> : '—'}</TableCell>
              <TableCell><StatusBadge status={view.report.status === 'published' ? 'active' : 'draft'}>{REPORT_STATUS_LABELS[view.report.status]}</StatusBadge></TableCell>
              <TableCell><div className="row-actions"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={`Actions for ${view.report.titleEn}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setPreviewing(view)}><Eye /> Preview</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditing(view.report)}><Edit2 /> Edit</DropdownMenuItem>
                  {view.report.status === 'draft'
                    ? <DropdownMenuItem onSelect={() => run(() => qualityReportService.publish(view.report.id), 'Report published.')}><Send /> Publish</DropdownMenuItem>
                    : <DropdownMenuItem onSelect={() => run(() => qualityReportService.unpublish(view.report.id), 'Report moved back to draft.')}><EyeOff /> Unpublish</DropdownMenuItem>}
                </DropdownMenuContent></DropdownMenu></div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'report' : 'reports'} · Page {Math.min(page, pageCount)} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div>
        </>}
    </section>
    {editing !== undefined && <QualityReportDialog key={editing?.id ?? 'new'} report={editing} onClose={() => setEditing(undefined)} onDone={refresh} />}
    {previewing && <QualityReportPreview view={previewing} onClose={() => setPreviewing(null)} />}
  </div>
}

/** Waits for the browser, where the mock data lives, so the first render matches the server's. */
export function QualityReportWorkspace() {
  const hydrated = useHydrated()
  return hydrated ? <QualityReportContent /> : <PageSkeleton />
}
