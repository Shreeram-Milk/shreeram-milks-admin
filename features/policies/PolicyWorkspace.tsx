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
import { tc } from '@/lib/i18n/common'
import { t } from './messages'

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
    if (action === 'publish') void run(() => policyApi.publish(policy.id), t('publishedVersion', { version: policy.version }))
    else if (action === 'archive') void run(() => policyApi.archive(policy.id), t('archivedVersion', { version: policy.version }))
    else void run(() => policyApi.discard(policy.id), t('draftDiscarded'))
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); refresh() }}>{tc('tryAgain')}</Button></div>

  const { policies } = state
  const currentPublished = (policyType: PolicyType) => policies.find(policy => policy.type === policyType && policy.status === 'published')
  const suggestedVersion = (policyType: PolicyType) => nextVersion(policies.filter(policy => policy.type === policyType).map(policy => policy.version))
  const filtered = policies.filter(policy => (!type || policy.type === type) && (!status || policy.status === status))
  const replaced = pending?.action === 'publish' ? currentPublished(pending.policy.type) : undefined
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('content') }, { label: t('title') }]} /><h1>{t('title')}</h1><p className="page-description">{t('description')}</p></div>
      <Button className="primary-button" onClick={() => setEditor({ policy: null, presetType: 'privacy' })}><Plus size={15} /> {t('newDraft')}</Button>
    </header>
    <section className="policy-summary" aria-label={t('publishedVersions')}>
      {TYPES.map(item => { const current = currentPublished(item); return <div key={item} className="policy-summary-card" data-published={Boolean(current)}>
        <strong>{POLICY_TYPE_LABELS[item]}</strong>
        <span>{current ? t('versionFrom', { version: current.version, date: formatDisplayDate(current.effectiveDate) }) : t('noPublished')}</span>
      </div> })}
    </section>
    <section className="product-list-section">
      <div className="product-filter-row">
        <SelectField label={t('policy')} className="product-select-trigger" value={type} onChange={value => setType(value === ALL ? '' : value as PolicyType)} placeholder={t('allPolicies')} options={[{ value: ALL, label: t('allPolicies') }, ...TYPES.map(value => ({ value, label: POLICY_TYPE_LABELS[value] }))]} />
        <SelectField label={t('status')} className="product-select-trigger" value={status} onChange={value => setStatus(value === ALL ? '' : value as PolicyStatus)} placeholder={t('allStatuses')} options={[{ value: ALL, label: t('allStatuses') }, ...(Object.keys(POLICY_STATUS_LABELS) as PolicyStatus[]).map(value => ({ value, label: POLICY_STATUS_LABELS[value] }))]} />
      </div>
      {filtered.length === 0
        ? <div className="product-state"><strong>{policies.length ? t('noMatch') : t('noneYet')}</strong><span>{policies.length ? t('tryFilter') : t('writeFirst')}</span></div>
        : <div className="table-card product-list-table-card"><Table className="config-table">
          <TableHeader><TableRow><TableHead>{t('policy')}</TableHead><TableHead>{t('version')}</TableHead><TableHead>{t('status')}</TableHead><TableHead>{t('effectiveFrom')}</TableHead><TableHead>{t('published')}</TableHead><TableHead>{t('gujarati')}</TableHead><TableHead scope="col" aria-label={t('actions')} /></TableRow></TableHeader>
          <TableBody>{filtered.map(policy => <TableRow key={policy.id}>
            <TableCell><Button variant="ghost" className="table-link" onClick={() => setViewing(policy)}>{POLICY_TYPE_LABELS[policy.type]}</Button></TableCell>
            <TableCell>{policy.version}</TableCell>
            <TableCell><StatusBadge status={BADGE_STATUS[policy.status]}>{POLICY_STATUS_LABELS[policy.status]}</StatusBadge></TableCell>
            <TableCell>{formatDisplayDate(policy.effectiveDate)}</TableCell>
            <TableCell>{policy.publishedAt ? formatTimestamp(policy.publishedAt) : '—'}</TableCell>
            <TableCell>{policy.titleGu && policy.bodyGu ? t('added') : t('missing')}</TableCell>
            <TableCell><div className="row-actions"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={t('actionsFor', { policy: POLICY_TYPE_LABELS[policy.type], version: policy.version })}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setViewing(policy)}><Eye /> {t('view')}</DropdownMenuItem>
                {policy.status === 'draft' && <DropdownMenuItem onSelect={() => setEditor({ policy, presetType: policy.type })}><Edit2 /> {t('editDraft')}</DropdownMenuItem>}
                {policy.status === 'draft' && <DropdownMenuItem onSelect={() => setPending({ action: 'publish', policy })}><Send /> {t('publish')}</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => void run(() => policyApi.newVersion(policy.id), t('newVersionCreated'))}><CopyPlus /> {t('newVersionFrom')}</DropdownMenuItem>
                {policy.status === 'published' && <DropdownMenuItem onSelect={() => setPending({ action: 'archive', policy })}><Archive /> {t('archive')}</DropdownMenuItem>}
                {policy.status === 'draft' && <DropdownMenuItem onSelect={() => setPending({ action: 'discard', policy })}><Trash2 /> {t('discardDraft')}</DropdownMenuItem>}
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
            <p className="eyebrow">{pending.action === 'publish' ? t('publishVersion') : pending.action === 'archive' ? t('archiveVersion') : t('discardDraft')}</p>
            <AlertDialogTitle>{t(pending.action === 'publish' ? 'confirmPublish' : pending.action === 'archive' ? 'confirmArchive' : 'confirmDiscard', { policy: POLICY_TYPE_LABELS[pending.policy.type], version: pending.policy.version })}</AlertDialogTitle>
            <AlertDialogDescription>{pending.action === 'publish'
              ? `${t('publishBody', { date: formatDisplayDate(pending.policy.effectiveDate) })}${replaced ? t('publishReplaces', { version: replaced.version }) : ''}`
              : pending.action === 'archive' ? t('archiveBody') : t('discardBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">{t('cancel')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" onClick={confirmPending}>{pending.action === 'publish' ? t('publish') : pending.action === 'archive' ? t('archive') : t('discard')}</Button></AlertDialogAction></AlertDialogFooter>
        </>}
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
