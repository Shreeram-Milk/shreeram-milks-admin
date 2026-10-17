'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Archive, CopyPlus, Edit2, Eye, MoreHorizontal, Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { describeApiError } from '@/lib/api-errors'
import { formatDisplayDate, formatTimestamp } from '@/lib/business-time'
import { PolicyDialog } from './components/PolicyDialog'
import { PolicyViewDialog } from './components/PolicyViewDialog'
import { policyApi } from './api'
import { nextVersion } from './version'
import { POLICY_STATUS_LABELS, POLICY_TYPE_LABELS, type PolicyDocument, type PolicyStatus, type PolicyType } from './types'

const ALL = '__all__'
const TYPES = Object.keys(POLICY_TYPE_LABELS) as PolicyType[]
const BADGE_STATUS: Record<PolicyStatus, string> = { draft: 'draft', published: 'active', archived: 'closed' }

type Pending = { action: 'publish' | 'archive' | 'discard'; policy: PolicyDocument }
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; policies: PolicyDocument[] }

/** Every version of every policy, loaded from the backend. Published and archived versions are history and never change. */
export function PolicyWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [type, setType] = useState<PolicyType | ''>('')
  const [status, setStatus] = useState<PolicyStatus | ''>('')
  // Editor: `undefined` closed, otherwise the draft being edited (or null with a preset type for a new one).
  const [editor, setEditor] = useState<{ policy: PolicyDocument | null; presetType: PolicyType } | undefined>(undefined)
  const [viewing, setViewing] = useState<PolicyDocument | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  // Bumping this reloads the list; the effect ignores an answer that arrives after a newer request.
  const [reloadKey, setReloadKey] = useState(0)
  const refresh = () => setReloadKey(count => count + 1)
  useEffect(() => {
    let cancelled = false
    policyApi.list().then(
      policies => { if (!cancelled) setState({ status: 'ready', policies }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey])

  const run = async (action: () => Promise<unknown>, success: string) => {
    try { await action(); toast.success(success) } catch (failure) { toast.error(describeApiError(failure)) }
    refresh()
  }
  const confirmPending = () => {
    if (!pending) return
    const { action, policy } = pending
    setPending(null)
    if (action === 'publish') void run(() => policyApi.publish(policy.id), `Version ${policy.version} published.`)
    else if (action === 'archive') void run(() => policyApi.archive(policy.id), `Version ${policy.version} archived.`)
    else void run(() => policyApi.discard(policy.id), 'Draft discarded.')
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Policies could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); refresh() }}>Try again</Button></div>

  const { policies } = state
  const currentPublished = (policyType: PolicyType) => policies.find(policy => policy.type === policyType && policy.status === 'published')
  const suggestedVersion = (policyType: PolicyType) => nextVersion(policies.filter(policy => policy.type === policyType).map(policy => policy.version))
  const filtered = policies.filter(policy => (!type || policy.type === type) && (!status || policy.status === status))
  const replaced = pending?.action === 'publish' ? currentPublished(pending.policy.type) : undefined
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Legal & Policies' }]} /><h1>Legal &amp; Policies</h1><p className="page-description">Each policy has one published version that customers read. Older versions are kept for the record.</p></div>
      <Button className="primary-button" onClick={() => setEditor({ policy: null, presetType: 'privacy' })}><Plus size={15} /> New Draft</Button>
    </header>
    <section className="policy-summary" aria-label="Published versions">
      {TYPES.map(item => { const current = currentPublished(item); return <div key={item} className="policy-summary-card" data-published={Boolean(current)}>
        <strong>{POLICY_TYPE_LABELS[item]}</strong>
        <span>{current ? `Version ${current.version} · from ${formatDisplayDate(current.effectiveDate)}` : 'No published version'}</span>
      </div> })}
    </section>
    <section className="product-list-section">
      <div className="product-filter-row">
        <SelectField label="Policy" className="product-select-trigger" value={type} onChange={value => setType(value === ALL ? '' : value as PolicyType)} placeholder="All policies" options={[{ value: ALL, label: 'All policies' }, ...TYPES.map(value => ({ value, label: POLICY_TYPE_LABELS[value] }))]} />
        <SelectField label="Status" className="product-select-trigger" value={status} onChange={value => setStatus(value === ALL ? '' : value as PolicyStatus)} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(POLICY_STATUS_LABELS) as PolicyStatus[]).map(value => ({ value, label: POLICY_STATUS_LABELS[value] }))]} />
      </div>
      {filtered.length === 0
        ? <div className="product-state"><strong>{policies.length ? 'No versions match these filters' : 'No policies yet'}</strong><span>{policies.length ? 'Try changing a filter.' : 'Write the first draft, then publish it when it has been approved.'}</span></div>
        : <div className="table-card product-list-table-card"><Table className="config-table">
          <TableHeader><TableRow><TableHead>Policy</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Effective from</TableHead><TableHead>Published</TableHead><TableHead>Gujarati</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
          <TableBody>{filtered.map(policy => <TableRow key={policy.id}>
            <TableCell><Button variant="ghost" className="table-link" onClick={() => setViewing(policy)}>{POLICY_TYPE_LABELS[policy.type]}</Button></TableCell>
            <TableCell>{policy.version}</TableCell>
            <TableCell><StatusBadge status={BADGE_STATUS[policy.status]}>{POLICY_STATUS_LABELS[policy.status]}</StatusBadge></TableCell>
            <TableCell>{formatDisplayDate(policy.effectiveDate)}</TableCell>
            <TableCell>{policy.publishedAt ? formatTimestamp(policy.publishedAt) : '—'}</TableCell>
            <TableCell>{policy.titleGu && policy.bodyGu ? 'Added' : 'Missing'}</TableCell>
            <TableCell><div className="row-actions"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={`Actions for ${POLICY_TYPE_LABELS[policy.type]} version ${policy.version}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setViewing(policy)}><Eye /> View</DropdownMenuItem>
                {policy.status === 'draft' && <DropdownMenuItem onSelect={() => setEditor({ policy, presetType: policy.type })}><Edit2 /> Edit draft</DropdownMenuItem>}
                {policy.status === 'draft' && <DropdownMenuItem onSelect={() => setPending({ action: 'publish', policy })}><Send /> Publish</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => void run(() => policyApi.newVersion(policy.id), 'New draft version created.')}><CopyPlus /> New version from this</DropdownMenuItem>
                {policy.status === 'published' && <DropdownMenuItem onSelect={() => setPending({ action: 'archive', policy })}><Archive /> Archive</DropdownMenuItem>}
                {policy.status === 'draft' && <DropdownMenuItem onSelect={() => setPending({ action: 'discard', policy })}><Trash2 /> Discard draft</DropdownMenuItem>}
              </DropdownMenuContent></DropdownMenu></div></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
    </section>
    {editor && <PolicyDialog key={editor.policy?.id ?? 'new'} policy={editor.policy} presetType={editor.presetType} suggestedVersion={suggestedVersion} onClose={() => setEditor(undefined)} onDone={refresh} />}
    {viewing && <PolicyViewDialog policy={viewing} onClose={() => setViewing(null)} />}
    <AlertDialog open={Boolean(pending)} onOpenChange={next => { if (!next) setPending(null) }}>
      <AlertDialogContent className="confirm-dialog">
        {pending && <>
          <AlertDialogHeader>
            <p className="eyebrow">{pending.action === 'publish' ? 'Publish version' : pending.action === 'archive' ? 'Archive version' : 'Discard draft'}</p>
            <AlertDialogTitle>{pending.action === 'publish' ? 'Publish' : pending.action === 'archive' ? 'Archive' : 'Discard'} {POLICY_TYPE_LABELS[pending.policy.type]} version {pending.policy.version}?</AlertDialogTitle>
            <AlertDialogDescription>{pending.action === 'publish'
              ? `Customers will read this version from ${formatDisplayDate(pending.policy.effectiveDate)}. It can’t be edited afterwards.${replaced ? ` Version ${replaced.version} is archived and kept in the history.` : ''}`
              : pending.action === 'archive' ? 'Customers will have no published version of this policy until you publish another. The version stays in the history.' : 'This draft is deleted for good. It was never published, so nothing in the history is lost.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" onClick={confirmPending}>{pending.action === 'publish' ? 'Publish' : pending.action === 'archive' ? 'Archive' : 'Discard'}</Button></AlertDialogAction></AlertDialogFooter>
        </>}
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
