'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { FormSelect } from '@/components/shared/FormSelect'
import { parseRupeesToPaise } from '@/lib/money'
import { customerService } from '../../customers/service'
import { prepaidAdjustmentService } from '../service'

const schema = z.object({
  customerId: z.string().min(1, 'Select a prepaid customer.'),
  amount: z.string().refine(value => { const paise = parseRupeesToPaise(value); return paise !== null && paise > 0 }, 'Enter an amount greater than zero (up to 2 decimals).'),
  reason: z.string().trim().min(1, 'A reason is required.').max(200, 'Keep the reason under 200 characters.'),
})
type Values = z.infer<typeof schema>

export function NewAdjustmentDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const customers = useMemo(() => customerService.listAll().filter(customer => customer.customerType === 'prepaid' && customer.status === 'active').slice(0, 100), [])
  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { customerId: '', amount: '', reason: '' } })
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      prepaidAdjustmentService.createManual({ customerId: values.customerId, amountPaise: parseRupeesToPaise(values.amount) ?? 0, reason: values.reason })
      toast.success('Adjustment created.')
      onOpenChange(false)
      reset()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to create the adjustment.')
    }
  })
  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { reset(); setError('') } }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>New prepaid adjustment</DialogTitle><DialogDescription>Adds a credit owed to a prepaid customer, for example after an operational correction. It starts as pending.</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label="Prepaid customer" required error={errors.customerId?.message}><FormSelect control={control} name="customerId" label="Prepaid customer" placeholder={customers.length ? 'Select a customer' : 'No active prepaid customers'} options={customers.map(customer => ({ value: customer.id, label: `${customer.fullName} · ${customer.mobile}` }))} /></FormField>
          <FormField label="Amount (₹)" required error={errors.amount?.message}><Input {...register('amount')} inputMode="decimal" autoComplete="off" placeholder="70" aria-invalid={errors.amount ? true : undefined} /></FormField>
          <FormField label="Reason" required error={errors.reason?.message}><Textarea {...register('reason')} rows={2} placeholder="e.g. Damaged delivery" /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Create Adjustment</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
