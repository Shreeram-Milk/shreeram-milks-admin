'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/ui/form-field'
import { describeApiError } from '@/lib/api-errors'
import { formatINR, parseRupeesToPaise } from '@/lib/money'
import { customerRecordApi, type CustomerRecord } from '../customers/api'
import { adjustmentAdminApi, TYPE_LABELS, type Adjustment } from './api'

const SEARCH_DELAY_MS = 250

/** A bounded, debounced search over customers on the server. It never loads the whole customer list. */
function CustomerSearch({ onPick }: { onPick: (customer: CustomerRecord) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerRecord[]>([])
  const [failed, setFailed] = useState(false)
  const latest = useRef(0)
  useEffect(() => {
    const id = ++latest.current
    const timer = setTimeout(() => {
      customerRecordApi.list({ search: query.trim(), status: 'active', customerType: '', page: 1, pageSize: 6 }).then(
        result => { if (id === latest.current) { setResults(result.rows); setFailed(false) } },
        () => { if (id === latest.current) setFailed(true) },
      )
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])
  return <div>
    <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name or phone..." aria-label="Search customers" autoFocus />
    {failed && <p className="field-error" role="alert">Customers could not be searched. Try again.</p>}
    <ul className="product-reference-list">{results.map(customer => <li key={customer.id}><Button type="button" variant="ghost" className="text-button" onClick={() => onPick(customer)}>{customer.name.trim() || 'No name'} · {customer.phone ?? ''}</Button></li>)}</ul>
  </div>
}

export function NewAdjustmentDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [customer, setCustomer] = useState<CustomerRecord | null>(null)
  const [type, setType] = useState<'account_credit' | 'refund_pending' | 'manual_adjustment'>('account_credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [problems, setProblems] = useState<{ customer?: string; amount?: string; reason?: string }>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const paise = parseRupeesToPaise(amount)
    const found = { customer: customer ? undefined : 'Choose a customer.', amount: paise !== null && paise > 0 ? undefined : 'Enter an amount above zero.', reason: reason.trim().length >= 3 ? undefined : 'Say why, in a few words.' }
    setProblems(found)
    if (!customer || paise === null || paise <= 0 || found.reason) return
    setSaving(true); setError('')
    try {
      await adjustmentAdminApi.create({ customerId: customer.id, type, amountPaise: paise, reason: reason.trim() })
      toast.success('Adjustment added.'); onDone()
    } catch (failure) { setError(describeApiError(failure)) }
    setSaving(false)
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={event => { event.preventDefault(); void submit() }} noValidate>
        <DialogHeader><DialogTitle>Add an adjustment</DialogTitle><DialogDescription>Something you owe a prepaid customer. Refunds that come from cancelled orders appear on their own; use this for anything else.</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label="Customer *" error={problems.customer}>{customer
            ? <div className="inactive-customer-note"><strong>{customer.name.trim() || 'No name'}</strong> · {customer.phone} <Button type="button" variant="ghost" className="text-button" onClick={() => setCustomer(null)}>Change</Button></div>
            : <CustomerSearch onPick={setCustomer} />}</FormField>
          <FormField label="What is it? *"><SelectField label="Adjustment type" value={type} onChange={value => setType(value as typeof type)} placeholder="Choose" options={[{ value: 'account_credit', label: 'Account credit (goodwill)' }, { value: 'refund_pending', label: 'A refund to send' }, { value: 'manual_adjustment', label: 'Other correction' }]} /></FormField>
          <FormField label="Amount (₹) *" error={problems.amount}><Input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></FormField>
          <FormField label="Reason *" error={problems.reason}><Input maxLength={300} value={reason} onChange={event => setReason(event.target.value)} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter className="dialog-actions"><Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Add adjustment'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

export function ApplyDialog({ adjustment, onClose, onDone }: { adjustment: Adjustment; onClose: () => void; onDone: () => void }) {
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isRefund = adjustment.type === 'refund_pending'
  const submit = async () => {
    setSaving(true); setError('')
    try {
      await adjustmentAdminApi.apply(adjustment.id, { providerReference: reference.trim(), note: note.trim() })
      toast.success('Marked done.'); onDone()
    } catch (failure) { setError(describeApiError(failure)) }
    setSaving(false)
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={event => { event.preventDefault(); void submit() }} noValidate>
        <DialogHeader><DialogTitle>{isRefund ? 'Record the refund' : 'Mark as done'}</DialogTitle>
          <DialogDescription>{isRefund
            ? `First send ${adjustment.amountPaise === null ? 'the refund' : formatINR(adjustment.amountPaise)} to ${adjustment.customerName.trim() || 'the customer'} from the PhonePe dashboard, then record it here. This app never sends refunds by itself.`
            : `${TYPE_LABELS[adjustment.type]} for ${adjustment.customerName.trim() || 'the customer'}${adjustment.amountPaise === null ? '' : `: ${formatINR(adjustment.amountPaise)}`}. Marking it done cannot be undone.`}</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          {isRefund && <FormField label="PhonePe refund reference" helper="The reference PhonePe showed for this refund. Optional but useful."><Input maxLength={100} value={reference} onChange={event => setReference(event.target.value)} autoFocus /></FormField>}
          <FormField label="Note"><Input maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter className="dialog-actions"><Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={onClose}>Not yet</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : isRefund ? 'Record refund' : 'Mark done'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
