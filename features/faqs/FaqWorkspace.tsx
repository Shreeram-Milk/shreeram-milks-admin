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
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Questions could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); refresh() }}>Try again</Button></div>

  const { result } = state
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const filtered = Boolean(search || topic || status)
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Help Center' }]} /><h1>Help Center</h1><p className="page-description">Questions and answers in the customer app’s Help &amp; Support screen, in English and Gujarati.</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={15} /> Add Question</Button>
    </header>
    <section className="product-list-section">
      <ListSearchInput label="Search questions" value={search} onCommit={value => { setSearch(value); setPage(1) }} placeholder="Search by question, answer, or keyword..." />
      <div className="product-filter-row">
        <SelectField label="Topic" className="product-select-trigger" value={topic} onChange={value => { setTopic(value === ALL ? '' : value as SupportCategory); setPage(1) }} placeholder="All topics" options={[{ value: ALL, label: 'All topics' }, ...SUPPORT_CATEGORIES.map(category => ({ value: category.id, label: category.labelEn }))]} />
        <SelectField label="Status" className="product-select-trigger" value={status} onChange={value => { setStatus(value === ALL ? '' : value as FaqStatus); setPage(1) }} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(FAQ_STATUS_LABELS) as FaqStatus[]).map(value => ({ value, label: FAQ_STATUS_LABELS[value] }))]} />
      </div>
      {result.total === 0
        ? <div className="product-state"><strong>{filtered ? 'No questions match these filters' : 'No questions yet'}</strong><span>{filtered ? 'Try changing your search or filters.' : 'Add the first question customers are likely to ask.'}</span></div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Topic</TableHead><TableHead>Order</TableHead><TableHead>Gujarati</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
            <TableBody>{result.rows.map(faq => <TableRow key={faq.id}>
              <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(faq)}>{faq.featured && <Star size={13} aria-label="Featured" />}{faq.questionEn}</Button>{faq.searchKeywords.length > 0 && <small className="cell-note">{faq.searchKeywords.join(', ')}</small>}</TableCell>
              <TableCell>{SUPPORT_CATEGORY_LABELS[faq.topic]}</TableCell>
              <TableCell>{faq.sortOrder}</TableCell>
              <TableCell>{faq.questionGu && faq.answerGu ? 'Added' : 'Missing'}</TableCell>
              <TableCell><StatusBadge status={BADGE_STATUS[faq.status]}>{FAQ_STATUS_LABELS[faq.status]}</StatusBadge></TableCell>
              <TableCell><div className="row-actions"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={`Actions for ${faq.questionEn}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(faq)}><Edit2 /> Edit</DropdownMenuItem>
                  {faq.status !== 'published' && <DropdownMenuItem onSelect={() => void setFaqStatus(faq, 'published', 'Question published.')}><Send /> Publish</DropdownMenuItem>}
                  {faq.status === 'published' && <DropdownMenuItem onSelect={() => void setFaqStatus(faq, 'inactive', 'Question hidden from the app.')}><EyeOff /> Hide from app</DropdownMenuItem>}
                </DropdownMenuContent></DropdownMenu></div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'question' : 'questions'} · Page {Math.min(page, pageCount)} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div>
        </>}
    </section>
    {editing !== undefined && <FaqDialog key={editing?.id ?? 'new'} faq={editing} nextSortOrder={0} onClose={() => setEditing(undefined)} onDone={refresh} />}
  </div>
}
