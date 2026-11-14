'use client'

import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { formatDisplayDate } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { MoneyHeader } from '../money/MoneyHeader'
import { REFUND_STATUSES, STATUS_LABELS, STATUS_TONE, walletAdminApi, type RefundStatus, type WalletRefund, type WalletRefundDetail } from './api'
import { t } from './messages'

const PAGE_SIZE = 15
/** No status in the link means "To refund": what still needs doing. "all" shows everything. */
const FILTERS = { status: [...REFUND_STATUSES, 'all'] } as const

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: WalletRefund[]; total: number }

/** One request: the PhonePe top-ups to refund against, then "Mark as refunded" (with the PhonePe reference) or "Cancel request". */
function RefundDialog({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [detail, setDetail] = useState<WalletRefundDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState<'send' | 'cancel'>('send')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    walletAdminApi.get(id).then(found => { if (!cancelled) setDetail(found) }, failure => { if (!cancelled) setLoadError(describeApiError(failure)) })
    return () => { cancelled = true }
  }, [id])

  const submit = async () => {
    if (mode === 'send' && !reference.trim()) { setProblem(t('referenceNeeded')); return }
    if (mode === 'cancel' && note.trim().length < 3) { setProblem(t('reasonNeeded')); return }
    setProblem(''); setSaving(true); setError('')
    try {
      if (mode === 'send') { await walletAdminApi.markSent(id, { providerReference: reference.trim(), note: note.trim() }); toast.success(t('sentDone')) }
      else { await walletAdminApi.cancel(id, { note: note.trim() }); toast.success(t('cancelDone')) }
      onDone()
    } catch (failure) { setError(describeApiError(failure)) }
    setSaving(false)
  }

  const name = detail ? detail.customerName.trim() || t('noName') : ''
  const open = detail?.status === 'requested'
  return <Dialog open onOpenChange={value => { if (!value && !saving) onClose() }}>
    <DialogContent className="record-editor-dialog">
      {!detail
        ? <div className="product-state" role={loadError ? 'alert' : undefined}>{loadError ? <><strong>{t('loadFailed')}</strong><span>{loadError}</span></> : <span>…</span>}</div>
        : <form onSubmit={event => { event.preventDefault(); void submit() }} noValidate>
          <DialogHeader>
            <DialogTitle>{mode === 'cancel' ? t('cancelTitle') : t('dialogTitle', { amount: formatINR(detail.amountPaise), name })}</DialogTitle>
            <DialogDescription>{mode === 'cancel' ? t('cancelBody') : open ? t('dialogBody') : t('handled', { date: detail.handledAt ? formatDisplayDate(detail.handledAt.slice(0, 10)) : '' })}</DialogDescription>
          </DialogHeader>
          <div className="record-editor-fields one-column">
            <p><strong>{name}</strong> · {detail.customerPhone || detail.customerEmail} · {formatINR(detail.amountPaise)} · <StatusBadge status={STATUS_TONE[detail.status]}>{STATUS_LABELS[detail.status]}</StatusBadge></p>
            {detail.customerNote ? <FormField label={t('customerNote')}><p>{detail.customerNote}</p></FormField> : null}
            {mode === 'send' && <FormField label={t('topUps')}>{detail.topUps.length === 0
              ? <p className="field-error">{t('noTopUps')}</p>
              : <ul className="product-reference-list">{detail.topUps.map(item => <li key={item.paymentId}><strong>{formatINR(item.amountPaise)}</strong> · {item.merchantOrderId}{item.transactionId ? ` · ${item.transactionId}` : ''}{item.paidAt ? ` · ${t('paidOn', { date: formatDisplayDate(item.paidAt.slice(0, 10)) })}` : ''}</li>)}</ul>}
            </FormField>}
            {!open && detail.providerReference ? <FormField label={t('reference')}><p>{detail.providerReference}</p></FormField> : null}
            {!open && detail.staffNote ? <FormField label={t('staffNote')}><p>{detail.staffNote}</p></FormField> : null}
            {open && mode === 'send' && <FormField label={t('reference')} helper={t('referenceHelper')} error={problem || undefined}><Input maxLength={100} value={reference} onChange={event => setReference(event.target.value)} autoFocus /></FormField>}
            {open && <FormField label={mode === 'cancel' ? t('cancelReason') : t('note')} error={mode === 'cancel' ? problem || undefined : undefined}><Input maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></FormField>}
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <DialogFooter className="dialog-actions">
            {open && mode === 'send' && <Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={() => { setMode('cancel'); setProblem('') }}>{t('cancelRequest')}</Button>}
            {open && mode === 'cancel' && <Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={() => { setMode('send'); setProblem('') }}>{t('keepIt')}</Button>}
            {!open && <Button type="button" variant="outline" className="secondary-button" onClick={onClose}>{t('close')}</Button>}
            {open && <Button type="submit" className={`primary-button${mode === 'cancel' ? ' destructive' : ''}`} disabled={saving}>{saving ? t('saving') : mode === 'cancel' ? t('cancelRequest') : t('markSent')}</Button>}
          </DialogFooter>
        </form>}
    </DialogContent>
  </Dialog>
}

function RefundTable() {
  const { page, filters, update } = useUrlListState(FILTERS)
  const tab = (filters.status || 'requested') as RefundStatus | 'all'
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const reload = () => setReloadKey(count => count + 1)

  useEffect(() => {
    let cancelled = false
    walletAdminApi.list({ status: tab === 'all' ? '' : tab, page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', ...result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [tab, page, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); reload() }}>{t('retry')}</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  return <div className="workspace-page products-page">
    <MoneyHeader tab="wallet" description={t('description')} />
    <section className="product-list-section">
      <div className="list-toolbar">
        <div className="type-tabs" role="group" aria-label={t('status')}>
          {(['requested', 'sent', 'cancelled', 'all'] as const).map(value => <button key={value} type="button" className={`type-tab${tab === value ? ' is-active' : ''}`} aria-pressed={tab === value} onClick={() => update({ status: value === 'requested' ? null : value })}>{value === 'all' ? t('all') : STATUS_LABELS[value]}</button>)}
        </div>
      </div>
      {state.total === 0
        ? <div className="product-state"><strong>{tab === 'requested' ? t('nothingToDo') : t('nothingYet')}</strong><span>{t('appearOnOwn')}</span></div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>{t('customer')}</TableHead><TableHead>{t('amount')}</TableHead><TableHead>{t('requested')}</TableHead><TableHead>{t('status')}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{state.rows.map(row => <TableRow key={row.id}>
              <TableCell>{row.customerName.trim() || t('noName')}<br /><small>{row.customerPhone || row.customerEmail}</small></TableCell>
              <TableCell>{formatINR(row.amountPaise)}</TableCell>
              <TableCell>{formatDisplayDate(row.requestedAt.slice(0, 10))}</TableCell>
              <TableCell><StatusBadge status={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</StatusBadge></TableCell>
              <TableCell><div className="row-actions product-row-actions"><Button variant="outline" className="secondary-button" onClick={() => setOpenId(row.id)}>{t('review')}</Button></div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{t(state.total === 1 ? 'itemOne' : 'itemMany', { count: state.total })}{t('pageOf', { page, count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: String(next) })} /></div>
        </>}
    </section>
    {openId && <RefundDialog id={openId} onClose={() => setOpenId(null)} onDone={() => { setOpenId(null); reload() }} />}
  </div>
}

/** Wallet refunds: what customers asked to get back from their wallet. */
export function WalletRefundList() {
  return <Suspense fallback={<PageSkeleton />}><RefundTable /></Suspense>
}
