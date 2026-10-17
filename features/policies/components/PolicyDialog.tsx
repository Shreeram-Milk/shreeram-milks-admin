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
import { DatePickerField } from '@/components/shared/DatePickerField'
import { todayInBusinessZone } from '@/lib/business-time'
import { policySchema, type PolicyFormValues } from '../schema'
import { describeApiError } from '@/lib/api-errors'
import { policyApi } from '../api'
import { MIN_PUBLISHED_BODY_LENGTH } from '../types'
import { POLICY_TYPE_LABELS, type PolicyDocument, type PolicyType } from '../types'

const TYPES = (Object.keys(POLICY_TYPE_LABELS) as PolicyType[]).map(value => ({ value, label: POLICY_TYPE_LABELS[value] }))

const initialValues = (policy: PolicyDocument | null, presetType: PolicyType, suggestedVersion: (type: PolicyType) => string): PolicyFormValues => policy
  ? { type: policy.type, titleEn: policy.titleEn, titleGu: policy.titleGu, bodyEn: policy.bodyEn, bodyGu: policy.bodyGu, version: policy.version, effectiveDate: policy.effectiveDate }
  : { type: presetType, titleEn: POLICY_TYPE_LABELS[presetType], titleGu: '', bodyEn: '', bodyGu: '', version: suggestedVersion(presetType), effectiveDate: todayInBusinessZone() }

/** Creates a draft or edits one. Published and archived versions open read-only elsewhere. Mounted fresh each time. */
export function PolicyDialog({ policy, presetType, suggestedVersion, onClose, onDone }: { policy: PolicyDocument | null; presetType: PolicyType; suggestedVersion: (type: PolicyType) => string; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<PolicyFormValues>({ resolver: zodResolver(policySchema), defaultValues: initialValues(policy, presetType, suggestedVersion) })
  const [error, setError] = useState('')
  const submit = handleSubmit(async values => {
    setError('')
    try {
      if (policy) await policyApi.updateDraft(policy.id, values)
      else await policyApi.create(values)
      toast.success(policy ? 'Draft saved.' : 'Draft created.')
      onClose()
      onDone()
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{policy ? `Edit draft ${policy.version}` : 'New policy draft'}</DialogTitle><DialogDescription>Drafts are not visible to customers until published. Once published, a version can’t be changed.</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <FormField label="Policy"><Controller control={control} name="type" render={({ field }) => <SelectField label="Policy" placeholder="Choose a policy" value={field.value} options={TYPES} onChange={value => { field.onChange(value); if (!policy) setValue('version', suggestedVersion(value as PolicyType)) }} />} /></FormField>
          <div className="record-editor-fields two-column">
            <FormField label="Version" required error={errors.version?.message}><Input {...register('version')} autoComplete="off" /></FormField>
            <FormField label="Effective from" required error={errors.effectiveDate?.message}><Controller control={control} name="effectiveDate" render={({ field }) => <DatePickerField label="Effective date" value={field.value} onChange={field.onChange} />} /></FormField>
          </div>
          <FormField label="Title (English)" required error={errors.titleEn?.message}><Input {...register('titleEn')} autoComplete="off" /></FormField>
          <FormField label="Title (Gujarati)" error={errors.titleGu?.message}><Input {...register('titleGu')} autoComplete="off" /></FormField>
          <FormField label="Text (English)" required error={errors.bodyEn?.message}><Textarea {...register('bodyEn')} rows={10} /></FormField>
          <FormField label="Text (Gujarati)" error={errors.bodyGu?.message}><Textarea {...register('bodyGu')} rows={10} /></FormField>
        </div>
        <p className="product-hint">The English text needs at least {MIN_PUBLISHED_BODY_LENGTH} characters to be published. Avoid health or nutrition claims you cannot prove: the app stores check this.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{policy ? 'Save Draft' : 'Create Draft'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
