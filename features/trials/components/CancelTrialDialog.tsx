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
import { addDays, formatDisplayDate, isIsoDate, todayInBusinessZone, type IsoDate } from '@/lib/business-time'
import { trialService } from '../service'

export function CancelTrialDialog({ trialId, customerName, endDate, open, onOpenChange, onDone }: { trialId: string; customerName: string; endDate: IsoDate; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const today = useMemo(() => todayInBusinessZone(), [])
  const lastDay = addDays(endDate, -1)
  const schema = useMemo(() => z.object({
    effectiveDate: z.string().refine(value => isIsoDate(value) && value >= today && value < endDate, `Choose a date from today up to ${formatDisplayDate(lastDay)}.`),
    reason: z.string().trim().max(200, 'Keep the reason under 200 characters.'),
  }), [today, endDate, lastDay])
  type Values = z.infer<typeof schema>
  const { control, register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { effectiveDate: today, reason: '' } })
  const effectiveDate = useWatch({ control, name: 'effectiveDate' })
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      trialService.cancel(trialId, values)
      toast.success('Trial cancelled.')
      onOpenChange(false)
      reset()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to cancel the trial.')
    }
  })
  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { reset(); setError('') } }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>Cancel {customerName}’s trial?</DialogTitle><DialogDescription>Trial deliveries after the effective date are cancelled. Earlier deliveries and the trial itself stay on record.</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label="Effective date" required error={errors.effectiveDate?.message} helper="The last day a trial delivery can still happen."><DatePickerField label="Effective date" value={effectiveDate} minDate={today} invalid={Boolean(errors.effectiveDate)} onChange={value => setValue('effectiveDate', value, { shouldDirty: true, shouldValidate: true })} /></FormField>
          <FormField label="Reason" error={errors.reason?.message}><Textarea {...register('reason')} rows={2} placeholder="Optional" /></FormField>
        </div>
        <p className="warning-note" aria-live="polite">Deliveries after {effectiveDate ? formatDisplayDate(effectiveDate) : '—'} will be cancelled. History is kept.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => onOpenChange(false)}>Keep Trial</Button><Button type="submit" className="primary-button destructive-button" disabled={isSubmitting}>Cancel Trial</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
