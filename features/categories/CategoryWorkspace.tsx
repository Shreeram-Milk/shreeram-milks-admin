'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { RecordRowActions } from '@/components/shared/RecordListParts'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { SelectField } from '@/components/ui/select-field'
import { ApiError } from '@/lib/api-client'
import { describeApiError } from '@/lib/api-errors'
import { InfoTip } from '@/components/shared/InfoTip'
import { setupHelp } from '../configuration/help'
import { tc } from '@/lib/i18n/common'
import { t } from './messages'
import { readUsages } from '../configuration/format'
import { DeleteRecordDialog } from '../configuration/components/DeleteRecordDialog'
import { InUseDialog } from '../configuration/components/InUseDialog'
import type { RecordStatus, Usage } from '../configuration/api'
import { categoryApi, type CategoryRecord } from './api'
import { CategoryDialog } from './components/CategoryDialog'

const PAGE_SIZE = 10
const ALL = '__all__'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: CategoryRecord[]; total: number }

/** Categories, loaded a page at a time from the backend with search and the status filter applied there. */
export function CategoryWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<CategoryRecord | null>(null)
  const [status, setStatus] = useState<RecordStatus | ''>('')
  const [page, setPage] = useState(1)
  // `undefined` = editor closed, `null` = creating, a category = editing it.
  const [editing, setEditing] = useState<CategoryRecord | null | undefined>(undefined)
  const [pending, setPending] = useState<{ category: CategoryRecord; usages: Usage[] } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const refresh = () => setReloadKey(count => count + 1)

  useEffect(() => {
    let cancelled = false
    categoryApi.list({ search, status, page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', rows: result.rows, total: result.total }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey, search, status, page])

  const switchStatus = async (category: CategoryRecord, next: RecordStatus, confirmInUse = false) => {
    try {
      await categoryApi.setStatus(category.id, next, confirmInUse)
      toast.success(t(next === 'active' ? 'activated' : 'deactivated', { name: category.name }))
      setPending(null)
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'IN_USE') { setPending({ category, usages: readUsages(failure.details) }); return }
      toast.error(describeApiError(failure))
    }
    refresh()
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); refresh() }}>{tc('tryAgain')}</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  const filtered = Boolean(search || status)
  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('masterData') }, { label: t('categories') }]} /><h1 className="title-with-tip">{t('categories')}<InfoTip label={t('categories')} text={setupHelp('categories')} /></h1><p className="page-description">{t('description')}</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> {t('addCategory')}</Button>
    </header>
    <section className="config-section">
      <ListSearchInput label={t('searchCategories')} value={search} onCommit={value => { setSearch(value); setPage(1) }} placeholder={t('searchPlaceholder')} />
      <div className="config-filter-row"><SelectField label={tc('filterByStatus')} className="config-select product-select-trigger" value={status || ALL} onChange={value => { setStatus(value === ALL ? '' : value as RecordStatus); setPage(1) }} placeholder={tc('allStatuses')} options={[{ value: ALL, label: tc('allStatuses') }, { value: 'active', label: tc('active') }, { value: 'inactive', label: tc('inactive') }]} /><span className="record-count">{t('countCategories', { count: state.total })}</span></div>
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>{t('category')}</TableHead><TableHead>{t('gujarati')}</TableHead><TableHead>{t('order')}</TableHead><TableHead>{t('status')}</TableHead><TableHead scope="col" aria-label={t('actions')} /></TableRow></TableHeader>
        <TableBody>
          {state.rows.map(item => <TableRow key={item.id}>
            <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(item)}>{item.name}</Button></TableCell>
            <TableCell>{item.nameGu || '—'}</TableCell>
            <TableCell>{item.sortOrder}</TableCell>
            <TableCell><StatusBadge status={item.status}>{item.status === 'active' ? tc('active') : tc('inactive')}</StatusBadge></TableCell>
            <TableCell><RecordRowActions name={item.name} active={item.status === 'active'} onEdit={() => setEditing(item)} onToggle={() => void switchStatus(item, item.status === 'active' ? 'inactive' : 'active')} onDelete={() => setDeleting(item)} /></TableCell>
          </TableRow>)}
          {state.rows.length === 0 && <TableRow><TableCell colSpan={5}><div className="empty-table">{filtered ? t('noMatch') : t('noneYet')}{!filtered && <Button variant="link" className="text-button" onClick={() => setEditing(null)}>{t('createFirst')}</Button>}</div></TableCell></TableRow>}
        </TableBody>
      </Table></div>
      <div className="table-footer"><span>{t('showing', { from: state.total ? (page - 1) * PAGE_SIZE + 1 : 0, to: Math.min(page * PAGE_SIZE, state.total), total: state.total })}</span><div><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div></div></div>
    </section>
    {editing !== undefined && <CategoryDialog key={editing?.id ?? 'new'} category={editing} nextSortOrder={state.rows.length ? Math.max(...state.rows.map(item => item.sortOrder)) + 1 : 1} onClose={() => setEditing(undefined)} onDone={refresh} />}
    {deleting && <DeleteRecordDialog target={deleting} noun={t('noun')} remove={id => categoryApi.remove(id)} deactivate={id => categoryApi.setStatus(id, 'inactive', true)} onClose={() => setDeleting(null)} onChanged={refresh} />}
    <InUseDialog name={pending?.category.name ?? ''} usages={pending?.usages ?? []} open={Boolean(pending)} onCancel={() => setPending(null)} onConfirm={() => { if (pending) void switchStatus(pending.category, 'inactive', true) }} />
  </div>
}
