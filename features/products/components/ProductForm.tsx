'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { describeApiError } from '@/lib/api-errors'
import type { CategoryRecord } from '../../categories/api'
import type { CutoffRule, ServiceArea, SubscriptionRule, TrialPlan } from '../../configuration/api'
import { collectProblems, type FormProblem } from '../form-errors'
import { productApi, type Product } from '../api'
import { emptyForm, productSchema, statusChoices, toForm, toPayload, type ProductFormValues } from '../schema'
import { BasicSection, ContentSection, DeliverySection, PurchaseSection, SubscriptionSection, TrialSection, VariantsSection } from './ProductSections'
import { ProductStepNavigation, type ProductStep, type ProductStepId } from './ProductStepNavigation'
import { t } from '../messages'
import { tc } from '@/lib/i18n/common'

const steps = (): ProductStep[] => [
  { id: 'basics', label: t('stepAbout'), description: t('stepAboutHint') },
  { id: 'delivery', label: t('stepDelivery'), description: t('stepDeliveryHint') },
  { id: 'variants', label: t('stepSizes'), description: t('stepSizesHint') },
  { id: 'selling', label: t('stepSelling'), description: t('stepSellingHint') },
  { id: 'content', label: t('stepContent'), description: t('stepContentHint') },
]

export type ProductReferences = { categories: CategoryRecord[]; areas: ServiceArea[]; cutoffRules: CutoffRule[]; trialPlans: TrialPlan[]; rules: SubscriptionRule[] }

/**
 * Create or edit one product in five steps. Saving goes straight back to the product list. The server decides whether the
 * save is allowed; this form only makes it easy.
 */
export function ProductForm({ existing, refs }: { existing?: Product; refs: ProductReferences }) {
  const router = useRouter()
  const productSteps = steps()
  const id = existing?.id
  const [guardOpen, setGuardOpen] = useState(false)
  const [pendingDestination, setPendingDestination] = useState('/products')
  const [activeStep, setActiveStep] = useState<ProductStepId>('basics')
  const [saving, setSaving] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [problems, setProblems] = useState<FormProblem[]>([])
  // Links to show for each picture: the saved ones, plus local previews of pictures uploaded in this session.
  const [imageUrls, setImageUrls] = useState<Record<string, string>>(() => Object.fromEntries([...(existing?.primaryImage ? [existing.primaryImage] : []), ...(existing?.gallery ?? [])].map(image => [image.assetId, image.url])))
  // Local previews of pictures uploaded in this session are released only when the whole form goes away, not when a step does.
  const imageUrlsRef = useRef(imageUrls)
  useEffect(() => { imageUrlsRef.current = imageUrls }, [imageUrls])
  useEffect(() => () => { for (const url of Object.values(imageUrlsRef.current)) if (url.startsWith('blob:')) URL.revokeObjectURL(url) }, [])
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues: existing ? toForm(existing) : emptyForm(), mode: 'onSubmit' })
  const { register, handleSubmit, formState, watch, setValue, getValues } = form
  const methods = watch('purchaseMethods')
  const isDirty = formState.isDirty
  const categoryOptions = refs.categories.filter(item => item.status === 'active' || item.id === existing?.categoryId).map(item => ({ value: item.id, label: item.status === 'active' ? item.name : t('inactiveSuffix', { name: item.name }) }))

  const leave = (destination = '/products') => {
    if (isDirty) { setPendingDestination(destination); setGuardOpen(true) }
    else router.push(destination)
  }
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (form.formState.isDirty) { event.preventDefault(); event.returnValue = '' } }
    const onPop = () => { if (form.formState.isDirty) { history.pushState({ productGuard: true }, '', location.href); setPendingDestination('/products'); setGuardOpen(true) } }
    const onAnchorClick = (event: MouseEvent) => {
      if (!form.formState.isDirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) return
      const destination = new URL(anchor.href, location.href)
      if (destination.origin !== location.origin || destination.pathname === location.pathname) return
      event.preventDefault(); event.stopPropagation(); setPendingDestination(`${destination.pathname}${destination.search}${destination.hash}`); setGuardOpen(true)
    }
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('popstate', onPop); window.addEventListener('click', onAnchorClick, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('popstate', onPop); window.removeEventListener('click', onAnchorClick, true) }
  }, [form, form.formState.isDirty])

  // A save that fails the form's own checks must say what is wrong and take the admin to it, never fail silently.
  const showProblems = (errors: FieldErrors<ProductFormValues>) => {
    const found = collectProblems(errors)
    setProblems(found)
    if (found[0] && !found.some(problem => problem.step === activeStep)) setActiveStep(found[0].step)
  }

  const save = async (values: ProductFormValues) => {
    setSaving(true); setSubmitError('')
    try {
      const payload = toPayload(values)
      const saved = id ? await productApi.update(id, payload) : await productApi.create(payload)
      form.reset(values)
      toast.success(t(values.status === 'draft' ? 'savedDraft' : 'saved', { name: saved.name }))
      router.push('/products')
    } catch (failure) { setSubmitError(describeApiError(failure)) }
    finally { setSaving(false) }
  }

  const stepIndex = productSteps.findIndex(step => step.id === activeStep)
  const status = watch('status')
  const submitLabel = t(status === 'draft' ? 'saveDraft' : status === 'inactive' ? 'saveInactive' : id ? 'saveChanges' : 'publishProduct')
  const busy = saving || imageBusy
  return <div className="workspace-page products-page product-edit-page"><header className="page-header page-header-form"><div className="page-title-row"><Button variant="outline" className="title-back-button" type="button" aria-label={t('backToProducts')} onClick={() => leave()}><ArrowLeft size={19} /></Button><div><PageBreadcrumbs items={[{ label: t('products'), href: '/products' }, { label: t(id ? 'edit' : 'newProduct') }]} /><h1>{existing ? t('editTitle', { name: existing.name }) : t('addProduct')}</h1><p className="page-description">{t(id ? 'editDescription' : 'newDescription')}</p></div></div></header>
    <form className="product-form" onSubmit={handleSubmit(values => { setProblems([]); void save(values) }, showProblems)} noValidate>
      <div className="product-form-scroll">
        <ProductStepNavigation steps={productSteps} active={activeStep} onChange={setActiveStep} />
        {activeStep === 'basics' && <BasicSection register={register} watch={watch} setValue={setValue} errors={formState.errors} categories={categoryOptions} statuses={statusChoices(existing?.status)} />}
        {activeStep === 'content' && <ContentSection control={form.control} register={register} setValue={setValue} imageUrls={imageUrls} onImageUrl={(assetId, url) => setImageUrls(current => ({ ...current, [assetId]: url }))} onBusyChange={setImageBusy} />}
        {activeStep === 'variants' && <VariantsSection watch={watch} setValue={setValue} />}
        {activeStep === 'selling' && <><PurchaseSection watch={watch} setValue={setValue} />{methods.includes('trial') && <TrialSection watch={watch} setValue={setValue} plans={refs.trialPlans} />}{methods.includes('subscription') && <SubscriptionSection watch={watch} setValue={setValue} rules={refs.rules} />}</>}
        {activeStep === 'delivery' && <DeliverySection watch={watch} setValue={setValue} errors={formState.errors} areas={refs.areas} cutoffRules={refs.cutoffRules} />}
        {problems.length > 0 && <div className="field-error" role="alert"><strong>{t('fixBeforePublishing')}</strong><ul>{problems.map(problem => <li key={`${problem.path}-${problem.message}`}><button type="button" className="text-button" onClick={() => setActiveStep(problem.step)}>{productSteps.find(step => step.id === problem.step)?.label}</button>: {problem.message}</li>)}</ul></div>}{submitError && <p className="field-error" role="alert">{submitError}</p>}
      </div>
      <div className="product-save-bar"><div className="product-step-actions">{stepIndex === 0 ? <Button type="button" variant="outline" className="secondary-button" onClick={() => leave()}>{tc('cancel')}</Button> : <Button type="button" variant="outline" className="secondary-button" onClick={() => setActiveStep(productSteps[stepIndex - 1].id)}>{t('back')}</Button>}<span>{t('stepOf', { step: stepIndex + 1, count: productSteps.length })}</span></div>
        <div className="product-step-actions">{(!existing || existing.status === 'draft') && <Button type="button" variant="outline" className="secondary-button" disabled={busy} onClick={() => { setProblems([]); void save({ ...getValues(), status: 'draft' }) }}>{t(saving ? 'saving' : 'saveAsDraft')}</Button>}{stepIndex < productSteps.length - 1 && <Button type="button" className="primary-button" onClick={() => setActiveStep(productSteps[stepIndex + 1].id)}>{t('continue')}</Button>}{(id || stepIndex === productSteps.length - 1) && <Button type="submit" className="primary-button" disabled={busy}>{saving ? t('saving') : imageBusy ? t('uploadingPicture') : id ? t('saveChanges') : submitLabel}</Button>}</div></div>
    </form>
    <AlertDialog open={guardOpen} onOpenChange={setGuardOpen}>{guardOpen && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">{t('unsavedEyebrow')}</p><AlertDialogTitle>{t('discardTitle')}</AlertDialogTitle><AlertDialogDescription>{t('discardBody')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">{t('stay')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" onClick={() => router.push(pendingDestination)}>{t('discardChanges')}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
  </div>
}
