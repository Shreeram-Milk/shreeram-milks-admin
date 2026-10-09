'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { faqSchema, type FaqFormValues } from '../schema'
import { faqService } from '../service'
import { FAQ_TOPIC_LABELS, type Faq, type FaqTopic } from '../types'

const TOPICS = (Object.keys(FAQ_TOPIC_LABELS) as FaqTopic[]).map(value => ({ value, label: FAQ_TOPIC_LABELS[value] }))
const blank = (sortOrder: number): FaqFormValues => ({ topic: 'delivery', question: '', questionGujarati: '', answer: '', answerGujarati: '', sortOrder, status: 'active' })
const fromFaq = (faq: Faq): FaqFormValues => ({ topic: faq.topic, question: faq.question, questionGujarati: faq.questionGujarati, answer: faq.answer, answerGujarati: faq.answerGujarati, sortOrder: faq.sortOrder, status: faq.status })

/** Mounted fresh for each create/edit, so the form always starts from the right record. */
export function FaqDialog({ faq, nextSortOrder, onClose, onDone }: { faq: Faq | null; nextSortOrder: number; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FaqFormValues>({ resolver: zodResolver(faqSchema), defaultValues: faq ? fromFaq(faq) : blank(nextSortOrder) })
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      faqService.save({ ...values, id: faq?.id })
      toast.success(faq ? 'Question saved.' : 'Question added.')
      onClose()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the question.')
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{faq ? 'Edit question' : 'Add question'}</DialogTitle><DialogDescription>Shown in the customer app’s Help &amp; Support screen.</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <FormField label="Topic"><Controller control={control} name="topic" render={({ field }) => <SelectField label="Topic" placeholder="Choose a topic" value={field.value} options={TOPICS} onChange={field.onChange} />} /></FormField>
          <FormField label="Display order" error={errors.sortOrder?.message} helper="Lower numbers appear first in the topic."><Input {...register('sortOrder', { valueAsNumber: true })} type="number" min={0} inputMode="numeric" /></FormField>
          <FormField label="Question" required error={errors.question?.message}><Input {...register('question')} autoComplete="off" /></FormField>
          <FormField label="Gujarati question" error={errors.questionGujarati?.message}><Input {...register('questionGujarati')} autoComplete="off" /></FormField>
          <FormField label="Answer" required error={errors.answer?.message}><Textarea {...register('answer')} rows={4} maxLength={800} /></FormField>
          <FormField label="Gujarati answer" error={errors.answerGujarati?.message}><Textarea {...register('answerGujarati')} rows={4} maxLength={800} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{faq ? 'Save Question' : 'Add Question'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
