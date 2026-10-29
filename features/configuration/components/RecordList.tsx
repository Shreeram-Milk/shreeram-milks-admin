'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CircleCheck, CircleOff, Edit2, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { InfoTip } from '@/components/shared/InfoTip'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { ApiError } from '@/lib/api-client'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { configApi, type CutoffRule, type DeliverySlot, type FeatureRecord, type RecordStatus, type ServiceArea, type SubscriptionRule, type TrialPlan, type Usage } from '../api'
import { FEATURE_LABELS, enumText, groupPath, humanWindow, readUsages } from '../format'
import { setupHelp, type SetupScreen } from '../help'
import { tc } from '@/lib/i18n/common'
import { t, type ConfigKey } from '../messages'
import { DeleteRecordDialog } from './DeleteRecordDialog'
import { InUseDialog } from './InUseDialog'

const PAGE_SIZE = 10
const ALL = '__all__'
type ListFeature = keyof typeof FEATURE_LABELS
const COLUMNS: Record<ListFeature, ConfigKey[]> = {
  'trial-plans': ['colPlanName', 'colDuration', 'colStatus', 'colUpdated'],
  'subscription-rules': ['colName', 'colSystemType', 'colDescription', 'colStatus'],
  'delivery-slots': ['colSlotName', 'colWindow', 'colStatus', 'colUpdated'],
  'service-areas': ['colServiceArea', 'colCoverage', 'colLocation', 'colPins', 'colSlots', 'colStatus'],
  'cutoff-rules': ['colRuleName', 'colConditions', 'colStatus', 'colUpdated'],
}
/** The setup screens whose title has an "i" explanation. */
const HELP: Partial<Record<ListFeature, SetupScreen>> = { 'trial-plans': 'trialPlans', 'subscription-rules': 'subscriptionRules', 'delivery-slots': 'deliverySlots', 'service-areas': 'deliveryAreas', 'cutoff-rules': 'orderByTimes' }

type Result = { rows: FeatureRecord[]; total: number }
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; result: Result }
type Pending = { record: FeatureRecord; usages: Usage[] }

const badge = (status: RecordStatus) => <StatusBadge status={status}>{enumText(status)}</StatusBadge>

/** One page of a master-data list, loaded from the backend with search and filters applied there. */
export function RecordList({ feature }: { feature: ListFeature }) {
  const meta = FEATURE_LABELS[feature]
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [slotNames, setSlotNames] = useState<Map<string, string>>(new Map())
  const [search, setSearch] = useState(useSearchParams().get('search') ?? '')
  const [deleting, setDeleting] = useState<FeatureRecord | null>(null)
  const [status, setStatusFilter] = useState<RecordStatus | ''>('')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<Pending | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const refresh = () => setReloadKey(count => count + 1)
  const href = `/${groupPath(feature)}/${feature}`

  // Bumping `reloadKey` reloads the page; an answer that arrives after a newer request is ignored.
  useEffect(() => {
    let cancelled = false
    const slots = feature === 'service-areas' ? configApi['delivery-slots'].all() : Promise.resolve<DeliverySlot[]>([])
    Promise.all([configApi[feature].list({ search, status, page, pageSize: PAGE_SIZE }), slots]).then(
      ([result, slotList]) => { if (cancelled) return; setSlotNames(new Map(slotList.map(slot => [slot.id, slot.name]))); setState({ status: 'ready', result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [feature, reloadKey, search, status, page])

  const switchStatus = async (record: FeatureRecord, next: RecordStatus, confirmInUse = false) => {
    try {
      await configApi[feature].setStatus(record.id, next, confirmInUse)
      toast.success(t(next === 'active' ? 'activated' : 'deactivated', { name: record.name }))
      setPending(null)
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'IN_USE') { setPending({ record, usages: readUsages(failure.details) }); return }
      toast.error(describeApiError(failure))
    }
    refresh()
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('couldNotLoad', { what: meta.plural })}</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); refresh() }}>{tc('tryAgain')}</Button></div>

  const { result } = state
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const filtered = Boolean(search || status)
  const cellsFor = (row: FeatureRecord): ReactNode[] => {
    const name = <Button key="name" variant="ghost" className="table-link" onClick={() => router.push(`${href}/${row.id}`)}>{row.name}</Button>
    switch (feature) {
      case 'trial-plans': { const value = row as TrialPlan; return [name, t('daysCount', { count: value.durationDays }), badge(row.status), formatTimestamp(row.updatedAt)] }
      case 'subscription-rules': { const value = row as SubscriptionRule; return [name, <><span className="system-code">{value.systemType}</span>{value.systemType === 'custom_weekdays' && <small className="weekday-note">{t('weekdaysAll')}</small>}<small className="weekday-note">{t('ruleRange', { min: value.minDays, max: value.maxDays, options: (value.lengthOptions ?? []).join(t('or')) })}</small></>, value.description || '—', badge(row.status)] }
      case 'delivery-slots': return [name, humanWindow(row as DeliverySlot), badge(row.status), formatTimestamp(row.updatedAt)]
      case 'service-areas': { const value = row as ServiceArea; return [name, enumText(value.coverageType), value.coverageType === 'pan_india' ? t('allIndia') : [value.city, value.state].filter(Boolean).join(', ') || value.state, t('pinCount', { count: value.pinCount }), value.slotIds.map(id => slotNames.get(id)).filter(Boolean).join(', ') || '—', badge(row.status)] }
      case 'cutoff-rules': return [name, t('slotConditions', { count: (row as CutoffRule).conditions.length }), badge(row.status), formatTimestamp(row.updatedAt)]
    }
  }
  const columns = COLUMNS[feature]
  return <div className="workspace-page">
    <header className="page-header"><div><PageBreadcrumbs items={[{ label: meta.group }, { label: meta.plural }]} /><h1 className="title-with-tip">{meta.plural}{HELP[feature] && <InfoTip label={meta.plural} text={setupHelp(HELP[feature])} />}</h1><p className="page-description">{meta.description}</p></div>{<Link className="primary-button" href={`${href}/new`}><Plus size={16} /> {t('addNoun', { noun: meta.singular })}</Link>}</header>
    <section className="config-section">
      <ListSearchInput label={t('searchNoun', { noun: meta.plural.toLowerCase() })} value={search} onCommit={value => { setSearch(value); setPage(1) }} placeholder={t('searchNounPlaceholder', { noun: meta.plural.toLowerCase() })} />
      <div className="config-filter-row"><SelectField label={tc('filterByStatus')} className="config-select product-select-trigger" value={status || ALL} onChange={value => { setStatusFilter(value === ALL ? '' : value as RecordStatus); setPage(1) }} placeholder={tc('allStatuses')} options={[{ value: ALL, label: tc('allStatuses') }, { value: 'active', label: tc('active') }, { value: 'inactive', label: tc('inactive') }]} /><span className="record-count">{t('recordsCount', { count: result.total })}</span></div>
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow>{columns.map(column => <TableHead key={column}>{t(column)}</TableHead>)}<TableHead scope="col" aria-label={t('actions')} /></TableRow></TableHeader>
        <TableBody>
          {result.rows.map(row => <TableRow key={row.id}>
            {cellsFor(row).map((cell, index) => <TableCell key={`${row.id}-${index}`}>{cell}</TableCell>)}
            <TableCell><div className="row-actions">
              <Button variant="ghost" size="icon" className="row-edit-action" aria-label={tc('editName', { name: row.name })} onClick={() => router.push(`${href}/${row.id}/edit`)}><Edit2 size={15} /></Button>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={tc('actionsFor', { name: row.name })}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => router.push(`${href}/${row.id}/edit`)}><Edit2 /> {tc('edit')}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void switchStatus(row, row.status === 'active' ? 'inactive' : 'active')}>{row.status === 'active' ? <CircleOff /> : <CircleCheck />}{row.status === 'active' ? tc('deactivate') : tc('activate')}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDeleting(row)}><Trash2 /> {tc('delete')}</DropdownMenuItem>
                </DropdownMenuContent></DropdownMenu>
            </div></TableCell>
          </TableRow>)}
          {result.rows.length === 0 && <TableRow><TableCell colSpan={columns.length + 1}><div className="empty-table">{filtered ? t('noResults') : t('noneYet', { noun: meta.plural.toLowerCase() })}{!filtered && <Link className="text-button" href={`${href}/new`}>{t('createFirst', { noun: meta.singular.toLowerCase() })}</Link>}</div></TableCell></TableRow>}
        </TableBody>
      </Table></div>
      <div className="table-footer"><span>{t('showing', { from: result.total ? (page - 1) * PAGE_SIZE + 1 : 0, to: Math.min(page * PAGE_SIZE, result.total), total: result.total })}</span><div><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div></div></div>
    </section>
    {deleting && <DeleteRecordDialog target={deleting} noun={meta.singular.toLowerCase()} remove={id => configApi[feature].remove(id)} deactivate={id => configApi[feature].setStatus(id, 'inactive', true)} onClose={() => setDeleting(null)} onChanged={refresh} />}
    <InUseDialog name={pending?.record.name ?? ''} usages={pending?.usages ?? []} open={Boolean(pending)} onCancel={() => setPending(null)} onConfirm={() => { if (pending) void switchStatus(pending.record, 'inactive', true) }} />
  </div>
}
