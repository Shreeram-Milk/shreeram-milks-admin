'use client'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatProductionQuantity, PRODUCTION_UNIT_LABELS } from '../quantity'
import type { ProductionProductRequirement } from '../types'

/** Primary view: one row per product (per unit), with variant demand listed inline. */
export function ProductRequirementsTable({ products, requirementLabel, onOpen }: { products: ProductionProductRequirement[]; requirementLabel: string; onOpen: (product: ProductionProductRequirement) => void }) {
  return <div className="table-card product-list-table-card"><Table className="config-table production-table">
    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Variant Demand</TableHead><TableHead>Deliveries</TableHead><TableHead>{requirementLabel}</TableHead><TableHead>Unit</TableHead><TableHead className="product-actions-column">Details</TableHead></TableRow></TableHeader>
    <TableBody>{products.map(product => <TableRow key={`${product.productId}|${product.unit}`}>
      <TableCell><strong className="product-name-strong">{product.productName}</strong>{product.inactive && <em className="product-inactive">Inactive</em>}</TableCell>
      <TableCell><ul className="variant-demand">{product.variants.map(variant => <li key={variant.variantId}>{variant.variantName} × {variant.units.toLocaleString('en-IN')} <span>= {formatProductionQuantity(product.unit, variant.requiredBase)}</span></li>)}</ul></TableCell>
      <TableCell>{product.deliveryCount.toLocaleString('en-IN')}</TableCell>
      <TableCell><strong>{formatProductionQuantity(product.unit, product.requiredBase)}</strong></TableCell>
      <TableCell>{PRODUCTION_UNIT_LABELS[product.unit].name}</TableCell>
      <TableCell><div className="row-actions"><Button type="button" variant="outline" className="secondary-button preview-skip-button" onClick={() => onOpen(product)} aria-label={`Details for ${product.productName}`}>Details</Button></div></TableCell>
    </TableRow>)}</TableBody>
  </Table></div>
}
