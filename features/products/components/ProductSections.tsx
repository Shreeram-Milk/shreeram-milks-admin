'use client'

import { useState, type ReactNode } from 'react'
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import type { FulfilmentProfile, SubscriptionRule, TrialPlan } from '../../configuration/types'
import type { ProductFormValues } from '../schema'
import { ProductSelect } from './ProductSelect'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Button as AdminButton } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatINR, paiseToRupeeInput, parseRupeesToPaise } from '@/lib/money'

export function BasicSection({ register, watch, setValue }: { register: UseFormRegister<ProductFormValues>; watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues> }) {
  return <Section number="01" title="Basic information" description="Set the product name and how it appears in the catalog.">
    <div className="product-grid">
      <FormField label="Product name *"><Input {...register('name')} placeholder="Fresh Cow Milk" /></FormField>
      <FormField label="Category *"><Input {...register('category')} placeholder="Milk" /></FormField>
      <FormField label="SKU"><Input {...register('sku')} placeholder="Optional" /></FormField>
      <FormField label="Short description"><Input {...register('shortDescription')} placeholder="A short description for staff and customers" /></FormField>
      <FormField label="Status"><ProductSelect label="Status" value={watch('status')} onChange={value => setValue('status', value as ProductFormValues['status'], { shouldDirty: true })} placeholder="Select status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'draft', label: 'Draft · Unpublished' }]} /></FormField>
    </div>
    <div className="product-image-placeholder">Primary image <span>No product image has been added.</span></div>
  </Section>
}

export function VariantsSection({ watch, setValue, showProduction }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; showProduction: boolean }) {
  const variants = watch('variants')
  type Variant = ProductFormValues['variants'][number]
  const [editor, setEditor] = useState<{ index: number | null; value: Variant } | null>(null)
  const [editorError, setEditorError] = useState('')
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const openEditor = (index: number | null) => {
    setEditorError('')
    setEditor({ index, value: index === null ? { id: crypto.randomUUID(), name: '', sku: '', pricePaise: 0, status: 'active', displayUnit: '', displayQuantity: 1, productionUnit: '', productionQuantity: 0 } : { ...variants[index] } })
  }
  const saveEditor = () => {
    if (!editor) return
    if (!editor.value.name.trim() || !editor.value.displayUnit.trim() || editor.value.pricePaise < 0 || editor.value.displayQuantity <= 0) {
      setEditorError('Enter a variant name, a price, a display unit, and a quantity greater than zero.')
      return
    }
    const next = editor.index === null ? [...variants, editor.value] : variants.map((variant, index) => index === editor.index ? editor.value : variant)
    setValue('variants', next, { shouldDirty: true, shouldValidate: true })
    setEditor(null)
  }
  const removeVariant = (index: number) => setValue('variants', variants.filter((_, rowIndex) => rowIndex !== index), { shouldDirty: true, shouldValidate: true })

  return <Section number="02" title="Variants & pricing" description="Set a customer-facing price and production conversion for each variant." action={<AdminButton type="button" className="section-add-button" onClick={() => openEditor(null)}><Plus size={14} /> Add variant</AdminButton>}>
    <div className="repeatable-table-shell"><Table className="variant-table"><TableHeader><TableRow><TableHead>Variant</TableHead><TableHead>SKU</TableHead><TableHead>Selling price</TableHead><TableHead>Customer display</TableHead>{showProduction && <TableHead>Production conversion</TableHead>}<TableHead className="table-actions-heading">Actions</TableHead></TableRow></TableHeader><TableBody>
      {variants.map((variant, index) => <TableRow key={variant.id}>
        <TableCell data-label="Variant" className="variant-name-cell">{variant.name || 'Unnamed variant'}</TableCell><TableCell data-label="SKU">{variant.sku || '—'}</TableCell><TableCell data-label="Selling price" className="value-emphasis">{formatINR(variant.pricePaise)}</TableCell><TableCell data-label="Customer display">{variant.displayQuantity} {variant.displayUnit || '—'}</TableCell>{showProduction && <TableCell data-label="Production conversion">{variant.productionUnit ? `${variant.productionQuantity} ${variant.productionUnit}` : '—'}</TableCell>}<TableCell data-label="Actions"><RowActions editLabel={`Edit ${variant.name || 'variant'}`} deleteLabel={`Delete ${variant.name || 'variant'}`} onEdit={() => openEditor(index)} onDelete={() => setDeleteIndex(index)} /></TableCell>
      </TableRow>)}
      {variants.length === 0 && <TableRow><TableCell colSpan={showProduction ? 6 : 5}><EmptyRows>No variants added yet. Add a variant to set its price and customer display.</EmptyRows></TableCell></TableRow>}
    </TableBody></Table></div>
    <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null) }}>
      {editor && <DialogContent className="record-editor-dialog"><DialogHeader><DialogTitle>{editor.index === null ? 'Add variant pricing' : 'Edit variant pricing'}</DialogTitle><DialogDescription>Update the variant details, selling price, and customer display.</DialogDescription></DialogHeader>
        <div className="record-editor-fields">
          <FormField className="form-field" label="Variant name *"><Input autoFocus value={editor.value.name} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, name: event.target.value } } : current)} placeholder="500 ml" /></FormField>
          <FormField className="form-field" label="SKU"><Input value={editor.value.sku} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, sku: event.target.value } } : current)} placeholder="Optional" /></FormField>
          <FormField className="form-field" label="Selling price (₹) *"><Input type="number" min="0" step="0.01" value={paiseToRupeeInput(editor.value.pricePaise)} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, pricePaise: parseRupeesToPaise(event.target.value.replace(/\.$/, '')) ?? 0 } } : current)} /></FormField>
          <FormField className="form-field" label="Display unit *"><Input value={editor.value.displayUnit} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, displayUnit: event.target.value } } : current)} placeholder="ml" /></FormField>
          <FormField className="form-field" label="Display quantity *"><Input type="number" min="0.01" step="any" value={editor.value.displayQuantity} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, displayQuantity: Number(event.target.value || 0) } } : current)} /></FormField>
          {showProduction && <><FormField className="form-field" label="Production unit"><Input value={editor.value.productionUnit} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, productionUnit: event.target.value } } : current)} placeholder="Litre" /></FormField><FormField className="form-field" label="Production quantity"><Input type="number" min="0" step="any" value={editor.value.productionQuantity} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, productionQuantity: Number(event.target.value || 0) } } : current)} /></FormField></>}
        </div>
        {editorError && <p className="field-error" role="alert">{editorError}</p>}
        <DialogFooter><AdminButton type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</AdminButton><AdminButton type="button" onClick={saveEditor}>Save changes</AdminButton></DialogFooter>
      </DialogContent>}
    </Dialog>
    <AlertDialog open={deleteIndex !== null} onOpenChange={open => { if (!open) setDeleteIndex(null) }}>
      {deleteIndex !== null && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Delete variant</p><AlertDialogTitle>Delete “{variants[deleteIndex]?.name || 'Unnamed variant'}”?</AlertDialogTitle><AlertDialogDescription>This variant and its pricing will be removed from the product when you save your changes.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton type="button" variant="outline" className="secondary-button">Cancel</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton type="button" className="primary-button destructive-button" onClick={() => { removeVariant(deleteIndex); setDeleteIndex(null) }}>Delete variant</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}
    </AlertDialog>
  </Section>
}

export function PurchaseSection({ watch, setValue }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues> }) {
  const selected = watch('purchaseMethods')
  return <Section number="03" title="Purchase methods" description="Choose the ways customers can purchase this product."><div className="product-methods">{([['buy_once', 'Buy Once'], ['trial', 'Trial'], ['subscription', 'Subscription']] as const).map(([value, label]) => <label className="product-check" key={value}><Checkbox checked={selected.includes(value)} onCheckedChange={checked => setValue('purchaseMethods', checked === true ? [...selected, value] : selected.filter(item => item !== value), { shouldDirty: true })} /><span>{label}</span></label>)}</div><p className="product-hint">At least one purchase method is required to publish.</p></Section>
}

export function TrialSection({ watch, setValue, plans }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; plans: TrialPlan[] }) {
  return <AssignmentSection number="04" title="Trial configuration" description="Trial durations are managed centrally under Configuration → Trial Plans." itemLabel="trial plan" records={plans} selectedIds={watch('trialPlanIds')} onChange={ids => setValue('trialPlanIds', ids, { shouldDirty: true, shouldValidate: true })} detailHeading="Duration" detail={plan => `${plan.duration} days`} />
}

export function SubscriptionSection({ watch, setValue, rules }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; rules: SubscriptionRule[] }) {
  return <AssignmentSection number="05" title="Subscription configuration" description="Schedules are managed centrally under Configuration → Subscription Rules." itemLabel="subscription rule" records={rules} selectedIds={watch('subscriptionRuleIds')} onChange={ids => setValue('subscriptionRuleIds', ids, { shouldDirty: true, shouldValidate: true })} detailHeading="Schedule" detail={rule => rule.systemType === 'alternate_days' ? 'Alternate days' : rule.systemType === 'custom_weekdays' ? 'Custom weekdays' : 'Daily'} />
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

export function FulfilmentSection({ watch, setValue, profiles }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; profiles: Array<FulfilmentProfile & { serviceAreaName: string; cutoffRuleName: string }> }) {
  const id = watch('fulfilmentProfileId')
  const profile = profiles.find(item => item.id === id)
  return <Section number="06" title="Fulfilment" description="Products inherit delivery coverage and cut-off behavior from this profile."><FormField label="Fulfilment profile *"><ProductSelect label="Fulfilment profile" value={id} onChange={value => setValue('fulfilmentProfileId', value, { shouldDirty: true })} placeholder="Select a profile" options={profiles.filter(item => item.status === 'active' || item.id === id).map(item => ({ value: item.id, label: `${item.name}${item.status === 'inactive' ? ' · Inactive' : ''}` }))} /></FormField>{profile && <div className="product-profile-summary"><strong>{profile.name}</strong><div><span>Delivery</span><b>{profile.deliveryMethod === 'local_delivery' ? 'Local Delivery' : 'Shipping'}</b></div><div><span>Coverage</span><b>{profile.serviceAreaName}</b></div><div><span>Slots</span><b>{profile.deliveryMethod === 'local_delivery' ? 'Based on customer PIN code' : 'Not applicable'}</b></div><div><span>Cut-off</span><b>{profile.cutoffRuleName}</b></div><div><span>Production planning</span><b>{profile.includeInProductionPlanning ? 'Enabled' : 'Disabled'}</b></div></div>}</Section>
}

export function ProductionSection({ watch }: { watch: UseFormWatch<ProductFormValues> }) {
  const profileId = watch('fulfilmentProfileId')
  return <Section number="07" title="Production planning" description="Conversion metadata supports future operational planning."><p className="product-hint">{profileId ? 'Production conversion is configured per variant above. Profile eligibility determines whether those quantities are used.' : 'Choose a fulfilment profile to review production eligibility.'}</p></Section>
}

export function ProductReviewSummary({ values, profileName, productionEnabled }: { values: ProductFormValues; profileName: string; productionEnabled: boolean }) {
  const rows = [['Product', values.name || 'Not set'], ['Category', values.category || 'Not set'], ['Variants', values.variants.map(variant => variant.name || 'Unnamed variant').join(', ') || 'None'], ['Purchase methods', values.purchaseMethods.map(method => method === 'buy_once' ? 'Buy Once' : method === 'trial' ? 'Trial' : 'Subscription').join(', ') || 'None'], ['Trial plans', String(values.trialPlanIds.length)], ['Subscription rules', String(values.subscriptionRuleIds.length)], ['Fulfilment', profileName], ['Production planning', productionEnabled ? 'Enabled' : 'Disabled'], ['Status', values.status === 'draft' ? 'Draft · Unpublished' : values.status === 'active' ? 'Active' : 'Inactive']]
  return <Section number="06" title="Review product" description="Confirm the complete product setup before saving or publishing."><div className="review-summary"><div className="review-summary-heading"><h3>Product configuration</h3><p>Review each value below. You can return to any step to make changes.</p></div><div className="product-review-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div></Section>
}

function RowActions({ editLabel, deleteLabel, onEdit, onDelete }: { editLabel: string; deleteLabel: string; onEdit: () => void; onDelete: () => void }) {
  return <div className="variant-row-actions"><AdminButton type="button" variant="outline" className="variant-edit-button" onClick={onEdit} aria-label={editLabel}><Edit2 size={14} /> Edit</AdminButton><AdminButton type="button" variant="outline" className="variant-delete-button" onClick={onDelete} aria-label={deleteLabel}><Trash2 size={14} /> Delete</AdminButton></div>
}
function EmptyRows({ children }: { children: ReactNode }) { return <div className="empty-table">{children}</div> }
function Section({ number, title, description, action, children }: { number: string; title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <section className="form-card"><div className="form-section-header"><div className="form-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>{action}</div>{children}</section>
}
