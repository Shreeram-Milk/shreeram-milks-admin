'use client'

import { useState, type ReactNode } from 'react'
import { useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue, type UseFormWatch } from 'react-hook-form'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import type { CutoffRule, DeliveryMethod, ServiceArea, SubscriptionRule, TrialPlan } from '../../configuration/api'
import { newVariant, type FormVariant, type ProductFormValues } from '../schema'
import type { ProductStatus } from '../api'
import { MAX_HIGHLIGHT_LENGTH, MAX_HIGHLIGHTS, PRODUCT_BADGE_LABELS, type ProductBadge } from '../types'
import { METHOD_LABELS, STATUS_LABELS } from '../labels'
import { t } from '../messages'
import { tc } from '@/lib/i18n/common'
import { GalleryField } from './GalleryField'
import { ProductSelect } from './ProductSelect'
import { suggestedProduction, unitLabel, unitOptions } from '../units'
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

/** "12 / 200" under a field, so the limit is visible while typing. */
const counter = (text: string, max: number) => t('characters', { count: text.length, max })

export function BasicSection({ register, watch, setValue, errors, categories, statuses }: { register: UseFormRegister<ProductFormValues>; errors: FieldErrors<ProductFormValues>; watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; categories: Array<{ value: string; label: string }>; statuses: ProductStatus[] }) {
  return <Section number="01" title={t('aboutTitle')} description={t('aboutDescription')}>
    <div className="product-grid">
      <FormField label={t('productName')} error={errors.name?.message}><Input {...register('name')} placeholder="Fresh Cow Milk" /></FormField>
      <FormField label={t('categoryRequired')} error={errors.categoryId?.message}><ProductSelect label={t('category')} value={watch('categoryId')} onChange={value => setValue('categoryId', value, { shouldDirty: true, shouldValidate: true })} placeholder={t('selectCategory')} options={categories} /></FormField>
      <FormField label={t('sku')}><Input {...register('sku')} placeholder={t('optional')} /></FormField>
      <FormField label={t('gujaratiName')} helper={counter(watch('nameGu'), 80)}><Input maxLength={80} {...register('nameGu')} placeholder="તાજું ગાયનું દૂધ" /></FormField>
      <FormField label={t('shortDescription')} helper={counter(watch('shortDescriptionEn'), 200)}><Input maxLength={200} {...register('shortDescriptionEn')} placeholder={t('shortDescriptionPlaceholder')} /></FormField>
      <FormField label={t('gujaratiShortDescription')} helper={counter(watch('shortDescriptionGu'), 200)}><Input maxLength={200} {...register('shortDescriptionGu')} placeholder="ગુજરાતીમાં ટૂંકું વર્ણન" /></FormField>
      <FormField label={t('status')}><ProductSelect label={t('status')} value={watch('status')} onChange={value => setValue('status', value as ProductFormValues['status'], { shouldDirty: true })} placeholder={t('selectStatus')} options={statuses.map(value => ({ value, label: STATUS_LABELS[value] }))} /></FormField>
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
      setEditorError(t('sizeFieldsRequired'))
      return
    }
    if (showProduction && (!editor.value.productionUnit.trim() || editor.value.productionQuantity <= 0)) {
      setEditorError(t('productionAmountRequired'))
      return
    }
    if (editor.value.compareAtPricePaise !== null && editor.value.compareAtPricePaise <= editor.value.pricePaise) {
      setEditorError(t('oldPriceHigher'))
      return
    }
    const next = editor.index === null ? [...variants, editor.value] : variants.map((variant, index) => index === editor.index ? editor.value : variant)
    setValue('variants', next, { shouldDirty: true, shouldValidate: true })
    setEditor(null)
  }
  const removeVariant = (index: number) => setValue('variants', variants.filter((_, rowIndex) => rowIndex !== index), { shouldDirty: true, shouldValidate: true })
  const missingAmounts = showProduction ? variants.filter(variant => !variant.productionUnit || variant.productionQuantity <= 0).length : 0

  return <Section number="03" title={t('sizesTitle')} description={t('sizesDescription')} action={<AdminButton type="button" className="section-add-button" onClick={() => openEditor(null)}><Plus size={14} /> {t('addSize')}</AdminButton>}>
    {!canPlan
      ? <p className="product-hint">{t(courier ? 'courierNotPlanned' : deliveryMethod === 'local_delivery' ? 'chooseOrderByForPlan' : 'chooseDeliveryForPlan')}</p>
      : <label className={`production-choice${showProduction ? ' is-on' : ''}`}><Checkbox checked={showProduction} onCheckedChange={checked => toggleProduction(checked === true)} /><span><strong>{t('weMakeThis')}</strong><small>{t(showProduction ? 'weMakeThisOn' : 'weMakeThisOff')}</small></span></label>}
    {missingAmounts > 0 ? <p className="field-error" role="alert">{missingAmounts === 1 ? t('missingAmountOne') : t('missingAmountMany', { count: missingAmounts })}</p> : null}
    <div className="repeatable-table-shell"><Table className="variant-table"><TableHeader><TableRow><TableHead>{t('size')}</TableHead><TableHead>{t('price')}</TableHead><TableHead>{t('customersSee')}</TableHead>{showProduction && <TableHead>{t('usesForMaking')}</TableHead>}<TableHead className="table-actions-heading">{t('actions')}</TableHead></TableRow></TableHeader><TableBody>
      {variants.map((variant, index) => <TableRow key={variant.clientKey}>
        <TableCell data-label={t('size')} className="variant-name-cell">{variant.name || t('unnamedSize')}{variant.status === 'inactive' && <em className="product-inactive">{t('notSold')}</em>}{variant.sku ? <small className="cell-note">{t('skuCode', { sku: variant.sku })}</small> : null}</TableCell><TableCell data-label={t('price')} className="value-emphasis">{formatINR(variant.pricePaise)}{variant.compareAtPricePaise !== null && <small className="cell-note">{t('was', { price: formatINR(variant.compareAtPricePaise) })}</small>}</TableCell><TableCell data-label={t('customersSee')}>{variant.displayQuantity} {variant.displayUnit ? unitLabel(variant.displayUnit) : '—'}</TableCell>{showProduction && <TableCell data-label={t('usesForMaking')}>{variant.productionUnit ? `${variant.productionQuantity} ${unitLabel(variant.productionUnit)}` : <span className="field-error">{t('missing')}</span>}</TableCell>}<TableCell data-label={t('actions')}><RowActions editLabel={t('editNamed', { name: variant.name || t('sizeWord') })} deleteLabel={t('removeNamed', { name: variant.name || t('sizeWord') })} onEdit={() => openEditor(index)} onDelete={() => setDeleteIndex(index)} /></TableCell>
      </TableRow>)}
      {variants.length === 0 && <TableRow><TableCell colSpan={showProduction ? 5 : 4}><EmptyRows>{t('noSizes')}</EmptyRows></TableCell></TableRow>}
    </TableBody></Table></div>
    <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null) }}>
      {editor && <DialogContent className="record-editor-dialog"><DialogHeader><DialogTitle>{t(editor.index === null ? 'addASize' : 'editSize')}</DialogTitle><DialogDescription>{t('sizeDialogDescription')}</DialogDescription></DialogHeader>
        <div className="record-editor-fields">
          <FormField className="form-field" label={t('sizeName')} helper={t('sizeNameHint')}><Input autoFocus value={editor.value.name} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, name: event.target.value } } : current)} placeholder="500 ml" /></FormField>
          <FormField className="form-field" label={t('sellingPrice')}><Input type="number" min="0" step="0.01" value={paiseToRupeeInput(editor.value.pricePaise)} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, pricePaise: parseRupeesToPaise(event.target.value.replace(/\.$/, '')) ?? 0 } } : current)} /></FormField>
          <FormField className="form-field" label={t('unitRequired')} helper={t('unitHint')}><ProductSelect label={t('unit')} value={editor.value.displayUnit} options={unitOptions(editor.value.displayUnit)} placeholder={t('chooseUnit')} onChange={value => changeSize({ displayUnit: value })} /></FormField>
          <FormField className="form-field" label={t('amountRequired')} helper={t('amountHint')}><Input type="number" min="0.01" step="any" value={editor.value.displayQuantity} onChange={event => changeSize({ displayQuantity: Number(event.target.value || 0) })} /></FormField>
          {showProduction && <><FormField className="form-field" label={t('makingUnit')} helper={t('makingUnitHint')}><ProductSelect label={t('makingUnitLabel')} value={editor.value.productionUnit} options={unitOptions(editor.value.productionUnit)} placeholder={t('chooseUnit')} onChange={value => setEditor(current => current ? { ...current, value: { ...current.value, productionUnit: value } } : current)} /></FormField><FormField className="form-field" label={t('makingAmount')} helper={t('makingAmountHint')}><Input type="number" min="0" step="any" value={editor.value.productionQuantity} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, productionQuantity: Number(event.target.value || 0) } } : current)} /></FormField></>}
          <FormField className="form-field" label={t('oldPrice')} helper={t('oldPriceHint')}><Input type="number" min="0" step="0.01" value={editor.value.compareAtPricePaise === null ? '' : paiseToRupeeInput(editor.value.compareAtPricePaise)} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, compareAtPricePaise: event.target.value.trim() === '' ? null : parseRupeesToPaise(event.target.value.replace(/\.$/, '')) } } : current)} /></FormField>
          <FormField className="form-field" label={t('sku')} helper={t('skuHint')}><Input value={editor.value.sku} onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, sku: event.target.value } } : current)} placeholder={t('optional')} /></FormField>
          <FormField className="form-field" label={t('soldNow')}><ProductSelect label={t('soldNow')} value={editor.value.status} onChange={value => setEditor(current => current ? { ...current, value: { ...current.value, status: value === 'inactive' ? 'inactive' : 'active' } } : current)} placeholder={t('choose')} options={[{ value: 'active', label: t('soldYes') }, { value: 'inactive', label: t('soldNo') }]} /></FormField>
        </div>
        {editorError && <p className="field-error" role="alert">{editorError}</p>}
        <DialogFooter><AdminButton type="button" variant="outline" onClick={() => setEditor(null)}>{tc('cancel')}</AdminButton><AdminButton type="button" onClick={saveEditor}>{t('saveSize')}</AdminButton></DialogFooter>
      </DialogContent>}
    </Dialog>
    <AlertDialog open={deleteIndex !== null} onOpenChange={open => { if (!open) setDeleteIndex(null) }}>
      {deleteIndex !== null && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">{t('removeSize')}</p><AlertDialogTitle>{t('removeTitle', { name: variants[deleteIndex]?.name || t('unnamedSize') })}</AlertDialogTitle><AlertDialogDescription>{t('removeSizeBody')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton type="button" variant="outline" className="secondary-button">{tc('cancel')}</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton type="button" className="primary-button destructive-button" onClick={() => { removeVariant(deleteIndex); setDeleteIndex(null) }}>{t('removeSize')}</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}
    </AlertDialog>
  </Section>
}

export function PurchaseSection({ watch, setValue }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues> }) {
  const selected = watch('purchaseMethods')
  // Trials and subscriptions need a delivery window every day, which a courier does not have.
  const courier = watch('deliveryMethod') === 'shipping'
  return <Section number="04" title={t('sellingTitle')} description={t('sellingDescription')}><div className="product-methods">{(['buy_once', 'trial', 'subscription'] as const).map(value => { const label = METHOD_LABELS[value]; const locked = courier && value !== 'buy_once'; return <label className={`product-check${locked ? ' is-disabled' : ''}`} key={value}><Checkbox disabled={locked} checked={!locked && selected.includes(value)} onCheckedChange={checked => setValue('purchaseMethods', checked === true ? [...selected, value] : selected.filter(item => item !== value), { shouldDirty: true })} /><span>{label}</span></label> })}</div><p className="product-hint">{t(courier ? 'courierBuyOnceOnly' : 'methodRequired')}</p><label className="product-check product-check-row"><Checkbox checked={watch('excludedFromCredit')} onCheckedChange={checked => setValue('excludedFromCredit', checked === true, { shouldDirty: true })} /> {t('notOnCredit')}</label><p className="product-hint">{t('notOnCreditHint')}</p></Section>
}

export function TrialSection({ watch, setValue, plans }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; plans: TrialPlan[] }) {
  return <AssignmentSection number="4a" title={t('trialTitle')} description={t('trialDescription')} itemLabel={t('trialItem')} records={plans} selectedIds={watch('trialPlanIds')} onChange={ids => setValue('trialPlanIds', ids, { shouldDirty: true, shouldValidate: true })} detailHeading={t('duration')} detail={plan => t('days', { count: plan.durationDays })} />
}

export function SubscriptionSection({ watch, setValue, rules }: { watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; rules: SubscriptionRule[] }) {
  return <AssignmentSection number="4b" title={t('subscriptionTitle')} description={t('subscriptionDescription')} itemLabel={t('subscriptionItem')} records={rules} selectedIds={watch('subscriptionRuleIds')} onChange={ids => setValue('subscriptionRuleIds', ids, { shouldDirty: true, shouldValidate: true })} detailHeading={t('schedule')} detail={rule => t(rule.systemType === 'alternate_days' ? 'alternateDays' : rule.systemType === 'custom_weekdays' ? 'customWeekdays' : 'daily')} />
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

  return <Section number={number} title={title} description={description} action={<AdminButton type="button" className="section-add-button" onClick={openAdd} disabled={!canAdd}><Plus size={14} /> {t('addItem', { item: itemLabel })}</AdminButton>}>
    <div className="repeatable-table-shell"><Table className="assignment-table"><TableHeader><TableRow><TableHead>{t('name')}</TableHead><TableHead>{detailHeading}</TableHead><TableHead>{t('status')}</TableHead><TableHead className="table-actions-heading">{t('actions')}</TableHead></TableRow></TableHeader><TableBody>
      {selectedRecords.map((record, index) => <TableRow key={record.id}><TableCell data-label={t('name')} className="variant-name-cell">{record.name}</TableCell><TableCell data-label={detailHeading}>{detail(record)}</TableCell><TableCell data-label={t('status')}><StatusBadge status={record.status}>{t(record.status === 'active' ? 'statusActive' : 'statusInactive')}</StatusBadge></TableCell><TableCell data-label={t('actions')}><RowActions editLabel={t('editNamed', { name: record.name })} deleteLabel={t('removeNamed', { name: record.name })} onEdit={() => openEdit(index)} onDelete={() => setDeleteIndex(index)} /></TableCell></TableRow>)}
      {selectedRecords.length === 0 && <TableRow><TableCell colSpan={4}><EmptyRows>{t('noItems', { item: itemLabel })}</EmptyRows></TableCell></TableRow>}
    </TableBody></Table></div>
    <Dialog open={editorIndex !== null} onOpenChange={open => { if (!open) setEditorIndex(null) }}><DialogContent className="record-editor-dialog assignment-editor-dialog"><DialogHeader><DialogTitle>{t(editorIndex === 'add' ? 'addItem' : 'editItem', { item: itemLabel })}</DialogTitle><DialogDescription>{t(editorIndex === 'add' ? 'chooseItem' : 'replaceItem', { item: itemLabel })}</DialogDescription></DialogHeader><div className="record-editor-fields one-column"><FormField className="form-field" label={t('itemRequired', { item: `${itemLabel[0].toUpperCase()}${itemLabel.slice(1)}` })}><ProductSelect label={itemLabel} value={draftId} onChange={setDraftId} placeholder={t('selectItem', { item: itemLabel })} options={availableRecords.map(record => ({ value: record.id, label: `${record.name} · ${detail(record)}` }))} /></FormField></div><DialogFooter><AdminButton type="button" variant="outline" onClick={() => setEditorIndex(null)}>{tc('cancel')}</AdminButton><AdminButton type="button" onClick={save} disabled={!draftId}>{t('saveChangesLower')}</AdminButton></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={deleteIndex !== null} onOpenChange={open => { if (!open) setDeleteIndex(null) }}>
      {deleteIndex !== null && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">{t('removeItem', { item: itemLabel })}</p><AlertDialogTitle>{t('removeTitle', { name: selectedRecords[deleteIndex]?.name ?? '' })}</AlertDialogTitle><AlertDialogDescription>{t('removeAssignmentBody')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton type="button" variant="outline" className="secondary-button">{tc('cancel')}</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton type="button" className="primary-button destructive-button" onClick={() => { const record = selectedRecords[deleteIndex]; if (record) onChange(selectedIds.filter(id => id !== record.id)); setDeleteIndex(null) }}>{t('removeItem', { item: itemLabel })}</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}
    </AlertDialog>
  </Section>
}

const NO_CUTOFF = '__none__'
const methodOptions = () => [{ value: 'local_delivery', label: t('methodOwn') }, { value: 'shipping', label: t('methodCourier') }]

export function DeliverySection({ watch, setValue, errors, areas, cutoffRules }: { errors: FieldErrors<ProductFormValues>; watch: UseFormWatch<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; areas: ServiceArea[]; cutoffRules: CutoffRule[] }) {
  const method = watch('deliveryMethod')
  const areaId = watch('serviceAreaId')
  const cutoffId = watch('cutoffRuleId')
  const fits = (area: ServiceArea) => (method === 'local_delivery' ? area.coverageType === 'pin_code' : area.coverageType !== 'pin_code')
  const named = (name: string, status: string) => (status === 'inactive' ? t('inactiveTag', { name }) : name)
  const areaOptions = areas.filter(area => fits(area) && (area.status === 'active' || area.id === areaId)).map(area => ({ value: area.id, label: named(area.name, area.status) }))
  const cutoffOptions = [{ value: NO_CUTOFF, label: t('noLimit') }, ...cutoffRules.filter(rule => rule.status === 'active' || rule.id === cutoffId).map(rule => ({ value: rule.id, label: named(rule.name, rule.status) }))]
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
  return <Section number="02" title={t('deliveryTitle')} description={t('deliveryDescription')}>
    <FormField label={t('howDelivered')} error={errors.deliveryMethod?.message}><ProductSelect label={t('deliveryMethod')} value={method} onChange={changeMethod} placeholder={t('chooseHowDelivered')} options={methodOptions()} /></FormField>
    {method && <FormField label={t('deliveryAreaRequired')} error={errors.serviceAreaId?.message}><ProductSelect label={t('deliveryArea')} value={areaId} onChange={value => setValue('serviceAreaId', value, { shouldDirty: true, shouldValidate: true })} placeholder={t(areaOptions.length ? 'chooseArea' : 'noMatchingArea')} options={areaOptions} /></FormField>}
    {method === 'local_delivery' && <>
      <p className="product-hint">{t('pinWindowsHint')}</p>
      <FormField label={t('orderByTime')} helper={t('orderByHint')}><ProductSelect label={t('orderByTime')} value={cutoffId || NO_CUTOFF} onChange={value => { setValue('cutoffRuleId', value === NO_CUTOFF ? '' : value, { shouldDirty: true }); if (value === NO_CUTOFF) setValue('includeInProductionPlanning', false, { shouldDirty: true }) }} placeholder={t('chooseOrderBy')} options={cutoffOptions} /></FormField>
    </>}
    {method === 'shipping' && <p className="product-hint">{t('courierNoWindows')}</p>}
  </Section>
}

function RowActions({ editLabel, deleteLabel, onEdit, onDelete }: { editLabel: string; deleteLabel: string; onEdit: () => void; onDelete: () => void }) {
  return <div className="variant-row-actions"><AdminButton type="button" variant="outline" className="variant-edit-button" onClick={onEdit} aria-label={editLabel}><Edit2 size={14} /> {tc('edit')}</AdminButton><AdminButton type="button" variant="outline" className="variant-delete-button" onClick={onDelete} aria-label={deleteLabel}><Trash2 size={14} /> {t('delete')}</AdminButton></div>
}
function EmptyRows({ children }: { children: ReactNode }) { return <div className="empty-table">{children}</div> }
const BADGES = Object.keys(PRODUCT_BADGE_LABELS) as ProductBadge[]
const linesOf = (text: string) => text.split('\n')

/** Under the highlights box: how many lines there are and how long the longest is, so the limits are visible while typing. */
const highlightHelper = (lines: string[]) => t('highlightCount', { count: lines.length, max: MAX_HIGHLIGHTS, longest: Math.max(0, ...lines.map(line => line.length)), limit: MAX_HIGHLIGHT_LENGTH })
/** The first thing wrong with the highlights, in plain words, shown right under the box. */
function highlightProblem(lines: string[]): string | undefined {
  const tooLong = lines.findIndex(line => line.length > MAX_HIGHLIGHT_LENGTH)
  if (tooLong >= 0) return t('highlightTooLong', { line: tooLong + 1, length: lines[tooLong]?.length ?? 0, limit: MAX_HIGHLIGHT_LENGTH })
  if (lines.filter(line => line.trim()).length > MAX_HIGHLIGHTS) return t('highlightTooMany', { max: MAX_HIGHLIGHTS })
  return undefined
}

/** What customers read and see about the product. Price, variants and how it is sold live in their own steps. */
export function ContentSection({ control, setValue, register, imageUrls, onImageUrl, onBusyChange }: { control: Control<ProductFormValues>; setValue: UseFormSetValue<ProductFormValues>; register: UseFormRegister<ProductFormValues>; imageUrls: Record<string, string>; onImageUrl: (assetId: string, url: string) => void; onBusyChange: (busy: boolean) => void }) {
  const content = useWatch({ control, name: 'content' })
  const set = <Key extends keyof ProductFormValues['content']>(key: Key, value: ProductFormValues['content'][Key]) => setValue('content', { ...content, [key]: value }, { shouldDirty: true, shouldValidate: true })
  return <Section number="05" title={t('contentTitle')} description={t('contentDescription')}>
    <div className="product-grid">
      <FormField label={t('longEn')} helper={counter(content.longDescriptionEn, 2000)}><Textarea rows={4} maxLength={2000} {...register('content.longDescriptionEn')} /></FormField>
      <FormField label={t('longGu')} helper={counter(content.longDescriptionGu, 2000)}><Textarea rows={4} maxLength={2000} {...register('content.longDescriptionGu')} /></FormField>
      <FormField label={t('nutritionEn')} helper={counter(content.nutritionEn, 1000)}><Textarea rows={3} maxLength={1000} {...register('content.nutritionEn')} /></FormField>
      <FormField label={t('nutritionGu')} helper={counter(content.nutritionGu, 1000)}><Textarea rows={3} maxLength={1000} {...register('content.nutritionGu')} /></FormField>
      <FormField label={t('highlightsEn')} helper={highlightHelper(content.highlightsEn)} error={highlightProblem(content.highlightsEn)}><Textarea rows={4} aria-describedby="highlights-hint" value={content.highlightsEn.join('\n')} onChange={event => set('highlightsEn', linesOf(event.target.value))} /></FormField>
      <FormField label={t('highlightsGu')} helper={highlightHelper(content.highlightsGu)} error={highlightProblem(content.highlightsGu)}><Textarea rows={4} aria-describedby="highlights-hint" value={content.highlightsGu.join('\n')} onChange={event => set('highlightsGu', linesOf(event.target.value))} /></FormField>
    </div>
    <p id="highlights-hint" className="product-hint">{t('highlightsHint', { max: MAX_HIGHLIGHTS, limit: MAX_HIGHLIGHT_LENGTH })}</p>
    <ImageUploadField purpose="product" label={t('primaryImage')} hint={t('primaryImageHint')} currentUrl={imageUrls[content.primaryImageAssetId] ?? null} hasImage={Boolean(content.primaryImageAssetId)} onBusyChange={onBusyChange}
      onChange={assetId => set('primaryImageAssetId', assetId ?? '')} onPreview={onImageUrl} />
    <GalleryField assetIds={content.galleryAssetIds} urls={imageUrls} onChange={ids => set('galleryAssetIds', ids)} onPreview={onImageUrl} onBusyChange={onBusyChange} />
    <fieldset className="product-badges"><legend className="product-form-label">{t('badges')}</legend>
      {BADGES.map(badge => <label key={badge}><Checkbox checked={content.badges.includes(badge)} onCheckedChange={checked => set('badges', checked ? [...content.badges, badge] : content.badges.filter(item => item !== badge))} /> {PRODUCT_BADGE_LABELS[badge]}</label>)}
    </fieldset>
  </Section>
}

function Section({ number, title, description, action, children }: { number: string; title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <section className="form-card"><div className="form-section-header"><div className="form-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>{action}</div>{children}</section>
}
