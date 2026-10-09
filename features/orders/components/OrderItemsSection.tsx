'use client'

import { useMemo } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/configuration/FormField'
import { FormSection } from '@/components/shared/FormSection'
import { formatINR } from '@/lib/money'
import { productService } from '../../products/service'
import type { OrderFormValues } from '../schema'
import { MAX_ORDER_ITEMS, orderService } from '../service'

/** The item rows. Only Buy Once products are offered, and every row must share the first item's fulfilment profile. */
export function OrderItemsSection({ existingOrderId }: { existingOrderId: string | undefined }) {
  const { control, register, setValue, getValues, formState: { errors } } = useFormContext<OrderFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' })
  const firstProductId = items[0]?.productId ?? ''
  const profileId = firstProductId ? productService.getById(firstProductId)?.fulfilmentProfileId : undefined
  const firstOptions = useMemo(() => orderService.listOrderableProducts(), [])
  const laterOptions = useMemo(() => orderService.listOrderableProducts(profileId), [profileId])
  const preview = useMemo(() => orderService.previewTotals(items, existingOrderId), [items, existingOrderId])

  const changeProduct = (index: number, productId: string) => {
    setValue(`items.${index}.productId`, productId, { shouldDirty: true, shouldValidate: true })
    setValue(`items.${index}.variantId`, '', { shouldDirty: true })
    if (index !== 0) return
    // A different first product can mean a different fulfilment profile; items that no longer fit are dropped.
    const nextProfile = productService.getById(productId)?.fulfilmentProfileId
    const kept = getValues('items').filter((row, rowIndex) => rowIndex === 0 || productService.getById(row.productId)?.fulfilmentProfileId === nextProfile)
    if (kept.length !== getValues('items').length) { setValue('items', kept, { shouldDirty: true }); toast.info('Removed items that need a different fulfilment profile.') }
  }

  return <FormSection id="order-items-section" number="02" title="Items" description="Only products sold as Buy Once are listed. All items in one order share a fulfilment profile.">
    <div className="order-lines">
      {fields.map((field, index) => {
        const productId = items[index]?.productId ?? ''
        const variants = (productService.getById(productId)?.variants ?? []).filter(variant => variant.status === 'active' || variant.id === items[index]?.variantId)
        const rowErrors = errors.items?.[index]
        const line = preview.lines[index]
        return <div key={field.id} className="order-line">
          <FormField label="Product" required error={rowErrors?.productId?.message}>
            <SelectField label={`Product, item ${index + 1}`} value={productId} onChange={value => changeProduct(index, value)} placeholder="Select a product" options={(index === 0 ? firstOptions : laterOptions).map(product => ({ value: product.id, label: product.name }))} />
          </FormField>
          <FormField label="Variant" required error={rowErrors?.variantId?.message}>
            <SelectField label={`Variant, item ${index + 1}`} value={items[index]?.variantId ?? ''} onChange={value => setValue(`items.${index}.variantId`, value, { shouldDirty: true, shouldValidate: true })} placeholder={productId ? 'Select a variant' : 'Select a product first'} options={variants.map(variant => ({ value: variant.id, label: `${variant.name} · ${formatINR(variant.pricePaise)}` }))} />
          </FormField>
          <FormField label="Quantity" required error={rowErrors?.quantity?.message}>
            <Input type="number" inputMode="numeric" min={1} step={1} {...register(`items.${index}.quantity`, { valueAsNumber: true })} aria-invalid={rowErrors?.quantity ? true : undefined} />
          </FormField>
          <div className="order-line-total"><span>Line total</span><strong>{line?.lineTotalPaise === null || line === undefined ? '—' : formatINR(line.lineTotalPaise)}</strong></div>
          <Button type="button" variant="ghost" size="icon" className="order-line-remove" aria-label={`Remove item ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(index)}><Trash2 size={16} /></Button>
        </div>
      })}
    </div>
    {errors.items?.message && <small className="field-error" role="alert">{errors.items.message}</small>}
    <div className="order-items-footer">
      <Button type="button" variant="outline" className="secondary-button" disabled={fields.length >= MAX_ORDER_ITEMS || !firstProductId} onClick={() => append({ productId: '', variantId: '', quantity: 1 })}><Plus size={14} /> Add item</Button>
      <dl className="order-totals"><div><dt>Subtotal</dt><dd>{formatINR(preview.subtotalPaise)}</dd></div><div className="grand"><dt>Total</dt><dd>{formatINR(preview.totalPaise)}</dd></div></dl>
    </div>
  </FormSection>
}
