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
import { tc } from '@/lib/i18n/common'
import { t } from './messages'

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
    <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchByName')} aria-label={t('searchCustomers')} autoFocus />
    {failed && <p className="field-error" role="alert">{t('searchFailed')}</p>}
    <ul className="product-reference-list">{results.map(customer => <li key={customer.id}><Button type="button" variant="ghost" className="text-button" onClick={() => onPick(customer)}>{customer.name.trim() || t('noName')} · {customer.phone ?? ''}</Button></li>)}</ul>
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
    const found = { customer: customer ? undefined : t('chooseCustomer'), amount: paise !== null && paise > 0 ? undefined : t('aboveZero'), reason: reason.trim().length >= 3 ? undefined : t('sayWhy') }
    setProblems(found)
    if (!customer || paise === null || paise <= 0 || found.reason) return
    setSaving(true); setError('')
    try {
      await adjustmentAdminApi.create({ customerId: customer.id, type, amountPaise: paise, reason: reason.trim() })
      toast.success(t('added')); onDone()
    } catch (failure) { setError(describeApiError(failure)) }
    setSaving(false)
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={event => { event.preventDefault(); void submit() }} noValidate>
        <DialogHeader><DialogTitle>{t('newTitle')}</DialogTitle><DialogDescription>{t('newDescription')}</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label={t('customerField')} error={problems.customer}>{customer
            ? <div className="inactive-customer-note"><strong>{customer.name.trim() || t('noName')}</strong> · {customer.phone} <Button type="button" variant="ghost" className="text-button" onClick={() => setCustomer(null)}>{t('change')}</Button></div>
            : <CustomerSearch onPick={setCustomer} />}</FormField>
          <FormField label={t('whatIsIt')}><SelectField label={t('adjustmentType')} value={type} onChange={value => setType(value as typeof type)} placeholder={t('choose')} options={[{ value: 'account_credit', label: t('optionCredit') }, { value: 'refund_pending', label: t('optionRefund') }, { value: 'manual_adjustment', label: t('optionOther') }]} /></FormField>
          <FormField label={t('amountField')} error={problems.amount}><Input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></FormField>
          <FormField label={t('reasonField')} error={problems.reason}><Input maxLength={300} value={reason} onChange={event => setReason(event.target.value)} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter className="dialog-actions"><Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={onClose}>{tc('cancel')}</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? t('saving') : t('addAdjustment')}</Button></DialogFooter>
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
      toast.success(t('markedDone')); onDone()
    } catch (failure) { setError(describeApiError(failure)) }
    setSaving(false)
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={event => { event.preventDefault(); void submit() }} noValidate>
        <DialogHeader><DialogTitle>{isRefund ? t('recordTitle') : t('doneTitle')}</DialogTitle>
          <DialogDescription>{isRefund
            ? t('refundBody', { amount: adjustment.amountPaise === null ? t('theRefund') : formatINR(adjustment.amountPaise), name: adjustment.customerName.trim() || t('theCustomer') })
            : t('doneBody', { type: TYPE_LABELS[adjustment.type], name: adjustment.customerName.trim() || t('theCustomer'), amount: adjustment.amountPaise === null ? '' : `: ${formatINR(adjustment.amountPaise)}` })}</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          {isRefund && <FormField label={t('phonePeReference')} helper={t('referenceHelper')}><Input maxLength={100} value={reference} onChange={event => setReference(event.target.value)} autoFocus /></FormField>}
          <FormField label={t('note')}><Input maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter className="dialog-actions"><Button type="button" variant="outline" className="secondary-button" disabled={saving} onClick={onClose}>{t('notYet')}</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? t('saving') : isRefund ? t('recordRefund') : t('markDone')}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
