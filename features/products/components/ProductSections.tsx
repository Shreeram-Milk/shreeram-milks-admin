'use client'

import { useState, type ReactNode } from 'react'
import { useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue, type UseFormWatch } from 'react-hook-form'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import type { CutoffRule, DeliveryMethod, ServiceArea, SubscriptionRule, TrialPlan } from '../../configuration/api'
import { newVariant, type FormVariant, type ProductFormValues } from '../schema'
import type { ProductStatus } from '../api'
import { MAX_HIGHLIGHT_LENGTH, MAX_HIGHLIGHTS, PRODUCT_BADGE_LABELS, type ProductBadge } from '../types'
import { GalleryField } from './GalleryField'
import { ProductSelect } from './ProductSelect'
import { suggestedProduction, unitOptions } from '../units'
import { ImageUploadField } from '@/components/shared/ImageUploadField'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { Button as AdminButton } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatINR, paiseToRupeeInput, parseRupeesToPaise } from '@/lib/money'

const STATUS_LABELS: Record<ProductStatus, string> = { draft: 'Draft · Unpublished', active: 'Active', inactive: 'Inactive' }

/** "12 / 200" under a field, so the limit is visible while typing. */
const counter = (text: string, max: number) => `${text.length} / ${max} characters`

export function BasicSection({ register, watch, setValue, errors, categories, statuses }: { register: UseFormRegister<ProductFormValues>; errors: FieldErrors<ProductFormValues>; watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; categories: Array<{ value: string; label: string }>; statuses: ProductStatus[] }) {
  return <Section number="01" title="About the product" description="Its name, its shelf (category) in the app, and a short line about it.">
    <div className="product-grid">
      <FormField label="Product name *" error={errors.name?.message}><Input {...register('name')} placeholder="Fresh Cow Milk" /></FormField>
      <FormField label="Category *" error={errors.categoryId?.message}><ProductSelect label="Category" value={watch('categoryId')} onChange={value => setValue('categoryId', value, { shouldDirty: true, shouldValidate: true })} placeholder="Select a category" options={categories} /></FormField>
      <FormField label="SKU"><Input {...register('sku')} placeholder="Optional" /></FormField>
      <FormField label="Gujarati name" helper={counter(watch('nameGu'), 80)}><Input maxLength={80} {...register('nameGu')} placeholder="તાજું ગાયનું દૂધ" /></FormField>
      <FormField label="Short description" helper={counter(watch('shortDescriptionEn'), 200)}><Input maxLength={200} {...register('shortDescriptionEn')} placeholder="A short description for staff and customers" /></FormField>
      <FormField label="Gujarati short description" helper={counter(watch('shortDescriptionGu'), 200)}><Input maxLength={200} {...register('shortDescriptionGu')} placeholder="ગુજરાતીમાં ટૂંકું વર્ણન" /></FormField>
      <FormField label="Status"><ProductSelect label="Status" value={watch('status')} onChange={value => setValue('status', value as ProductFormValues['status'], { shouldDirty: true })} placeholder="Select status" options={statuses.map(value => ({ value, label: STATUS_LABELS[value] }))} /></FormField>
    </div>
  </Section>
}

/** Each size customers can buy and its price. A product made in the dairy also says how much each size uses up, for the daily plan. */
export function VariantsSection({ watch, setValue }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues> }) {
  const variants = watch('variants')
  const deliveryMethod = watch('deliveryMethod')
  const hasCutoff = Boolean(watch('cutoffRuleId'))
  // The daily plan exists to know how much to make before orders close, so only products we deliver ourselves with an order-by time belong in it.
  const canPlan = deliveryMethod === 'local_delivery' && hasCutoff
  const showProduction = watch('includeInProductionPlanning') && canPlan
  const courier = deliveryMethod === 'shipping'
  const [editor, setEditor] = useState<{ index: number | null; value: FormVariant } | null>(null)
  const [editorError, setEditorError] = useState('')
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const openEditor = (index: number | null) => {
    setEditorError('')
    setEditor({ index, value: index === null ? newVariant() : { ...variants[index] } })
  }
  /** Changes the size, and keeps the "uses for making" amount in step with it until the admin types their own. */
  const changeSize = (patch: Pick<Partial<FormVariant>, 'displayUnit' | 'displayQuantity'>) => setEditor(current => {
    if (!current) return current
    const before = current.value
    const next = { ...before, ...patch }
    const suggestedBefore = suggestedProduction(before.displayUnit, before.displayQuantity)
    const untouched = !before.productionUnit || (before.productionUnit === suggestedBefore.productionUnit && before.productionQuantity === suggestedBefore.productionQuantity)
    return { ...current, value: showProduction && untouched && next.displayUnit ? { ...next, ...suggestedProduction(next.displayUnit, next.displayQuantity) } : next }
  })
  /** Ticking the daily plan fills in the amounts for sizes that have none yet. */
  const toggleProduction = (on: boolean) => {
    setValue('includeInProductionPlanning', on, { shouldDirty: true })
    if (on) setValue('variants', variants.map(variant => (variant.productionUnit || !variant.displayUnit ? variant : { ...variant, ...suggestedProduction(variant.displayUnit, variant.displayQuantity) })), { shouldDirty: true })
  }
  const saveEditor = () => {
    if (!editor) return
    if (!editor.value.name.trim() || !editor.value.displayUnit.trim() || editor.value.pricePaise <= 0 || editor.value.displayQuantity <= 0) {
      setEditorError('Enter a size name, a price above ₹0, a unit, and an amount greater than zero.')
      return
    }
    if (showProduction && (!editor.value.productionUnit.trim() || editor.value.productionQuantity <= 0)) {
      setEditorError('This product is in the daily production plan, so say how much one item uses (a unit and an amount greater than zero).')
      return
    }
    if (editor.value.compareAtPricePaise !== null && editor.value.compareAtPricePaise <= editor.value.pricePaise) {
      setEditorError('The old price must be higher than the selling price, or left empty.')
      return
    }
    const next = editor.index === null ? [...variants, editor.value] : variants.map((variant, index) => index === editor.index ? editor.value : variant)
    setValue('variants', next, { shouldDirty: true, shouldValidate: true })
    setEditor(null)
  }
  const removeVariant = (index: number) => setValue('variants', variants.filter((_, rowIndex) => rowIndex !== index), { shouldDirty: true, shouldValidate: true })
  const missingAmounts = showProduction ? variants.filter(variant => !variant.productionUnit || variant.productionQuantity <= 0).length : 0

  return <Section number="03" title="Sizes & prices" description="Each size customers can buy, like 500 ml or 1 litre, and its price." action={<AdminButton type="button" className="section-add-button" onClick={() => openEditor(null)}><Plus size={14} /> Add size</AdminButton>}>
    {!canPlan
      ? <p className="product-hint">{courier ? 'Courier products are not part of the daily production plan.' : deliveryMethod === 'local_delivery' ? 'To count this product in the daily production plan, choose an order-by time in the Delivery step. The plan only covers products that have one.' : 'Choose how this product is delivered (Delivery step) to see if it can be counted in the daily production plan.'}</p>
      : <label className={`production-choice${showProduction ? ' is-on' : ''}`}><Checkbox checked={showProduction} onCheckedChange={checked => toggleProduction(checked === true)} /><span><strong>We make this product: count it in the daily production plan</strong><small>{showProduction ? 'Each size then says how much it uses, for example 0.5 Litre for a 500 ml bottle. It is filled in for you from the size.' : 'Leave this off for products you buy ready-made.'}</small></span></label>}
    {missingAmounts > 0 ? <p className="field-error" role="alert">{missingAmounts === 1 ? '1 size has' : `${missingAmounts} sizes have`} no &quot;uses for making&quot; amount yet. Edit {missingAmounts === 1 ? 'it' : 'them'} to add one.</p> : null}
    <div className="repeatable-table-shell"><Table className="variant-table"><TableHeader><TableRow><TableHead>Size</TableHead><TableHead>Price</TableHead><TableHead>Customers see</TableHead>{showProduction && <TableHead>Uses for making</TableHead>}<TableHead className="table-actions-heading">Actions</TableHead></TableRow></TableHeader><TableBody>
      {variants.map((variant, index) => <TableRow key={variant.clientKey}>
        <TableCell data-label="Size" className="variant-name-cell">{variant.name || 'Unnamed size'}{variant.status === 'inactive' && <em className="product-inactive">Not sold</em>}{variant.sku ? <small className="cell-note">SKU {variant.sku}</small> : null}</TableCell><TableCell data-label="Price" className="value-emphasis">{formatINR(variant.pricePaise)}{variant.compareAtPricePaise !== null && <small className="cell-note">was {formatINR(variant.compareAtPricePaise)}</small>}</TableCell><TableCell data-label="Customers see">{variant.displayQuantity} {variant.displayUnit || '—'}</TableCell>{showProduction && <TableCell data-label="Uses for making">{variant.productionUnit ? `${variant.productionQuantity} ${variant.productionUnit}` : <span className="field-error">Missing</span>}</TableCell>}<TableCell data-label="Actions"><RowActions editLabel={`Edit ${variant.name || 'size'}`} deleteLabel={`Remove ${variant.name || 'size'}`} onEdit={() => openEditor(index)} onDelete={() => setDeleteIndex(index)} /></TableCell>
      </TableRow>)}
      {variants.length === 0 && <TableRow><TableCell colSpan={showProduction ? 5 : 4}><EmptyRows>No sizes yet. Press “Add size” to add the first one, like 500 ml.</EmptyRows></TableCell></TableRow>}
    </TableBody></Table></div>
    <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null) }}>
      {editor && <DialogContent className="record-editor-dialog"><DialogHeader><DialogTitle>{editor.index === null ? 'Add a size' : 'Edit size'}</DialogTitle><DialogDescription>The size, its price, and what customers see.</DialogDescription></DialogHeader>
        <div className="record-editor-fields">
          <FormField className="form-field" label="Size name *" helper="What customers pick, for example 500 ml."><Input autoFocus value={editor.value.name} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, name: event.target.value } } : current)} placeholder="500 ml" /></FormField>
          <FormField className="form-field" label="Selling price (₹) *"><Input type="number" min="0" step="0.01" value={paiseToRupeeInput(editor.value.pricePaise)} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, pricePaise: parseRupeesToPaise(event.target.value.replace(/\.$/, '')) ?? 0 } } : current)} /></FormField>
          <FormField className="form-field" label="Unit *" helper="For example Millilitre."><ProductSelect label="Unit" value={editor.value.displayUnit} options={unitOptions(editor.value.displayUnit)} placeholder="Choose a unit" onChange={value => changeSize({ displayUnit: value })} /></FormField>
          <FormField className="form-field" label="Amount *" helper="For example 500."><Input type="number" min="0.01" step="any" value={editor.value.displayQuantity} onChange={event => changeSize({ displayQuantity: Number(event.target.value || 0) })} /></FormField>
          {showProduction && <><FormField className="form-field" label="Uses for making: unit *" helper="Filled in from the size. Change it only if it is different."><ProductSelect label="Uses for making: unit" value={editor.value.productionUnit} options={unitOptions(editor.value.productionUnit)} placeholder="Choose a unit" onChange={value => setEditor(current => current ? { ...current, value: { ...current.value, productionUnit: value } } : current)} /></FormField><FormField className="form-field" label="Uses for making: amount *" helper="For example 0.5 for a 500 ml bottle."><Input type="number" min="0" step="any" value={editor.value.productionQuantity} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, productionQuantity: Number(event.target.value || 0) } } : current)} /></FormField></>}
          <FormField className="form-field" label="Old price (₹)" helper="Optional. Shown crossed out next to the selling price."><Input type="number" min="0" step="0.01" value={editor.value.compareAtPricePaise === null ? '' : paiseToRupeeInput(editor.value.compareAtPricePaise)} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, compareAtPricePaise: event.target.value.trim() === '' ? null : parseRupeesToPaise(event.target.value.replace(/\.$/, '')) } } : current)} /></FormField>
          <FormField className="form-field" label="SKU" helper="Optional stock code."><Input value={editor.value.sku} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, sku: event.target.value } } : current)} placeholder="Optional" /></FormField>
          <FormField className="form-field" label="Sold now?"><ProductSelect label="Sold now?" value={editor.value.status} onChange={value => setEditor(current => current ? { ...current, value: { ...current.value, status: value === 'inactive' ? 'inactive' : 'active' } } : current)} placeholder="Choose" options={[{ value: 'active', label: 'Yes, customers can buy it' }, { value: 'inactive', label: 'No, hide it for now' }]} /></FormField>
        </div>
        {editorError && <p className="field-error" role="alert">{editorError}</p>}
        <DialogFooter><AdminButton type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</AdminButton><AdminButton type="button" onClick={saveEditor}>Save size</AdminButton></DialogFooter>
      </DialogContent>}
    </Dialog>
    <AlertDialog open={deleteIndex !== null} onOpenChange={open => { if (!open) setDeleteIndex(null) }}>
      {deleteIndex !== null && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Remove size</p><AlertDialogTitle>Remove “{variants[deleteIndex]?.name || 'Unnamed size'}”?</AlertDialogTitle><AlertDialogDescription>When you save, this size is switched off and no longer sold. It is kept, not deleted, so past orders still show it. You can switch it on again by editing it.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton type="button" variant="outline" className="secondary-button">Cancel</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton type="button" className="primary-button destructive-button" onClick={() => { removeVariant(deleteIndex); setDeleteIndex(null) }}>Remove size</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}
    </AlertDialog>
  </Section>
}

export function PurchaseSection({ watch, setValue }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues> }) {
  const selected = watch('purchaseMethods')
  // Trials and subscriptions need a delivery window every day, which a courier does not have.
  const courier = watch('deliveryMethod') === 'shipping'
  return <Section number="04" title="How it is sold" description="Tick every way customers can buy it."><div className="product-methods">{([['buy_once', 'Buy Once'], ['trial', 'Trial'], ['subscription', 'Subscription']] as const).map(([value, label]) => { const locked = courier && value !== 'buy_once'; return <label className={`product-check${locked ? ' is-disabled' : ''}`} key={value}><Checkbox disabled={locked} checked={!locked && selected.includes(value)} onCheckedChange={checked => setValue('purchaseMethods', checked === true ? [...selected, value] : selected.filter(item => item !== value), { shouldDirty: true })} /><span>{label}</span></label> })}</div><p className="product-hint">{courier ? 'Courier products can only be bought once. Trial and Subscription are for products you deliver yourself.' : 'At least one purchase method is required to publish.'}</p><label className="product-check product-check-row"><Checkbox checked={watch('excludedFromCredit')} onCheckedChange={checked => setValue('excludedFromCredit', checked === true, { shouldDirty: true })} /> Not available on credit</label><p className="product-hint">Tick this to stop credit customers buying this product on credit. They must pay for it when they order. Everyone else is unaffected.</p></Section>
}

export function TrialSection({ watch, setValue, plans }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; plans: TrialPlan[] }) {
  return <AssignmentSection number="4a" title="Trial packs offered" description="Which trial packs customers can pick. Packs are made in Setup → Trial Plans." itemLabel="trial plan" records={plans} selectedIds={watch('trialPlanIds')} onChange={ids => setValue('trialPlanIds', ids, { shouldDirty: true, shouldValidate: true })} detailHeading="Duration" detail={plan => `${plan.durationDays} days`} />
}

export function SubscriptionSection({ watch, setValue, rules }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; rules: SubscriptionRule[] }) {
  return <AssignmentSection number="4b" title="Subscription plans offered" description="Which repeat plans customers can pick. Plans are made in Setup → Subscription Rules." itemLabel="subscription rule" records={rules} selectedIds={watch('subscriptionRuleIds')} onChange={ids => setValue('subscriptionRuleIds', ids, { shouldDirty: true, shouldValidate: true })} detailHeading="Schedule" detail={rule => rule.systemType === 'alternate_days' ? 'Alternate days' : rule.systemType === 'custom_weekdays' ? 'Custom weekdays' : 'Daily'} />
}

type AssignmentRecord = TrialPlan | SubscriptionRule
function AssignmentSection<T extends AssignmentRecord>({ number, title, description, itemLabel, records, selectedIds, onChange, detailHeading, detail }: { number: string; title: string; description: string; itemLabel: string; records: T[]; selectedIds: string[]; onChange: (ids: string[]) => void; detailHeading: string; detail: (record: T) => string }) {
  const [editorIndex, setEditorIndex] = useState<number | 'add' | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [draftId, setDraftId] = useState('')
  const selectedRecords = selectedIds.map(id => records.find(record => record.id === id)).filter((record): record is T => Boolean(record))
  const availableRecords = records.filter(record => record.status === 'active' && (!selectedIds.includes(record.id) || (typeof editorIndex === 'number' && selectedIds[editorIndex] === record.id)))
  const openAdd = () => { const first = records.find(record => record.status === 'active' && !selectedIds.includes(record.id)); setDraftId(first?.id ?? ''); setEditorIndex('add') }
  const openEdit = (index: number) => { setDraftId(selectedIds[index] ?? ''); setEditorIndex(index) }
  const save = () => { if (!draftId) return; if (editorIndex === 'add') onChange([...selectedIds, draftId]); else if (typeof editorIndex === 'number') onChange(selectedIds.map((id, index) => index === editorIndex ? draftId : id)); setEditorIndex(null) }
  const canAdd = records.some(record => record.status === 'active' && !selectedIds.includes(record.id))

  return <Section number={number} title={title} description={description} action={<AdminButton type="button" className="section-add-button" onClick={openAdd} disabled={!canAdd}><Plus size={14} /> Add {itemLabel}</AdminButton>}>
    <div className="repeatable-table-shell"><Table className="assignment-table"><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>{detailHeading}</TableHead><TableHead>Status</TableHead><TableHead className="table-actions-heading">Actions</TableHead></TableRow></TableHeader><TableBody>
      {selectedRecords.map((record, index) => <TableRow key={record.id}><TableCell data-label="Name" className="variant-name-cell">{record.name}</TableCell><TableCell data-label={detailHeading}>{detail(record)}</TableCell><TableCell data-label="Status"><StatusBadge status={record.status}>{record.status === 'active' ? 'Active' : 'Inactive'}</StatusBadge></TableCell><TableCell data-label="Actions"><RowActions editLabel={`Edit ${record.name}`} deleteLabel={`Remove ${record.name}`} onEdit={() => openEdit(index)} onDelete={() => setDeleteIndex(index)} /></TableCell></TableRow>)}
      {selectedRecords.length === 0 && <TableRow><TableCell colSpan={4}><EmptyRows>No {itemLabel}s assigned. Use Add {itemLabel} to create the first assignment.</EmptyRows></TableCell></TableRow>}
    </TableBody></Table></div>
    <Dialog open={editorIndex !== null} onOpenChange={open => { if (!open) setEditorIndex(null) }}><DialogContent className="record-editor-dialog assignment-editor-dialog"><DialogHeader><DialogTitle>{editorIndex === 'add' ? `Add ${itemLabel}` : `Edit ${itemLabel}`}</DialogTitle><DialogDescription>{editorIndex === 'add' ? `Choose a ${itemLabel} to assign to this product.` : `Replace the assigned ${itemLabel} for this row.`}</DialogDescription></DialogHeader><div className="record-editor-fields one-column"><FormField className="form-field" label={`${itemLabel[0].toUpperCase()}${itemLabel.slice(1)} *`}><ProductSelect label={itemLabel} value={draftId} onChange={setDraftId} placeholder={`Select ${itemLabel}`} options={availableRecords.map(record => ({ value: record.id, label: `${record.name} · ${detail(record)}` }))} /></FormField></div><DialogFooter><AdminButton type="button" variant="outline" onClick={() => setEditorIndex(null)}>Cancel</AdminButton><AdminButton type="button" onClick={save} disabled={!draftId}>Save changes</AdminButton></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={deleteIndex !== null} onOpenChange={open => { if (!open) setDeleteIndex(null) }}>
      {deleteIndex !== null && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Remove {itemLabel}</p><AlertDialogTitle>Remove “{selectedRecords[deleteIndex]?.name}”?</AlertDialogTitle><AlertDialogDescription>This assignment will be removed from the product when you save your changes.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton type="button" variant="outline" className="secondary-button">Cancel</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton type="button" className="primary-button destructive-button" onClick={() => { const record = selectedRecords[deleteIndex]; if (record) onChange(selectedIds.filter(id => id !== record.id)); setDeleteIndex(null) }}>Remove {itemLabel}</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}
    </AlertDialog>
  </Section>
}

const NO_CUTOFF = '__none__'
const METHOD_OPTIONS = [{ value: 'local_delivery', label: 'Our own delivery (to PIN codes)' }, { value: 'shipping', label: 'Courier shipping (a state or all India)' }]

export function DeliverySection({ watch, setValue, errors, areas, cutoffRules }: { errors: FieldErrors<ProductFormValues>; watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; areas: ServiceArea[]; cutoffRules: CutoffRule[] }) {
  const method = watch('deliveryMethod')
  const areaId = watch('serviceAreaId')
  const cutoffId = watch('cutoffRuleId')
  const fits = (area: ServiceArea) => (method === 'local_delivery' ? area.coverageType === 'pin_code' : area.coverageType !== 'pin_code')
  const areaOptions = areas.filter(area => fits(area) && (area.status === 'active' || area.id === areaId)).map(area => ({ value: area.id, label: `${area.name}${area.status === 'inactive' ? ' · Inactive' : ''}` }))
  const cutoffOptions = [{ value: NO_CUTOFF, label: 'No limit: orders accepted any time' }, ...cutoffRules.filter(rule => rule.status === 'active' || rule.id === cutoffId).map(rule => ({ value: rule.id, label: `${rule.name}${rule.status === 'inactive' ? ' · Inactive' : ''}` }))]
  const changeMethod = (value: string) => {
    setValue('deliveryMethod', value as DeliveryMethod, { shouldDirty: true, shouldValidate: true })
    // The area list changes with the method, so the old pick no longer applies; courier shipping has no cut-off or production plan.
    setValue('serviceAreaId', '', { shouldDirty: true })
    if (value === 'shipping') {
      setValue('cutoffRuleId', '', { shouldDirty: true }); setValue('includeInProductionPlanning', false, { shouldDirty: true })
      // A courier product is bought once only.
      const kept = watch('purchaseMethods').filter(item => item === 'buy_once')
      setValue('purchaseMethods', kept, { shouldDirty: true, shouldValidate: true })
    }
  }
  return <Section number="02" title="Delivery" description="How it reaches customers, where, and by when they must order.">
    <FormField label="How is it delivered? *" error={errors.deliveryMethod?.message}><ProductSelect label="Delivery method" value={method} onChange={changeMethod} placeholder="Choose how it is delivered" options={METHOD_OPTIONS} /></FormField>
    {method && <FormField label="Delivery area *" error={errors.serviceAreaId?.message}><ProductSelect label="Delivery area" value={areaId} onChange={value => setValue('serviceAreaId', value, { shouldDirty: true, shouldValidate: true })} placeholder={areaOptions.length ? 'Choose a delivery area' : 'No matching delivery area yet'} options={areaOptions} /></FormField>}
    {method === 'local_delivery' && <>
      <p className="product-hint">The PIN codes served, and the Morning or Evening windows each PIN gets, are set inside the delivery area.</p>
      <FormField label="Order-by time" helper="The last time customers can order for a delivery. Made in Setup → Order-by Times."><ProductSelect label="Order-by time" value={cutoffId || NO_CUTOFF} onChange={value => { setValue('cutoffRuleId', value === NO_CUTOFF ? '' : value, { shouldDirty: true }); if (value === NO_CUTOFF) setValue('includeInProductionPlanning', false, { shouldDirty: true }) }} placeholder="Choose an order-by time" options={cutoffOptions} /></FormField>
    </>}
    {method === 'shipping' && <p className="product-hint">Courier shipping has no delivery windows, order-by time or production plan.</p>}
  </Section>
}

function RowActions({ editLabel, deleteLabel, onEdit, onDelete }: { editLabel: string; deleteLabel: string; onEdit: () => void; onDelete: () => void }) {
  return <div className="variant-row-actions"><AdminButton type="button" variant="outline" className="variant-edit-button" onClick={onEdit} aria-label={editLabel}><Edit2 size={14} /> Edit</AdminButton><AdminButton type="button" variant="outline" className="variant-delete-button" onClick={onDelete} aria-label={deleteLabel}><Trash2 size={14} /> Delete</AdminButton></div>
}
function EmptyRows({ children }: { children: ReactNode }) { return <div className="empty-table">{children}</div> }
const BADGES = Object.keys(PRODUCT_BADGE_LABELS) as ProductBadge[]
const linesOf = (text: string) => text.split('\n')

/** Under the highlights box: how many lines there are and how long the longest is, so the limits are visible while typing. */
const highlightHelper = (lines: string[]) => `${lines.length} of ${MAX_HIGHLIGHTS} highlights · longest line ${Math.max(0, ...lines.map(line => line.length))} / ${MAX_HIGHLIGHT_LENGTH} characters`
/** The first thing wrong with the highlights, in plain words, shown right under the box. */
function highlightProblem(lines: string[]): string | undefined {
  const tooLong = lines.findIndex(line => line.length > MAX_HIGHLIGHT_LENGTH)
  if (tooLong >= 0) return `Line ${tooLong + 1} has ${lines[tooLong]?.length} characters. Keep each highlight to ${MAX_HIGHLIGHT_LENGTH} or fewer.`
  if (lines.filter(line => line.trim()).length > MAX_HIGHLIGHTS) return `Add at most ${MAX_HIGHLIGHTS} highlights, one per line.`
  return undefined
}

/** What customers read and see about the product. Price, variants and how it is sold live in their own steps. */
export function ContentSection({ control, setValue, register, imageUrls, onImageUrl, onBusyChange }: { control: Control<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; register: UseFormRegister<ProductFormValues>; imageUrls: Record<string, string>; onImageUrl: (assetId: string, url: string) => void; onBusyChange: (busy: boolean) => void }) {
  const content = useWatch({ control, name: 'content' })
  const set = <Key extends keyof ProductFormValues['content']>(key: Key, value: ProductFormValues['content'][Key]) => setValue('content', { ...content, [key]: value }, { shouldDirty: true, shouldValidate: true })
  return <Section number="05" title="Photos & details" description="Pictures and the longer text on the product page, in English and Gujarati. You can fill this in later.">
    <div className="product-grid">
      <FormField label="Long description (English)" helper={counter(content.longDescriptionEn, 2000)}><Textarea rows={4} maxLength={2000} {...register('content.longDescriptionEn')} /></FormField>
      <FormField label="Long description (Gujarati)" helper={counter(content.longDescriptionGu, 2000)}><Textarea rows={4} maxLength={2000} {...register('content.longDescriptionGu')} /></FormField>
      <FormField label="Nutrition (English)" helper={counter(content.nutritionEn, 1000)}><Textarea rows={3} maxLength={1000} {...register('content.nutritionEn')} /></FormField>
      <FormField label="Nutrition (Gujarati)" helper={counter(content.nutritionGu, 1000)}><Textarea rows={3} maxLength={1000} {...register('content.nutritionGu')} /></FormField>
      <FormField label="Highlights (English)" helper={highlightHelper(content.highlightsEn)} error={highlightProblem(content.highlightsEn)}><Textarea rows={4} aria-describedby="highlights-hint" value={content.highlightsEn.join('\n')} onChange={event => set('highlightsEn', linesOf(event.target.value))} /></FormField>
      <FormField label="Highlights (Gujarati)" helper={highlightHelper(content.highlightsGu)} error={highlightProblem(content.highlightsGu)}><Textarea rows={4} aria-describedby="highlights-hint" value={content.highlightsGu.join('\n')} onChange={event => set('highlightsGu', linesOf(event.target.value))} /></FormField>
    </div>
    <p id="highlights-hint" className="product-hint">One highlight per line, up to {MAX_HIGHLIGHTS}, each under {MAX_HIGHLIGHT_LENGTH} characters.</p>
    <ImageUploadField purpose="product" label="Primary image" hint="JPEG, PNG or WebP, up to 2 MB. The first picture customers see." currentUrl={imageUrls[content.primaryImageAssetId] ?? null} hasImage={Boolean(content.primaryImageAssetId)} onBusyChange={onBusyChange}
      onChange={assetId => set('primaryImageAssetId', assetId ?? '')} onPreview={onImageUrl} />
    <GalleryField assetIds={content.galleryAssetIds} urls={imageUrls} onChange={ids => set('galleryAssetIds', ids)} onPreview={onImageUrl} onBusyChange={onBusyChange} />
    <fieldset className="product-badges"><legend className="product-form-label">Badges</legend>
      {BADGES.map(badge => <label key={badge}><Checkbox checked={content.badges.includes(badge)} onCheckedChange={checked => set('badges', checked ? [...content.badges, badge] : content.badges.filter(item => item !== badge))} /> {PRODUCT_BADGE_LABELS[badge]}</label>)}
    </fieldset>
  </Section>
}

function Section({ number, title, description, action, children }: { number: string; title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <section className="form-card"><div className="form-section-header"><div className="form-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>{action}</div>{children}</section>
}
