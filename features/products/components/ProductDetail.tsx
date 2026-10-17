'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import type { SubscriptionRule, TrialPlan } from '../../configuration/api'
import { productApi, type Product } from '../api'
import { METHOD_LABELS, STATUS_LABELS } from '../labels'
import { ProductContentSummary } from './ProductContentSummary'
import type { ProductReferences } from './ProductForm'

/** Read-only view of one product, with Deactivate and Activate. Switching on is refused by the server until the product is complete. */
export function ProductDetail({ product: initial, refs }: { product: Product; refs: ProductReferences }) {
  const router = useRouter()
  const [product, setProduct] = useState(initial)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const category = refs.categories.find(item => item.id === product.categoryId)

  const changeStatus = async (status: 'active' | 'inactive') => {
    setBusy(true)
    try { setProduct(await productApi.setStatus(product.id, status)); toast.success(status === 'inactive' ? 'Product deactivated.' : product.status === 'draft' ? 'Product published.' : 'Product activated.') } catch (failure) { toast.error(describeApiError(failure)) }
    setBusy(false); setConfirm(false)
  }

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" onClick={() => router.push('/products')} aria-label="Back to products"><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: 'Products', href: '/products' }, { label: product.name }]} /><h1>{product.name}</h1><p className="page-description">{product.shortDescriptionEn || 'Review product details, purchase methods, and delivery.'}</p></div>
      </div>
      <div className="header-actions">
        <StatusBadge status={product.status}>{STATUS_LABELS[product.status]}</StatusBadge>
        <Link className="primary-button" href={`/products/${product.id}/edit`}><Edit2 size={15} /> Edit Product</Link>
        {product.status === 'draft' && <Button className="primary-button" disabled={busy} onClick={() => void changeStatus('active')}>{busy ? 'Publishing…' : 'Publish'}</Button>}
        {product.status === 'active' && <Button className="secondary-button" onClick={() => setConfirm(true)}>Deactivate</Button>}
        {product.status === 'inactive' && <Button className="secondary-button" disabled={busy} onClick={() => void changeStatus('active')}>Activate</Button>}
      </div>
    </header>
    <div className="product-detail-grid">
      <section className="form-card"><h2>Product overview</h2><div className="product-detail-rows"><Summary label="Category" value={category?.name ?? '—'} /><Summary label="Gujarati name" value={product.nameGu || '—'} /><Summary label="SKU" value={product.sku || '—'} /><Summary label="Purchase methods" value={product.purchaseMethods.map(method => METHOD_LABELS[method]).join(', ') || '—'} /><Summary label="Updated" value={formatTimestamp(product.updatedAt)} /></div></section>
      <section className="form-card"><h2>Content</h2><ProductContentSummary product={product} /></section>
      <section className="form-card"><h2>Variants &amp; pricing</h2>{product.variants.length ? <div className="product-table-wrap"><Table className="config-table"><TableHeader><TableRow><TableHead>Variant</TableHead><TableHead>Price</TableHead><TableHead>Display</TableHead><TableHead>Production conversion</TableHead></TableRow></TableHeader><TableBody>{product.variants.map(variant => <TableRow key={variant.id}><TableCell>{variant.name}{variant.status === 'inactive' && <em className="product-inactive">Inactive</em>}</TableCell><TableCell>{formatINR(variant.pricePaise)}{variant.compareAtPricePaise !== null && <small className="cell-note">was {formatINR(variant.compareAtPricePaise)}</small>}</TableCell><TableCell>{variant.displayQuantity} {variant.displayUnit}</TableCell><TableCell>{variant.productionUnit ? `${variant.productionQuantity} ${variant.productionUnit}` : 'Disabled'}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="product-hint">No variants saved.</p>}</section>
      {product.purchaseMethods.includes('trial') && <section className="form-card"><h2>Trial plans</h2><ReferenceNames ids={product.trialPlanIds} rows={refs.trialPlans} /></section>}
      {product.purchaseMethods.includes('subscription') && <section className="form-card product-subscription-card"><h2>Subscription schedules</h2><ReferenceNames ids={product.subscriptionRuleIds} rows={refs.rules} /></section>}
      <section className="form-card"><h2>Delivery</h2><DeliverySummary product={product} refs={refs} /></section>
    </div>
    <AlertDialog open={confirm} onOpenChange={setConfirm}>{confirm && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Product deactivation</p><AlertDialogTitle>Deactivate “{product.name}”?</AlertDialogTitle><AlertDialogDescription>Existing historical records will remain unchanged. New purchases and subscriptions will no longer be allowed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" disabled={busy} onClick={() => void changeStatus('inactive')}>Deactivate</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
  </div>
}

function DeliverySummary({ product, refs }: { product: Product; refs: ProductReferences }) {
  if (!product.deliveryMethod) return <p className="product-hint">No delivery set up yet.</p>
  const area = refs.areas.find(item => item.id === product.serviceAreaId)
  const cutoff = refs.cutoffRules.find(item => item.id === product.cutoffRuleId)
  return <div className="product-detail-rows"><Summary label="Delivered by" value={product.deliveryMethod === 'local_delivery' ? 'Our own delivery' : 'Courier shipping'} /><Summary label="Delivery area" value={area ? `${area.name}${area.status === 'inactive' ? ' (inactive)' : ''}` : '—'} /><Summary label="Order cut-off" value={cutoff?.name ?? 'None'} /><Summary label="Production planning" value={product.includeInProductionPlanning ? 'Included' : 'Not included'} /></div>
}
function ReferenceNames<T extends TrialPlan | SubscriptionRule>({ ids, rows }: { ids: string[]; rows: T[] }) {
  return <ul className="product-reference-list">{ids.length ? ids.map(id => { const row = rows.find(item => item.id === id); return <li key={id}>{row?.name ?? 'Unavailable configuration'}{row?.status === 'inactive' && <em className="product-inactive">Inactive</em>}</li> }) : <li>None selected</li>}</ul>
}
function Summary({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
