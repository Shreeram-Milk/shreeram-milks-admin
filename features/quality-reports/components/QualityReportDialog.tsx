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
import { OptionalDateField } from '@/components/shared/OptionalDateField'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { todayInBusinessZone } from '@/lib/business-time'
import { MediaPicker } from '../../media/components/MediaPicker'
import { qualityReportSchema, type QualityReportFormValues } from '../schema'
import { qualityReportService } from '../service'
import { REPORT_TYPE_LABELS, type QualityReport, type QualityReportType } from '../types'

const TYPES = (Object.keys(REPORT_TYPE_LABELS) as QualityReportType[]).map(value => ({ value, label: REPORT_TYPE_LABELS[value] }))
const NO_PRODUCT = '__none__'

const initialValues = (report: QualityReport | null): QualityReportFormValues => report
  ? { titleEn: report.titleEn, titleGu: report.titleGu, reportType: report.reportType, productId: report.productId, batchReference: report.batchReference, labName: report.labName, reportDate: report.reportDate, validFrom: report.validFrom, validUntil: report.validUntil, summaryEn: report.summaryEn, summaryGu: report.summaryGu, mediaAssetId: report.mediaAssetId }
  : { titleEn: '', titleGu: '', reportType: 'lab_report', productId: '', batchReference: '', labName: '', reportDate: todayInBusinessZone(), validFrom: '', validUntil: '', summaryEn: '', summaryGu: '', mediaAssetId: '' }

/** Mounted fresh for each create/edit, so the form always starts from the right record. */
export function QualityReportDialog({ report, onClose, onDone }: { report: QualityReport | null; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<QualityReportFormValues>({ resolver: zodResolver(qualityReportSchema), defaultValues: initialValues(report) })
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      qualityReportService.save({ ...values, id: report?.id, status: report?.status ?? 'draft' })
      toast.success(report ? 'Report saved.' : 'Report created as a draft.')
      onClose()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the report.')
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{report ? 'Edit report' : 'Add report'}</DialogTitle><DialogDescription>Lab reports and certificates customers can read in the app. Attach the file from the Media Library.</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <FormField label="Title (English)" required error={errors.titleEn?.message}><Input {...register('titleEn')} autoComplete="off" /></FormField>
          <FormField label="Title (Gujarati)" error={errors.titleGu?.message}><Input {...register('titleGu')} autoComplete="off" /></FormField>
          <FormField label="Type"><Controller control={control} name="reportType" render={({ field }) => <SelectField label="Report type" placeholder="Choose a type" value={field.value} options={TYPES} onChange={field.onChange} />} /></FormField>
          <FormField label="Lab or issuer" required error={errors.labName?.message}><Input {...register('labName')} autoComplete="off" /></FormField>
          <FormField label="Product" helper="Optional. Leave empty for a report that covers the whole range."><Controller control={control} name="productId" render={({ field }) => <SelectField label="Product" placeholder="No specific product" value={field.value || NO_PRODUCT} options={[{ value: NO_PRODUCT, label: 'No specific product' }, ...qualityReportService.productOptions(report?.productId)]} onChange={value => field.onChange(value === NO_PRODUCT ? '' : value)} />} /></FormField>
          <FormField label="Batch reference" error={errors.batchReference?.message}><Input {...register('batchReference')} autoComplete="off" placeholder="CM-2026-09" /></FormField>
          <FormField label="Report date" required error={errors.reportDate?.message}><Controller control={control} name="reportDate" render={({ field }) => <DatePickerField label="Report date" value={field.value} onChange={field.onChange} />} /></FormField>
          <div className="record-editor-fields two-column">
            <FormField label="Valid from"><Controller control={control} name="validFrom" render={({ field }) => <OptionalDateField label="Valid from" value={field.value} onChange={field.onChange} placeholder="Not set" />} /></FormField>
            <FormField label="Valid until" error={errors.validUntil?.message}><Controller control={control} name="validUntil" render={({ field }) => <OptionalDateField label="Valid until" value={field.value} onChange={field.onChange} placeholder="Not set" />} /></FormField>
          </div>
          <FormField label="Summary (English)" error={errors.summaryEn?.message} helper="Needed to publish."><Textarea {...register('summaryEn')} rows={3} maxLength={600} /></FormField>
          <FormField label="Summary (Gujarati)" error={errors.summaryGu?.message}><Textarea {...register('summaryGu')} rows={3} maxLength={600} /></FormField>
          <FormField label="File" helper="Needed to publish. A PDF or an image of the report."><Controller control={control} name="mediaAssetId" render={({ field }) => <MediaPicker label="Report file" value={field.value} onChange={field.onChange} />} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{report ? 'Save Report' : 'Create Report'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
