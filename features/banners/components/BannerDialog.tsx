'use client'

import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { OptionalDateField } from '@/components/shared/OptionalDateField'
import { bannerSchema, type BannerFormValues } from '../schema'
import { bannerService } from '../service'
import type { Banner } from '../types'

const LINK_TYPES = [{ value: 'none', label: 'No link' }, { value: 'product', label: 'A product' }, { value: 'category', label: 'A category' }]
const blank = (sortOrder: number): BannerFormValues => ({ label: '', title: '', titleGujarati: '', subtitle: '', subtitleGujarati: '', imageUrl: '', linkType: 'none', linkTargetId: '', startDate: '', endDate: '', sortOrder, status: 'active' })
const fromBanner = (banner: Banner): BannerFormValues => ({ label: banner.label, title: banner.title, titleGujarati: banner.titleGujarati, subtitle: banner.subtitle, subtitleGujarati: banner.subtitleGujarati, imageUrl: banner.imageUrl, linkType: banner.linkType, linkTargetId: banner.linkTargetId, startDate: banner.startDate, endDate: banner.endDate, sortOrder: banner.sortOrder, status: banner.status })

/** Mounted fresh for each create/edit, so the form always starts from the right record. */
export function BannerDialog({ banner, nextSortOrder, onClose, onDone }: { banner: Banner | null; nextSortOrder: number; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<BannerFormValues>({ resolver: zodResolver(bannerSchema), defaultValues: banner ? fromBanner(banner) : blank(nextSortOrder) })
  const linkType = useWatch({ control, name: 'linkType' })
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      bannerService.save({ ...values, id: banner?.id })
      toast.success(banner ? 'Banner saved.' : 'Banner created.')
      onClose()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the banner.')
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{banner ? 'Edit banner' : 'Add banner'}</DialogTitle><DialogDescription>Banners appear on the customer app’s home screen while they are live.</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <FormField label="Label" error={errors.label?.message} helper="Small text above the headline."><Input {...register('label')} autoComplete="off" placeholder="SEASONAL OFFER" /></FormField>
          <FormField label="Display order" error={errors.sortOrder?.message} helper="Lower numbers appear first."><Input {...register('sortOrder', { valueAsNumber: true })} type="number" min={0} inputMode="numeric" /></FormField>
          <FormField label="Headline" required error={errors.title?.message}><Input {...register('title')} autoComplete="off" /></FormField>
          <FormField label="Gujarati headline" error={errors.titleGujarati?.message}><Input {...register('titleGujarati')} autoComplete="off" /></FormField>
          <FormField label="Text" error={errors.subtitle?.message}><Input {...register('subtitle')} autoComplete="off" /></FormField>
          <FormField label="Gujarati text" error={errors.subtitleGujarati?.message}><Input {...register('subtitleGujarati')} autoComplete="off" /></FormField>
          <FormField label="Image link" error={errors.imageUrl?.message} helper="Optional. A full https:// image address." className="field-wide"><Input {...register('imageUrl')} inputMode="url" autoComplete="off" placeholder="https://" /></FormField>
          <FormField label="Opens"><Controller control={control} name="linkType" render={({ field }) => <SelectField label="Opens" placeholder="No link" value={field.value} options={LINK_TYPES} onChange={value => { field.onChange(value); setValue('linkTargetId', '') }} />} /></FormField>
          <FormField label={linkType === 'category' ? 'Category' : 'Product'} error={errors.linkTargetId?.message}>
            <Controller control={control} name="linkTargetId" render={({ field }) => <SelectField label="Link target" placeholder={linkType === 'none' ? 'Not needed' : `Choose a ${linkType}`} value={field.value} options={bannerService.linkOptions(linkType)} onChange={value => field.onChange(value)} />} />
          </FormField>
          <FormField label="Starts" helper="Leave empty to start straight away."><Controller control={control} name="startDate" render={({ field }) => <OptionalDateField label="Start date" value={field.value} onChange={field.onChange} placeholder="Immediately" />} /></FormField>
          <FormField label="Ends" error={errors.endDate?.message} helper="Leave empty to run until turned off."><Controller control={control} name="endDate" render={({ field }) => <OptionalDateField label="End date" value={field.value} onChange={field.onChange} placeholder="No end date" />} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{banner ? 'Save Banner' : 'Create Banner'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
