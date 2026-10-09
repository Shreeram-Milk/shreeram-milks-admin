'use client'

import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { addDays, formatDisplayDate, isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { subscriptionService, type SubscriptionView } from '../service'

type DialogProps = { view: SubscriptionView; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }

export function PauseSubscriptionDialog({ view, open, onOpenChange, onDone }: DialogProps) {
  const today = useMemo(() => todayInBusinessZone(), [])
  const schema = useMemo(() => z.object({
    fromDate: z.string().refine(value => isIsoDate(value) && value >= today, 'Choose a pause date that is today or later.'),
    resumeDate: z.string(),
    reason: z.string().trim().max(200, 'Keep the reason under 200 characters.'),
  }).superRefine((value, context) => {
    if (value.resumeDate && (!isIsoDate(value.resumeDate) || value.resumeDate <= value.fromDate)) context.addIssue({ code: 'custom', path: ['resumeDate'], message: 'Resume date must be after the pause date.' })
  }), [today])
  type Values = z.infer<typeof schema>
  const { control, register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fromDate: addDays(today, 1), resumeDate: '', reason: '' } })
  const [fromDate, resumeDate] = useWatch({ control, name: ['fromDate', 'resumeDate'] })
  const [error, setError] = useState('')
  const customerName = view.customer?.fullName ?? 'this customer'

  const submit = handleSubmit(values => {
    setError('')
    try {
      subscriptionService.pause(view.subscription.id, { fromDate: values.fromDate, resumeDate: values.resumeDate || null, reason: values.reason })
      toast.success('Subscription paused.')
      onOpenChange(false)
      reset()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to pause the subscription.')
    }
  })

  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { reset(); setError('') } }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>Pause {view.product?.name} for {customerName}?</DialogTitle><DialogDescription>Deliveries stop from the chosen date. The recurring schedule is kept.</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label="Pause from date" required error={errors.fromDate?.message}><DatePickerField label="Pause from date" value={fromDate} minDate={today} invalid={Boolean(errors.fromDate)} onChange={value => setValue('fromDate', value, { shouldDirty: true, shouldValidate: true })} /></FormField>
          <FormField label="Resume date" error={errors.resumeDate?.message} helper="Optional. If set, deliveries restart automatically on this date. Leave empty to stay paused until you resume it."><DatePickerField label="Resume date" value={resumeDate} minDate={fromDate ? addDays(fromDate, 1) : today} invalid={Boolean(errors.resumeDate)} placeholder="No resume date" onChange={value => setValue('resumeDate', value, { shouldDirty: true, shouldValidate: true })} /></FormField>
          <FormField label="Reason" error={errors.reason?.message}><Textarea {...register('reason')} rows={2} placeholder="Optional" /></FormField>
        </div>
        <p className="warning-note" aria-live="polite">Deliveries from {fromDate ? formatDisplayDate(fromDate) : '—'} onward will be paused{resumeDate ? `, and resume on ${formatDisplayDate(resumeDate)}` : ''}.</p>
        {view.customer?.customerType === 'prepaid' && <p className="help-text">Pausing does not create a prepaid adjustment. Skip individual deliveries, or cancel, if the customer should be credited.</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Pause Subscription</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
