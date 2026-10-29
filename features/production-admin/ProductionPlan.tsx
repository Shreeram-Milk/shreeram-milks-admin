'use client'

import Link from 'next/link'
import { Fragment, Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { addDays, formatTime12h, formatTimestamp, formatWeekdayDate, todayInBusinessZone } from '@/lib/business-time'
import { tc } from '@/lib/i18n/common'
import { t, warningText } from './messages'
import { TYPE_PARTS, describeTotals, planToCsv, productionAdminApi, sumTotals, type PlannedSlot, type ProductionPlan as Plan, type TypeSplit } from './api'

const FILTERS = { date: 'free', slotId: 'free', productId: 'free' } as const
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ALL = '__all__'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; plan: Plan }

/** "in 3 h 20 min" until a moment, or null once it has passed. */
function timeLeft(iso: string, now: number): string | null {
  const minutes = Math.round((Date.parse(iso) - now) / 60_000)
  if (minutes <= 0) return null
  if (minutes < 60) return t('inMinutes', { minutes })
  const hours = Math.floor(minutes / 60)
  return hours >= 24 ? t('inDays', { days: Math.floor(hours / 24), hours: hours % 24 }) : t('inHours', { hours, minutes: minutes % 60 })
}

/** Hands the browser a CSV file to save. The plan on screen (with the chosen filters) is what is saved. */
function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

const addSplit = (a: TypeSplit, b: TypeSplit): TypeSplit => ({ oneTime: a.oneTime + b.oneTime, trial: a.trial + b.trial, subscription: a.subscription + b.subscription })

/** The thin bar inside the "Repeat orders" card: one-time, subscription and trial pieces. */
function TypeBar({ split, total }: { split: TypeSplit; total: number }) {
  return <div className="type-bar" role="img" aria-label={TYPE_PARTS.map(part => `${part.label} ${split[part.key]}`).join(', ')}>
    {TYPE_PARTS.map(part => <span key={part.key} className={`type-bar-${part.key}`} style={{ width: total > 0 ? `${(split[part.key] / total) * 100}%` : '0%' }} />)}
  </div>
}

function PlanView() {
  const { filters, update } = useUrlListState(FILTERS)
  const today = todayInBusinessZone()
  // Tomorrow is the day being prepared for, so it is where the page opens.
  const date = ISO_DATE.test(filters.date) ? filters.date : addDays(today, 1)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    productionAdminApi.plan(date).then(
      plan => { if (!cancelled) { setState({ status: 'ready', plan }); setNow(Date.now()) } },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [date, reloadKey])

  // The "closes in" times count down while the page is open.
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); setReloadKey(count => count + 1) }, 60_000)
    return () => clearInterval(timer)
  }, [])

  const reload = () => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }
  const dayChip = (label: string, value: string) => <button type="button" className={`day-chip${date === value ? ' is-active' : ''}`} aria-pressed={date === value} onClick={() => update({ date: value })}>{label}</button>

  const allSlots = state.status === 'ready' ? state.plan.slots : []
  const productChoices = [...new Map(allSlots.flatMap(slot => slot.products.map(product => [product.productId, product.productName] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  // Filters only narrow what is shown; the numbers per window always come from the whole day's orders.
  const slots: PlannedSlot[] = allSlots
    .filter(slot => !filters.slotId || slot.slotId === filters.slotId)
    .map(slot => (filters.productId ? { ...slot, products: slot.products.filter(product => product.productId === filters.productId) } : slot))
    .filter(slot => slot.products.length > 0)
  const products = slots.flatMap(slot => slot.products)
  const pieces = products.reduce((sum, product) => sum + product.quantity, 0)
  const dropped = products.reduce((sum, product) => sum + product.cancelledQuantity, 0)
  const split = products.reduce<TypeSplit>((total, product) => addSplit(total, product.byType), { oneTime: 0, trial: 0, subscription: 0 })
  const repeat = split.subscription + split.trial
  const deliveries = filters.productId ? null : slots.reduce((sum, slot) => sum + slot.orderCount, 0)
  const toMake = sumTotals(products.map(product => product.production))
  const openSlots = allSlots.filter(slot => slot.status === 'open')
  const nextClose = openSlots.filter(slot => slot.closesAt).sort((a, b) => (a.closesAt ?? '').localeCompare(b.closesAt ?? ''))[0]

  return <div className="workspace-page products-page production-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('operations') }, { label: t('title') }]} /><h1>{t('title')}</h1><p className="page-description">{t('description', { day: formatWeekdayDate(date) })}</p></div>
      <div className="header-actions">{state.status === 'ready' && slots.length > 0 ? <>
        <Button variant="outline" className="secondary-button" onClick={() => downloadCsv(`production-plan-${date}.csv`, planToCsv(date, slots))}>{t('downloadCsv')}</Button>
      </> : null}
        <Button variant="outline" className="secondary-button" onClick={reload}>{tc('refresh')}</Button></div>
    </header>

    <div className="day-chip-row" role="group" aria-label={tc('deliveryDay')}>
      <button type="button" className="day-chip" onClick={() => update({ date: addDays(date, -1) })} aria-label={tc('previousDay')}>‹</button>
      {dayChip(tc('today'), today)}
      {dayChip(tc('tomorrow'), addDays(today, 1))}
      <label className="date-filter compact"><span className="sr-only">{tc('deliveryDay')}</span><Input type="date" value={date} onChange={event => update({ date: event.target.value || null })} aria-label={t('pickDay')} /></label>
      <button type="button" className="day-chip" onClick={() => update({ date: addDays(date, 1) })} aria-label={tc('nextDay')}>›</button>
    </div>

    {state.status === 'ready' && state.plan.warnings.length > 0 && <div className="product-state tone-warning" role="alert">
      <strong>{t('checkBeforeProduce')}</strong>
      {state.plan.warnings.map(warning => <span key={warning.code}>{warningText(warning)}</span>)}
    </div>}

    {state.status === 'loading' && <PageSkeleton />}
    {state.status === 'error' && <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={reload}>{tc('tryAgain')}</Button></div>}
    {state.status === 'ready' && allSlots.length === 0 && <div className="product-state"><strong>{t('nothingYet', { day: formatWeekdayDate(date) })}</strong><span>{t('nothingYetDetail')}</span></div>}

    {state.status === 'ready' && allSlots.length > 0 && <>
      <div className="window-banners">{allSlots.map(slot => <div key={slot.slotId} className={`window-banner ${slot.status === 'final' ? 'is-final' : 'is-open'}`} role="status">
        <div>
          <strong>{slot.slotName} {formatTime12h(slot.startTime)}–{formatTime12h(slot.endTime)} · {slot.status === 'final' ? t('bannerFinal') : t('bannerOpen')}</strong>
          <span>{slot.status === 'final'
            ? t('nothingChanges', { deliveries: t(slot.orderCount === 1 ? 'deliveryOne' : 'deliveryMany', { count: slot.orderCount }) })
            : slot.closesAt ? t('canChangeUntil', { time: formatTimestamp(slot.closesAt), left: timeLeft(slot.closesAt, now) ? ` (${timeLeft(slot.closesAt, now)})` : '' }) : t('noCutoffBanner')}</span>
        </div>
        {slot.status === 'final' ? <Link className="secondary-button window-banner-link" href={`/deliveries/rider-sheet?date=${date}&slotId=${slot.slotId}`}>{t('riderSheet')}</Link> : null}
      </div>)}</div>
      <div className="kpi-row kpi-row-six card-in">
        <div className="kpi-card kpi-card-main"><span>{t('makeInTotal')}</span><strong>{describeTotals(toMake, slots.reduce((sum, slot) => sum + slot.quantity, 0))}</strong><small>{t(slots.length === 1 ? 'windowOne' : 'windowMany', { count: slots.length })}</small></div>
        <div className="kpi-card"><span>{t('piecesToPack')}</span><strong>{pieces}</strong><small>{t('piecesHint')}</small></div>
        <div className="kpi-card"><span>{t('deliveries')}</span><strong>{deliveries ?? '—'}</strong><small>{deliveries === null ? t('allProductsOnly') : t('ordersToDeliver')}</small></div>
        <div className="kpi-card"><span>{t('repeatOrders')}</span><strong>{pieces > 0 ? Math.round((repeat / pieces) * 100) : 0}%</strong><small>{t('repeatSplit', { subscription: split.subscription, trial: split.trial, oneTime: split.oneTime })}</small><TypeBar split={split} total={pieces} /></div>
        <div className={`kpi-card${dropped > 0 ? ' tone-danger' : ''}`}><span>{t('cancelledSkipped')}</span><strong>{dropped}</strong><small>{t('piecesNotToMake')}</small></div>
        <div className={`kpi-card${openSlots.length === 0 ? ' tone-success' : ' tone-warning'}`}><span>{openSlots.length === 0 ? t('allFinal') : t('nextCutoff')}</span><strong>{openSlots.length === 0 ? t('makeNow') : nextClose?.closesAt ? formatTime12h(new Date(nextClose.closesAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })) : t('noCutoff')}</strong><small>{openSlots.length === 0 ? t('nothingCanChange') : nextClose ? `${nextClose.slotName}${nextClose.closesAt && timeLeft(nextClose.closesAt, now) ? ` · ${timeLeft(nextClose.closesAt, now)}` : ''}` : t('windowStillOpen', { count: openSlots.length })}</small></div>
      </div>

      <div className="plan-toolbar">
        <div className="window-tabs" role="tablist" aria-label={t('deliveryWindow')}>
          <button type="button" role="tab" aria-selected={!filters.slotId} className={`window-tab${!filters.slotId ? ' is-active' : ''}`} onClick={() => update({ slotId: null })}>{t('allWindows')}</button>
          {allSlots.map(slot => <button type="button" role="tab" key={slot.slotId} aria-selected={filters.slotId === slot.slotId} className={`window-tab${filters.slotId === slot.slotId ? ' is-active' : ''}`} onClick={() => update({ slotId: slot.slotId })}>
            {slot.slotName} <small>{formatTime12h(slot.startTime)}</small> <span className={`lock-tag ${slot.status === 'final' ? 'is-locked' : 'is-open'}`}>{slot.status === 'final' ? t('final') : t('open')}</span>
          </button>)}
        </div>
        <SelectField label={t('product')} className="product-select-trigger" value={filters.productId || ALL} onChange={value => update({ productId: value === ALL ? null : value })} placeholder={t('allProducts')} options={[{ value: ALL, label: t('allProducts') }, ...productChoices.map(([id, name]) => ({ value: id, label: name }))]} />
      </div>

      {slots.length === 0
        ? <div className="product-state"><strong>{t('noMatch')}</strong><span>{t('noMatchDetail')}</span></div>
        : <div className="table-card product-list-table-card card-in"><Table className="config-table make-table">
          <TableHeader><TableRow>
            <TableHead>{t('productAndSize')}</TableHead><TableHead className="num">{t('toMake')}</TableHead><TableHead className="num">{t('pieces')}</TableHead><TableHead className="num">{t('oneTime')}</TableHead><TableHead className="num">{t('subscription')}</TableHead><TableHead className="num">{t('trial')}</TableHead><TableHead className="num">{t('cancelledSlashSkipped')}</TableHead><TableHead className="num">{t('orders')}</TableHead><TableHead><span className="sr-only">{t('ordersLink')}</span></TableHead>
          </TableRow></TableHeader>
          <TableBody>{slots.map(slot => <Fragment key={slot.slotId}>
            <TableRow className="window-row">
              <TableCell colSpan={9}>
                <strong>{slot.slotName}</strong> <span>{formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}</span>
                <span className={`lock-tag ${slot.status === 'final' ? 'is-locked' : 'is-open'}`}>{slot.status === 'final' ? t('final') : t('open')}</span>
                <span className="window-row-note">{slot.status === 'final' ? (slot.closesAt ? t('closedMakeThis', { time: formatTimestamp(slot.closesAt) }) : t('dayBegunMakeThis')) : slot.closesAt ? t('canStillChange', { time: formatTimestamp(slot.closesAt) }) : t('noCutoffCanChange')}</span>
                <span className="window-row-total">{describeTotals(slot.products.flatMap(product => product.production).length ? sumTotals(slot.products.map(product => product.production)) : [], slot.quantity)}</span>
              </TableCell>
            </TableRow>
            {slot.products.map(product => <Fragment key={`${slot.slotId}-${product.productId}`}>
              {product.variants.map((variant, index) => <TableRow key={`${slot.slotId}-${variant.variantId}`} className="row-in">
                <TableCell>{index === 0 ? <strong className="make-product">{product.productName}</strong> : null}<span className="make-size">{variant.variantName}</span></TableCell>
                <TableCell className="num strong">{variant.production ? `${variant.production.quantity} ${variant.production.unit}` : '—'}</TableCell>
                <TableCell className="num">{variant.quantity}</TableCell>
                <TableCell className="num muted">{variant.byType.oneTime || '—'}</TableCell>
                <TableCell className="num muted">{variant.byType.subscription || '—'}</TableCell>
                <TableCell className="num muted">{variant.byType.trial || '—'}</TableCell>
                <TableCell className="num">{variant.cancelledQuantity > 0 ? <span className="dropped-count">{variant.cancelledQuantity}</span> : '—'}</TableCell>
                <TableCell className="num muted">{variant.orderCount}</TableCell>
                <TableCell>{index === 0 ? <Link className="product-name-link" href={`/orders?date=${date}&slotId=${slot.slotId}&productId=${product.productId}`}>{t('viewOrders')}</Link> : null}</TableCell>
              </TableRow>)}
              {product.variants.length > 1 ? <TableRow className="subtotal-row">
                <TableCell>{t('productTotal', { name: product.productName })}</TableCell>
                <TableCell className="num strong">{describeTotals(product.production, product.quantity)}</TableCell>
                <TableCell className="num">{product.quantity}</TableCell>
                <TableCell className="num muted">{product.byType.oneTime || '—'}</TableCell>
                <TableCell className="num muted">{product.byType.subscription || '—'}</TableCell>
                <TableCell className="num muted">{product.byType.trial || '—'}</TableCell>
                <TableCell className="num">{product.cancelledQuantity > 0 ? <span className="dropped-count">{product.cancelledQuantity}</span> : '—'}</TableCell>
                <TableCell /><TableCell />
              </TableRow> : null}
            </Fragment>)}
          </Fragment>)}</TableBody>
        </Table></div>}
    </>}
  </div>
}

/** How much of each product to make for a delivery day, per delivery window, split by how it was bought. */
export function ProductionPlan() {
  return <Suspense fallback={<PageSkeleton />}><PlanView /></Suspense>
}
