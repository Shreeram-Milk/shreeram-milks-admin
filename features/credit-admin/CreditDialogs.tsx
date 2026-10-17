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
        <DialogFooter className="dialog-actions"><Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

/** Reads a rupee amount typed by staff; null (with the reason) when it is not a usable positive amount. */
function amountOf(text: string, allowZero = false): { paise: number } | { problem: string } {
  const paise = parseRupeesToPaise(text)
  if (paise === null) return { problem: 'Enter an amount like 250 or 250.50.' }
  if (paise < 0 || (!allowZero && paise === 0)) return { problem: 'Enter an amount above zero.' }
  return { paise }
}

export function LimitDialog({ account, onClose, onDone }: Props) {
  const [amount, setAmount] = useState(paiseToRupeeInput(account.limitPaise))
  const [problem, setProblem] = useState('')
  return <DialogFrame title="Credit limit" description={`The most ${account.name.trim() || 'this customer'} can owe at one time. Orders that would go over it are refused. They currently owe ${formatINR(account.owedPaise)}.`} submitLabel="Save limit" onClose={onClose}
    onSubmit={async () => {
      const parsed = amountOf(amount, true)
      if ('problem' in parsed) { setProblem(parsed.problem); return }
      await creditAdminApi.setLimit(account.customerId, parsed.paise)
      toast.success('Credit limit saved.'); onDone()
    }}>
    <FormField label="Credit limit (₹) *" error={problem}><Input inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setProblem('') }} autoFocus /></FormField>
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
  return <DialogFrame title="Record a payment received" description={`Money ${account.name.trim() || 'the customer'} handed over by hand. It lowers what they owe (${formatINR(account.owedPaise)} now) and cannot be undone, only corrected with an adjustment.`} submitLabel="Record payment" onClose={onClose}
    onSubmit={async () => {
      const parsed = amountOf(amount)
      if ('problem' in parsed) { setProblem(parsed.problem); return }
      await creditAdminApi.recordPayment(account.customerId, { amountPaise: parsed.paise, method, note: note.trim(), ...(requestId ? { paymentRequestId: requestId } : {}) })
      toast.success('Payment recorded.'); onDone()
    }}>
    {requests.length > 0 && <FormField label="Settles a payment request"><SelectField label="Payment request" value={requestId || 'none'} onChange={value => chooseRequest(value === 'none' ? '' : value)} placeholder="Not for a request" options={[{ value: 'none', label: 'Not for a request' }, ...requests.map(request => ({ value: request.id, label: `${formatINR(request.amountPaise)}${request.note ? ` · ${request.note}` : ''}` }))]} /></FormField>}
    <FormField label="Amount received (₹) *" error={problem}><Input inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setProblem('') }} autoFocus /></FormField>
    <FormField label="How was it paid? *"><SelectField label="Payment method" value={method} onChange={value => setMethod(value as PaymentMethod)} placeholder="Choose" options={Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }))} /></FormField>
    <FormField label="Note" helper="For example who collected it, or the UPI reference."><Input maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></FormField>
  </DialogFrame>
}

export function AdjustmentDialog({ account, onClose, onDone }: Props) {
  const [direction, setDirection] = useState<'debit' | 'credit'>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState('')
  const [reasonProblem, setReasonProblem] = useState('')
  return <DialogFrame title="Correct the ledger" description="Old entries are never changed or deleted. To fix a mistake or give a goodwill discount, add a new entry here." submitLabel="Add entry" onClose={onClose}
    onSubmit={async () => {
      const parsed = amountOf(amount)
      if ('problem' in parsed) { setProblem(parsed.problem); return }
      if (reason.trim().length < 3) { setReasonProblem('Say why, in a few words.'); return }
      await creditAdminApi.addAdjustment(account.customerId, { direction, amountPaise: parsed.paise, description: reason.trim() })
      toast.success('Ledger entry added.'); onDone()
    }}>
    <FormField label="What does it do? *"><SelectField label="Direction" value={direction} onChange={value => setDirection(value as 'debit' | 'credit')} placeholder="Choose" options={[{ value: 'credit', label: 'Lowers what they owe (a discount or a correction)' }, { value: 'debit', label: 'Raises what they owe (a missing charge)' }]} /></FormField>
    <FormField label="Amount (₹) *" error={problem}><Input inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setProblem('') }} autoFocus /></FormField>
    <FormField label="Reason *" error={reasonProblem}><Input maxLength={300} value={reason} onChange={event => { setReason(event.target.value); setReasonProblem('') }} /></FormField>
  </DialogFrame>
}

export function RequestDialog({ account, onClose, onDone }: Props) {
  const [amount, setAmount] = useState(paiseToRupeeInput(account.owedPaise))
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState('')
  return <DialogFrame title="Ask for a payment" description={`The customer sees a "Pay now" card in the app until they pay or you cancel it. You can ask for at most what they owe (${formatINR(account.owedPaise)}).`} submitLabel="Send request" onClose={onClose}
    onSubmit={async () => {
      const parsed = amountOf(amount)
      if ('problem' in parsed) { setProblem(parsed.problem); return }
      await creditAdminApi.createRequest(account.customerId, { amountPaise: parsed.paise, note: note.trim() })
      toast.success('Payment request sent.'); onDone()
    }}>
    <FormField label="Amount to ask for (₹) *" error={problem}><Input inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setProblem('') }} autoFocus /></FormField>
    <FormField label="Note to the customer" helper="For example: October bill."><Input maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></FormField>
  </DialogFrame>
}
