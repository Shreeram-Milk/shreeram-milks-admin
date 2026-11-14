'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR, paiseToRupeeInput, parseRupeesToPaise } from '@/lib/money'
import { walletAdminApi, type RefundDetail, type WalletTotals } from './api'
import { t } from './messages'

/** A small copy button: staff paste the PhonePe order number into the PhonePe dashboard search. */
function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return <button type="button" className="wallet-copy" aria-label={`${t('copy')} ${text}`} onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>
    {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copied ? t('copied') : t('copy')}
  </button>
}

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

type Line = { paymentId: string; amount: string; reference: string }

/**
 * Sending a refund. PhonePe refunds one payment at a time and never more than that payment, so the request is split over the
 * customer's PhonePe payments (newest first, filled in for staff). Step 1: refund each in PhonePe. Step 2: type each reference.
 */
export function RefundDialog({ refundId, onClose, onDone }: { refundId: string; onClose: () => void; onDone: () => void }) {
  const [detail, setDetail] = useState<RefundDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState<'send' | 'cancel'>('send')
  const [lines, setLines] = useState<Line[]>([])
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    walletAdminApi.refund(refundId).then(found => {
      if (cancelled) return
      setDetail(found)
      const suggested = new Map(found.suggested.map(part => [part.paymentId, part.amountPaise]))
      setLines(found.topUps.filter(item => item.leftPaise > 0).map(item => ({ paymentId: item.paymentId, amount: suggested.has(item.paymentId) ? paiseToRupeeInput(suggested.get(item.paymentId) ?? 0) : '', reference: '' })))
    }, failure => { if (!cancelled) setLoadError(describeApiError(failure)) })
    return () => { cancelled = true }
  }, [refundId])

  const setLine = (paymentId: string, change: Partial<Line>) => { setLines(current => current.map(line => (line.paymentId === paymentId ? { ...line, ...change } : line))); setProblem('') }
  const amountOf = (line: Line) => (line.amount.trim() ? parseRupeesToPaise(line.amount) : 0)
  const given = lines.reduce((sum, line) => sum + Math.max(0, amountOf(line) ?? 0), 0)
  const needed = detail?.amountPaise ?? 0

  const submit = async () => {
    if (!detail) return
    if (mode === 'cancel') {
      if (note.trim().length < 3) { setProblem(t('reasonNeeded')); return }
    } else {
      if (lines.some(line => amountOf(line) === null)) { setProblem(t('amountFormat')); return }
      const over = lines.find(line => (amountOf(line) ?? 0) > (detail.topUps.find(item => item.paymentId === line.paymentId)?.leftPaise ?? 0))
      if (over) { setProblem(t('tooMuchOn', { amount: formatINR(detail.topUps.find(item => item.paymentId === over.paymentId)?.leftPaise ?? 0) })); return }
      if (given !== needed) { setProblem(t('mustAddUp', { amount: formatINR(needed) })); return }
      if (lines.some(line => (amountOf(line) ?? 0) > 0 && !line.reference.trim())) { setProblem(t('referenceNeeded')); return }
    }
    setProblem(''); setSaving(true); setError('')
    try {
      if (mode === 'send') {
        const parts = lines.filter(line => (amountOf(line) ?? 0) > 0).map(line => ({ paymentId: line.paymentId, amountPaise: amountOf(line) ?? 0, providerReference: line.reference.trim() }))
        await walletAdminApi.markSent(refundId, { parts, note: note.trim() }); toast.success(t('sentDone'))
      } else { await walletAdminApi.cancel(refundId, { note: note.trim() }); toast.success(t('cancelDone')) }
      onDone()
    } catch (failure) { setError(describeApiError(failure)) }
    setSaving(false)
  }

  const name = detail ? detail.customerName.trim() || t('noName') : ''
  const difference = given - needed
  return <Dialog open onOpenChange={value => { if (!value && !saving) onClose() }}>
    <DialogContent className="record-editor-dialog wallet-refund-dialog">
      {!detail
        ? <div className="product-state" role={loadError ? 'alert' : undefined}>{loadError ? <><strong>{t('recordFailed')}</strong><span>{loadError}</span></> : <span>…</span>}</div>
        : <form onSubmit={event => { event.preventDefault(); void submit() }} noValidate>
          <DialogHeader>
            <DialogTitle>{mode === 'cancel' ? t('cancelTitle') : t('sendTitle')}</DialogTitle>
            {mode === 'cancel' ? <DialogDescription>{t('cancelBody')}</DialogDescription> : <DialogDescription className="sr-only">{t('dialogBody')}</DialogDescription>}
          </DialogHeader>
          <div className="record-editor-fields one-column">
            {mode === 'send' ? <div className="wallet-send-amount">
              <span>{t('sendTo', { name })}</span>
              <strong>{formatINR(detail.amountPaise)}</strong>
              <small>{t('askedOnShort', { date: formatTimestamp(detail.requestedAt) })}{detail.totals && detail.totals.balancePaise > 0 ? ` · ${t('staysInWallet', { amount: formatINR(detail.totals.balancePaise) })}` : ''}</small>
            </div> : null}
            {detail.customerNote ? <p className="product-hint">{t('customerSaid', { note: detail.customerNote })}</p> : null}
            {mode === 'send' && detail.untrackedPaise > 0 ? <div className="wallet-warning" role="note">
              <strong>{t('untrackedTitle', { amount: formatINR(detail.untrackedPaise) })}</strong>
              <span>{t('untrackedBody')}</span>
            </div> : null}

            {mode === 'send' && (lines.length === 0
              ? <p className="field-error">{t('noTopUps')}</p>
              : <>
                <div className="wallet-step"><strong>{t('step1')}</strong><span>{t('step1Hint')}</span></div>
                <div className="wallet-refund-lines">
                  {lines.map(line => {
                    const payment = detail.topUps.find(item => item.paymentId === line.paymentId)
                    if (!payment) return null
                    const used = (amountOf(line) ?? 0) > 0
                    const pick = detail.suggested.find(part => part.paymentId === line.paymentId)
                    return <div key={line.paymentId} className={`wallet-refund-line${used ? ' is-used' : ''}`}>
                      <div className="wallet-refund-payment">
                        {pick ? <span className="wallet-pick">{t('refundHere', { amount: formatINR(pick.amountPaise) })}</span> : null}
                        <strong>{t('paymentOf', { amount: formatINR(payment.amountPaise) })}</strong>
                        <span>{payment.paidAt ? formatTimestamp(payment.paidAt) : ''}{payment.refundedPaise > 0 ? ` · ${t('refundedFromIt')} ${formatINR(payment.refundedPaise)}` : ''}</span>
                        <span className="wallet-order-id">{payment.merchantOrderId} <CopyText text={payment.merchantOrderId} /></span>
                        <small>{t('left')}: {formatINR(payment.leftPaise)}</small>
                      </div>
                      <label className="wallet-refund-input"><span>{t('refundAmount')}</span><Input inputMode="decimal" value={line.amount} placeholder="0" onChange={event => setLine(line.paymentId, { amount: event.target.value })} /></label>
                      <label className="wallet-refund-input"><span>{t('reference')}</span><Input maxLength={100} value={line.reference} disabled={!used} onChange={event => setLine(line.paymentId, { reference: event.target.value })} /></label>
                    </div>
                  })}
                </div>
                <div className={`wallet-total${difference === 0 ? ' is-ok' : ' is-off'}`} role="status">
                  <span>{t('totalLine', { given: formatINR(given), needed: formatINR(needed) })}</span>
                  <strong>{difference === 0 ? t('totalOk') : difference < 0 ? t('totalShort', { amount: formatINR(-difference) }) : t('totalOver', { amount: formatINR(difference) })}</strong>
                </div>
              </>)}
            <FormField label={mode === 'cancel' ? t('cancelReason') : t('note')}><Input maxLength={300} value={note} onChange={event => { setNote(event.target.value); setProblem('') }} /></FormField>
            {problem ? <p className="field-error" role="alert">{problem}</p> : null}
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <DialogFooter className="dialog-actions">
            {mode === 'send' && <Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={() => { setMode('cancel'); setProblem('') }}>{t('cancelRequest')}</Button>}
            {mode === 'cancel' && <Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={() => { setMode('send'); setProblem('') }}>{t('keepIt')}</Button>}
            <Button type="submit" className={`primary-button${mode === 'cancel' ? ' destructive' : ''}`} disabled={saving || (mode === 'send' && lines.length === 0)}>{saving ? t('saving') : mode === 'cancel' ? t('cancelRequest') : t('markSent')}</Button>
          </DialogFooter>
        </form>}
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
