'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { todayInBusinessZone } from '@/lib/business-time'
import { scheduleSchema, type ScheduleFormValues } from '../schema'
import { broadcastService } from '../service'
import type { Broadcast } from '../types'

export function ScheduleDialog({ broadcast, onClose, onDone }: { broadcast: Broadcast; onClose: () => void; onDone: () => void }) {
  const today = todayInBusinessZone()
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ScheduleFormValues>({ resolver: zodResolver(scheduleSchema), defaultValues: { scheduledDate: '', scheduledTime: '09:00' } })
  const [error, setError] = useState('')
  const reach = broadcastService.audienceCount(broadcast.audience)
  const submit = handleSubmit(values => {
    setError('')
    try {
      broadcastService.schedule(broadcast.id, values.scheduledDate, values.scheduledTime)
      toast.success('Broadcast scheduled.')
      onClose()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to schedule the broadcast.')
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>Schedule “{broadcast.title}”</DialogTitle><DialogDescription>It is queued for {reach} {reach === 1 ? 'customer' : 'customers'}. Times are in India Standard Time.</DialogDescription></DialogHeader>
        <div className="record-editor-fields">
          <FormField label="Date" required error={errors.scheduledDate?.message}><Controller control={control} name="scheduledDate" render={({ field }) => <DatePickerField label="Send date" value={field.value} onChange={field.onChange} minDate={today} placeholder="Choose a date" />} /></FormField>
          <FormField label="Time" required error={errors.scheduledTime?.message}><Input {...register('scheduledTime')} type="time" /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Schedule</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
