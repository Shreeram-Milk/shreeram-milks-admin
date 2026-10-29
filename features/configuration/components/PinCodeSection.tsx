'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ListPlus, MapPinned, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { describeApiError } from '@/lib/api-errors'
import { pinApi, type DeliverySlot, type ListResult, type Pin, type RecordStatus, type ServiceArea } from '../api'
import { enumText } from '../format'
import { PinCodeEditor, type PinEditorMode } from './PinCodeEditor'
import { tc } from '@/lib/i18n/common'
import { t } from '../messages'

const PAGE_SIZE = 8
const ALL = '__all__'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; result: ListResult<Pin> }
type EditorState = { mode: PinEditorMode; editing: Pin | null } | null

/** The PIN codes of one PIN-code area, a page at a time from the server. Adding and editing happen in a side panel. */
export function PinCodeSection({ area, slots, onChanged, startOpen = false }: { area: ServiceArea; slots: DeliverySlot[]; onChanged: () => void; startOpen?: boolean }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [search, setSearch] = useState('')
  const [slotId, setSlotId] = useState('')
  const [status, setStatus] = useState<RecordStatus | ''>('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [editor, setEditor] = useState<EditorState>(startOpen ? { mode: 'one', editing: null } : null)
  const slotName = (id: string) => slots.find(slot => slot.id === id)?.name ?? t('inactiveSlot')
  const filtered = Boolean(search || slotId || status)

  useEffect(() => {
    let cancelled = false
    pinApi.list(area.id, { search, status, slotId, page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [area.id, search, status, slotId, page, reloadKey])

  const open = (mode: PinEditorMode) => setEditor({ mode, editing: null })
  const saved = () => { setEditor(null); setReloadKey(count => count + 1); onChanged() }
  const pageCount = state.status === 'ready' ? Math.max(1, Math.ceil(state.result.total / PAGE_SIZE)) : 1

  return <section className="section-block detail-section pin-section">
    <div className="pin-section-head">
      <div>
        <h2>{t('pinCodesTitle')} <span className="pin-total">{area.pinCount}</span></h2>
        <p>{t('pinCodesIntro')}</p>
      </div>
      <div className="pin-add-group">
        <Button className="primary-button pin-add-main" onClick={() => open('one')}><Plus size={15} /> {t('addPinCodes')}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button className="primary-button pin-add-more" aria-label={t('moreWays')}><ChevronDown size={15} /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => open('many')}><ListPlus size={15} /> {t('pasteList')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open('city')}><MapPinned size={15} /> {t('addFromCity')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <div className="pin-toolbar">
      <ListSearchInput label={t('searchPin')} value={search} onCommit={value => { setSearch(value); setPage(1) }} placeholder={t('searchPin')} />
      <SelectField label={t('filterSlot')} className="config-select" value={slotId || ALL} onChange={value => { setSlotId(value === ALL ? '' : value); setPage(1) }} placeholder={t('allSlots')} options={[{ value: ALL, label: t('allSlots') }, ...slots.map(slot => ({ value: slot.id, label: slot.name }))]} />
      <SelectField label={t('filterPinStatus')} className="config-select" value={status || ALL} onChange={value => { setStatus(value === ALL ? '' : value as RecordStatus); setPage(1) }} placeholder={t('allStatuses')} options={[{ value: ALL, label: t('allStatuses') }, { value: 'active', label: tc('active') }, { value: 'inactive', label: tc('inactive') }]} />
    </div>

    {state.status === 'error' && <div className="product-state" role="alert"><strong>{t('pinsFailed')}</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{t('tryAgain')}</Button></div>}
    {state.status === 'loading' && <div className="product-state" aria-busy="true"><span>{t('loadingPins')}</span></div>}
    {state.status === 'ready' && <div className="table-card"><div className="table-scroll"><Table>
      <TableHeader><TableRow><TableHead>{t('pinCode')}</TableHead><TableHead>{t('locality')}</TableHead><TableHead>{t('deliverySlotsCol')}</TableHead><TableHead>{t('status')}</TableHead><TableHead className="pin-col-action"><span className="sr-only">{t('actions')}</span></TableHead></TableRow></TableHeader>
      <TableBody>
        {state.result.rows.map(pin => <TableRow key={pin.id}>
          <TableCell className="pin-code-cell">{pin.pinCode}</TableCell>
          <TableCell className="pin-locality-cell">{pin.locality || <span className="pin-muted">—</span>}</TableCell>
          <TableCell><div className="pin-slot-chips">{pin.allowedDeliverySlotIds.map(id => <span key={id} className="pin-slot-chip">{slotName(id)}</span>)}</div></TableCell>
          <TableCell><StatusBadge status={pin.status}>{enumText(pin.status)}</StatusBadge></TableCell>
          <TableCell className="pin-col-action"><Button className="pin-row-edit" aria-label={t('editPin', { pin: pin.pinCode })} onClick={() => setEditor({ mode: 'one', editing: pin })}><Pencil size={14} /> {tc('edit')}</Button></TableCell>
        </TableRow>)}
        {state.result.rows.length === 0 && <TableRow><TableCell colSpan={5}><div className="pin-empty">
          {filtered ? <><strong>{t('noPinsMatch')}</strong><span>{t('tryDifferent')}</span></>
            : <><strong>{t('noPinsYet')}</strong><span>{t('noPinsHint')}</span><Button className="primary-button" onClick={() => open('one')}><Plus size={15} /> {t('addPinCodes')}</Button></>}
        </div></TableCell></TableRow>}
      </TableBody>
    </Table></div>
    {state.result.total > 0 && <div className="table-footer"><span>{t(state.result.total === 1 ? 'pinsTotalOne' : 'pinsTotalMany', { count: state.result.total, matching: filtered ? t('matching') : '' })}</span><div><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div></div>}
    </div>}

    {editor && <PinCodeEditor area={area} slots={slots} mode={editor.mode} editing={editor.editing} onClose={() => setEditor(null)} onSaved={saved} />}
  </section>
}
