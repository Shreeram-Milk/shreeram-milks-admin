'use client'

import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { broadcastSchema, type BroadcastFormValues } from '../schema'
import { broadcastService, renderPreview } from '../service'
import { BROADCAST_AUDIENCE_LABELS, BROADCAST_CHANNEL_LABELS, type Broadcast, type BroadcastAudience, type BroadcastChannel } from '../types'

const AUDIENCES = (Object.keys(BROADCAST_AUDIENCE_LABELS) as BroadcastAudience[]).map(value => ({ value, label: BROADCAST_AUDIENCE_LABELS[value] }))
const CHANNELS = (Object.keys(BROADCAST_CHANNEL_LABELS) as BroadcastChannel[]).map(value => ({ value, label: BROADCAST_CHANNEL_LABELS[value] }))
const blank: BroadcastFormValues = { title: '', titleGujarati: '', body: '', bodyGujarati: '', audience: 'all', channel: 'push' }
const fromBroadcast = (broadcast: Broadcast): BroadcastFormValues => ({ title: broadcast.title, titleGujarati: broadcast.titleGujarati, body: broadcast.body, bodyGujarati: broadcast.bodyGujarati, audience: broadcast.audience, channel: broadcast.channel })

/** Drafts a broadcast. It is scheduled separately, once the wording and audience are right. */
export function BroadcastDialog({ broadcast, onClose, onDone }: { broadcast: Broadcast | null; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<BroadcastFormValues>({ resolver: zodResolver(broadcastSchema), defaultValues: broadcast ? fromBroadcast(broadcast) : blank })
  const [audience, title, body] = useWatch({ control, name: ['audience', 'title', 'body'] })
  const [error, setError] = useState('')
  const reach = broadcastService.audienceCount(audience)
  const submit = handleSubmit(values => {
    setError('')
    try {
      broadcastService.save({ ...values, id: broadcast?.id, status: 'draft', scheduledDate: '', scheduledTime: '' })
      toast.success(broadcast ? 'Broadcast saved.' : 'Draft created.')
      onClose()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the broadcast.')
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{broadcast ? 'Edit broadcast' : 'New broadcast'}</DialogTitle><DialogDescription>A one-off message to a group of customers. You can use {'{{customerName}}'} to greet each person by name.</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <FormField label="Title" required error={errors.title?.message}><Input {...register('title')} autoComplete="off" /></FormField>
          <FormField label="Gujarati title" error={errors.titleGujarati?.message}><Input {...register('titleGujarati')} autoComplete="off" /></FormField>
          <FormField label="Message" required error={errors.body?.message}><Textarea {...register('body')} rows={3} maxLength={178} /></FormField>
          <FormField label="Gujarati message" error={errors.bodyGujarati?.message}><Textarea {...register('bodyGujarati')} rows={3} maxLength={178} /></FormField>
          <FormField label="Send to" helper={`Reaches ${reach} ${reach === 1 ? 'customer' : 'customers'} right now.`}><Controller control={control} name="audience" render={({ field }) => <SelectField label="Send to" placeholder="Choose an audience" value={field.value} options={AUDIENCES} onChange={field.onChange} />} /></FormField>
          <FormField label="Send as" helper="SMS messages must be 160 characters or fewer."><Controller control={control} name="channel" render={({ field }) => <SelectField label="Send as" placeholder="Choose a channel" value={field.value} options={CHANNELS} onChange={field.onChange} />} /></FormField>
          <div className="notification-preview field-wide" aria-live="polite"><span>Preview with sample details</span><strong>{renderPreview(title) || 'Title'}</strong><p>{renderPreview(body) || 'Message'}</p></div>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{broadcast ? 'Save Draft' : 'Create Draft'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
