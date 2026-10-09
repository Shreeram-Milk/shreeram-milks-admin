'use client'

import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { eventById, PLACEHOLDER_LABELS } from '../events'
import { templateSchema, type TemplateFormValues } from '../schema'
import { renderPreview, templateService } from '../service'
import type { NotificationTemplate } from '../types'

const fromTemplate = (template: NotificationTemplate): TemplateFormValues => ({ pushEnabled: template.pushEnabled, smsEnabled: template.smsEnabled, title: template.title, titleGujarati: template.titleGujarati, body: template.body, bodyGujarati: template.bodyGujarati, status: template.status })

/** Edits the wording and channels of one automatic message. The event itself is fixed by the system. */
export function TemplateDialog({ template, onClose, onDone }: { template: NotificationTemplate; onClose: () => void; onDone: () => void }) {
  const event = eventById(template.id)
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<TemplateFormValues>({ resolver: zodResolver(templateSchema), defaultValues: fromTemplate(template) })
  const [title, body] = useWatch({ control, name: ['title', 'body'] })
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      templateService.save({ ...values, id: template.id })
      toast.success('Template saved.')
      onClose()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the template.')
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{event?.label ?? 'Notification'}</DialogTitle><DialogDescription>{event?.trigger} You can use {event?.placeholders.map(token => `{{${token}}} (${PLACEHOLDER_LABELS[token].toLowerCase()})`).join(', ')}.</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <FormField label="Title" required error={errors.title?.message}><Input {...register('title')} autoComplete="off" /></FormField>
          <FormField label="Gujarati title" error={errors.titleGujarati?.message}><Input {...register('titleGujarati')} autoComplete="off" /></FormField>
          <FormField label="Message" required error={errors.body?.message}><Textarea {...register('body')} rows={3} maxLength={178} /></FormField>
          <FormField label="Gujarati message" error={errors.bodyGujarati?.message}><Textarea {...register('bodyGujarati')} rows={3} maxLength={178} /></FormField>
          <div className="notification-preview field-wide" aria-live="polite"><span>Preview with sample details</span><strong>{renderPreview(title) || 'Title'}</strong><p>{renderPreview(body) || 'Message'}</p></div>
          <div className="switch-field"><label htmlFor="template-push">App notification</label><Controller control={control} name="pushEnabled" render={({ field }) => <Switch id="template-push" checked={field.value} onCheckedChange={field.onChange} />} />{errors.pushEnabled && <small className="field-error">{errors.pushEnabled.message}</small>}</div>
          <div className="switch-field"><label htmlFor="template-sms">SMS</label><Controller control={control} name="smsEnabled" render={({ field }) => <Switch id="template-sms" checked={field.value} onCheckedChange={field.onChange} />} /><small className="help-text">SMS messages must be 160 characters or fewer.</small></div>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Save Template</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
