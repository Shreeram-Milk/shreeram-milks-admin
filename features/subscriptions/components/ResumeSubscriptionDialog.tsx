'use client'

import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { addDays, formatDisplayDate, isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { subscriptionService, type SubscriptionView } from '../service'

type DialogProps = { view: SubscriptionView; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }

export function ResumeSubscriptionDialog({ view, open, onOpenChange, onDone }: DialogProps) {
  const today = useMemo(() => todayInBusinessZone(), [])
  const openPause = view.subscription.pauses[view.subscription.pauses.length - 1]
  // Resuming cannot predate the pause itself or today.
  const earliest = openPause && openPause.fromDate > today ? openPause.fromDate : today
  const schema = useMemo(() => z.object({ resumeDate: z.string().refine(value => isIsoDate(value) && value >= earliest, `Choose a resume date on or after ${formatDisplayDate(earliest)}.`) }), [earliest])
  type Values = z.infer<typeof schema>
  const { control, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { resumeDate: earliest > today ? earliest : addDays(today, 1) } })
  const resumeDate = useWatch({ control, name: 'resumeDate' })
  const [error, setError] = useState('')

  const submit = handleSubmit(values => {
    setError('')
    try {
      subscriptionService.resume(view.subscription.id, { resumeDate: values.resumeDate })
      toast.success('Subscription resumed.')
      onOpenChange(false)
      reset()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to resume the subscription.')
    }
  })

  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) setError('') }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>Resume {view.product?.name} for {view.customer?.fullName ?? 'this customer'}?</DialogTitle><DialogDescription>Deliveries restart on the date you choose.</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label="Resume date" required error={errors.resumeDate?.message}><DatePickerField label="Resume date" value={resumeDate} minDate={earliest} invalid={Boolean(errors.resumeDate)} onChange={value => setValue('resumeDate', value, { shouldDirty: true, shouldValidate: true })} /></FormField>
        </div>
        <p className="warning-note" aria-live="polite">Scheduled deliveries will resume from {resumeDate ? formatDisplayDate(resumeDate) : '—'}.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Resume Subscription</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
