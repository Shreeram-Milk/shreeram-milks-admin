'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { FormSelect } from '@/components/shared/FormSelect'
import { deliveryService } from '../service'
import { NOT_DELIVERED_REASON_LABELS, type NotDeliveredReasonCode } from '../types'

const reasonCodes = Object.keys(NOT_DELIVERED_REASON_LABELS) as NotDeliveredReasonCode[]
const schema = z.object({
  reason: z.enum(reasonCodes as [NotDeliveredReasonCode, ...NotDeliveredReasonCode[]], { error: 'Select a reason.' }),
  notes: z.string().trim().max(300, 'Keep notes under 300 characters.'),
}).superRefine((value, context) => {
  if (value.reason === 'other' && !value.notes) context.addIssue({ code: 'custom', path: ['notes'], message: 'Add a note when the reason is Other.' })
})
type Values = z.infer<typeof schema>

export function MarkNotDeliveredDialog({ deliveryId, customerName, open, onOpenChange, onDone }: { deliveryId: string; customerName: string; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: 'customer_unavailable', notes: '' } })
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      deliveryService.markNotDelivered(deliveryId, values)
      toast.success('Delivery marked as not delivered.')
      onOpenChange(false)
      reset()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update the delivery.')
    }
  })
  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { reset(); setError('') } }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>Mark {customerName}’s delivery as not delivered?</DialogTitle><DialogDescription>Record why the delivery could not be completed.</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label="Reason" required error={errors.reason?.message}>
            <FormSelect control={control} name="reason" label="Reason" placeholder="Select a reason" options={reasonCodes.map(code => ({ value: code, label: NOT_DELIVERED_REASON_LABELS[code] }))} />
          </FormField>
          <FormField label="Notes" error={errors.notes?.message}><Textarea {...register('notes')} rows={3} placeholder="Optional" /></FormField>
        </div>
        <p className="help-text">Financial handling for undelivered prepaid deliveries will be resolved separately. No refund or credit is created.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Mark Not Delivered</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
