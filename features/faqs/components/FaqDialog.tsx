'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { SelectField } from '@/components/ui/select-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { SUPPORT_CATEGORIES } from '../../support-tickets/categories'
import { faqSchema, type FaqFormValues } from '../schema'
import { describeApiError } from '@/lib/api-errors'
import { faqApi } from '../api'
import { parseKeywords } from '../keywords'
import { FAQ_STATUS_LABELS, MAX_FEATURED_FAQS, type Faq, type FaqStatus } from '../types'

const TOPICS = SUPPORT_CATEGORIES.map(category => ({ value: category.id, label: category.labelEn }))
const STATUSES = (Object.keys(FAQ_STATUS_LABELS) as FaqStatus[]).map(value => ({ value, label: FAQ_STATUS_LABELS[value] }))
const blank = (sortOrder: number): FaqFormValues => ({ topic: 'late_delivery', questionEn: '', questionGu: '', answerEn: '', answerGu: '', searchKeywords: '', featured: false, sortOrder, status: 'draft' })
const fromFaq = (faq: Faq): FaqFormValues => ({ topic: faq.topic, questionEn: faq.questionEn, questionGu: faq.questionGu, answerEn: faq.answerEn, answerGu: faq.answerGu, searchKeywords: faq.searchKeywords.join(', '), featured: faq.featured, sortOrder: faq.sortOrder, status: faq.status })

/** Mounted fresh for each create/edit, so the form always starts from the right record. New articles start as drafts. */
export function FaqDialog({ faq, nextSortOrder, onClose, onDone }: { faq: Faq | null; nextSortOrder: number; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<FaqFormValues>({ resolver: zodResolver(faqSchema), defaultValues: faq ? fromFaq(faq) : blank(nextSortOrder) })
  const status = watch('status')
  const [error, setError] = useState('')
  const submit = handleSubmit(async values => {
    setError('')
    try {
      const payload = { ...values, searchKeywords: parseKeywords(values.searchKeywords) }
      if (faq) await faqApi.update(faq.id, payload)
      else await faqApi.create(payload)
      toast.success(faq ? 'Question saved.' : 'Question added.')
      onClose()
      onDone()
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{faq ? 'Edit question' : 'Add question'}</DialogTitle><DialogDescription>Shown in the customer app’s Help &amp; Support screen once published.</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <FormField label="Topic" helper="Same issue types customers pick when they contact support."><Controller control={control} name="topic" render={({ field }) => <SelectField label="Topic" placeholder="Choose a topic" value={field.value} options={TOPICS} onChange={field.onChange} />} /></FormField>
          <FormField label="Status"><Controller control={control} name="status" render={({ field }) => <SelectField label="Status" placeholder="Choose a status" value={field.value} options={STATUSES} onChange={value => { field.onChange(value); if (value !== 'published') setValue('featured', false) }} />} /></FormField>
          <FormField label="Question (English)" required error={errors.questionEn?.message}><Input {...register('questionEn')} autoComplete="off" /></FormField>
          <FormField label="Question (Gujarati)" error={errors.questionGu?.message}><Input {...register('questionGu')} autoComplete="off" /></FormField>
          <FormField label="Answer (English)" required error={errors.answerEn?.message}><Textarea {...register('answerEn')} rows={4} maxLength={800} /></FormField>
          <FormField label="Answer (Gujarati)" error={errors.answerGu?.message}><Textarea {...register('answerGu')} rows={4} maxLength={800} /></FormField>
          <FormField label="Search keywords" error={errors.searchKeywords?.message} helper="Comma-separated words people might type, such as late, morning."><Input {...register('searchKeywords')} autoComplete="off" /></FormField>
          <FormField label="Display order" error={errors.sortOrder?.message} helper="Lower numbers appear first in the topic."><Input {...register('sortOrder', { valueAsNumber: true })} type="number" min={0} inputMode="numeric" /></FormField>
          <div className="switch-field"><label htmlFor="faq-featured">Featured</label><Controller control={control} name="featured" render={({ field }) => <Switch id="faq-featured" checked={field.value} disabled={status !== 'published'} onCheckedChange={field.onChange} />} /><small className="help-text">Highlighted at the top of Help. Up to {MAX_FEATURED_FAQS}; published questions only.</small></div>
        </div>
        <p className="product-hint">Keep answers factual. Do not claim that a product cures, prevents or treats an illness: the app stores reject health claims.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{faq ? 'Save Question' : 'Add Question'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
