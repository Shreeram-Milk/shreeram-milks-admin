'use client'

import Link from 'next/link'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form'
import { ArrowLeft, ArrowRight, Check, Clock3 } from 'lucide-react'
import { FormField as Field } from '@/components/configuration/FormField'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { ApiError } from '@/lib/api-client'
import { describeApiError } from '@/lib/api-errors'
import { configApi, type CutoffRule, type FeatureKey, type FeatureRecord, type RecordStatus, type ServiceArea } from '../api'
import { AreaSetupSteps } from './AreaSetupSteps'
import { CutoffConditions } from './CutoffConditions'
import { FEATURE_LABELS, enumText, formatTime, groupPath } from '../format'
import { buildSchema, defaultValues, toPayload, type FormValues, type References } from '../form-values'
import { tc } from '@/lib/i18n/common'
import { t } from '../messages'

type Props = { feature: FeatureKey; existing?: FeatureRecord; refs: References; onCancel: () => void; onSaved: (record: FeatureRecord) => void }

const areaKinds = () => [{ value: 'pin_code', label: t('areaKindPins') }, { value: 'state', label: t('areaKindState') }, { value: 'pan_india', label: t('areaKindIndia') }]
const schedules = () => [{ value: 'daily', label: t('scheduleDaily') }, { value: 'alternate_days', label: t('scheduleAlternate') }, { value: 'custom_weekdays', label: t('scheduleCustom') }]

/** Create or edit one master-data record. The server decides whether the save is allowed; this form only makes it easy. */
export function RecordForm({ feature, existing, refs, onCancel, onSaved }: Props) {
  const meta = FEATURE_LABELS[feature]
  const currentConditions = (existing as CutoffRule | undefined)?.conditions ?? []
  const slotChoices = refs.slots.filter(slot => slot.status === 'active' || currentConditions.some(condition => condition.deliverySlotId === slot.id))
  const form = useForm<FormValues, unknown, FormValues>({ resolver: zodResolver(buildSchema(feature)) as Resolver<FormValues, unknown, FormValues>, defaultValues: defaultValues(existing, refs), mode: 'onBlur' })
  const fields = useFieldArray({ control: form.control, name: 'conditions' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null)
  const coverageType = useWatch({ control: form.control, name: 'coverageType' })
  const isEdit = Boolean(existing)
  const requestCancel = () => { if (isEdit && form.formState.isDirty) setDiscardConfirm(true); else onCancel() }

  const persist = async (values: FormValues, confirmRemovePins = false) => {
    setSaving(true); setSaveError('')
    try {
      const payload = toPayload(feature, values, confirmRemovePins)
      const record = existing ? await configApi[feature].update(existing.id, payload) : await configApi[feature].create(payload)
      toast.success(t('saved', { noun: meta.singular }))
      onSaved(record)
    } catch (failure) {
      // The server also guards this; if two admins race, it asks here instead of silently deleting PIN codes.
      if (failure instanceof ApiError && failure.code === 'PIN_REMOVAL_NEEDS_CONFIRMATION') setPendingValues(values)
      else setSaveError(describeApiError(failure))
    } finally { setSaving(false) }
  }
  const submit = form.handleSubmit(async values => {
    const area = existing as ServiceArea | undefined
    if (feature === 'service-areas' && area?.coverageType === 'pin_code' && values.coverageType !== 'pin_code' && area.pinCount > 0) { setPendingValues(values); return }
    await persist(values)
  })
  const fieldError = (name: keyof FormValues) => form.formState.errors[name]?.message?.toString()
  const pinCount = (existing as ServiceArea | undefined)?.pinCount ?? 0
  const listHref = `/${groupPath(feature)}/${feature}`
  const isPinArea = feature === 'service-areas' && coverageType === 'pin_code'

  return <div className="workspace-page">
    <header className="page-header page-header-form"><div className="page-title-row"><Link className="title-back-button" href="#" onClick={event => { event.preventDefault(); requestCancel() }} aria-label={t('backTo', { noun: meta.plural })}><ArrowLeft size={19} /></Link><div><PageBreadcrumbs items={[{ label: meta.group }, { label: meta.plural, href: listHref }, { label: isEdit ? t('edit') : t('new') }]} /><h1>{isEdit ? t('editNoun', { noun: meta.singular }) : t('newNoun', { noun: meta.singular })}</h1><p className="page-description">{meta.description}</p></div></div></header>
    {feature === 'service-areas' && (isPinArea
      ? <AreaSetupSteps current={1} pinsDone={pinCount > 0} />
      : <div className="setup-note success"><div><strong>{t('oneStepOnly')}</strong>{coverageType === 'state' ? t('stateNoPins') : t('indiaNoPins')}{t('doneOnSave')}</div></div>)}
    <form className="config-form" onSubmit={submit} noValidate>
      <section className="form-card"><div className="form-section-heading"><span>01</span><div><h2>{t('basicInfo')}</h2><p>{t('basicInfoHint')}</p></div></div>
        <div className="form-grid"><Field label={t('nounName', { noun: meta.singular })} required error={fieldError('name')}><Input {...form.register('name')} placeholder={t('enterNounName', { noun: meta.singular.toLowerCase() })} /></Field>
          {feature === 'trial-plans' && <Field label={t('duration')} required helper={t('durationHelper')} error={fieldError('durationDays')}><div className="input-suffix"><Input type="number" min={1} step={1} aria-label={t('durationInDays')} {...form.register('durationDays', { valueAsNumber: true })} /><span>{t('days')}</span></div></Field>}
          {feature === 'subscription-rules' && <Field label={t('howOften')} helper={existing ? t('howOftenFixed') : form.watch('systemType') === 'custom_weekdays' ? t('howOftenCustom') : t('howOftenSeen')}>{existing ? <Input value={schedules().find(item => item.value === form.watch('systemType'))?.label ?? enumText(form.watch('systemType'))} disabled aria-label={t('howOftenFixedLabel')} /> : <SelectField label={t('howOften')} value={form.watch('systemType')} onChange={value => form.setValue('systemType', value as FormValues['systemType'], { shouldDirty: true, shouldValidate: true })} placeholder={t('chooseHowOften')} options={schedules()} />}</Field>}
          {feature === 'subscription-rules' && <><Field label={t('fewestDays')} required helper={t('fewestDaysHelper')} error={fieldError('minDays')}><div className="input-suffix"><Input type="number" min={1} step={1} aria-label={t('fewestDays')} {...form.register('minDays', { valueAsNumber: true })} /><span>{t('days')}</span></div></Field><Field label={t('mostDays')} required helper={t('mostDaysHelper')} error={fieldError('maxDays')}><div className="input-suffix"><Input type="number" min={1} step={1} aria-label={t('mostDays')} {...form.register('maxDays', { valueAsNumber: true })} /><span>{t('days')}</span></div></Field></>}
          {feature === 'subscription-rules' && <Field label={t('readyLengths')} required helper={t('readyLengthsHelper')} error={fieldError('lengthOptions')}><div className="input-suffix"><Input inputMode="numeric" aria-label={t('lengthsLabel')} {...form.register('lengthOptions')} placeholder="15, 30" /><span>{t('deliveries')}</span></div></Field>}
          {feature === 'delivery-slots' && <><Field label={t('startTime')} required error={fieldError('startTime')}><Input type="time" {...form.register('startTime')} /></Field><Field label={t('endTime')} required error={fieldError('endTime')}><Input type="time" {...form.register('endTime')} /></Field></>}
          {feature === 'service-areas' && <><Field label={t('whereDeliver')} required helper={coverageType === 'pin_code' ? t('whereDeliverPins') : coverageType === 'state' ? t('whereDeliverState') : t('whereDeliverIndia')}><SelectField label={t('whereDeliver')} value={coverageType} onChange={value => form.setValue('coverageType', value as FormValues['coverageType'], { shouldDirty: true, shouldValidate: true })} placeholder={t('selectCoverage')} options={areaKinds()} /></Field>{coverageType !== 'pan_india' && <Field label={t('state')} required error={fieldError('state')}><Input {...form.register('state')} placeholder={t('statePlaceholder')} /></Field>}{coverageType === 'pin_code' && <Field label={t('city')} required error={fieldError('city')}><Input {...form.register('city')} placeholder={t('cityPlaceholder')} /></Field>}</>}
          <Field label={t('status')}><SelectField label={t('status')} value={form.watch('status')} onChange={value => form.setValue('status', value as RecordStatus, { shouldDirty: true })} placeholder={t('chooseStatus')} options={[{ value: 'active', label: tc('active') }, { value: 'inactive', label: tc('inactive') }]} /></Field>
          <Field label={t('description')} className="span-two"><Textarea rows={3} {...form.register('description')} placeholder={t('descriptionPlaceholder')} /></Field>
        </div>
      </section>
      {feature === 'cutoff-rules' && <CutoffConditions form={form} fields={fields} slotChoices={slotChoices} error={fieldError('conditions')} />}
      {feature === 'delivery-slots' && <div className="preview-strip"><Clock3 size={16} /><span>{form.watch('name') ? t('slotRuns', { name: form.watch('name'), start: formatTime(form.watch('startTime') || '06:00'), end: formatTime(form.watch('endTime') || '09:00') }) : t('deliveriesRun', { start: formatTime(form.watch('startTime') || '06:00'), end: formatTime(form.watch('endTime') || '09:00') })}</span></div>}
      {saveError && <div role="alert" className="form-error-banner">{saveError}</div>}
      <div className="save-bar"><Button type="button" className="secondary-button" onClick={requestCancel}>{t('cancel')}</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? t('saving') : isPinArea ? <>{t('saveContinuePins')} <ArrowRight size={15} /></> : <><Check size={15} /> {t('saveNoun', { noun: meta.singular })}</>}</Button></div>
      <AlertDialog open={discardConfirm} onOpenChange={setDiscardConfirm}>{discardConfirm && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">{t('unsavedEyebrow')}</p><AlertDialogTitle>{t('unsavedTitle')}</AlertDialogTitle><AlertDialogDescription>{t('unsavedBody')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button type="button" variant="outline" className="secondary-button">{t('stay')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button type="button" className="primary-button" onClick={onCancel}>{t('discard')}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
      <AlertDialog open={Boolean(pendingValues)} onOpenChange={open => { if (!open) setPendingValues(null) }}>{pendingValues && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">{t('coverageChangeEyebrow')}</p><AlertDialogTitle>{t('coverageChangeTitle')}</AlertDialogTitle><AlertDialogDescription>{t('coverageChangeBody', { count: pinCount, type: enumText(pendingValues.coverageType) })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button type="button" variant="outline" className="secondary-button">{t('keepPins')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button type="button" className="primary-button destructive-button" onClick={() => { const values = pendingValues; setPendingValues(null); void persist(values, true) }}>{t('removePins')}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
    </form>
  </div>
}
