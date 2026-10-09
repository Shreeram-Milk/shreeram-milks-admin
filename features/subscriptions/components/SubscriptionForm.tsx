'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FormProvider, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { StepNavigation, type Step } from '@/components/shared/StepNavigation'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { addDays, todayInBusinessZone } from '@/lib/business-time'
import { buildSubscriptionSchema, type SubscriptionFormValues } from '../schema'
import { trialService } from '../../trials/service'
import type { TrialEnrollment } from '../../trials/types'
import { subscriptionService } from '../service'
import type { Subscription, SubscriptionInput } from '../types'
import { CustomerSection } from './CustomerSection'
import { SubscriptionDeliverySection } from './SubscriptionDeliverySection'
import { SubscriptionProductSelector } from './SubscriptionProductSelector'
import { SubscriptionReview } from './SubscriptionReview'
import { SubscriptionScheduleSection } from './SubscriptionScheduleSection'
import { SubscriptionStartDateSection } from './SubscriptionStartDateSection'

type SubscriptionFormProps = { subscriptionId?: string; presetCustomerId?: string; /** Converts this trial: customer, product, variant and slot are pre-filled and the form opens at the Schedule step. */ fromTrialId?: string }
export type SubscriptionStepId = 'customer' | 'product' | 'schedule' | 'delivery' | 'start' | 'review'

const STEPS: Step<SubscriptionStepId>[] = [
  { id: 'customer', label: 'Customer', description: 'Choose the customer. Their PIN code decides what can be delivered.' },
  { id: 'product', label: 'Product', description: 'Pick a subscription product and variant.' },
  { id: 'schedule', label: 'Schedule', description: 'Choose how often deliveries happen.' },
  { id: 'delivery', label: 'Delivery', description: 'Pick a delivery slot available for the customer’s PIN.' },
  { id: 'start', label: 'Start date', description: 'Choose when deliveries begin.' },
  { id: 'review', label: 'Review', description: 'Check everything before saving.' },
]

/** Fields each step owns, used to validate before moving on and to find the first step with an error. */
const STEP_FIELDS: Record<SubscriptionStepId, FieldPath<SubscriptionFormValues>[]> = {
  customer: ['customerId'],
  product: ['productId', 'variantId'],
  schedule: ['scheduleType', 'weekdays', 'alternatePatternDate'],
  delivery: ['deliverySlotId'],
  start: ['startDate'],
  review: [],
}

function toDefaults(existing: Subscription | undefined, presetCustomerId: string | undefined, trial: TrialEnrollment | undefined): SubscriptionFormValues {
  if (trial) {
    const today = todayInBusinessZone()
    const afterTrial = addDays(trial.endDate, 1)
    return { customerId: trial.customerId, productId: trial.productId, variantId: trial.variantId, scheduleType: '', weekdays: [], alternatePatternDate: '', deliverySlotId: trial.deliverySlotId ?? '', startDate: afterTrial > today ? afterTrial : today }
  }
  if (!existing) return { customerId: presetCustomerId ?? '', productId: '', variantId: '', scheduleType: '', weekdays: [], alternatePatternDate: '', deliverySlotId: '', startDate: '' }
  return { customerId: existing.customerId, productId: existing.productId, variantId: existing.variantId, scheduleType: existing.schedule.scheduleType, weekdays: existing.schedule.weekdays, alternatePatternDate: existing.schedule.alternatePatternDate ?? '', deliverySlotId: existing.deliverySlotId ?? '', startDate: existing.startDate }
}

function toInput(values: SubscriptionFormValues): SubscriptionInput {
  return {
    customerId: values.customerId, productId: values.productId, variantId: values.variantId,
    schedule: { scheduleType: values.scheduleType === '' ? 'daily' : values.scheduleType, weekdays: values.weekdays, alternatePatternDate: values.alternatePatternDate || null },
    deliverySlotId: values.deliverySlotId || null,
    startDate: values.startDate,
  }
}

export function SubscriptionForm({ subscriptionId, presetCustomerId, fromTrialId }: SubscriptionFormProps) {
  const existing = subscriptionId ? subscriptionService.getById(subscriptionId) : undefined
  if (subscriptionId && !existing) return <div className="product-state"><strong>Subscription not found</strong><Link className="secondary-button" href="/subscriptions">Back to subscriptions</Link></div>
  if (existing?.status === 'cancelled') return <div className="product-state"><strong>This subscription is cancelled</strong><span>Cancelled subscriptions are view-only.</span><Link className="secondary-button" href={`/subscriptions/${existing.id}`}>Back to subscription</Link></div>
  if (fromTrialId) {
    const trial = trialService.getById(fromTrialId)
    if (!trial) return <div className="product-state"><strong>Trial not found</strong><Link className="secondary-button" href="/trials">Back to trials</Link></div>
    const block = trialService.conversionBlock(trial)
    if (block) return <div className="product-state"><strong>This trial can’t be converted</strong><span>{block}</span><Link className="secondary-button" href={`/trials/${trial.id}`}>Back to trial</Link></div>
    return <SubscriptionFormBody existing={undefined} presetCustomerId={undefined} trial={trial} />
  }
  return <SubscriptionFormBody existing={existing} presetCustomerId={presetCustomerId} trial={undefined} />
}

function SubscriptionFormBody({ existing, presetCustomerId, trial }: { existing: Subscription | undefined; presetCustomerId: string | undefined; trial: TrialEnrollment | undefined }) {
  const router = useRouter()
  const today = useMemo(() => todayInBusinessZone(), [])
  const schema = useMemo(() => buildSubscriptionSchema({ today, originalStartDate: existing?.startDate }), [today, existing?.startDate])
  const form = useForm<SubscriptionFormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(existing, presetCustomerId, trial) })
  const { handleSubmit, control, setError, trigger, getValues, formState: { errors, isDirty, isSubmitting } } = form
  const [customerId, productId] = useWatch({ control, name: ['customerId', 'productId'] })
  const context = useMemo(() => subscriptionService.resolveContext({ customerId, productId, existing }), [customerId, productId, existing])
  const [step, setStep] = useState<SubscriptionStepId>(trial ? 'schedule' : 'customer')
  const [submitError, setSubmitError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const backPath = trial ? `/trials/${trial.id}` : existing ? `/subscriptions/${existing.id}` : presetCustomerId ? `/customers/${presetCustomerId}` : '/subscriptions'
  const { leave, dialog } = useUnsavedChangesGuard(isDirty, backPath)
  const customerInactive = !existing && context.customer !== undefined && context.customer.status !== 'active'
  const blocked = customerInactive || (context.eligibility !== undefined && !context.eligibility.serviceable)
  const stepIndex = STEPS.findIndex(item => item.id === step)
  const isLast = stepIndex === STEPS.length - 1

  const goTo = (next: SubscriptionStepId) => setStep(next)
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [step])

  /** A step is complete when its own fields validate and, for delivery, the customer can actually be served. */
  const stepIsValid = async (target: SubscriptionStepId): Promise<boolean> => {
    const fieldsValid = STEP_FIELDS[target].length === 0 || await trigger(STEP_FIELDS[target])
    if (!fieldsValid) return false
    if (target === 'customer' && customerInactive) return false
    if (target === 'delivery') {
      if (blocked) return false
      if (context.eligibility?.slotRequired && !getValues('deliverySlotId')) { setError('deliverySlotId', { message: 'Select a delivery slot.' }); return false }
    }
    return true
  }

  const next = async () => { if (await stepIsValid(step)) goTo(STEPS[stepIndex + 1].id) }
  /** Jumping ahead is only allowed over steps that are already valid. */
  const jump = async (target: SubscriptionStepId) => {
    const targetIndex = STEPS.findIndex(item => item.id === target)
    for (let index = stepIndex; index < targetIndex; index += 1) { if (!await stepIsValid(STEPS[index].id)) { goTo(STEPS[index].id); return } }
    goTo(target)
  }

  const submitAll = handleSubmit(
    values => {
      setSubmitError('')
      if (context.eligibility?.slotRequired && !values.deliverySlotId) { setError('deliverySlotId', { message: 'Select a delivery slot.' }); goTo('delivery'); return }
      try {
        const saved = trial ? trialService.convertToSubscription(trial.id, toInput(values)) : existing ? subscriptionService.update(existing.id, toInput(values)) : subscriptionService.create(toInput(values))
        toast.success(trial ? 'Trial converted to a subscription.' : existing ? 'Subscription updated.' : 'Subscription created.')
        router.push(`/subscriptions/${saved.id}`)
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to save subscription.')
      }
    },
    invalid => {
      const firstBad = STEPS.find(item => STEP_FIELDS[item.id].some(field => field in invalid))
      if (firstBad) goTo(firstBad.id)
    },
  )

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Enter inside a field advances the step instead of saving half-finished work (create flow only).
    if (!isLast && !existing) { void next(); return }
    if (blocked) { goTo('delivery'); return }
    void submitAll()
  }

  return <div className="workspace-page products-page product-edit-page">
    <header className="page-header page-header-form"><div className="page-title-row">
      <Button variant="outline" className="title-back-button" type="button" aria-label="Back" onClick={() => leave()}><ArrowLeft size={19} /></Button>
      <div><PageBreadcrumbs items={trial ? [{ label: 'Trials', href: '/trials' }, { label: 'Trial', href: `/trials/${trial.id}` }, { label: 'Convert' }] : [{ label: 'Subscriptions', href: '/subscriptions' }, { label: existing ? 'Edit' : 'New subscription' }]} /><h1>{trial ? 'Convert Trial to Subscription' : existing ? 'Edit Subscription' : 'Create Subscription'}</h1><p className="page-description">{existing ? 'Update the product, schedule, and delivery slot. The customer cannot be changed.' : 'Delivery options are derived from the customer’s PIN code and the product’s fulfilment profile.'}</p></div>
    </div></header>
    <FormProvider {...form}>
      <form className="product-form" onSubmit={onSubmit} noValidate>
        <div className="product-form-scroll" ref={scrollRef}>
          <StepNavigation title="Subscription Setup Flow" steps={STEPS} active={step} onChange={target => { void jump(target) }} />
          {step === 'customer' && <CustomerSection locked={Boolean(existing || trial)} customer={context.customer} inactive={customerInactive} />}
          {step === 'product' && <SubscriptionProductSelector context={context} keepProductId={existing?.productId} />}
          {step === 'schedule' && <SubscriptionScheduleSection context={context} today={today} />}
          {step === 'delivery' && <SubscriptionDeliverySection context={context} existingSlotId={existing?.deliverySlotId ?? null} customerLocked={Boolean(existing)} goToStep={goTo} />}
          {step === 'start' && <SubscriptionStartDateSection today={today} originalStartDate={existing?.startDate} />}
          {step === 'review' && <SubscriptionReview context={context} />}
          {Object.keys(errors).length > 0 && step === 'review' && <p className="field-error" role="alert">Some earlier steps need attention. Go back to the highlighted step.</p>}
          {submitError && <p className="field-error" role="alert">{submitError}</p>}
        </div>
        <div className="product-save-bar">
          <div className="product-step-actions">
            {stepIndex === 0 ? <Button type="button" variant="outline" className="secondary-button" onClick={() => leave()}>Cancel</Button> : <Button type="button" variant="outline" className="secondary-button" onClick={() => goTo(STEPS[stepIndex - 1].id)}>Back</Button>}
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
          </div>
          <div className="product-step-actions">
            {!isLast && <Button type="button" className="primary-button" onClick={() => void next()}>Continue</Button>}
            {(isLast || existing) && <Button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : existing ? 'Save Changes' : trial ? 'Convert to Subscription' : 'Create Subscription'}</Button>}
          </div>
        </div>
      </form>
    </FormProvider>
    {dialog}
  </div>
}
