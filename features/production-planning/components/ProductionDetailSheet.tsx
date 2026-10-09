'use client'

import Link from 'next/link'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatProductionQuantity } from '../quantity'
import type { ProductionPlan, ProductionProductRequirement } from '../types'

/** Everything behind one product's total: variants, PIN codes, sources, and a link back to the deliveries. */
export function ProductionDetailSheet({ plan, product, onClose }: { plan: ProductionPlan; product: ProductionProductRequirement | null; onClose: () => void }) {
  const byPin = product ? plan.areas.flatMap(area => area.items.filter(item => item.productId === product.productId && item.unit === product.unit).map(item => ({ pinCode: area.pinCode, locality: area.locality, requiredBase: item.requiredBase }))) : []
  const link = product ? `/deliveries?date=${plan.date}${plan.slotId ? `&slot=${plan.slotId}` : ''}&product=${product.productId}&status=${plan.mode === 'historical' ? 'delivered' : 'scheduled'}` : '/deliveries'
  return <Sheet open={product !== null} onOpenChange={open => { if (!open) onClose() }}>
    <SheetContent side="right" className="production-sheet">
      {product && <>
        <SheetHeader><SheetTitle>{product.productName}</SheetTitle><SheetDescription>{product.deliveryCount.toLocaleString('en-IN')} {product.deliveryCount === 1 ? 'delivery' : 'deliveries'}</SheetDescription></SheetHeader>
        <div className="production-sheet-body">
          <p className="production-sheet-total"><span>Total required</span><strong>{formatProductionQuantity(product.unit, product.requiredBase)}</strong></p>
          <h3>Variants</h3>
          <ul className="breakdown-list">{product.variants.map(variant => <li key={variant.variantId}><span>{variant.variantName} <small>{variant.units.toLocaleString('en-IN')} {variant.units === 1 ? 'unit' : 'units'}</small></span><strong>{formatProductionQuantity(product.unit, variant.requiredBase)}</strong></li>)}</ul>
          <h3>By PIN code</h3>
          <ul className="breakdown-list">{byPin.map(row => <li key={row.pinCode}><span>{row.pinCode} <small>{row.locality}</small></span><strong>{formatProductionQuantity(product.unit, row.requiredBase)}</strong></li>)}</ul>
          <h3>By source</h3>
          <ul className="breakdown-list">{product.sources.map(source => <li key={source.sourceType}><span>{source.sourceType === 'subscription' ? 'Subscription' : source.sourceType === 'trial' ? 'Trial' : 'Buy Once'}</span><strong>{formatProductionQuantity(product.unit, source.requiredBase)}</strong></li>)}</ul>
          <Link className="secondary-button" href={link}>View Deliveries</Link>
        </div>
      </>}
    </SheetContent>
  </Sheet>
}
