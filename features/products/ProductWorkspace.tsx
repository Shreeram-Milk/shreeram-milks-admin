'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, CircleOff, Edit2, MoreHorizontal, Plus, Search } from 'lucide-react'
import { Button as AdminButton } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useHydrated } from '@/hooks/useHydrated'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { cutoffRuleService, fulfilmentProfileService, serviceAreaService, subscriptionRuleService, trialPlanService } from '../configuration/mock-store'
import { categoryService } from '../categories/service'
import { productService } from './service'
import { productSchema, type ProductFormValues } from './schema'
import type { Product } from './types'
import { BasicSection, FulfilmentSection, ProductionSection, ProductReviewSummary, PurchaseSection, SubscriptionSection, TrialSection, VariantsSection } from './components/ProductSections'
import { ProductStepNavigation, type ProductStep, type ProductStepId } from './components/ProductStepNavigation'

const productSteps: ProductStep[] = [
  { id: 'basics', label: 'Basics', description: 'Product name, category, status, and description.' },
  { id: 'variants', label: 'Variants', description: 'Variant labels, prices, and production conversion.' },
  { id: 'selling', label: 'Selling', description: 'Purchase methods, trial plans, and subscription schedules.' },
  { id: 'fulfilment', label: 'Fulfilment', description: 'Choose a reusable fulfilment profile.' },
  { id: 'production', label: 'Production', description: 'Review profile eligibility and conversion metadata.' },
  { id: 'review', label: 'Review', description: 'Check the product setup before saving or publishing.' },
]

type Mode = 'list' | 'new' | 'detail' | 'edit'
export function ProductWorkspace({ segments = [] }: { segments?: string[] }) {
  const hydrated = useHydrated()
  if (!hydrated) return <PageSkeleton />
  const mode: Mode = segments.length === 0 ? 'list' : segments[0] === 'new' ? 'new' : segments[1] === 'edit' ? 'edit' : 'detail'
  const productId = mode === 'detail' || mode === 'edit' ? segments[0] : undefined
  if (mode === 'new' || mode === 'edit') return <ProductForm key={`${mode}-${productId ?? 'new'}`} id={productId} />
  if (mode === 'detail' && productId) return <ProductDetail id={productId} />
  return <ProductList />
}

function ProductList() {
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [profile, setProfile] = useState('')
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<Product | null>(null)
  const [failed, setFailed] = useState(false)
  const pageSize = 8
  const products = useMemo(() => { void revision; try { return productService.list() } catch { return [] } }, [revision])
  const profiles = fulfilmentProfileService.list()
  const categories = categoryService.list()
  const filtered = products.filter(product => (!query || `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())) && (!category || product.categoryId === category) && (!status || product.status === status) && (!method || product.purchaseMethods.includes(method as Product['purchaseMethods'][number])) && (!profile || product.fulfilmentProfileId === profile))
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const statusLabel = (value: Product['status']) => value === 'draft' ? 'Draft · Unpublished' : value === 'active' ? 'Active' : 'Inactive'
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Catalog' }, { label: 'Products' }]} /><h1>Products</h1><p className="page-description">Manage products, selling options, fulfilment, and availability.</p></div>
      <Link className="primary-button" href="/products/new"><Plus size={15} /> Add Product</Link>
    </header>
    <section className="product-list-section">
      <label className="workspace-search"><Search size={17} aria-hidden="true" /><Input className="workspace-search-input" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Search by name or SKU..." /></label>
      <div className="product-filter-row">
        <SelectField label="Category" className="product-select-trigger" value={category} onChange={value => setCategory(value === '__all__' ? '' : value)} placeholder="All categories" options={[{ value: '__all__', label: 'All categories' }, ...categories.map(item => ({ value: item.id, label: item.name }))]} />
        <SelectField label="Status" className="product-select-trigger" value={status} onChange={value => setStatus(value === '__all__' ? '' : value)} placeholder="All statuses" options={[{ value: '__all__', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'draft', label: 'Draft' }]} />
        <SelectField label="Purchase method" className="product-select-trigger" value={method} onChange={value => setMethod(value === '__all__' ? '' : value)} placeholder="All purchase methods" options={[{ value: '__all__', label: 'All purchase methods' }, { value: 'buy_once', label: 'Buy Once' }, { value: 'trial', label: 'Trial' }, { value: 'subscription', label: 'Subscription' }]} />
        <SelectField label="Fulfilment profile" className="product-select-trigger" value={profile} onChange={value => setProfile(value === '__all__' ? '' : value)} placeholder="All fulfilment" options={[{ value: '__all__', label: 'All fulfilment' }, ...profiles.map(item => ({ value: item.id, label: item.name }))]} />
      </div>
      {failed ? <div className="product-state"><strong>Products could not be loaded.</strong><AdminButton className="secondary-button" onClick={() => { setFailed(false); setRevision(value => value + 1) }}>Try again</AdminButton></div>
        : !products.length ? <div className="product-state"><strong>No products yet</strong><span>Add a product to begin managing your catalog.</span><Link className="primary-button" href="/products/new"><Plus size={14} /> Add Product</Link></div>
          : !filtered.length ? <div className="product-state"><strong>No products match these filters</strong><span>Try changing your search or filters.</span><AdminButton className="secondary-button" onClick={() => { setQuery(''); setCategory(''); setStatus(''); setMethod(''); setProfile('') }}>Clear filters</AdminButton></div>
            : <>
              <div className="table-card product-list-table-card"><Table className="config-table product-table">
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Variants</TableHead><TableHead>Purchase Methods</TableHead><TableHead>Fulfilment</TableHead><TableHead>Production</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="product-actions-column">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{rows.map(item => {
                  const profileDetails = profiles.find(entry => entry.id === item.fulfilmentProfileId)
                  return <TableRow key={item.id}>
                    <TableCell><Link className="product-name-link" href={`/products/${item.id}`}>{item.name}</Link>{item.sku && <small>{item.sku}</small>}</TableCell>
                    <TableCell>{categoryService.name(item.categoryId) || '—'}</TableCell>
                    <TableCell className="product-wrap-cell">{item.variants.map(row => row.name).filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell className="product-wrap-cell">{item.purchaseMethods.map(labelMethod).join(', ') || '—'}</TableCell>
                    <TableCell className="product-wrap-cell">{profileDetails?.name ?? 'Not set'}</TableCell>
                    <TableCell>{profileDetails?.includeInProductionPlanning ? 'Enabled' : 'Disabled'}</TableCell>
                    <TableCell><StatusBadge status={item.status}>{statusLabel(item.status)}</StatusBadge></TableCell>
                    <TableCell>{formatTimestamp(item.updatedAt)}</TableCell>
                    <TableCell><div className="row-actions product-row-actions">
                      <Link href={`/products/${item.id}/edit`} className="row-edit-action" aria-label={`Edit ${item.name}`}><Edit2 size={15} /></Link>
                      <DropdownMenu><DropdownMenuTrigger asChild><AdminButton variant="ghost" size="icon" className="row-menu" aria-label={`More actions for ${item.name}`}><MoreHorizontal size={16} /></AdminButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/products/${item.id}/edit`}><Edit2 /> Edit product</Link></DropdownMenuItem>{item.status !== 'inactive' && <DropdownMenuItem onSelect={() => setConfirm(item)}><CircleOff /> Deactivate</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
                    </div></TableCell>
                  </TableRow>
                })}</TableBody>
              </Table></div>
              <div className="product-pagination"><span>{filtered.length} products · Page {page} of {pageCount}</span><TablePagination page={page} pageCount={pageCount} onPageChange={setPage} density="compact" /></div>
            </>}
    </section>
    <AlertDialog open={Boolean(confirm)} onOpenChange={open => { if (!open) setConfirm(null) }}>{confirm && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Product deactivation</p><AlertDialogTitle>Deactivate “{confirm.name}”?</AlertDialogTitle><AlertDialogDescription asChild><div><p>This product is currently referenced by:</p><ul><li>Mock active subscription and delivery references</li><li>Historical orders and deliveries will remain unchanged</li></ul><p className="warning-note">New purchases and subscriptions will no longer be allowed. Existing historical records are preserved.</p></div></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton variant="outline" className="secondary-button">Cancel</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton className="primary-button" onClick={() => { productService.setStatus(confirm.id, 'inactive'); toast.success('Product deactivated.'); setConfirm(null); setRevision(value => value + 1) }}>Deactivate</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
  </div>
}

function ProductForm({ id }: { id?: string }) {
  const router = useRouter()
  const existing = id ? productService.getById(id) : undefined
  const [guardOpen, setGuardOpen] = useState(false)
  const [pendingDestination, setPendingDestination] = useState('/products')
  const [activeStep, setActiveStep] = useState<ProductStepId>('basics')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [saveConfirmation, setSaveConfirmation] = useState<ProductFormValues | null>(null)
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues: existing ? toForm(existing) : emptyForm(), mode: 'onSubmit' })
  const { register, handleSubmit, formState, watch, setValue, getValues } = form
  const methods = watch('purchaseMethods')
  const trialPlans = trialPlanService.list()
  const subscriptionRules = subscriptionRuleService.list()
  const profiles = useProductProfiles()
  const isDirty = formState.isDirty
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
  const save = async (values: ProductFormValues) => {
    setSaving(true); setSubmitError('')
    try { const saved = productService.save({ ...values, id }); form.reset(values); toast.success(values.status === 'draft' ? 'Product saved as draft.' : 'Product saved.'); router.push(`/products/${saved.id}`) }
    catch (error) { setSubmitError(error instanceof Error ? error.message : 'Unable to save product.') }
    finally { setSaving(false) }
  }
  const requestSaveConfirmation = (values: ProductFormValues) => setSaveConfirmation(values)
  if (id && !existing) return <div className="product-state"><strong>Product not found</strong><Link className="secondary-button" href="/products">Back to products</Link></div>
  const stepIndex = productSteps.findIndex(step => step.id === activeStep)
  const profileDetails = profiles.find(profile => profile.id === watch('fulfilmentProfileId'))
  const submitLabel = watch('status') === 'draft' ? 'Save Draft' : watch('status') === 'inactive' ? 'Save Inactive Product' : id ? 'Save Changes' : 'Publish Product'
  return <div className="workspace-page products-page product-edit-page"><header className="page-header page-header-form"><div className="page-title-row"><AdminButton variant="outline" className="title-back-button" type="button" aria-label="Back to products" onClick={() => leave()}><ArrowLeft size={19} /></AdminButton><div><PageBreadcrumbs items={[{ label: 'Products', href: '/products' }, { label: id ? 'Edit' : 'New product' }]} /><h1>{id ? `Edit ${existing?.name}` : 'Add Product'}</h1><p className="page-description">{id ? 'Update product details and selling options.' : 'Create a product with the capabilities and fulfilment it needs.'}</p></div></div></header>
    <form className="product-form" onSubmit={handleSubmit(requestSaveConfirmation)} noValidate>
      <div className="product-form-scroll">
        <ProductStepNavigation steps={productSteps} active={activeStep} onChange={setActiveStep} />
        {activeStep === 'basics' && <BasicSection register={register} watch={watch} setValue={setValue} categories={categoryService.options(existing?.categoryId)} />}
        {activeStep === 'variants' && <VariantsSection watch={watch} setValue={setValue} showProduction={Boolean(profileDetails?.includeInProductionPlanning)} />}
        {activeStep === 'selling' && <><PurchaseSection watch={watch} setValue={setValue} />{methods.includes('trial') && <TrialSection watch={watch} setValue={setValue} plans={trialPlans} />}{methods.includes('subscription') && <SubscriptionSection watch={watch} setValue={setValue} rules={subscriptionRules} />}</>}
        {activeStep === 'fulfilment' && <FulfilmentSection watch={watch} setValue={setValue} profiles={profiles} />}
        {activeStep === 'production' && <ProductionSection watch={watch} />}
        {activeStep === 'review' && <ProductReviewSummary values={getValues()} categoryName={categoryService.name(getValues('categoryId'))} profileName={profileDetails?.name ?? 'Not selected'} productionEnabled={Boolean(profileDetails?.includeInProductionPlanning)} />}
        {Object.keys(formState.errors).length > 0 && <p className="field-error">Please review the highlighted fields and required configuration before publishing.</p>}{submitError && <p className="field-error">{submitError}</p>}
      </div>
      <div className="product-save-bar"><div className="product-step-actions">{stepIndex === 0 ? <AdminButton type="button" variant="outline" className="secondary-button" onClick={() => leave()}>Cancel</AdminButton> : <AdminButton type="button" variant="outline" className="secondary-button" onClick={() => setActiveStep(productSteps[stepIndex - 1].id)}>Back</AdminButton>}<span>Step {stepIndex + 1} of {productSteps.length}</span></div><div className="product-step-actions"><AdminButton type="button" variant="outline" className="secondary-button" disabled={saving} onClick={() => setSaveConfirmation({ ...getValues(), status: 'draft' })}>{saving ? 'Saving…' : 'Save as Draft'}</AdminButton>{stepIndex < productSteps.length - 1 && <AdminButton type="button" className="primary-button" onClick={() => setActiveStep(productSteps[stepIndex + 1].id)}>Continue</AdminButton>}{(id || stepIndex === productSteps.length - 1) && <AdminButton type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : id ? 'Save Changes' : submitLabel}</AdminButton>}</div></div>
    </form><AlertDialog open={saveConfirmation !== null} onOpenChange={open => { if (!open) setSaveConfirmation(null) }}>{saveConfirmation && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">{saveConfirmation.status === 'draft' ? 'Save draft' : id ? 'Update product' : 'Publish product'}</p><AlertDialogTitle>{saveConfirmation.status === 'draft' ? 'Save this product as a draft?' : id ? `Save changes to “${existing?.name}”?` : `Publish “${saveConfirmation.name}”?`}</AlertDialogTitle><AlertDialogDescription>{saveConfirmation.status === 'draft' ? 'Your product setup will be saved as an unpublished draft.' : id ? 'This will update the product using the values in this form.' : 'This product will become available according to its status and purchase settings.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton type="button" variant="outline" className="secondary-button">Review again</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton type="button" className="primary-button" disabled={saving} onClick={() => { const pendingSave = saveConfirmation; setSaveConfirmation(null); if (pendingSave) void save(pendingSave) }}>{saveConfirmation.status === 'draft' ? 'Save Draft' : id ? 'Update Product' : 'Publish Product'}</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog><AlertDialog open={guardOpen} onOpenChange={setGuardOpen}>{guardOpen && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Unsaved changes</p><AlertDialogTitle>Discard unsaved product changes?</AlertDialogTitle><AlertDialogDescription>Your unsaved changes will be lost.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton variant="outline" className="secondary-button">Stay</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton className="primary-button" onClick={() => router.push(pendingDestination)}>Discard Changes</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog></div>
}

function ProductDetail({ id }: { id: string }) {
  const router = useRouter()
  const product = productService.getById(id)
  const references = productService.references()
  const profiles = useProductProfiles()
  const [confirm, setConfirm] = useState(false)
  const [inactive, setInactive] = useState(product?.status === 'inactive')
  if (!product) return <div className="product-state"><strong>Product not found</strong><Link className="secondary-button" href="/products">Back to products</Link></div>
  const profile = profiles.find(item => item.id === product.fulfilmentProfileId)
  return (
    <div className="workspace-page products-page">
      <header className="page-header page-header-form">
        <div className="page-title-row">
          <AdminButton variant="outline" className="title-back-button" onClick={() => router.push('/products')} aria-label="Back to products"><ArrowLeft size={19} /></AdminButton>
          <div><PageBreadcrumbs items={[{ label: 'Products', href: '/products' }, { label: product.name }]} /><h1>{product.name}</h1><p className="page-description">{product.shortDescription || 'Review product details, purchase methods, and fulfilment.'}</p></div>
        </div>
        <div className="header-actions">
          <StatusBadge status={inactive ? 'inactive' : product.status}>{inactive ? 'inactive' : product.status === 'draft' ? 'Draft · Unpublished' : product.status}</StatusBadge>
          <Link className="primary-button" href={`/products/${id}/edit`}><Edit2 size={15} /> Edit Product</Link>
          {!inactive && <AdminButton className="secondary-button" onClick={() => setConfirm(true)}>Deactivate</AdminButton>}
        </div>
      </header>
      <div className="product-detail-grid">
        <section className="form-card"><h2>Product overview</h2><div className="product-detail-rows"><Summary label="Category" value={categoryService.name(product.categoryId) || '—'} /><Summary label="Gujarati name" value={product.nameGujarati || '—'} /><Summary label="SKU" value={product.sku || '—'} /><Summary label="Purchase methods" value={product.purchaseMethods.map(labelMethod).join(', ') || '—'} /><Summary label="Updated" value={formatTimestamp(product.updatedAt)} /></div></section>
        <section className="form-card"><h2>Variants &amp; pricing</h2>{product.variants.length ? <div className="product-table-wrap"><Table className="config-table"><TableHeader><TableRow><TableHead>Variant</TableHead><TableHead>Price</TableHead><TableHead>Display</TableHead><TableHead>Production conversion</TableHead></TableRow></TableHeader><TableBody>{product.variants.map(variant => <TableRow key={variant.id}><TableCell>{variant.name}</TableCell><TableCell>{formatINR(variant.pricePaise)}</TableCell><TableCell>{variant.displayQuantity} {variant.displayUnit}</TableCell><TableCell>{variant.productionUnit ? `${variant.productionQuantity} ${variant.productionUnit}` : 'Disabled'}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="product-hint">No variants saved.</p>}</section>
        {product.purchaseMethods.includes('trial') && <section className="form-card"><h2>Trial plans</h2><ReferenceNames ids={product.trialPlanIds} rows={references.trialPlans} /></section>}
        {product.purchaseMethods.includes('subscription') && <section className="form-card"><h2>Subscription schedules</h2><ReferenceNames ids={product.subscriptionRuleIds} rows={references.subscriptionRules} /></section>}
        <section className="form-card"><h2>Fulfilment profile</h2>{profile ? <><strong>{profile.name}{profile.status === 'inactive' && <em className="product-inactive">Inactive</em>}</strong><div className="product-detail-rows"><Summary label="Delivery" value={profile.deliveryMethod === 'local_delivery' ? 'Local Delivery' : 'Shipping'} /><Summary label="Coverage" value={profile.serviceAreaName} /><Summary label="Slots" value={profile.deliveryMethod === 'local_delivery' ? 'Based on customer PIN code' : 'Not applicable'} /><Summary label="Cut-off" value={profile.cutoffRuleName} /><Summary label="Production Planning" value={profile.includeInProductionPlanning ? 'Enabled' : 'Disabled'} /></div></> : <p className="product-hint">No fulfilment profile selected.</p>}</section>
        <section className="form-card"><h2>Production planning</h2><p>{profile?.includeInProductionPlanning ? 'Enabled by the selected fulfilment profile.' : 'Disabled by the selected fulfilment profile.'}</p></section>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>{confirm && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Product deactivation</p><AlertDialogTitle>Deactivate “{product.name}”?</AlertDialogTitle><AlertDialogDescription>Existing historical records will remain unchanged. New purchases and subscriptions will no longer be allowed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton variant="outline" className="secondary-button">Cancel</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton className="primary-button" onClick={() => { productService.setStatus(id, 'inactive'); toast.success('Product deactivated.'); setInactive(true) }}>Deactivate</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
    </div>
  )
}

function useProductProfiles() {
  return useMemo(() => {
    const areas = serviceAreaService.list(); const cutoffs = cutoffRuleService.list()
    return fulfilmentProfileService.list().map(profile => ({ ...profile, serviceAreaName: areas.find(area => area.id === profile.serviceAreaId)?.name ?? 'Unavailable area', cutoffRuleName: cutoffs.find(rule => rule.id === profile.cutoffRuleId)?.name ?? 'None' }))
  }, [])
}
function ReferenceNames<T extends { id: string; name: string; status: string }>({ ids, rows }: { ids: string[]; rows: T[] }) { return <ul className="product-reference-list">{ids.length ? ids.map(id => { const row = rows.find(item => item.id === id); return <li key={id}>{row?.name ?? 'Unavailable configuration'}{row?.status === 'inactive' && <em className="product-inactive">Inactive</em>}</li> }) : <li>None selected</li>}</ul> }
function Summary({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
function emptyForm(): ProductFormValues { return { name: '', nameGujarati: '', categoryId: '', sku: '', shortDescription: '', shortDescriptionGujarati: '', imageUrl: '', status: 'active', variants: [], purchaseMethods: [], trialPlanIds: [], subscriptionRuleIds: [], fulfilmentProfileId: '' } }
function toForm(product: Product): ProductFormValues { return { ...product, status: product.status === 'inactive' ? 'active' : product.status } }
function labelMethod(value: string) { return value === 'buy_once' ? 'Buy Once' : value === 'trial' ? 'Trial' : 'Subscription' }
