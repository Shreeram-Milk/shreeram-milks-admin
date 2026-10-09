'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { DeactivateDialog, RecordListToolbar, RecordRowActions } from '@/components/shared/RecordListParts'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FaqDialog } from './components/FaqDialog'
import { faqService } from './service'
import { FAQ_TOPIC_LABELS, type Faq } from './types'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useHydrated } from '@/hooks/useHydrated'

function FaqWorkspaceContent() {
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  // `undefined` = editor closed, `null` = creating, a question = editing it.
  const [editing, setEditing] = useState<Faq | null | undefined>(undefined)
  const [deactivating, setDeactivating] = useState<Faq | null>(null)
  const faqs = useMemo(() => { void revision; return faqService.list() }, [revision])
  const filtered = faqs.filter(item => (status === 'all' || item.status === status) && `${item.question} ${item.answer} ${item.questionGujarati}`.toLowerCase().includes(query.trim().toLowerCase()))
  const refresh = () => setRevision(value => value + 1)
  const toggle = (faq: Faq) => {
    if (faq.status === 'inactive') { faqService.setStatus(faq.id, 'active'); toast.success('Question activated.'); refresh(); return }
    setDeactivating(faq)
  }
  const confirmDeactivate = () => {
    if (!deactivating) return
    faqService.setStatus(deactivating.id, 'inactive')
    toast.success('Question deactivated.')
    setDeactivating(null)
    refresh()
  }
  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'FAQs' }]} /><h1>FAQs</h1><p className="page-description">Questions and answers in the customer app’s Help &amp; Support screen.</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> Add Question</Button>
    </header>
    <section className="config-section">
      <RecordListToolbar noun="questions" query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} count={filtered.length} />
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Topic</TableHead><TableHead>Order</TableHead><TableHead>Gujarati</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
        <TableBody>
          {filtered.map(item => <TableRow key={item.id}>
            <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(item)}>{item.question}</Button></TableCell>
            <TableCell>{FAQ_TOPIC_LABELS[item.topic]}</TableCell>
            <TableCell>{item.sortOrder}</TableCell>
            <TableCell>{item.questionGujarati && item.answerGujarati ? 'Added' : 'Missing'}</TableCell>
            <TableCell><StatusBadge status={item.status}>{item.status === 'active' ? 'Active' : 'Inactive'}</StatusBadge></TableCell>
            <TableCell><RecordRowActions name={item.question} active={item.status === 'active'} onEdit={() => setEditing(item)} onToggle={() => toggle(item)} /></TableCell>
          </TableRow>)}
          {filtered.length === 0 && <TableRow><TableCell colSpan={6}><div className="empty-table">{faqs.length ? 'No questions match your search and filters.' : 'No questions yet.'}{faqs.length === 0 && <Button variant="link" className="text-button" onClick={() => setEditing(null)}>Add the first question</Button>}</div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
    </section>
    {editing !== undefined && <FaqDialog key={editing?.id ?? 'new'} faq={editing} nextSortOrder={Math.max(0, ...faqs.filter(item => item.topic === (editing?.topic ?? 'delivery')).map(item => item.sortOrder)) + 1} onClose={() => setEditing(undefined)} onDone={refresh} />}
    <DeactivateDialog open={Boolean(deactivating)} noun="question" name={deactivating?.question ?? ''} onCancel={() => setDeactivating(null)} onConfirm={confirmDeactivate} consequence="It disappears from the customer app’s Help & Support screen. You can activate it again any time." />
  </div>
}

/** Waits for the browser, where the mock data lives, so the first render matches the server's. */
export function FaqWorkspace() {
  const hydrated = useHydrated()
  return hydrated ? <FaqWorkspaceContent /> : <PageSkeleton />
}
