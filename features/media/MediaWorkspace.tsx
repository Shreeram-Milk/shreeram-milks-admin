'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { TablePagination } from '@/components/shared/TablePagination'
import { useHydrated } from '@/hooks/useHydrated'
import { formatDisplayDate } from '@/lib/business-time'
import { MediaDialog } from './components/MediaDialog'
import { MediaThumb } from './components/MediaThumb'
import { mediaService } from './service'
import { MEDIA_TYPE_LABELS, type MediaAsset, type MediaReference, type MediaType } from './types'

const PAGE_SIZE = 10
const ALL = '__all__'

function MediaContent() {
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<MediaType | ''>('')
  const [page, setPage] = useState(1)
  // `undefined` = dialog closed, `null` = adding, an asset = editing it.
  const [editing, setEditing] = useState<MediaAsset | null | undefined>(undefined)
  const [removing, setRemoving] = useState<{ asset: MediaAsset; used: MediaReference[] } | null>(null)
  const result = useMemo(() => { void revision; return mediaService.list({ search, type, page, pageSize: PAGE_SIZE }) }, [revision, search, type, page])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const refresh = () => setRevision(value => value + 1)
  const confirmRemove = () => {
    if (!removing) return
    try { mediaService.remove(removing.asset.id); toast.success('File deleted.'); refresh() } catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Unable to delete the file.') }
    setRemoving(null)
  }
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Media Library' }]} /><h1>Media Library</h1><p className="page-description">Images and documents used across banners, onboarding, products and reports.</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={15} /> Add File</Button>
    </header>
    <section className="product-list-section">
      <ListSearchInput label="Search files" value={search} onCommit={value => { setSearch(value); setPage(1) }} placeholder="Search by name or description..." />
      <div className="product-filter-row"><SelectField label="Type" className="product-select-trigger" value={type} onChange={value => { setType(value === ALL ? '' : value as MediaType); setPage(1) }} placeholder="All types" options={[{ value: ALL, label: 'All types' }, ...(Object.keys(MEDIA_TYPE_LABELS) as MediaType[]).map(value => ({ value, label: MEDIA_TYPE_LABELS[value] }))]} /></div>
      {result.total === 0
        ? <div className="product-state"><strong>{search || type ? 'No files match these filters' : 'No files yet'}</strong><span>{search || type ? 'Try changing your search or filter.' : 'Add an image or document to start your library.'}</span></div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>Preview</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Size</TableHead><TableHead>Description</TableHead><TableHead>Used in</TableHead><TableHead>Added</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
            <TableBody>{result.rows.map(asset => { const used = mediaService.references(asset.id); return <TableRow key={asset.id}>
              <TableCell><MediaThumb asset={asset} /></TableCell>
              <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(asset)}>{asset.displayName}</Button><small className="cell-note">{asset.fileName}</small></TableCell>
              <TableCell>{MEDIA_TYPE_LABELS[asset.type]}</TableCell>
              <TableCell>{mediaService.describeSize(asset.fileSizeBytes)}</TableCell>
              <TableCell>{asset.altTextEn ? (asset.altTextGu ? 'English + Gujarati' : 'English only') : 'Missing'}</TableCell>
              <TableCell>{used.length ? `${used.length} ${used.length === 1 ? 'place' : 'places'}` : 'Not used'}</TableCell>
              <TableCell>{formatDisplayDate(asset.createdAt.slice(0, 10))}</TableCell>
              <TableCell><div className="row-actions">
                <Button variant="ghost" size="icon" className="row-edit-action" aria-label={`Edit ${asset.displayName}`} onClick={() => setEditing(asset)}><Edit2 size={15} /></Button>
                <Button variant="ghost" size="icon" className="row-edit-action" aria-label={`Delete ${asset.displayName}`} onClick={() => setRemoving({ asset, used })}><Trash2 size={15} /></Button>
              </div></TableCell>
            </TableRow> })}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'file' : 'files'} · Page {Math.min(page, pageCount)} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div>
        </>}
    </section>
    {editing !== undefined && <MediaDialog key={editing?.id ?? 'new'} asset={editing} onClose={() => setEditing(undefined)} onDone={refresh} />}
    <AlertDialog open={Boolean(removing)} onOpenChange={next => { if (!next) setRemoving(null) }}>
      <AlertDialogContent className="confirm-dialog">
        {removing && (removing.used.length > 0
          ? <>
            <AlertDialogHeader><p className="eyebrow">In use</p><AlertDialogTitle>“{removing.asset.displayName}” can’t be deleted yet</AlertDialogTitle><AlertDialogDescription>It is used in the places below. Remove it from each one, then delete it.</AlertDialogDescription></AlertDialogHeader>
            <ul className="media-references">{removing.used.map(item => <li key={`${item.feature}-${item.label}`}><Link className="product-name-link" href={item.href}>{item.feature}: {item.label}</Link></li>)}</ul>
            <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button className="primary-button">Got it</Button></AlertDialogCancel></AlertDialogFooter>
          </>
          : <>
            <AlertDialogHeader><p className="eyebrow">Delete file</p><AlertDialogTitle>Delete “{removing.asset.displayName}”?</AlertDialogTitle><AlertDialogDescription>Nothing uses this file. It is removed from the library and can’t be restored.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Keep File</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" onClick={confirmRemove}>Delete File</Button></AlertDialogAction></AlertDialogFooter>
          </>)}
      </AlertDialogContent>
    </AlertDialog>
  </div>
}

/** Waits for the browser, where the mock data lives, so the first render matches the server's. */
export function MediaWorkspace() {
  const hydrated = useHydrated()
  return hydrated ? <MediaContent /> : <PageSkeleton />
}
