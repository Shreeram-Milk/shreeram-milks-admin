'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { describeApiError } from '@/lib/api-errors'
import { formatINR, parseRupeesToPaise } from '@/lib/money'
import { walletAdminApi, type WalletTotals } from './api'
import { t } from './messages'
import { SecureRefundDialog } from '../refund-admin/RefundDialog'

/** The money story as one line of sums, ending in what is in the wallet now. Rows that are zero (and not essential) are left out. */
export function MoneyStory({ totals, compact = false }: { totals: WalletTotals; compact?: boolean }) {
  const steps: Array<{ sign: '' | '+' | '−'; label: string; paise: number; tone?: 'due' | 'total'; always?: boolean }> = [
    { sign: '', label: t('storyAdded'), paise: totals.addedPaise, always: true },
    { sign: '−', label: t('storySpent'), paise: totals.spentPaise, always: true },
    { sign: '+', label: t('storyReturned'), paise: totals.returnedPaise },
    { sign: '−', label: t('storyRefunded'), paise: totals.refundedPaise, always: true },
    { sign: '−', label: t('storyWaiting'), paise: totals.waitingPaise, tone: 'due' },
    { sign: totals.adjustedPaise < 0 ? '−' : '+', label: t('storyAdjusted'), paise: Math.abs(totals.adjustedPaise) },
  ]
  return <ol className={`money-story${compact ? ' is-compact' : ''}`} aria-label={t('story')}>
    {steps.filter(step => step.always || step.paise !== 0).map(step => <li key={step.label} className={step.tone === 'due' ? 'is-due' : undefined}>
      {step.sign ? <span className="money-story-sign" aria-hidden="true">{step.sign}</span> : null}
      <span className="money-story-label">{step.label}</span><strong>{formatINR(step.paise)}</strong>
    </li>)}
    <li className="is-total"><span className="money-story-sign" aria-hidden="true">=</span><span className="money-story-label">{t('storyBalance')}</span><strong>{formatINR(totals.balancePaise)}</strong></li>
  </ol>
}

/** Refunds are reviewed and password-verified here, then sent through the backend. */
export function RefundDialog({ refundId, onClose, onDone }: { refundId: string; onClose: () => void; onDone: () => void }) {
  const [cancelling, setCancelling] = useState(false)
  if (!cancelling) return <SecureRefundDialog source={{ kind: 'wallet', id: refundId }} onClose={onClose} onDone={onDone} onCancelRequest={() => setCancelling(true)} />
  return <CancelRefundDialog refundId={refundId} onClose={() => setCancelling(false)} onDone={onDone} />
}

function CancelRefundDialog({ refundId, onClose, onDone }: { refundId: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    if (note.trim().length < 3) { setError(t('reasonNeeded')); return }
    setSaving(true); setError('')
    try { await walletAdminApi.cancel(refundId, { note: note.trim() }); toast.success(t('cancelDone')); onDone() }
    catch (failure) { setError(describeApiError(failure)) }
    setSaving(false)
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={event => { event.preventDefault(); void submit() }}>
        <DialogHeader><DialogTitle>{t('cancelTitle')}</DialogTitle><DialogDescription>{t('cancelBody')}</DialogDescription></DialogHeader>
        <FormField label={t('cancelReason')}><Input value={note} maxLength={300} disabled={saving} onChange={event => setNote(event.target.value)} /></FormField>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t('keepIt')}</Button><Button type="submit" className="primary-button destructive-button" disabled={saving}>{saving ? t('saving') : t('cancelRequest')}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

/** A staff correction to the balance, always with a reason. */
export function AdjustDialog({ customerId, balancePaise, onClose, onDone }: { customerId: string; balancePaise: number; onClose: () => void; onDone: () => void }) {
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    const paise = parseRupeesToPaise(amount)
    if (paise === null) { setProblem(t('amountFormat')); return }
    if (paise <= 0) { setProblem(t('amountAboveZero')); return }
    if (reason.trim().length < 3) { setProblem(t('reasonNeeded')); return }
    setProblem(''); setSaving(true); setError('')
    try { await walletAdminApi.adjust(customerId, { direction, amountPaise: paise, reason: reason.trim() }); toast.success(t('correctDone')); onDone() } catch (failure) { setError(describeApiError(failure)) }
    setSaving(false)
  }
  return <Dialog open onOpenChange={value => { if (!value && !saving) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={event => { event.preventDefault(); void submit() }} noValidate>
        <DialogHeader><DialogTitle>{t('correctTitle')}</DialogTitle><DialogDescription>{t('correctBody', { amount: formatINR(balancePaise) })}</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <div className="type-tabs" role="group">
            {(['credit', 'debit'] as const).map(value => <button key={value} type="button" className={`type-tab${direction === value ? ' is-active' : ''}`} aria-pressed={direction === value} onClick={() => setDirection(value)}>{value === 'credit' ? t('addMoney') : t('takeMoney')}</button>)}
          </div>
          <FormField label={t('correctAmount')}><Input inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setProblem('') }} autoFocus /></FormField>
          <FormField label={t('correctReason')}><Input maxLength={300} value={reason} onChange={event => { setReason(event.target.value); setProblem('') }} /></FormField>
          {problem ? <p className="field-error" role="alert">{problem}</p> : null}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter className="dialog-actions"><Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={onClose}>{t('cancel')}</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? t('saving') : t('correct')}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
