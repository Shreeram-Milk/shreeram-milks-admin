'use client'

import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/ui/form-field'
import { describeApiError } from '@/lib/api-errors'
import { formatINR, paiseToRupeeInput, parseRupeesToPaise } from '@/lib/money'
import { creditAdminApi, METHOD_LABELS, type CreditAccount, type PaymentMethod, type PaymentRequest } from './api'
import { t } from './messages'

type Props = { account: CreditAccount; onClose: () => void; onDone: () => void }

/** The frame every credit dialog shares: a title, one form, Cancel and a save button, and the server's refusal shown in place. */
function DialogFrame({ title, description, submitLabel, onSubmit, onClose, children }: { title: string; description: string; submitLabel: string; onSubmit: () => Promise<void>; onClose: () => void; children: ReactNode }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setSaving(true); setError('')
    try { await onSubmit() } catch (failure) { setError(describeApiError(failure)) }
    setSaving(false)
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={event => { event.preventDefault(); void submit() }} noValidate>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">{children}</div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter className="dialog-actions"><Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={onClose}>{t('cancel')}</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? t('saving') : submitLabel}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

/** Reads a rupee amount typed by staff; null (with the reason) when it is not a usable positive amount. */
function amountOf(text: string, allowZero = false): { paise: number } | { problem: string } {
  const paise = parseRupeesToPaise(text)
  if (paise === null) return { problem: t('amountFormat') }
  if (paise < 0 || (!allowZero && paise === 0)) return { problem: t('amountAboveZero') }
  return { paise }
}

export function LimitDialog({ account, onClose, onDone }: Props) {
  const [amount, setAmount] = useState(paiseToRupeeInput(account.limitPaise))
  const [problem, setProblem] = useState('')
  return <DialogFrame title={t('creditLimit')} description={t('limitDescription', { name: account.name.trim() || t('thisCustomer'), owed: formatINR(account.owedPaise) })} submitLabel={t('saveLimit')} onClose={onClose}
    onSubmit={async () => {
      const parsed = amountOf(amount, true)
      if ('problem' in parsed) { setProblem(parsed.problem); return }
      await creditAdminApi.setLimit(account.customerId, parsed.paise)
      toast.success(t('limitSaved')); onDone()
    }}>
    <FormField label={t('limitField')} error={problem}><Input inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setProblem('') }} autoFocus /></FormField>
  </DialogFrame>
}

export function PaymentDialog({ account, requests, onClose, onDone }: Props & { requests: PaymentRequest[] }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [requestId, setRequestId] = useState('')
  const [problem, setProblem] = useState('')
  const chooseRequest = (value: string) => {
    setRequestId(value)
    const request = requests.find(item => item.id === value)
    if (request) setAmount(paiseToRupeeInput(request.amountPaise))
  }
  return <DialogFrame title={t('paymentTitle')} description={t('paymentDescription', { name: account.name.trim() || t('theCustomer'), owed: formatINR(account.owedPaise) })} submitLabel={t('recordPayment')} onClose={onClose}
    onSubmit={async () => {
      const parsed = amountOf(amount)
      if ('problem' in parsed) { setProblem(parsed.problem); return }
      await creditAdminApi.recordPayment(account.customerId, { amountPaise: parsed.paise, method, note: note.trim(), ...(requestId ? { paymentRequestId: requestId } : {}) })
      toast.success(t('paymentRecorded')); onDone()
    }}>
    {requests.length > 0 && <FormField label={t('settlesRequest')}><SelectField label={t('paymentRequest')} value={requestId || 'none'} onChange={value => chooseRequest(value === 'none' ? '' : value)} placeholder={t('notForRequest')} options={[{ value: 'none', label: t('notForRequest') }, ...requests.map(request => ({ value: request.id, label: `${formatINR(request.amountPaise)}${request.note ? ` · ${request.note}` : ''}` }))]} /></FormField>}
    <FormField label={t('amountReceived')} error={problem}><Input inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setProblem('') }} autoFocus /></FormField>
    <FormField label={t('howPaid')}><SelectField label={t('paymentMethod')} value={method} onChange={value => setMethod(value as PaymentMethod)} placeholder={t('choose')} options={Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }))} /></FormField>
    <FormField label={t('note')} helper={t('noteHelper')}><Input maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></FormField>
  </DialogFrame>
}

export function AdjustmentDialog({ account, onClose, onDone }: Props) {
  const [direction, setDirection] = useState<'debit' | 'credit'>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState('')
  const [reasonProblem, setReasonProblem] = useState('')
  return <DialogFrame title={t('adjustTitle')} description={t('adjustDescription')} submitLabel={t('addEntry')} onClose={onClose}
    onSubmit={async () => {
      const parsed = amountOf(amount)
      if ('problem' in parsed) { setProblem(parsed.problem); return }
      if (reason.trim().length < 3) { setReasonProblem(t('sayWhy')); return }
      await creditAdminApi.addAdjustment(account.customerId, { direction, amountPaise: parsed.paise, description: reason.trim() })
      toast.success(t('entryAdded')); onDone()
    }}>
    <FormField label={t('whatDoesItDo')}><SelectField label={t('direction')} value={direction} onChange={value => setDirection(value as 'debit' | 'credit')} placeholder={t('choose')} options={[{ value: 'credit', label: t('lowersOwed') }, { value: 'debit', label: t('raisesOwed') }]} /></FormField>
    <FormField label={t('amount')} error={problem}><Input inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setProblem('') }} autoFocus /></FormField>
    <FormField label={t('reason')} error={reasonProblem}><Input maxLength={300} value={reason} onChange={event => { setReason(event.target.value); setReasonProblem('') }} /></FormField>
  </DialogFrame>
}

export function RequestDialog({ account, onClose, onDone }: Props) {
  const [amount, setAmount] = useState(paiseToRupeeInput(account.owedPaise))
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState('')
  return <DialogFrame title={t('requestTitle')} description={t('requestDescription', { owed: formatINR(account.owedPaise) })} submitLabel={t('sendRequest')} onClose={onClose}
    onSubmit={async () => {
      const parsed = amountOf(amount)
      if ('problem' in parsed) { setProblem(parsed.problem); return }
      await creditAdminApi.createRequest(account.customerId, { amountPaise: parsed.paise, note: note.trim() })
      toast.success(t('requestSent')); onDone()
    }}>
    <FormField label={t('amountToAsk')} error={problem}><Input inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setProblem('') }} autoFocus /></FormField>
    <FormField label={t('noteToCustomer')} helper={t('noteExample')}><Input maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></FormField>
  </DialogFrame>
}
