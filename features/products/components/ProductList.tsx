'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CircleOff, Edit2, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { categoryApi, type CategoryRecord } from '../../categories/api'
import { Switch } from '@/components/ui/switch'
import { productApi, type ProductStatus, type ProductSummary } from '../api'
import { METHOD_LABELS, STATUS_LABELS } from '../labels'
import { t } from '../messages'
import { tc } from '@/lib/i18n/common'

const PAGE_SIZE = 10
const ALL = '__all__'

type Result = { rows: ProductSummary[]; total: number }
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; result: Result }

/** One page of products, loaded from the backend with search and filters applied there. */
export function ProductList() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<ProductStatus | ''>('')
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<ProductSummary | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const refresh = () => setReloadKey(count => count + 1)

  // Bumping `reloadKey` reloads the page; an answer that arrives after a newer request is ignored.
  useEffect(() => {
    let cancelled = false
    Promise.all([productApi.list({ search, status, categoryId: category, page, pageSize: PAGE_SIZE }), categoryApi.all()]).then(
      ([result, list]) => { if (cancelled) return; setCategories(list); setState({ status: 'ready', result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey, search, category, status, page])

  // Whether a product can be bought on credit. Changed on the server first; the row only changes once the server has said yes.
  const [creditBusy, setCreditBusy] = useState<string | null>(null)
  const toggleCredit = async (product: ProductSummary) => {
    setCreditBusy(product.id)
    try {
      const saved = await productApi.setCreditExclusion(product.id, !product.excludedFromCredit)
      setState(current => current.status === 'ready' ? { status: 'ready', result: { ...current.result, rows: current.result.rows.map(row => row.id === product.id ? { ...row, excludedFromCredit: saved.excludedFromCredit } : row) } } : current)
      toast.success(t(saved.excludedFromCredit ? 'creditOff' : 'creditOn', { name: product.name }))
    } catch (failure) { toast.error(describeApiError(failure)) }
    setCreditBusy(null)
  }

  const deactivate = async (product: ProductSummary) => {
    try { await productApi.setStatus(product.id, 'inactive'); toast.success(t('deactivated')) } catch (failure) { toast.error(describeApiError(failure)) }
    setConfirm(null); refresh()
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('listFailed')}</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); refresh() }}>{tc('tryAgain')}</Button></div>

  const { result } = state
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const filtered = Boolean(search || category || status)
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('catalog') }, { label: t('products') }]} /><h1>{t('products')}</h1><p className="page-description">{t('listDescription')}</p></div>
      <Link className="primary-button" href="/products/new"><Plus size={15} /> {t('addProduct')}</Link>
    </header>
    <section className="product-list-section">
      <ListSearchInput label={t('searchProducts')} value={search} onCommit={value => { setSearch(value); setPage(1) }} placeholder={t('searchPlaceholder')} />
      <div className="product-filter-row">
        <SelectField label={t('category')} className="product-select-trigger" value={category || ALL} onChange={value => { setCategory(value === ALL ? '' : value); setPage(1) }} placeholder={t('allCategories')} options={[{ value: ALL, label: t('allCategories') }, ...categories.map(item => ({ value: item.id, label: item.name }))]} />
        <SelectField label={t('status')} className="product-select-trigger" value={status || ALL} onChange={value => { setStatus(value === ALL ? '' : value as ProductStatus); setPage(1) }} placeholder={t('allStatuses')} options={[{ value: ALL, label: t('allStatuses') }, { value: 'active', label: t('statusActive') }, { value: 'inactive', label: t('statusInactive') }, { value: 'draft', label: t('statusDraftShort') }]} />
      </div>
      {result.total === 0
        ? <div className="product-state"><strong>{t(filtered ? 'noMatch' : 'noneYet')}</strong><span>{t(filtered ? 'tryChanging' : 'addFirst')}</span>{!filtered && <Link className="primary-button" href="/products/new"><Plus size={14} /> {t('addProduct')}</Link>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table product-table">
            <TableHeader><TableRow><TableHead>{t('colProduct')}</TableHead><TableHead>{t('category')}</TableHead><TableHead>{t('colVariants')}</TableHead><TableHead>{t('colMethods')}</TableHead><TableHead>{t('colArea')}</TableHead><TableHead>{t('colCredit')}</TableHead><TableHead>{t('status')}</TableHead><TableHead>{t('colUpdated')}</TableHead><TableHead className="product-actions-column">{t('colActions')}</TableHead></TableRow></TableHeader>
            <TableBody>{result.rows.map(item => <TableRow key={item.id}>
              <TableCell><Link className="product-name-link" href={`/products/${item.id}`}>{item.name}</Link>{item.sku && <small>{item.sku}</small>}</TableCell>
              <TableCell>{item.categoryName}</TableCell>
              <TableCell className="product-wrap-cell">{item.variantCount ? t('variantsFrom', { count: item.variantCount, price: formatINR(item.priceFromPaise ?? 0) }) : '—'}</TableCell>
              <TableCell className="product-wrap-cell">{item.purchaseMethods.map(method => METHOD_LABELS[method]).join(', ') || '—'}</TableCell>
              <TableCell className="product-wrap-cell">{item.serviceAreaName ?? t('notSet')}</TableCell>
              <TableCell><Switch checked={!item.excludedFromCredit} disabled={creditBusy === item.id} onCheckedChange={() => void toggleCredit(item)} aria-label={t('canBuyOnCredit', { name: item.name })} /></TableCell>
              <TableCell><StatusBadge status={item.status}>{STATUS_LABELS[item.status]}</StatusBadge></TableCell>
              <TableCell>{formatTimestamp(item.updatedAt)}</TableCell>
              <TableCell><div className="row-actions product-row-actions">
                <Link href={`/products/${item.id}/edit`} className="row-edit-action" aria-label={t('editNamed', { name: item.name })}><Edit2 size={15} /></Link>
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={t('moreActionsFor', { name: item.name })}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/products/${item.id}/edit`}><Edit2 /> {t('editProduct')}</Link></DropdownMenuItem>{item.status === 'active' && <DropdownMenuItem onSelect={() => setConfirm(item)}><CircleOff /> {t('deactivate')}</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
              </div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{t('countPage', { count: result.total, page: Math.min(page, pageCount), pages: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} density="compact" /></div>
        </>}
    </section>
    <AlertDialog open={Boolean(confirm)} onOpenChange={open => { if (!open) setConfirm(null) }}>{confirm && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">{t('deactivationEyebrow')}</p><AlertDialogTitle>{t('deactivateTitle', { name: confirm.name })}</AlertDialogTitle><AlertDialogDescription asChild><div><p>{t('deactivateBody')}</p><p className="warning-note">{t('deactivateNote')}</p></div></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">{tc('cancel')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" onClick={() => void deactivate(confirm)}>{t('deactivate')}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
  </div>
}
