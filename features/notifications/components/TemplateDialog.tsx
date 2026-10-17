'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { describeApiError } from '@/lib/api-errors'
import { notificationApi, type MessageTemplate } from '../api'
import { BODY_MAX, TITLE_MAX, templateSchema, type TemplateFormValues } from '../schema'

/** Edits the wording of one automatic message. The details in double braces, like {{order}}, are filled in with the real values. */
export function TemplateDialog({ template, onClose, onSaved }: { template: MessageTemplate; onClose: () => void; onSaved: (template: MessageTemplate) => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { title: template.title, titleGujarati: template.titleGujarati, body: template.body, bodyGujarati: template.bodyGujarati, enabled: template.enabled },
  })
  const [error, setError] = useState('')
  const submit = handleSubmit(async values => {
    setError('')
    try {
      onSaved(await notificationApi.saveTemplate(template.key, values))
      toast.success('Message saved.')
      onClose()
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })
  const details = template.placeholders.map(name => `{{${name}}}`).join('  ')
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{template.label}</DialogTitle><DialogDescription>{template.trigger} You can put these in the words, and the real value is filled in: {details}</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <FormField label="Title" required error={errors.title?.message}><Input {...register('title')} autoComplete="off" maxLength={TITLE_MAX} /></FormField>
          <FormField label="Gujarati title" helper="Leave empty to use the English title." error={errors.titleGujarati?.message}><Input {...register('titleGujarati')} autoComplete="off" maxLength={TITLE_MAX} lang="gu" /></FormField>
          <FormField label="Message" required error={errors.body?.message}><Textarea {...register('body')} rows={3} maxLength={BODY_MAX} /></FormField>
          <FormField label="Gujarati message" helper="Leave empty to use the English message." error={errors.bodyGujarati?.message}><Textarea {...register('bodyGujarati')} rows={3} maxLength={BODY_MAX} lang="gu" /></FormField>
          <div className="switch-field"><label htmlFor="template-enabled">Send this message</label><Controller control={control} name="enabled" render={({ field }) => <Switch id="template-enabled" checked={field.value} onCheckedChange={field.onChange} />} /><small className="help-text">When off, customers get nothing for this event.</small></div>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
