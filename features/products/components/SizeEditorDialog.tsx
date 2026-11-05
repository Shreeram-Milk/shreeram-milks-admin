'use client'

import { useId } from 'react'
import type { FormVariant } from '../schema'
import { t } from '../messages'
import { sizeName, unitOptions } from '../units'
import { ProductSelect } from './ProductSelect'
import { tc } from '@/lib/i18n/common'
import { Button as AdminButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { paiseToRupeeInput, parseRupeesToPaise } from '@/lib/money'

type Props = {
  isNew: boolean
  value: FormVariant
  /** The "uses for making" amounts are asked only for products that are part of the daily production plan. */
  showProduction: boolean
  error: string
  onChange: (patch: Partial<FormVariant>) => void
  /** A change of size also keeps the "uses for making" amount in step with it. */
  onChangeSize: (patch: Pick<Partial<FormVariant>, 'displayUnit' | 'displayQuantity'>) => void
  onSave: () => void
  onClose: () => void
}

/**
 * One size of a product. The admin answers four things: how much is in one pack, the price, an optional old price, and whether it is
 * sold now. The name customers see and the amount used for making are worked out from the size; changing them lives under "More options".
 */
export function SizeEditorDialog({ isNew, value, showProduction, error, onChange, onChangeSize, onSave, onClose }: Props) {
  const sizeLabelId = useId()
  const automaticName = sizeName(value.displayUnit, value.displayQuantity)
  const shownName = value.name.trim() || automaticName
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="record-editor-dialog"><DialogHeader><DialogTitle>{t(isNew ? 'addASize' : 'editSize')}</DialogTitle><DialogDescription>{t('sizeDialogDescription')}</DialogDescription></DialogHeader>
      <div className="record-editor-fields">
        <div className="form-field" role="group" aria-labelledby={sizeLabelId}>
          <Label id={sizeLabelId} className="product-form-label">{t('sizeLabel')}</Label>
          <div className="size-row">
            <Input autoFocus type="number" min="0.01" step="any" aria-label={t('amount')} value={value.displayQuantity || ''} onChange={event => onChangeSize({ displayQuantity: Number(event.target.value || 0) })} placeholder="500" />
            <ProductSelect label={t('unit')} value={value.displayUnit} options={unitOptions(value.displayUnit)} placeholder={t('chooseUnit')} onChange={unit => onChangeSize({ displayUnit: unit })} />
          </div>
          <small className="help-text">{automaticName ? t('customersWillSee', { name: shownName }) : t('sizeHint')}</small>
        </div>
        <FormField className="form-field" label={t('sellingPrice')}><Input type="number" min="0" step="0.01" value={paiseToRupeeInput(value.pricePaise)} onChange={event => onChange({ pricePaise: parseRupeesToPaise(event.target.value.replace(/\.$/, '')) ?? 0 })} /></FormField>
        <FormField className="form-field" label={t('oldPrice')} helper={t('oldPriceHint')}><Input type="number" min="0" step="0.01" value={value.compareAtPricePaise === null ? '' : paiseToRupeeInput(value.compareAtPricePaise)} onChange={event => onChange({ compareAtPricePaise: event.target.value.trim() === '' ? null : parseRupeesToPaise(event.target.value.replace(/\.$/, '')) })} /></FormField>
        <label className="product-check"><Checkbox checked={value.status === 'active'} onCheckedChange={checked => onChange({ status: checked === true ? 'active' : 'inactive' })} /><span>{t('soldNowCheck')}</span></label>
        <details className="size-more">
          <summary>{t('moreOptions')}</summary>
          <div className="record-editor-fields">
            <FormField className="form-field" label={t('ownName')} helper={t('ownNameHint', { name: automaticName || '—' })}><Input value={value.name} onChange={event => onChange({ name: event.target.value })} placeholder={automaticName || t('ownNamePlaceholder')} /></FormField>
            <FormField className="form-field" label={t('sku')} helper={t('skuHint')}><Input value={value.sku} onChange={event => onChange({ sku: event.target.value })} placeholder={t('optional')} /></FormField>
            {showProduction && <>
              <FormField className="form-field" label={t('makingUnit')} helper={t('makingUnitHint')}><ProductSelect label={t('makingUnitLabel')} value={value.productionUnit} options={unitOptions(value.productionUnit)} placeholder={t('chooseUnit')} onChange={unit => onChange({ productionUnit: unit })} /></FormField>
              <FormField className="form-field" label={t('makingAmount')} helper={t('makingAmountHint')}><Input type="number" min="0" step="any" value={value.productionQuantity} onChange={event => onChange({ productionQuantity: Number(event.target.value || 0) })} /></FormField>
            </>}
          </div>
        </details>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <DialogFooter><AdminButton type="button" variant="outline" onClick={onClose}>{tc('cancel')}</AdminButton><AdminButton type="button" onClick={onSave}>{t('saveSize')}</AdminButton></DialogFooter>
    </DialogContent>
  </Dialog>
}
