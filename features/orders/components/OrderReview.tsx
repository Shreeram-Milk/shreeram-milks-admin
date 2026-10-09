'use client'

import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormSection } from '@/components/shared/FormSection'
import { formatDisplayDate } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { CUSTOMER_TYPE_LABELS } from '../../customers/types'
import { getPrimaryAddress } from '../../customers/address'
import { productService } from '../../products/service'
import type { SubscriptionContext } from '../../subscriptions/service'
import type { OrderFormValues } from '../schema'
import { orderService } from '../service'

export function OrderReview({ context, existingOrderId }: { context: SubscriptionContext; existingOrderId: string | undefined }) {
  const { control } = useFormContext<OrderFormValues>()
  const [items, slotId, deliveryDate] = useWatch({ control, name: ['items', 'deliverySlotId', 'deliveryDate'] })
  const preview = useMemo(() => orderService.previewTotals(items, existingOrderId), [items, existingOrderId])
  const { customer, profile, slots } = context
  const address = customer ? getPrimaryAddress(customer) : undefined
  const rows: Array<[string, string]> = [
    ['Customer', customer?.fullName ?? '—'],
    ['Payment', customer ? CUSTOMER_TYPE_LABELS[customer.customerType] : '—'],
    ['Delivery date', deliveryDate ? formatDisplayDate(deliveryDate) : '—'],
    ['Delivery slot', slotId ? slots.find(slot => slot.id === slotId)?.name ?? '—' : context.eligibility?.slotRequired === false ? 'Not applicable' : '—'],
    ['PIN', address?.pinCode ?? '—'],
    ['Fulfilment', profile?.name ?? '—'],
  ]
  return <FormSection id="order-review-section" number="04" title="Review" description="Confirm the order. Prices are fixed when the order is saved.">
    <div className="product-review-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="table-card order-review-items"><table className="config-table"><thead><tr><th>Item</th><th className="numeric">Price</th><th className="numeric">Qty</th><th className="numeric">Total</th></tr></thead>
      <tbody>{items.map((item, index) => {
        const product = productService.getById(item.productId)
        const variant = product?.variants.find(candidate => candidate.id === item.variantId)
        const line = preview.lines[index]
        return <tr key={item.id ?? index}><td>{product?.name ?? '—'} · {variant?.name ?? '—'}</td><td className="numeric">{line?.unitPricePaise === null || !line ? '—' : formatINR(line.unitPricePaise)}</td><td className="numeric">{item.quantity}</td><td className="numeric">{line?.lineTotalPaise === null || !line ? '—' : formatINR(line.lineTotalPaise)}</td></tr>
      })}</tbody></table></div>
    <dl className="order-totals"><div className="grand"><dt>Order total</dt><dd>{formatINR(preview.totalPaise)}</dd></div></dl>
  </FormSection>
}
