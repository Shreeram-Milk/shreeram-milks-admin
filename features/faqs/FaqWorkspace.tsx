'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Edit2, EyeOff, MoreHorizontal, Plus, Send, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { describeApiError } from '@/lib/api-errors'
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABELS, type SupportCategory } from '../support-tickets/categories'
import { FaqDialog } from './components/FaqDialog'
import { faqApi } from './api'
import { FAQ_STATUS_LABELS, type Faq, type FaqStatus } from './types'
import { tc } from '@/lib/i18n/common'
import { t } from './messages'

const PAGE_SIZE = 10
const ALL = '__all__'
const BADGE_STATUS: Record<FaqStatus, string> = { draft: 'draft', published: 'active', inactive: 'inactive' }

type Result = { rows: Faq[]; total: number }
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; result: Result }

/** Help questions, loaded a page at a time from the backend with the search and filters applied there. */
export function FaqWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState<SupportCategory | ''>('')
  const [status, setStatus] = useState<FaqStatus | ''>('')
  const [page, setPage] = useState(1)
  // `undefined` = editor closed, `null` = creating, a question = editing it.
  const [editing, setEditing] = useState<Faq | null | undefined>(undefined)

  // Bumping this reloads the page; the effect ignores an answer that arrives after a newer request.
  const [reloadKey, setReloadKey] = useState(0)
  const refresh = () => setReloadKey(count => count + 1)
  useEffect(() => {
    let cancelled = false
    faqApi.list({ search, topic, status, page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey, search, topic, status, page])

  const setFaqStatus = async (faq: Faq, next: FaqStatus, success: string) => {
    try { await faqApi.setStatus(faq.id, next); toast.success(success) } catch (failure) { toast.error(describeApiError(failure)) }
    refresh()
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); refresh() }}>{tc('tryAgain')}</Button></div>

  const { result } = state
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const filtered = Boolean(search || topic || status)
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('content') }, { label: t('title') }]} /><h1>{t('title')}</h1><p className="page-description">{t('description')}</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={15} /> {t('addQuestion')}</Button>
    </header>
    <section className="product-list-section">
      <ListSearchInput label={t('searchQuestions')} value={search} onCommit={value => { setSearch(value); setPage(1) }} placeholder={t('searchPlaceholder')} />
      <div className="product-filter-row">
        <SelectField label={t('topic')} className="product-select-trigger" value={topic} onChange={value => { setTopic(value === ALL ? '' : value as SupportCategory); setPage(1) }} placeholder={t('allTopics')} options={[{ value: ALL, label: t('allTopics') }, ...SUPPORT_CATEGORIES.map(category => ({ value: category.id, label: SUPPORT_CATEGORY_LABELS[category.id] }))]} />
        <SelectField label={t('status')} className="product-select-trigger" value={status} onChange={value => { setStatus(value === ALL ? '' : value as FaqStatus); setPage(1) }} placeholder={t('allStatuses')} options={[{ value: ALL, label: t('allStatuses') }, ...(Object.keys(FAQ_STATUS_LABELS) as FaqStatus[]).map(value => ({ value, label: FAQ_STATUS_LABELS[value] }))]} />
      </div>
      {result.total === 0
        ? <div className="product-state"><strong>{filtered ? t('noMatch') : t('noneYet')}</strong><span>{filtered ? t('tryChanging') : t('addFirst')}</span></div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>{t('question')}</TableHead><TableHead>{t('topic')}</TableHead><TableHead>{t('order')}</TableHead><TableHead>{t('gujarati')}</TableHead><TableHead>{t('status')}</TableHead><TableHead scope="col" aria-label={t('actions')} /></TableRow></TableHeader>
            <TableBody>{result.rows.map(faq => <TableRow key={faq.id}>
              <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(faq)}>{faq.featured && <Star size={13} aria-label={t('featured')} />}{faq.questionEn}</Button>{faq.searchKeywords.length > 0 && <small className="cell-note">{faq.searchKeywords.join(', ')}</small>}</TableCell>
              <TableCell>{SUPPORT_CATEGORY_LABELS[faq.topic]}</TableCell>
              <TableCell>{faq.sortOrder}</TableCell>
              <TableCell>{faq.questionGu && faq.answerGu ? t('added') : t('missing')}</TableCell>
              <TableCell><StatusBadge status={BADGE_STATUS[faq.status]}>{FAQ_STATUS_LABELS[faq.status]}</StatusBadge></TableCell>
              <TableCell><div className="row-actions"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={t('actionsFor', { name: faq.questionEn })}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(faq)}><Edit2 /> {t('edit')}</DropdownMenuItem>
                  {faq.status !== 'published' && <DropdownMenuItem onSelect={() => void setFaqStatus(faq, 'published', t('published'))}><Send /> {t('publish')}</DropdownMenuItem>}
                  {faq.status === 'published' && <DropdownMenuItem onSelect={() => void setFaqStatus(faq, 'inactive', t('hidden'))}><EyeOff /> {t('hide')}</DropdownMenuItem>}
                </DropdownMenuContent></DropdownMenu></div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{t(result.total === 1 ? 'countOne' : 'countMany', { count: result.total })}{t('pageOf', { page: Math.min(page, pageCount), count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div>
        </>}
    </section>
    {editing !== undefined && <FaqDialog key={editing?.id ?? 'new'} faq={editing} nextSortOrder={0} onClose={() => setEditing(undefined)} onDone={refresh} />}
  </div>
}
