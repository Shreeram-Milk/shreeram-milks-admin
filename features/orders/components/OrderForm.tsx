'use client'

import Link from 'next/link'
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
import { buildOrderSchema, type OrderFormValues } from '../schema'
import { orderService } from '../service'
import type { Order, OrderInput } from '../types'
import { OrderDeliverySection } from './OrderDeliverySection'
import { OrderItemsSection } from './OrderItemsSection'
import { OrderReview } from './OrderReview'

type OrderStepId = 'customer' | 'items' | 'delivery' | 'review'
const STEPS: Step<OrderStepId>[] = [
  { id: 'customer', label: 'Customer', description: 'Choose the customer. Their PIN code decides what can be delivered.' },
  { id: 'items', label: 'Items', description: 'Add Buy Once products, variants and quantities.' },
  { id: 'delivery', label: 'Delivery', description: 'Pick a delivery slot and date.' },
  { id: 'review', label: 'Review', description: 'Check everything before saving.' },
]
const STEP_FIELDS: Record<OrderStepId, FieldPath<OrderFormValues>[]> = { customer: ['customerId'], items: ['items'], delivery: ['deliverySlotId', 'deliveryDate'], review: [] }

const toDefaults = (existing: Order | undefined, presetCustomerId: string | undefined): OrderFormValues => existing
  ? { customerId: existing.customerId, items: existing.items.map(item => ({ id: item.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity })), deliverySlotId: existing.deliverySlotId ?? '', deliveryDate: existing.deliveryDate ?? '' }
  : { customerId: presetCustomerId ?? '', items: [{ productId: '', variantId: '', quantity: 1 }], deliverySlotId: '', deliveryDate: '' }

const toInput = (values: OrderFormValues): OrderInput => ({
  customerId: values.customerId, items: values.items.map(item => ({ id: item.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
  deliverySlotId: values.deliverySlotId || null, deliveryDate: values.deliveryDate,
})

export function OrderForm({ orderId, presetCustomerId }: { orderId?: string; presetCustomerId?: string }) {
  const existing = orderId ? orderService.getById(orderId) : undefined
  if (orderId && !existing) return <div className="product-state"><strong>Order not found</strong><Link className="secondary-button" href="/orders">Back to orders</Link></div>
  if (existing && existing.status === 'cancelled') return <div className="product-state"><strong>This order is cancelled</strong><span>Cancelled orders are view-only.</span><Link className="secondary-button" href={`/orders/${existing.id}`}>Back to order</Link></div>
  return <OrderFormBody existing={existing} presetCustomerId={presetCustomerId} />
}

function OrderFormBody({ existing, presetCustomerId }: { existing: Order | undefined; presetCustomerId: string | undefined }) {
  const router = useRouter()
  const today = useMemo(() => todayInBusinessZone(), [])
  const schema = useMemo(() => buildOrderSchema({ today, originalDate: existing?.deliveryDate }), [today, existing?.deliveryDate])
  const form = useForm<OrderFormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(existing, presetCustomerId) })
  const { handleSubmit, control, setError, trigger, getValues, setValue, formState: { errors, isDirty, isSubmitting } } = form
  const [customerId, items] = useWatch({ control, name: ['customerId', 'items'] })
  const firstProductId = items[0]?.productId ?? ''
  const context = useMemo(() => orderService.resolveContext({ customerId, productId: firstProductId }), [customerId, firstProductId])
  const [step, setStep] = useState<OrderStepId>('customer')
  const [submitError, setSubmitError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const backPath = existing ? `/orders/${existing.id}` : presetCustomerId ? `/customers/${presetCustomerId}` : '/orders'
  const { leave, dialog } = useUnsavedChangesGuard(isDirty, backPath)
  const customerInactive = !existing && context.customer !== undefined && context.customer.status !== 'active'
  const blocked = customerInactive || (context.eligibility !== undefined && !context.eligibility.serviceable)
  const stepIndex = STEPS.findIndex(item => item.id === step)
  const isLast = stepIndex === STEPS.length - 1

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [step])
  const goTo = (next: OrderStepId) => setStep(next)

  const stepIsValid = async (target: OrderStepId): Promise<boolean> => {
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
  const jump = async (target: OrderStepId) => {
    const targetIndex = STEPS.findIndex(item => item.id === target)
    for (let index = stepIndex; index < targetIndex; index += 1) { if (!await stepIsValid(STEPS[index].id)) { goTo(STEPS[index].id); return } }
    goTo(target)
  }

  const save = (confirm: boolean) => handleSubmit(
    values => {
      setSubmitError('')
      try {
        const saved = existing ? orderService.update(existing.id, toInput(values)) : orderService.create(toInput(values), { confirm })
        toast.success(existing ? 'Order updated.' : confirm ? 'Order created and confirmed.' : 'Draft order saved.')
        router.push(`/orders/${saved.id}`)
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to save the order.')
      }
    },
    invalid => { const firstBad = STEPS.find(item => STEP_FIELDS[item.id].some(field => field.split('.')[0] in invalid)); if (firstBad) goTo(firstBad.id) },
  )

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLast) { void next(); return }
    if (blocked) { goTo('delivery'); return }
    void save(false)()
  }

  return <div className="workspace-page products-page product-edit-page">
    <header className="page-header page-header-form"><div className="page-title-row">
      <Button variant="outline" className="title-back-button" type="button" aria-label="Back" onClick={() => leave()}><ArrowLeft size={19} /></Button>
      <div><PageBreadcrumbs items={[{ label: 'Orders', href: '/orders' }, { label: existing ? `${existing.orderNumber} · Edit` : 'New order' }]} /><h1>{existing ? `Edit ${existing.orderNumber}` : 'Create Order'}</h1><p className="page-description">{existing ? 'Update items, delivery slot and date. Items you leave unchanged keep their sold price.' : 'Create a one-time Buy Once order for a customer.'}</p></div>
    </div></header>
    <FormProvider {...form}>
      <form className="product-form" onSubmit={onSubmit} noValidate>
        <div className="product-form-scroll" ref={scrollRef}>
          <StepNavigation title="Order Setup Flow" steps={STEPS} active={step} onChange={target => { void jump(target) }} />
          {step === 'customer' && <FormSection id="order-customer-section" number="01" title="Customer" description="Choose an active customer. Their PIN code decides what can be delivered.">
            <CustomerPicker customer={customerId ? context.customer : undefined} locked={Boolean(existing)} onSelect={picked => setValue('customerId', picked.id, { shouldDirty: true, shouldValidate: true })} onClear={() => setValue('customerId', '', { shouldDirty: true })} error={errors.customerId?.message} warning={customerInactive ? 'This customer is inactive. Activate them, or choose another customer, before creating an order.' : undefined} />
          </FormSection>}
          {step === 'items' && <OrderItemsSection existingOrderId={existing?.id} />}
          {step === 'delivery' && <OrderDeliverySection context={context} today={today} originalDate={existing?.deliveryDate ?? null} originalSlotId={existing?.deliverySlotId ?? null} customerLocked={Boolean(existing)} goToStep={goTo} />}
          {step === 'review' && <OrderReview context={context} existingOrderId={existing?.id} />}
          {submitError && <p className="field-error" role="alert">{submitError}</p>}
        </div>
        <StepActionBar stepIndex={stepIndex} stepCount={STEPS.length} onCancel={() => leave()} onBack={() => goTo(STEPS[stepIndex - 1].id)} onContinue={() => void next()} showSubmit={isLast}
          submitActions={existing
            ? <Button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save Changes'}</Button>
            : <><Button type="button" variant="outline" className="secondary-button" disabled={isSubmitting} onClick={() => void save(false)()}>Save as Draft</Button><Button type="button" className="primary-button" disabled={isSubmitting} onClick={() => void save(true)()}>{isSubmitting ? 'Saving…' : 'Create & Confirm'}</Button></>} />
      </form>
    </FormProvider>
    {dialog}
  </div>
}
