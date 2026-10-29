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
import { t } from '../messages'
import { unitLabel } from '../units'
import { tc } from '@/lib/i18n/common'
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
    try { setProduct(await productApi.setStatus(product.id, status)); toast.success(t(status === 'inactive' ? 'deactivated' : product.status === 'draft' ? 'published' : 'activated')) } catch (failure) { toast.error(describeApiError(failure)) }
    setBusy(false); setConfirm(false)
  }

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" onClick={() => router.push('/products')} aria-label={t('backToProducts')}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: t('products'), href: '/products' }, { label: product.name }]} /><h1>{product.name}</h1><p className="page-description">{product.shortDescriptionEn || t('detailDescription')}</p></div>
      </div>
      <div className="header-actions">
        <StatusBadge status={product.status}>{STATUS_LABELS[product.status]}</StatusBadge>
        <Link className="primary-button" href={`/products/${product.id}/edit`}><Edit2 size={15} /> {t('editProductButton')}</Link>
        {product.status === 'draft' && <Button className="primary-button" disabled={busy} onClick={() => void changeStatus('active')}>{t(busy ? 'publishing' : 'publish')}</Button>}
        {product.status === 'active' && <Button className="secondary-button" onClick={() => setConfirm(true)}>{t('deactivate')}</Button>}
        {product.status === 'inactive' && <Button className="secondary-button" disabled={busy} onClick={() => void changeStatus('active')}>{t('activate')}</Button>}
      </div>
    </header>
    <div className="product-detail-grid">
      <section className="form-card"><h2>{t('overview')}</h2><div className="product-detail-rows"><Summary label={t('category')} value={category?.name ?? '—'} /><Summary label={t('gujaratiName')} value={product.nameGu || '—'} /><Summary label={t('sku')} value={product.sku || '—'} /><Summary label={t('purchaseMethods')} value={product.purchaseMethods.map(method => METHOD_LABELS[method]).join(', ') || '—'} /><Summary label={t('updated')} value={formatTimestamp(product.updatedAt)} /></div></section>
      <section className="form-card"><h2>{t('content')}</h2><ProductContentSummary product={product} /></section>
      <section className="form-card"><h2>{t('variantsPricing')}</h2>{product.variants.length ? <div className="product-table-wrap"><Table className="config-table"><TableHeader><TableRow><TableHead>{t('variant')}</TableHead><TableHead>{t('price')}</TableHead><TableHead>{t('display')}</TableHead><TableHead>{t('productionConversion')}</TableHead></TableRow></TableHeader><TableBody>{product.variants.map(variant => <TableRow key={variant.id}><TableCell>{variant.name}{variant.status === 'inactive' && <em className="product-inactive">{t('inactive')}</em>}</TableCell><TableCell>{formatINR(variant.pricePaise)}{variant.compareAtPricePaise !== null && <small className="cell-note">{t('was', { price: formatINR(variant.compareAtPricePaise) })}</small>}</TableCell><TableCell>{variant.displayQuantity} {unitLabel(variant.displayUnit)}</TableCell><TableCell>{variant.productionUnit ? `${variant.productionQuantity} ${unitLabel(variant.productionUnit)}` : t('disabled')}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="product-hint">{t('noVariants')}</p>}</section>
      {product.purchaseMethods.includes('trial') && <section className="form-card"><h2>{t('trialPlans')}</h2><ReferenceNames ids={product.trialPlanIds} rows={refs.trialPlans} /></section>}
      {product.purchaseMethods.includes('subscription') && <section className="form-card product-subscription-card"><h2>{t('subscriptionSchedules')}</h2><ReferenceNames ids={product.subscriptionRuleIds} rows={refs.rules} /></section>}
      <section className="form-card"><h2>{t('delivery')}</h2><DeliverySummary product={product} refs={refs} /></section>
    </div>
    <AlertDialog open={confirm} onOpenChange={setConfirm}>{confirm && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">{t('deactivationEyebrow')}</p><AlertDialogTitle>{t('deactivateTitle', { name: product.name })}</AlertDialogTitle><AlertDialogDescription>{t('detailDeactivateBody')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">{tc('cancel')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" disabled={busy} onClick={() => void changeStatus('inactive')}>{t('deactivate')}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
  </div>
}

function DeliverySummary({ product, refs }: { product: Product; refs: ProductReferences }) {
  if (!product.deliveryMethod) return <p className="product-hint">{t('noDelivery')}</p>
  const area = refs.areas.find(item => item.id === product.serviceAreaId)
  const cutoff = refs.cutoffRules.find(item => item.id === product.cutoffRuleId)
  return <div className="product-detail-rows"><Summary label={t('deliveredBy')} value={t(product.deliveryMethod === 'local_delivery' ? 'ownDelivery' : 'courierShipping')} /><Summary label={t('deliveryArea')} value={area ? (area.status === 'inactive' ? t('inactiveSuffix', { name: area.name }) : area.name) : '—'} /><Summary label={t('orderCutoff')} value={cutoff?.name ?? t('none')} /><Summary label={t('productionPlanning')} value={t(product.includeInProductionPlanning ? 'included' : 'notIncluded')} /></div>
}
function ReferenceNames<T extends TrialPlan | SubscriptionRule>({ ids, rows }: { ids: string[]; rows: T[] }) {
  return <ul className="product-reference-list">{ids.length ? ids.map(id => { const row = rows.find(item => item.id === id); return <li key={id}>{row?.name ?? t('unavailableConfig')}{row?.status === 'inactive' && <em className="product-inactive">{t('inactive')}</em>}</li> }) : <li>{t('noneSelected')}</li>}</ul>
}
function Summary({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
