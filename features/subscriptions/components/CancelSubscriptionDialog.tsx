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
import { formatDisplayDate, isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { describePolicyOutcome } from '../../prepaid-adjustments/policy'
import { subscriptionService, type SubscriptionView } from '../service'

type DialogProps = { view: SubscriptionView; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }

export function CancelSubscriptionDialog({ view, open, onOpenChange, onDone }: DialogProps) {
  const today = useMemo(() => todayInBusinessZone(), [])
  const schema = useMemo(() => z.object({
    effectiveDate: z.string().refine(value => isIsoDate(value) && value >= today, 'Choose an effective date that is today or later.'),
    reason: z.string().trim().max(200, 'Keep the reason under 200 characters.'),
  }), [today])
  type Values = z.infer<typeof schema>
  const { control, register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { effectiveDate: today, reason: '' } })
  const effectiveDate = useWatch({ control, name: 'effectiveDate' })
  const [error, setError] = useState('')
  const title = `Cancel ${view.product?.name ?? 'this'} subscription for ${view.customer?.fullName ?? 'this customer'}?`

  const submit = handleSubmit(values => {
    setError('')
    try {
      subscriptionService.cancel(view.subscription.id, values)
      toast.success('Subscription cancelled.')
      onOpenChange(false)
      reset()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to cancel the subscription.')
    }
  })

  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { reset(); setError('') } }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Future scheduled deliveries after the effective date will stop. Historical delivery records remain unchanged.</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label="Effective date" required error={errors.effectiveDate?.message} helper="The last day a delivery can still happen."><DatePickerField label="Effective date" value={effectiveDate} minDate={today} invalid={Boolean(errors.effectiveDate)} onChange={value => setValue('effectiveDate', value, { shouldDirty: true, shouldValidate: true })} /></FormField>
          <FormField label="Reason" error={errors.reason?.message}><Textarea {...register('reason')} rows={2} placeholder="Optional" /></FormField>
        </div>
        <p className="warning-note" aria-live="polite">Deliveries after {effectiveDate ? formatDisplayDate(effectiveDate) : '—'} will stop. The subscription is kept as Cancelled, not deleted.{view.customer?.customerType === 'prepaid' ? ` Because this customer is prepaid, for each paid delivery cancelled ${describePolicyOutcome('cancel')}. No refund is sent automatically.` : ' No refund or credit is created automatically.'}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => onOpenChange(false)}>Keep Subscription</Button><Button type="submit" className="primary-button destructive-button" disabled={isSubmitting}>Cancel Subscription</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
