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

type Props = { feature: FeatureKey; existing?: FeatureRecord; refs: References; onCancel: () => void; onSaved: (record: FeatureRecord) => void }

const AREA_KINDS: Array<{ value: string; label: string }> = [{ value: 'pin_code', label: 'Chosen PIN codes' }, { value: 'state', label: 'One whole state' }, { value: 'pan_india', label: 'All of India' }]
const SCHEDULES = [{ value: 'daily', label: 'Every day' }, { value: 'alternate_days', label: 'Every other day' }, { value: 'custom_weekdays', label: 'Days the customer picks' }]

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
      toast.success(`${meta.singular} saved.`)
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
    <header className="page-header page-header-form"><div className="page-title-row"><Link className="title-back-button" href="#" onClick={event => { event.preventDefault(); requestCancel() }} aria-label={`Back to ${meta.plural}`}><ArrowLeft size={19} /></Link><div><PageBreadcrumbs items={[{ label: meta.group }, { label: meta.plural, href: listHref }, { label: isEdit ? 'Edit' : 'New' }]} /><h1>{isEdit ? `Edit ${meta.singular}` : `New ${meta.singular}`}</h1><p className="page-description">{meta.description}</p></div></div></header>
    {feature === 'service-areas' && (isPinArea
      ? <AreaSetupSteps current={1} pinsDone={pinCount > 0} />
      : <div className="setup-note success"><div><strong>One step only</strong>{coverageType === 'state' ? 'A whole-state area needs no PIN list. Any PIN code inside the state is accepted.' : 'An all-India area needs no PIN list. Any valid PIN code in India is accepted.'} You are done as soon as you save.</div></div>)}
    <form className="config-form" onSubmit={submit} noValidate>
      <section className="form-card"><div className="form-section-heading"><span>01</span><div><h2>Basic information</h2><p>A clear name you will recognise when picking it on a product.</p></div></div>
        <div className="form-grid"><Field label={`${meta.singular} name`} required error={fieldError('name')}><Input {...form.register('name')} placeholder={`Enter ${meta.singular.toLowerCase()} name`} /></Field>
          {feature === 'trial-plans' && <Field label="Duration" required helper="Duration is measured in days." error={fieldError('durationDays')}><div className="input-suffix"><Input type="number" min={1} step={1} aria-label="Duration in days" {...form.register('durationDays', { valueAsNumber: true })} /><span>Days</span></div></Field>}
          {feature === 'subscription-rules' && <Field label="How often?" helper={existing ? 'This cannot change after the rule is made. Make a new rule for another schedule.' : form.watch('systemType') === 'custom_weekdays' ? 'Customers tick the weekdays they want when they subscribe.' : 'Customers see this when they subscribe.'}>{existing ? <Input value={SCHEDULES.find(item => item.value === form.watch('systemType'))?.label ?? enumText(form.watch('systemType'))} disabled aria-label="How often (fixed)" /> : <SelectField label="How often?" value={form.watch('systemType')} onChange={value => form.setValue('systemType', value as FormValues['systemType'], { shouldDirty: true, shouldValidate: true })} placeholder="Choose how often" options={SCHEDULES} />}</Field>}
          {feature === 'subscription-rules' && <><Field label="Fewest days" required helper="The shortest plan a customer can choose, from the first to the last delivery day." error={fieldError('minDays')}><div className="input-suffix"><Input type="number" min={1} step={1} aria-label="Fewest days" {...form.register('minDays', { valueAsNumber: true })} /><span>Days</span></div></Field><Field label="Most days" required helper="The longest plan a customer can choose." error={fieldError('maxDays')}><div className="input-suffix"><Input type="number" min={1} step={1} aria-label="Most days" {...form.register('maxDays', { valueAsNumber: true })} /><span>Days</span></div></Field></>}
          {feature === 'subscription-rules' && <Field label="Ready-made lengths" required helper="Buttons customers can tap, as a number of deliveries, separated by commas. For example 15, 30. They can also pick any last day on the calendar." error={fieldError('lengthOptions')}><div className="input-suffix"><Input inputMode="numeric" aria-label="Lengths offered, in deliveries" {...form.register('lengthOptions')} placeholder="15, 30" /><span>Deliveries</span></div></Field>}
          {feature === 'delivery-slots' && <><Field label="Start time" required error={fieldError('startTime')}><Input type="time" {...form.register('startTime')} /></Field><Field label="End time" required error={fieldError('endTime')}><Input type="time" {...form.register('endTime')} /></Field></>}
          {feature === 'service-areas' && <><Field label="Where do you deliver?" required helper={coverageType === 'pin_code' ? 'You choose each PIN code you deliver to, and which delivery slots it gets. You add them in the next step.' : coverageType === 'state' ? 'Every PIN code inside one state. No PIN list needed.' : 'Every valid PIN code in India. No PIN list needed.'}><SelectField label="Where do you deliver?" value={coverageType} onChange={value => form.setValue('coverageType', value as FormValues['coverageType'], { shouldDirty: true, shouldValidate: true })} placeholder="Select coverage" options={AREA_KINDS} /></Field>{coverageType !== 'pan_india' && <Field label="State" required error={fieldError('state')}><Input {...form.register('state')} placeholder="e.g. Gujarat" /></Field>}{coverageType === 'pin_code' && <Field label="City" required error={fieldError('city')}><Input {...form.register('city')} placeholder="e.g. Gandhinagar" /></Field>}</>}
          <Field label="Status"><SelectField label="Status" value={form.watch('status')} onChange={value => form.setValue('status', value as RecordStatus, { shouldDirty: true })} placeholder="Choose a status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Field>
          <Field label="Description" className="span-two"><Textarea rows={3} {...form.register('description')} placeholder="Add helpful context (optional)" /></Field>
        </div>
      </section>
      {feature === 'cutoff-rules' && <CutoffConditions form={form} fields={fields} slotChoices={slotChoices} error={fieldError('conditions')} />}
      {feature === 'delivery-slots' && <div className="preview-strip"><Clock3 size={16} /><span>{form.watch('name') ? `${form.watch('name')} deliveries` : 'Deliveries'} run from {formatTime(form.watch('startTime') || '06:00')} to {formatTime(form.watch('endTime') || '09:00')}.</span></div>}
      {saveError && <div role="alert" className="form-error-banner">{saveError}</div>}
      <div className="save-bar"><Button type="button" className="secondary-button" onClick={requestCancel}>Cancel</Button><Button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : isPinArea ? <>Save and continue to PIN codes <ArrowRight size={15} /></> : <><Check size={15} /> Save {meta.singular}</>}</Button></div>
      <AlertDialog open={discardConfirm} onOpenChange={setDiscardConfirm}>{discardConfirm && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Unsaved changes</p><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your changes haven’t been saved. If you leave this page, you’ll lose them.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button type="button" variant="outline" className="secondary-button">Stay on this page</Button></AlertDialogCancel><AlertDialogAction asChild><Button type="button" className="primary-button" onClick={onCancel}>Discard changes</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
      <AlertDialog open={Boolean(pendingValues)} onOpenChange={open => { if (!open) setPendingValues(null) }}>{pendingValues && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">PIN coverage will change</p><AlertDialogTitle>Change coverage type?</AlertDialogTitle><AlertDialogDescription>This service area has {pinCount} PIN records. Continuing will permanently remove these PIN records and their delivery-slot assignments when coverage changes to {enumText(pendingValues.coverageType)}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button type="button" variant="outline" className="secondary-button">Cancel and keep PIN records</Button></AlertDialogCancel><AlertDialogAction asChild><Button type="button" className="primary-button destructive-button" onClick={() => { const values = pendingValues; setPendingValues(null); void persist(values, true) }}>Continue and remove PINs</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
    </form>
  </div>
}
