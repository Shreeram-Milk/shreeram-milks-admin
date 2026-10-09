'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FormProvider, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormSection } from '@/components/shared/FormSection'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { StepActionBar } from '@/components/shared/StepActionBar'
import { StepNavigation, type Step } from '@/components/shared/StepNavigation'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { todayInBusinessZone } from '@/lib/business-time'
import { CustomerPicker } from '../../customers/components/CustomerPicker'
import { buildTrialSchema, type TrialFormValues } from '../schema'
import { trialService } from '../service'
import { TrialDeliveryStep, TrialPlanStep, TrialProductStep, TrialReview, TrialStartStep } from './TrialSteps'

type TrialStepId = 'customer' | 'product' | 'plan' | 'delivery' | 'start' | 'review'
const STEPS: Step<TrialStepId>[] = [
  { id: 'customer', label: 'Customer', description: 'Choose the customer. Their PIN code decides what can be delivered.' },
  { id: 'product', label: 'Product', description: 'Pick a trial-enabled product and variant.' },
  { id: 'plan', label: 'Plan', description: 'Choose one of the trial plans offered for this product.' },
  { id: 'delivery', label: 'Delivery', description: 'Pick a delivery slot available for the customer’s PIN.' },
  { id: 'start', label: 'Start date', description: 'Choose the first trial day.' },
  { id: 'review', label: 'Review', description: 'Check everything before creating the trial.' },
]
const STEP_FIELDS: Record<TrialStepId, FieldPath<TrialFormValues>[]> = { customer: ['customerId'], product: ['productId', 'variantId'], plan: ['trialPlanId'], delivery: ['deliverySlotId'], start: ['startDate'], review: [] }

export function TrialForm({ presetCustomerId }: { presetCustomerId?: string }) {
  const router = useRouter()
  const today = useMemo(() => todayInBusinessZone(), [])
  const schema = useMemo(() => buildTrialSchema({ today }), [today])
  const form = useForm<TrialFormValues>({ resolver: zodResolver(schema), defaultValues: { customerId: presetCustomerId ?? '', productId: '', variantId: '', trialPlanId: '', deliverySlotId: '', startDate: '' } })
  const { handleSubmit, control, setError, trigger, getValues, setValue, formState: { errors, isDirty, isSubmitting } } = form
  const [customerId, productId] = useWatch({ control, name: ['customerId', 'productId'] })
  const context = useMemo(() => trialService.resolveContext({ customerId, productId }), [customerId, productId])
  const [step, setStep] = useState<TrialStepId>('customer')
  const [submitError, setSubmitError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const { leave, dialog } = useUnsavedChangesGuard(isDirty, presetCustomerId ? `/customers/${presetCustomerId}` : '/trials')
  const { eligibility, customer } = context.fulfilment
  const customerInactive = customer !== undefined && customer.status !== 'active'
  const blocked = customerInactive || (eligibility !== undefined && !eligibility.serviceable)
  const stepIndex = STEPS.findIndex(item => item.id === step)
  const isLast = stepIndex === STEPS.length - 1

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [step])
  const goTo = (target: TrialStepId) => setStep(target)

  const stepIsValid = async (target: TrialStepId): Promise<boolean> => {
    const fieldsValid = STEP_FIELDS[target].length === 0 || await trigger(STEP_FIELDS[target])
    if (!fieldsValid) return false
    if (target === 'customer' && customerInactive) return false
    if (target === 'delivery') {
      if (blocked) return false
      if (eligibility?.slotRequired && !getValues('deliverySlotId')) { setError('deliverySlotId', { message: 'Select a delivery slot.' }); return false }
    }
    return true
  }
  const next = async () => { if (await stepIsValid(step)) goTo(STEPS[stepIndex + 1].id) }
  const jump = async (target: TrialStepId) => {
    const targetIndex = STEPS.findIndex(item => item.id === target)
    for (let index = stepIndex; index < targetIndex; index += 1) { if (!await stepIsValid(STEPS[index].id)) { goTo(STEPS[index].id); return } }
    goTo(target)
  }

  const submit = handleSubmit(
    values => {
      setSubmitError('')
      try {
        const created = trialService.create({ ...values, deliverySlotId: values.deliverySlotId || null })
        toast.success('Trial created. Its deliveries are scheduled.')
        router.push(`/trials/${created.id}`)
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to create the trial.')
      }
    },
    invalid => { const firstBad = STEPS.find(item => STEP_FIELDS[item.id].some(field => field in invalid)); if (firstBad) goTo(firstBad.id) },
  )
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLast) { void next(); return }
    if (blocked) { goTo('delivery'); return }
    void submit()
  }

  return <div className="workspace-page products-page product-edit-page">
    <header className="page-header page-header-form"><div className="page-title-row">
      <Button variant="outline" className="title-back-button" type="button" aria-label="Back" onClick={() => leave()}><ArrowLeft size={19} /></Button>
      <div><PageBreadcrumbs items={[{ label: 'Trials', href: '/trials' }, { label: 'New trial' }]} /><h1>Create Trial</h1><p className="page-description">Start a short trial for a customer. A delivery is scheduled for each trial day.</p></div>
    </div></header>
    <FormProvider {...form}>
      <form className="product-form" onSubmit={onSubmit} noValidate>
        <div className="product-form-scroll" ref={scrollRef}>
          <StepNavigation title="Trial Setup Flow" steps={STEPS} active={step} onChange={target => { void jump(target) }} />
          {step === 'customer' && <FormSection id="trial-customer-section" number="01" title="Customer" description="Choose an active customer. Their PIN code decides what can be delivered.">
            <CustomerPicker customer={customerId ? customer : undefined} locked={false} onSelect={picked => setValue('customerId', picked.id, { shouldDirty: true, shouldValidate: true })} onClear={() => setValue('customerId', '', { shouldDirty: true })} error={errors.customerId?.message} warning={customerInactive ? 'This customer is inactive. Activate them, or choose another customer, before creating a trial.' : undefined} />
          </FormSection>}
          {step === 'product' && <TrialProductStep context={context} />}
          {step === 'plan' && <TrialPlanStep context={context} />}
          {step === 'delivery' && <TrialDeliveryStep context={context} customerLocked={false} goToStep={goTo} />}
          {step === 'start' && <TrialStartStep today={today} context={context} />}
          {step === 'review' && <TrialReview context={context} />}
          {submitError && <p className="field-error" role="alert">{submitError}</p>}
        </div>
        <StepActionBar stepIndex={stepIndex} stepCount={STEPS.length} onCancel={() => leave()} onBack={() => goTo(STEPS[stepIndex - 1].id)} onContinue={() => void next()} showSubmit={isLast}
          submitActions={<Button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create Trial'}</Button>} />
      </form>
    </FormProvider>
    {dialog}
  </div>
}
