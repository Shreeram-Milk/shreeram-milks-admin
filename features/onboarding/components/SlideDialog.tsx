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
import { ImageUploadField } from '@/components/shared/ImageUploadField'
import { describeApiError } from '@/lib/api-errors'
import { onboardingApi } from '../api'
import { slideSchema, type SlideFormValues } from '../schema'
import type { OnboardingSlideRecord } from '../types'
import { t } from '../messages'

const initialValues = (slide: OnboardingSlideRecord | null): SlideFormValues => slide
  ? { imageAssetId: slide.imageAssetId, titleEn: slide.titleEn, titleGu: slide.titleGu, descriptionEn: slide.descriptionEn, descriptionGu: slide.descriptionGu, status: slide.status }
  : { imageAssetId: '', titleEn: '', titleGu: '', descriptionEn: '', descriptionGu: '', status: 'active' }

/** Mounted fresh for each create/edit. Status is chosen here: only Active slides reach customers. */
export function SlideDialog({ slide, onClose, onDone }: { slide: OnboardingSlideRecord | null; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<SlideFormValues>({ resolver: zodResolver(slideSchema), defaultValues: initialValues(slide) })
  const [error, setError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const submit = handleSubmit(async values => {
    setError('')
    try {
      if (slide) await onboardingApi.update(slide.id, values)
      else await onboardingApi.create(values)
      toast.success(slide ? t('saved') : t('addedToast'))
      onClose()
      onDone()
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{slide ? t('editTitle') : t('addTitle')}</DialogTitle><DialogDescription>{t('dialogDescription')}</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <div className="field-wide"><Controller control={control} name="imageAssetId" render={({ field }) => <ImageUploadField purpose="onboarding" label={t('picture')} hint={t('pictureHint')} currentUrl={slide?.imageUrl ?? null} hasImage={Boolean(field.value)} removable={false} error={errors.imageAssetId?.message} onChange={id => setValue('imageAssetId', id ?? '', { shouldDirty: true, shouldValidate: true })} onBusyChange={setImageBusy} />} /></div>
          <FormField label={t('headlineEn')} required error={errors.titleEn?.message}><Input {...register('titleEn')} autoComplete="off" /></FormField>
          <FormField label={t('headlineGu')} error={errors.titleGu?.message}><Input {...register('titleGu')} autoComplete="off" /></FormField>
          <FormField label={t('textEn')} required error={errors.descriptionEn?.message}><Textarea {...register('descriptionEn')} rows={3} maxLength={200} /></FormField>
          <FormField label={t('textGu')} error={errors.descriptionGu?.message}><Textarea {...register('descriptionGu')} rows={3} maxLength={200} /></FormField>
          <div className="switch-field field-wide"><label htmlFor="slide-active">{t('active')}</label><Controller control={control} name="status" render={({ field }) => <Switch id="slide-active" checked={field.value === 'active'} onCheckedChange={checked => field.onChange(checked ? 'active' : 'inactive')} />} /><small className="help-text">{t('activeHelper')}</small></div>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>{t('cancel')}</Button><Button type="submit" className="primary-button" disabled={isSubmitting || imageBusy}>{slide ? t('saveSlide') : t('addSlide')}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
