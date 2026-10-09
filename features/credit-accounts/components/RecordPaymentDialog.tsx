'use client'

import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { FormSelect } from '@/components/shared/FormSelect'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { formatINR, parseRupeesToPaise, type Paise } from '@/lib/money'
import { creditAccountService } from '../service'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../types'

const methods = Object.keys(PAYMENT_METHOD_LABELS) as [PaymentMethod, ...PaymentMethod[]]

export function RecordPaymentDialog({ customerId, customerName, balancePaise, open, onOpenChange, onDone }: { customerId: string; customerName: string; balancePaise: Paise; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const today = useMemo(() => todayInBusinessZone(), [])
  const schema = useMemo(() => z.object({
    amount: z.string().superRefine((value, context) => {
      const paise = parseRupeesToPaise(value)
      if (paise === null || paise <= 0) context.addIssue({ code: 'custom', message: 'Enter an amount greater than zero (up to 2 decimals).' })
      else if (paise > balancePaise) context.addIssue({ code: 'custom', message: `Payments cannot exceed the outstanding balance of ${formatINR(balancePaise)}.` })
    }),
    paymentDate: z.string().refine(value => isIsoDate(value) && value <= today, 'Choose a payment date that is today or earlier.'),
    method: z.enum(methods, { error: 'Select a payment method.' }),
    reference: z.string().trim().max(80, 'Keep the reference under 80 characters.'),
    notes: z.string().trim().max(300, 'Keep notes under 300 characters.'),
  }), [balancePaise, today])
  type Values = z.infer<typeof schema>
  const { control, register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { amount: '', paymentDate: today, method: 'upi', reference: '', notes: '' } })
  const [amount, paymentDate] = useWatch({ control, name: ['amount', 'paymentDate'] })
  const [error, setError] = useState('')
  const paise = parseRupeesToPaise(amount)
  const after = paise !== null && paise > 0 && paise <= balancePaise ? balancePaise - paise : null

  const submit = handleSubmit(values => {
    setError('')
    try {
      creditAccountService.recordPayment(customerId, { amountPaise: parseRupeesToPaise(values.amount) ?? 0, paymentDate: values.paymentDate, method: values.method, reference: values.reference, notes: values.notes })
      toast.success('Payment recorded.')
      onOpenChange(false)
      reset()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to record the payment.')
    }
  })

  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { reset(); setError('') } }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>Record payment from {customerName}</DialogTitle><DialogDescription>Adds a payment entry to the ledger. Existing entries are never changed.</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label="Amount (₹)" required error={errors.amount?.message}><Input {...register('amount')} inputMode="decimal" autoComplete="off" placeholder="500" aria-invalid={errors.amount ? true : undefined} /></FormField>
          <FormField label="Payment date" required error={errors.paymentDate?.message}><DatePickerField label="Payment date" value={paymentDate} invalid={Boolean(errors.paymentDate)} onChange={value => setValue('paymentDate', value, { shouldDirty: true, shouldValidate: true })} /></FormField>
          <FormField label="Payment method" required error={errors.method?.message}><FormSelect control={control} name="method" label="Payment method" placeholder="Select a method" options={methods.map(method => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }))} /></FormField>
          <FormField label="Reference / transaction ID" error={errors.reference?.message}><Input {...register('reference')} autoComplete="off" placeholder="Optional" /></FormField>
          <FormField label="Notes" error={errors.notes?.message}><Textarea {...register('notes')} rows={2} placeholder="Optional" /></FormField>
        </div>
        <dl className="balance-preview" aria-live="polite">
          <div><dt>Outstanding before</dt><dd>{formatINR(balancePaise)}</dd></div>
          <div><dt>Payment</dt><dd>{paise !== null && paise > 0 ? `− ${formatINR(paise)}` : '—'}</dd></div>
          <div><dt>Outstanding after</dt><dd>{after === null ? '—' : formatINR(after)}</dd></div>
        </dl>
        <p className="help-text">For now a payment cannot be larger than the outstanding balance. Advance payments are not supported yet.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting || balancePaise <= 0}>Record Payment</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
