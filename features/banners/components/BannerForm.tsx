'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/configuration/FormField'
import { OptionalDateField } from '@/components/shared/OptionalDateField'
import { ImageUploadField } from '@/components/shared/ImageUploadField'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { describeApiError } from '@/lib/api-errors'
import { bannerApi } from '../api'
import { useLinkTargets } from '../links'
import { bannerSchema, type BannerFormValues } from '../schema'
import { BANNER_AUDIENCE_LABELS, BANNER_CTA_LABELS, BANNER_TAB_LABELS, BANNER_TYPE_DESCRIPTIONS, BANNER_TYPE_LABELS, type Banner, type BannerAudience, type BannerCtaType, type BannerInput, type BannerType } from '../types'

const AUDIENCES = (Object.keys(BANNER_AUDIENCE_LABELS) as BannerAudience[]).map(value => ({ value, label: BANNER_AUDIENCE_LABELS[value] }))
const CTA_TYPES = (Object.keys(BANNER_CTA_LABELS) as BannerCtaType[]).map(value => ({ value, label: BANNER_CTA_LABELS[value] }))

const blank = (type: BannerType, sortOrder: number): BannerFormValues => ({ type, audience: 'all_users', titleEn: '', titleGu: '', messageEn: '', messageGu: '', labelEn: '', labelGu: '', imageAssetId: null, ctaType: 'none', ctaTarget: '', startDate: '', endDate: '', sortOrder, status: 'active' })
const fromBanner = (banner: Banner): BannerFormValues => ({ type: banner.type, audience: banner.audience, titleEn: banner.titleEn, titleGu: banner.titleGu, messageEn: banner.messageEn, messageGu: banner.messageGu, labelEn: banner.labelEn, labelGu: banner.labelGu, imageAssetId: banner.imageAssetId, ctaType: banner.ctaType, ctaTarget: banner.ctaTarget, startDate: banner.startDate ?? '', endDate: banner.endDate ?? '', sortOrder: banner.sortOrder, status: banner.status })
/** The form keeps "no date" as an empty string; the API wants null. */
const toInput = (values: BannerFormValues): BannerInput => ({ ...values, startDate: values.startDate || null, endDate: values.endDate || null })

type Props = { banner: Banner | null; type: BannerType; nextSortOrder?: number }

/**
 * One banner on its own page. The type is fixed by the tab it was opened from, so there is no type dropdown:
 * each kind of banner is added and edited in its own place.
 */
export function BannerForm({ banner, type, nextSortOrder = 1 }: Props) {
  const router = useRouter()
  const backPath = `/content/banners?type=${type}`
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<BannerFormValues>({ resolver: zodResolver(bannerSchema), defaultValues: banner ? fromBanner(banner) : blank(type, nextSortOrder) })
  const ctaType = useWatch({ control, name: 'ctaType' })
  const linkTargets = useLinkTargets()
  const [error, setError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const { leave, dialog } = useUnsavedChangesGuard(isDirty, backPath)
  const label = BANNER_TYPE_LABELS[type]

  const submit = handleSubmit(async values => {
    setError('')
    try {
      if (banner) await bannerApi.update(banner.id, toInput(values))
      else await bannerApi.create(toInput(values))
      toast.success(banner ? `${label} saved.` : `${label} created.`)
      // Saved: nothing is unsaved any more, so leaving must not ask again.
      router.push(backPath)
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })

  return <div className="workspace-page products-page product-edit-page">
    <header className="page-header page-header-form"><div className="page-title-row">
      <Button variant="outline" className="title-back-button" type="button" aria-label={`Back to ${BANNER_TAB_LABELS[type].toLowerCase()}`} onClick={() => leave()}><ArrowLeft size={19} /></Button>
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Banners', href: backPath }, { label: BANNER_TAB_LABELS[type], href: backPath }, { label: banner ? 'Edit' : 'New' }]} /><h1>{banner ? `Edit ${label.toLowerCase()}` : `New ${label.toLowerCase()}`}</h1><p className="page-description">{BANNER_TYPE_DESCRIPTIONS[type]}</p></div>
    </div></header>
    <form onSubmit={submit} noValidate className="settings-form">
      <section className="form-card"><h2>Message</h2>
        <div className="product-grid">
          <FormField label="Headline (English)" required error={errors.titleEn?.message}><Input {...register('titleEn')} autoComplete="off" /></FormField>
          <FormField label="Headline (Gujarati)" error={errors.titleGu?.message}><Input {...register('titleGu')} autoComplete="off" /></FormField>
          <FormField label="Text (English)" error={errors.messageEn?.message}><Textarea {...register('messageEn')} rows={3} maxLength={160} /></FormField>
          <FormField label="Text (Gujarati)" error={errors.messageGu?.message}><Textarea {...register('messageGu')} rows={3} maxLength={160} /></FormField>
          <FormField label="Label (English)" error={errors.labelEn?.message} helper="Optional tag on the card, such as SEASONAL OFFER. Leave empty for none."><Input {...register('labelEn')} autoComplete="off" maxLength={24} /></FormField>
          <FormField label="Label (Gujarati)" error={errors.labelGu?.message}><Input {...register('labelGu')} autoComplete="off" maxLength={24} /></FormField>
        </div>
        {type === 'warning'
          ? <p className="product-hint">Warnings are plain text. They do not carry a picture.</p>
          : <Controller control={control} name="imageAssetId" render={({ field }) => type === 'promotion'
            ? <ImageUploadField purpose="banner" label="Picture" hint="JPEG, PNG or WebP, up to 2 MB. Wide pictures (about 2:1) look best on the home screen." currentUrl={banner?.imageUrl ?? null} hasImage={Boolean(field.value)} onChange={id => setValue('imageAssetId', id, { shouldDirty: true })} onBusyChange={setImageBusy} />
            : <ImageUploadField purpose="banner_icon" label="Icon" hint="Optional. A small SVG file, up to 100 KB. Files that contain scripts or links are refused." currentUrl={banner?.imageUrl ?? null} hasImage={Boolean(field.value)} onChange={id => setValue('imageAssetId', id, { shouldDirty: true })} onBusyChange={setImageBusy} />} />}
      </section>
      <section className="form-card"><h2>Where it goes</h2>
        <div className="product-grid">
          <FormField label="Shown to"><Controller control={control} name="audience" render={({ field }) => <SelectField label="Audience" placeholder="Choose an audience" value={field.value} options={AUDIENCES} onChange={field.onChange} />} /></FormField>
          <FormField label="Opens when tapped"><Controller control={control} name="ctaType" render={({ field }) => <SelectField label="Opens" placeholder="No link" value={field.value} options={CTA_TYPES} onChange={value => { field.onChange(value); setValue('ctaTarget', '', { shouldDirty: true }) }} />} /></FormField>
          {ctaType !== 'none' && ctaType !== 'offers' && <FormField label={ctaType === 'category' ? 'Category' : 'Product'} error={errors.ctaTarget?.message}>
            <Controller control={control} name="ctaTarget" render={({ field }) => <SelectField label="Link target" placeholder={`Choose a ${ctaType}`} value={field.value} options={linkTargets.options(ctaType)} onChange={value => field.onChange(value)} />} />
          </FormField>}
        </div>
      </section>
      <section className="form-card"><h2>When it runs</h2>
        <div className="product-grid">
          <FormField label="Starts" helper="Leave empty to start straight away."><Controller control={control} name="startDate" render={({ field }) => <OptionalDateField label="Start date" value={field.value} onChange={field.onChange} placeholder="Immediately" />} /></FormField>
          <FormField label="Ends" error={errors.endDate?.message} helper="Leave empty to run until turned off."><Controller control={control} name="endDate" render={({ field }) => <OptionalDateField label="End date" value={field.value} onChange={field.onChange} placeholder="No end date" />} /></FormField>
          <FormField label="Display order" error={errors.sortOrder?.message} helper="Lower numbers appear first."><Input {...register('sortOrder', { valueAsNumber: true })} type="number" min={0} inputMode="numeric" /></FormField>
          <FormField label="Status"><Controller control={control} name="status" render={({ field }) => <SelectField label="Status" placeholder="Choose a status" value={field.value} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} onChange={field.onChange} />} /></FormField>
        </div>
      </section>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="settings-actions">
        <Button type="button" variant="outline" className="secondary-button" onClick={() => leave()} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" className="primary-button" disabled={isSubmitting || imageBusy}>{isSubmitting ? 'Saving…' : banner ? 'Save Changes' : `Create ${label}`}</Button>
      </div>
    </form>
    {dialog}
  </div>
}

/** Shown when a banner can't be found or loaded, with a way back. */
export function BannerNotFound({ message }: { message: string }) {
  return <div className="product-state" role="alert"><strong>This banner could not be opened</strong><span>{message}</span><Link className="secondary-button" href="/content/banners">Back to banners</Link></div>
}
