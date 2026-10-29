'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Printer, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { tc } from '@/lib/i18n/common'
import { addDays, formatTime12h, formatTimestamp, formatWeekdayDate, isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { configApi, type DeliverySlot } from '../configuration/api'
import { riderSheetApi, sumLoad, type RiderSheet as Sheet } from '../production-admin/api'
import { warningText } from '../production-admin/messages'
import { RiderSheetPrint } from './RiderSheetPrint'
import { t } from './messages'

const FILTERS = { date: 'free', slotId: 'free' } as const
const MAX_RIDERS = 20

/** What was loaded for one day, window and refresh (`key`); a different key means that answer is still on its way. */
type LoadState = { key: string; status: 'error'; message: string } | { key: string; status: 'ready'; sheet: Sheet }
/** Which rider's sheet is being printed (one rider by position, or every rider). `id` is new on every press, so pressing Print twice prints twice. */
type Printing = { target: number | 'all'; id: number } | null

const riderLabel = (names: string[], index: number) => names[index]?.trim() || t('riderNumber', { number: index + 1 })
/** The name printed on a sheet: none when one person does every delivery and typed no name, since "Rider 1" would say nothing. */
const printedName = (names: string[], index: number) => (names.length === 1 && !names[0]?.trim() ? '' : riderLabel(names, index))

/**
 * The rider sheet for one delivery window: staff give each PIN code to a rider (one rider keeps them all), set the order the
 * areas are visited in, and print each rider's sheet, or all of them, from the browser ("Save as PDF" makes the file to send).
 */
export function RiderSheet() {
  const { filters, update } = useUrlListState(FILTERS)
  const date = isIsoDate(filters.date) ? filters.date : todayInBusinessZone()
  const slotId = filters.slotId
  const [slots, setSlots] = useState<DeliverySlot[]>([])
  const [loaded, setLoaded] = useState<LoadState | null>(null)
  const [slotsError, setSlotsError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const loadKey = `${date}|${slotId}|${reloadKey}`
  const [riders, setRiders] = useState<string[]>([''])
  // Rider position per PIN code; a PIN code not listed belongs to the first rider.
  const [assigned, setAssigned] = useState<Record<string, number>>({})
  const [pinOrder, setPinOrder] = useState<string[]>([])
  const [printing, setPrinting] = useState<Printing>(null)

  useEffect(() => {
    let cancelled = false
    configApi['delivery-slots'].all().then(rows => { if (!cancelled) setSlots(rows) }, failure => { if (!cancelled) setSlotsError(describeApiError(failure)) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!slotId) return
    let cancelled = false
    riderSheetApi.get(date, slotId).then(
      sheet => {
        if (cancelled) return
        setLoaded({ key: loadKey, status: 'ready', sheet })
        // Keep the order staff chose for PIN codes still on the sheet; new ones go last, lowest first (as the server sorts them).
        setPinOrder(current => {
          const pins = sheet.areas.map(area => area.pinCode)
          return [...current.filter(pin => pins.includes(pin)), ...pins.filter(pin => !current.includes(pin))]
        })
      },
      failure => { if (!cancelled) setLoaded({ key: loadKey, status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [date, slotId, loadKey])

  // Printing waits for the chosen sheets to be on the page, then hands over to the browser's print dialog.
  useEffect(() => {
    if (printing === null) return
    const done = () => setPrinting(null)
    window.addEventListener('afterprint', done)
    window.print()
    return () => window.removeEventListener('afterprint', done)
  }, [printing])

  const state = !slotId ? 'idle' : loaded?.key === loadKey ? loaded : 'loading'
  const sheet = typeof state === 'object' && state.status === 'ready' ? state.sheet : null
  const perRider = useMemo(() => {
    if (!sheet) return []
    const byPin = new Map(sheet.areas.map(area => [area.pinCode, area]))
    return riders.map((_, index) => {
      const areas = pinOrder.filter(pin => (assigned[pin] ?? 0) === index).flatMap(pin => byPin.get(pin) ?? [])
      return { index, areas, load: sumLoad(areas.map(area => area.load)) }
    })
  }, [sheet, riders, pinOrder, assigned])

  const move = (pin: string, step: -1 | 1) => setPinOrder(current => {
    const from = current.indexOf(pin)
    const to = from + step
    if (from < 0 || to < 0 || to >= current.length) return current
    const next = [...current]
    next.splice(from, 1)
    next.splice(to, 0, pin)
    return next
  })
  // The removed rider's PIN codes go back to the first rider; later riders move up one place.
  const removeRider = (index: number) => {
    setRiders(current => current.filter((_, position) => position !== index))
    setAssigned(current => Object.fromEntries(Object.entries(current).map(([pin, rider]) => [pin, rider === index ? 0 : rider > index ? rider - 1 : rider])))
  }
  const riderOptions = riders.map((_, index) => ({ value: String(index), label: riderLabel(riders, index) }))
  const withHouses = perRider.filter(rider => rider.areas.length > 0)

  return <div className="workspace-page products-page">
    <header className="page-header no-print">
      <div><PageBreadcrumbs items={[{ label: t('operations') }, { label: t('deliveries'), href: '/deliveries' }, { label: t('riderSheet') }]} /><h1>{t('riderSheet')}</h1><p className="page-description">{t('sheetDescription')}</p></div>
      <div className="header-actions">
        <Button variant="outline" className="secondary-button" asChild><Link href={`/deliveries?date=${date}${slotId ? `&slotId=${slotId}` : ''}`}>{t('backToDeliveries')}</Link></Button>
        {slotId ? <Button variant="outline" className="secondary-button" onClick={() => setReloadKey(count => count + 1)}>{tc('refresh')}</Button> : null}
      </div>
    </header>

    <section className="product-list-section no-print">
      <div className="product-filter-row">
        <DatePickerField label={t('deliveryDay')} value={date} onChange={value => update({ date: value })} />
        <Button className="secondary-button" variant="outline" onClick={() => update({ date: todayInBusinessZone() })}>{tc('today')}</Button>
        <Button className="secondary-button" variant="outline" onClick={() => update({ date: addDays(todayInBusinessZone(), 1) })}>{tc('tomorrow')}</Button>
        <SelectField label={t('window')} className="product-select-trigger" value={slotId} onChange={value => update({ slotId: value })} placeholder={t('chooseWindow')} options={slots.map(slot => ({ value: slot.id, label: `${slot.name} (${formatTime12h(slot.startTime)}–${formatTime12h(slot.endTime)})` }))} />
      </div>

      {slotsError && <div className="setup-note attention" role="alert"><div><strong>{t('slotsFailed')}</strong>{slotsError}</div></div>}
      {state === 'idle' && <div className="product-state"><strong>{t('chooseWindowTitle')}</strong><span>{t('chooseWindowDetail')}</span></div>}
      {state === 'loading' && <PageSkeleton />}
      {typeof state === 'object' && state.status === 'error' && <div className="product-state" role="alert"><strong>{t('sheetFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => setReloadKey(count => count + 1)}>{tc('tryAgain')}</Button></div>}

      {sheet && <>
        {sheet.status === 'final'
          ? <div className="setup-note success" role="status"><div><strong>{t('finalTitle')}</strong>{t('finalDetail', { window: sheet.slot.name, day: formatWeekdayDate(sheet.date) })}</div></div>
          : <div className="setup-note attention" role="status"><div><strong>{t('draftTitle')}</strong>{t('draftDetail', { until: sheet.closesAt ? t('until', { time: formatTimestamp(sheet.closesAt) }) : '' })}</div></div>}
        {sheet.warnings.map(warning => <div key={warning.code} className="setup-note attention" role="alert"><div><strong>{t('checkBeforePrint')}</strong>{warningText(warning)}</div></div>)}
        {sheet.truncated && <div className="setup-note attention" role="alert"><div><strong>{t('onlyFirst', { count: sheet.stopCount })}</strong>{t('tooMany')}</div></div>}

        {sheet.areas.length === 0
          ? <div className="product-state"><strong>{t('noHouses', { window: sheet.slot.name, day: formatWeekdayDate(sheet.date) })}</strong><span>{t('noHousesDetail')}</span></div>
          : <div className="rider-plan">
            <div className="table-card product-list-table-card">
              <Table className="config-table">
                <TableHeader><TableRow><TableHead>{t('visitOrder')}</TableHead><TableHead>{t('pinCode')}</TableHead><TableHead>{t('houses')}</TableHead><TableHead>{t('rider')}</TableHead></TableRow></TableHeader>
                <TableBody>{pinOrder.map((pin, position) => {
                  const area = sheet.areas.find(item => item.pinCode === pin)
                  if (!area) return null
                  return <TableRow key={pin}>
                    <TableCell><div className="rider-move">
                      <Button variant="outline" size="icon" className="icon-button" aria-label={t('visitEarlier', { pin })} disabled={position === 0} onClick={() => move(pin, -1)}><ArrowUp size={14} /></Button>
                      <Button variant="outline" size="icon" className="icon-button" aria-label={t('visitLater', { pin })} disabled={position === pinOrder.length - 1} onClick={() => move(pin, 1)}><ArrowDown size={14} /></Button>
                    </div></TableCell>
                    <TableCell><strong>{pin}</strong>{area.city ? <><br /><small>{area.city}</small></> : null}</TableCell>
                    <TableCell>{area.stops.length}</TableCell>
                    <TableCell>{riders.length > 1
                      ? <SelectField label={t('riderFor', { pin })} value={String(assigned[pin] ?? 0)} onChange={value => setAssigned(current => ({ ...current, [pin]: Number(value) }))} placeholder={t('chooseRider')} options={riderOptions} />
                      : riderLabel(riders, 0)}</TableCell>
                  </TableRow>
                })}</TableBody>
              </Table>
            </div>

            <div className="rider-list">
              {riders.map((name, index) => {
                const mine = perRider[index]
                const houses = mine?.areas.reduce((sum, area) => sum + area.stops.length, 0) ?? 0
                return <div className="rider-card" key={index}>
                  <label className="rider-name"><span>{t('riderNumber', { number: index + 1 })}</span><Input value={name} maxLength={40} placeholder={t('nameOptional')} onChange={event => setRiders(current => current.map((value, position) => (position === index ? event.target.value : value)))} /></label>
                  <p>{mine && mine.areas.length > 0 ? `${t(mine.areas.length === 1 ? 'areaOne' : 'areaMany', { count: mine.areas.length })} · ${t(houses === 1 ? 'houseOne' : 'houseMany', { count: houses })}` : t('noPinsYet')}</p>
                  <div className="rider-card-actions">
                    <Button className="secondary-button" variant="outline" disabled={!mine || mine.areas.length === 0} onClick={() => setPrinting({ target: index, id: Date.now() })}><Printer size={14} /> {t('print')}</Button>
                    {riders.length > 1 ? <Button variant="outline" size="icon" className="icon-button" aria-label={t('removeRider', { name: riderLabel(riders, index) })} onClick={() => removeRider(index)}><Trash2 size={14} /></Button> : null}
                  </div>
                </div>
              })}
              <div className="rider-card-actions">
                <Button className="secondary-button" variant="outline" disabled={riders.length >= MAX_RIDERS} onClick={() => setRiders(current => [...current, ''])}>{t('addRider')}</Button>
                <Button className="primary-button" onClick={() => setPrinting({ target: 'all', id: Date.now() })}><Printer size={14} /> {withHouses.length > 1 ? t('printAll', { count: withHouses.length }) : t('printSheet')}</Button>
              </div>
            </div>
          </div>}
      </>}
    </section>

    {sheet && withHouses.length > 0 && <section className="rider-preview" aria-label={t('printPreview')}>
      <h2 className="no-print">{t('preview')}</h2>
      {withHouses.map(rider => <RiderSheetPrint key={rider.index} sheet={sheet} riderName={printedName(riders, rider.index)} areas={rider.areas} load={rider.load} hidden={printing !== null && printing.target !== 'all' && printing.target !== rider.index} />)}
    </section>}
  </div>
}
