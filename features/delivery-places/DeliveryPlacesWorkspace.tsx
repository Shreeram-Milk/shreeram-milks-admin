'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { TablePagination } from '@/components/shared/TablePagination'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { deliveryPlacesApi, type DeliveryPlace } from './api'
import { PlaceReviewDialog, PlaceMergeDialog } from './PlaceDialogs'
import { t } from './messages'

const FILTERS = { pinCode: 'free', kind: ['society', 'locality'], status: ['pending', 'approved', 'merged'] } as const
function PinFilter({ value, onCommit }: { value: string; onCommit: (pin: string | null) => void }) {
  const [draft, setDraft] = useState(value)
  return <label className="form-field"><span>{t('pin')}</span><Input aria-label={t('pin')} value={draft} maxLength={6} inputMode="numeric" onChange={event => {
    const pin = event.target.value.replace(/[^0-9]/g, '')
    setDraft(pin)
    if (!pin || /^[1-9][0-9]{5}$/.test(pin)) onCommit(pin || null)
  }} /></label>
}
export function DeliveryPlacesWorkspace() {
  const { search, page, filters, update } = useUrlListState(FILTERS)
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: DeliveryPlace[]; total: number }>({ status: 'loading' })
  const [reload, setReload] = useState(0)
  const [dialog, setDialog] = useState<{ mode: 'edit' | 'merge'; place?: DeliveryPlace } | null>(null)
  useEffect(() => {
    let alive = true
    deliveryPlacesApi.list({ search, pinCode: filters.pinCode, kind: filters.kind, status: filters.status, page, pageSize: 20 }).then(data => { if (alive) setState({ status: 'ready', ...data }) }, error => { if (alive) setState({ status: 'error', message: describeApiError(error) }) })
    return () => { alive = false }
  }, [search, page, filters.pinCode, filters.kind, filters.status, reload])
  const saved = () => { setDialog(null); setState({ status: 'loading' }); setReload(value => value + 1) }
  return <div className="workspace-page products-page">
    <header className="page-header"><div><p className="eyebrow">{t('setup')}</p><h1>{t('title')}</h1><p className="page-description">{t('description')}</p></div><div className="header-actions"><Button className="primary-button" onClick={() => setDialog({ mode: 'edit' })}>{t('add')}</Button></div></header>
    <section className="product-list-section">
      <ListSearchInput placeholder={t('search')} label={t('search')} value={search} onCommit={value => update({ search: value })} />
      <div className="product-filter-row">
        <PinFilter key={filters.pinCode} value={filters.pinCode} onCommit={pin => update({ pinCode: pin })} />
        <SelectField placeholder={t('all')} label={t('kind')} value={filters.kind || 'all'} onChange={value => update({ kind: value === 'all' ? null : value })} options={[{ value: 'all', label: t('all') }, { value: 'society', label: t('society') }, { value: 'locality', label: t('area') }]} />
        <SelectField placeholder={t('all')} label={t('status')} value={filters.status || 'all'} onChange={value => update({ status: value === 'all' ? null : value })} options={[{ value: 'all', label: t('all') }, ...(['pending', 'approved', 'merged'] as const).map(value => ({ value, label: t(value) }))]} />
      </div>
      {state.status === 'loading' ? <PageSkeleton rows={3} /> : state.status === 'error' ? <div className="product-state" role="alert"><strong>{t('failed')}</strong><span>{state.message}</span><Button variant="outline" onClick={() => setReload(value => value + 1)}>{t('retry')}</Button></div> : state.rows.length === 0 ? <div className="product-state">{t('empty')}</div> : <>
        <div className="table-card product-list-table-card"><Table className="config-table mobile-record-table"><TableHeader><TableRow>{(['name', 'pin', 'kind', 'status', 'actions'] as const).map(label => <TableHead key={label}>{t(label)}</TableHead>)}</TableRow></TableHeader><TableBody>{state.rows.map(place => <TableRow key={place.id}>
          <TableCell data-label={t('name')}><strong>{place.name}</strong><small className="cell-note">{place.locality}</small></TableCell><TableCell data-label={t('pin')}>{place.pinCode}</TableCell><TableCell data-label={t('kind')}>{t(place.kind === 'society' ? 'society' : 'area')}</TableCell><TableCell data-label={t('status')}>{t(place.status)}{place.mergedIntoId && <small className="cell-note">{t('mergedInto', { id: place.mergedIntoId })}</small>}</TableCell>
          <TableCell data-label={t('actions')}>{place.status !== 'merged' && <div className="row-actions"><Button type="button" variant="outline" onClick={() => setDialog({ mode: 'edit', place })}>{t('edit')}</Button><Button type="button" variant="outline" onClick={() => setDialog({ mode: 'merge', place })}>{t('merge')}</Button></div>}</TableCell>
        </TableRow>)}</TableBody></Table></div><div className="product-pagination"><span>{t('count', { count: state.total })}</span><TablePagination page={page} pageCount={Math.max(1, Math.ceil(state.total / 20))} onPageChange={next => update({ page: next })} /></div>
      </>}
    </section>
    {dialog?.mode === 'edit' && <PlaceReviewDialog place={dialog.place} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog?.mode === 'merge' && dialog.place && <PlaceMergeDialog place={dialog.place} onClose={() => setDialog(null)} onSaved={saved} />}
  </div>
}
