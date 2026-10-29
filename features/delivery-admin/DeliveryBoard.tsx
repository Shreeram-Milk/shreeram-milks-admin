'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectField } from '@/components/ui/select-field'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { tc } from '@/lib/i18n/common'
import { addDays, formatWeekdayDate, isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { configApi, type DeliverySlot } from '../configuration/api'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, orderAdminApi, type AdminOrder } from '../order-admin/api'
import { t, type DeliveryKey } from './messages'

/** The most orders one day and window can show at once (the server's limit for a page and for one bulk step). */
const DAY_LIMIT = 200
const FILTERS = { date: 'free', slotId: 'free' } as const
const ALL = '__all__'
type BulkStep = 'out_for_delivery' | 'delivered' | 'missed'
const STEP_TEXT: Record<BulkStep, { button: DeliveryKey; consequence: DeliveryKey }> = {
  out_for_delivery: { button: 'outButton', consequence: 'outConsequence' },
  delivered: { button: 'deliveredButton', consequence: 'deliveredConsequence' },
  missed: { button: 'missedButton', consequence: 'missedConsequence' },
}
/** Which orders a step can move. The server checks again and reports any it refuses. */
const CAN_TAKE: Record<BulkStep, ReadonlyArray<AdminOrder['status']>> = { out_for_delivery: ['placed'], delivered: ['out_for_delivery'], missed: ['placed', 'out_for_delivery'] }

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; orders: AdminOrder[]; total: number }

/** One delivery day as a route: orders by window and PIN code, with ticks to move many at once (out, delivered, missed). */
export function DeliveryBoard() {
  const { filters, update } = useUrlListState(FILTERS)
  const date = isIsoDate(filters.date) ? filters.date : todayInBusinessZone()
  const slotId = filters.slotId
  const [slots, setSlots] = useState<DeliverySlot[]>([])
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<BulkStep | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    configApi['delivery-slots'].all().then(rows => { if (!cancelled) setSlots(rows) }, () => { /* The filter is optional; the board works without it. */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    orderAdminApi.list({ search: '', status: '', date, slotId: slotId || undefined, page: 1, pageSize: DAY_LIMIT }).then(
      result => { if (!cancelled) { setState({ status: 'ready', orders: result.rows, total: result.total }); setPicked(new Set()) } },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [date, slotId, reloadKey])

  const groups = useMemo(() => {
    if (state.status !== 'ready') return []
    const byKey = new Map<string, { key: string; title: string; orders: AdminOrder[] }>()
    for (const order of state.orders.filter(item => item.status !== 'cancelled')) {
      const window = order.slot ? `${order.slot.name} (${order.slot.startTime}–${order.slot.endTime})` : order.deliveryMethod === 'shipping' ? t('courier') : t('noWindow')
      const key = `${window}|${order.pinCode}`
      const group = byKey.get(key) ?? { key, title: `${window} · ${t('pin', { pin: order.pinCode })}${order.city ? ` · ${order.city}` : ''}`, orders: [] }
      group.orders.push(order)
      byKey.set(key, group)
    }
    return [...byKey.values()]
  }, [state])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button></div>

  const open = groups.flatMap(group => group.orders).filter(order => order.status === 'placed' || order.status === 'out_for_delivery')
  const toggle = (ids: string[], on: boolean) => setPicked(current => { const next = new Set(current); for (const id of ids) { if (on) next.add(id); else next.delete(id) } return next })
  const chosen = (wanted: BulkStep) => open.filter(order => picked.has(order.id) && CAN_TAKE[wanted].includes(order.status))
  const cancelledCount = state.orders.filter(order => order.status === 'cancelled').length

  const apply = async () => {
    if (!step) return
    const ids = chosen(step).map(order => order.id)
    setBusy(true)
    try {
      const result = await orderAdminApi.bulkStatus(ids, step)
      toast.success(t(result.updated === 1 ? 'movedOne' : 'movedMany', { count: result.updated, status: ORDER_STATUS_LABELS[step].toLowerCase() }))
      if (result.failed.length > 0) toast.error(t('someFailed', { count: result.failed.length }))
      setStep(null)
      setReloadKey(count => count + 1)
    } catch (failure) { toast.error(describeApiError(failure)) }
    setBusy(false)
  }

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('operations') }, { label: t('deliveries') }]} /><h1>{t('deliveries')}</h1><p className="page-description">{t('boardDescription')}</p></div>
      <div className="header-actions">
        <Button variant="outline" className="secondary-button" asChild><Link href={`/deliveries/rider-sheet?date=${date}${slotId ? `&slotId=${slotId}` : ''}`}>{t('riderSheet')}</Link></Button>
        {(['out_for_delivery', 'delivered', 'missed'] as const).map(item => <Button key={item} className={item === 'missed' ? 'secondary-button' : 'primary-button'} variant={item === 'missed' ? 'outline' : 'default'} disabled={chosen(item).length === 0} onClick={() => setStep(item)}>{t(STEP_TEXT[item].button)}{chosen(item).length > 0 ? ` (${chosen(item).length})` : ''}</Button>)}
      </div>
    </header>
    <section className="product-list-section">
      <div className="product-filter-row">
        <DatePickerField label={tc('deliveryDay')} value={date} onChange={value => update({ date: value })} />
        <Button className="secondary-button" variant="outline" onClick={() => update({ date: addDays(date, -1) })}>{tc('previousDay')}</Button>
        <Button className="secondary-button" variant="outline" onClick={() => update({ date: todayInBusinessZone() })}>{tc('today')}</Button>
        <Button className="secondary-button" variant="outline" onClick={() => update({ date: addDays(date, 1) })}>{tc('nextDay')}</Button>
        <SelectField label={t('window')} className="product-select-trigger" value={slotId || ALL} onChange={value => update({ slotId: value === ALL ? null : value })} placeholder={t('allWindows')} options={[{ value: ALL, label: t('allWindows') }, ...slots.map(slot => ({ value: slot.id, label: `${slot.name} (${slot.startTime}–${slot.endTime})` }))]} />
      </div>
      {state.total > DAY_LIMIT ? <div className="setup-note attention" role="status"><div><strong>{t('showingFirst', { limit: DAY_LIMIT, total: state.total })}</strong>{t('chooseOneWindow')}</div></div> : null}
      {groups.length === 0
        ? <div className="product-state"><strong>{t('noDeliveriesOn', { day: formatWeekdayDate(date) })}</strong><span>{cancelledCount > 0 ? t(cancelledCount === 1 ? 'cancelledHiddenOne' : 'cancelledHiddenMany', { count: cancelledCount }) : ''}{t('subscriptionsAhead')}</span></div>
        : <>
          <label className="pin-checklist-all"><Checkbox checked={open.length > 0 && open.every(order => picked.has(order.id))} onCheckedChange={checked => toggle(open.map(order => order.id), checked === true)} aria-label={t('tickAll')} /><span><strong>{picked.size}</strong> {t('tickedOf', { count: open.length })}{cancelledCount > 0 ? t('cancelledHidden', { count: cancelledCount }) : ''}</span></label>
          {groups.map(group => {
            const groupOpen = group.orders.filter(order => order.status === 'placed' || order.status === 'out_for_delivery')
            return <div className="table-card product-list-table-card" key={group.key}>
              <Table className="config-table">
                <TableHeader><TableRow>
                  <TableHead><Checkbox disabled={groupOpen.length === 0} checked={groupOpen.length > 0 && groupOpen.every(order => picked.has(order.id))} onCheckedChange={checked => toggle(groupOpen.map(order => order.id), checked === true)} aria-label={t('tickGroup', { group: group.title })} /></TableHead>
                  <TableHead colSpan={4}>{group.title} · {t(group.orders.length === 1 ? 'orderCountOne' : 'orderCountMany', { count: group.orders.length })}</TableHead>
                </TableRow></TableHeader>
                <TableBody>{group.orders.map(order => {
                  const canPick = order.status === 'placed' || order.status === 'out_for_delivery'
                  return <TableRow key={order.id}>
                    <TableCell><Checkbox disabled={!canPick} checked={picked.has(order.id)} onCheckedChange={checked => toggle([order.id], checked === true)} aria-label={t('tickOrder', { number: order.orderNumber })} /></TableCell>
                    <TableCell><Link className="product-name-link" href={`/orders/${order.id}`}>{order.orderNumber}</Link>{order.subscriptionId ? <><br /><small>{order.items[0]?.purchaseMethod === 'trial' ? t('trial') : t('subscription')}</small></> : null}</TableCell>
                    <TableCell>{order.recipientName} · {order.recipientPhone}<br /><small>{[order.addressLine1, order.addressLine2, order.landmark].filter(Boolean).join(', ')}{order.doorstepNote ? ` · ${order.doorstepNote}` : ''}</small></TableCell>
                    <TableCell>{order.items.map(item => `${item.productName} ${item.variantName} × ${item.quantity}`).join(', ')}</TableCell>
                    <TableCell><StatusBadge status={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge></TableCell>
                  </TableRow>
                })}</TableBody>
              </Table>
            </div>
          })}
        </>}
    </section>
    <AlertDialog open={step !== null} onOpenChange={value => { if (!value && !busy) setStep(null) }}>
      {step && <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader>
          <p className="eyebrow">{ORDER_STATUS_LABELS[step]}</p>
          <AlertDialogTitle>{t('confirmTitle', { step: t(STEP_TEXT[step].button), count: chosen(step).length, orders: chosen(step).length === 1 ? t('orderWord') : t('ordersWord') })}</AlertDialogTitle>
          <AlertDialogDescription>{t(STEP_TEXT[step].consequence)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>{tc('notNow')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className={step === 'missed' ? 'primary-button destructive-button' : 'primary-button'} disabled={busy} onClick={event => { event.preventDefault(); void apply() }}>{busy ? tc('saving') : t(STEP_TEXT[step].button)}</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </div>
}
