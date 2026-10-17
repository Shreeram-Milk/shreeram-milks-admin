'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { FormField as Field } from '@/components/configuration/FormField'
import { describeApiError } from '@/lib/api-errors'
import { directoryApi, pinApi, type DeliverySlot, type DirectoryPin, type ServiceArea } from '../api'
import { SlotChoices } from './SlotChoices'

type Props = { area: ServiceArea; slots: DeliverySlot[]; onClose: () => void; onAdded: () => void }
type Step<T> = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
/** The post offices of a PIN become its locality, kept inside the 80 characters the server allows. */
const localityOf = (pin: DirectoryPin) => pin.offices.join(', ').slice(0, 80)

/** "Add from city": pick a state and district from the national list, tick the PIN codes you deliver to, choose slots, add them all at once. */
export function DirectoryPicker({ area, slots, onClose, onAdded }: Props) {
  const [states, setStates] = useState<Step<string[]>>({ status: 'loading' })
  const [state, setState] = useState('')
  const [districts, setDistricts] = useState<Step<string[]>>({ status: 'idle' })
  const [district, setDistrict] = useState('')
  const [pins, setPins] = useState<Step<DirectoryPin[]>>({ status: 'idle' })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [slotIds, setSlotIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  // 'all' ticks every PIN of the district; 'pick' starts empty so one or a few PIN codes can be searched and chosen.
  const [scope, setScope] = useState<'all' | 'pick'>('all')

  useEffect(() => {
    let cancelled = false
    directoryApi.states().then(
      list => {
        if (cancelled) return
        setStates({ status: 'ready', data: list })
        // Start on the area's own state when the list knows it.
        const own = list.find(name => sameName(name, area.state))
        if (own) setState(own)
      },
      failure => { if (!cancelled) setStates({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [area.state])

  useEffect(() => {
    if (!state) return
    let cancelled = false
    directoryApi.districts(state).then(
      list => {
        if (cancelled) return
        setDistricts({ status: 'ready', data: list })
        const own = list.find(name => sameName(name, area.city))
        if (own) setDistrict(own)
      },
      failure => { if (!cancelled) setDistricts({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [state, area.city])

  useEffect(() => {
    if (!state || !district) return
    let cancelled = false
    directoryApi.pins(state, district).then(
      list => { if (!cancelled) { setPins({ status: 'ready', data: list }); setPicked(scope === 'all' ? new Set(list.map(pin => pin.pinCode)) : new Set()) } },
      failure => { if (!cancelled) setPins({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a scope change must not reload the district
  }, [state, district])

  const chooseState = (value: string) => { setState(value); setDistrict(''); setDistricts({ status: 'loading' }); setPins({ status: 'idle' }); setPicked(new Set()) }
  const chooseDistrict = (value: string) => { setDistrict(value); setPins({ status: 'loading' }) }
  const chooseScope = (next: 'all' | 'pick') => {
    setScope(next); setFilter('')
    setPicked(next === 'all' && pins.status === 'ready' ? new Set(pins.data.map(pin => pin.pinCode)) : new Set())
  }
  const toggle = (pinCode: string, on: boolean) => setPicked(current => { const next = new Set(current); if (on) next.add(pinCode); else next.delete(pinCode); return next })

  const add = async () => {
    if (pins.status !== 'ready') return
    const chosen = pins.data.filter(pin => picked.has(pin.pinCode))
    if (chosen.length === 0) return setError('Tick at least one PIN code.')
    if (slotIds.length === 0) return setError('Choose at least one delivery slot.')
    setError(''); setSaving(true)
    try {
      const localities = Object.fromEntries(chosen.map(pin => [pin.pinCode, localityOf(pin)]).filter(([, locality]) => locality))
      const { added, skipped } = await pinApi.addMany(area.id, { pinCodes: chosen.map(pin => pin.pinCode), locality: district, localities, allowedDeliverySlotIds: slotIds, status: 'active' })
      toast.success(`${added.length} PIN ${added.length === 1 ? 'code' : 'codes'} added${skipped.length ? `, ${skipped.length} already in this area` : ''}.`)
      onAdded()
    } catch (failure) { setError(describeApiError(failure)); setSaving(false) }
  }

  const emptyDirectory = states.status === 'ready' && states.data.length === 0
  const visiblePins = useMemo(() => {
    if (pins.status !== 'ready') return []
    const query = filter.trim().toLowerCase()
    return query ? pins.data.filter(pin => pin.pinCode.includes(query) || pin.offices.some(office => office.toLowerCase().includes(query))) : pins.data
  }, [pins, filter])
  const allVisiblePicked = visiblePins.length > 0 && visiblePins.every(pin => picked.has(pin.pinCode))
  const toggleVisible = (on: boolean) => setPicked(current => { const next = new Set(current); visiblePins.forEach(pin => (on ? next.add(pin.pinCode) : next.delete(pin.pinCode))); return next })
  const ready = pins.status === 'ready' && pins.data.length > 0
  const pickedPins = pins.status === 'ready' ? pins.data.filter(pin => picked.has(pin.pinCode)) : []

  return <div className="pin-sheet-stack" aria-label="Add PIN codes from a city">
    <p className="pin-hint">Choose a state and district from India Post&rsquo;s list. Every PIN code in it is ticked; untick the ones you don&rsquo;t deliver to.</p>
    {states.status === 'loading' && <p className="pin-hint" aria-busy="true">Loading the PIN list…</p>}
    {states.status === 'error' && <p className="field-error" role="alert">{states.message}</p>}
    {emptyDirectory && <div className="setup-note attention" role="status"><div><strong>The national PIN list has not been loaded yet</strong>Until it is loaded, add PIN codes one by one or with <b>Paste a list</b>.</div></div>}
    {states.status === 'ready' && !emptyDirectory && <>
      <div className="pin-form-row">
        <Field label="State"><SelectField label="State" value={state} onChange={chooseState} placeholder="Choose a state" options={states.data.map(name => ({ value: name, label: name }))} /></Field>
        <Field label="District / city">
          {districts.status === 'error' ? <p className="field-error">{districts.message}</p> : <SelectField label="District" value={district} onChange={chooseDistrict} placeholder={state ? 'Choose a district' : 'Choose a state first'} options={districts.status === 'ready' ? districts.data.map(name => ({ value: name, label: name })) : []} />}
        </Field>
      </div>
      {pins.status === 'loading' && <p className="pin-hint" aria-busy="true">Loading PIN codes…</p>}
      {pins.status === 'error' && <p className="field-error" role="alert">{pins.message}</p>}
      {pins.status === 'ready' && pins.data.length === 0 && <p className="pin-hint">No PIN codes are listed for {district}.</p>}
      {ready && <div className="pin-scope" role="radiogroup" aria-label="Which PIN codes to add">
        <button type="button" role="radio" aria-checked={scope === 'all'} className="pin-scope-option" onClick={() => chooseScope('all')}><strong>All PIN codes</strong><small>Every PIN in {district}</small></button>
        <button type="button" role="radio" aria-checked={scope === 'pick'} className="pin-scope-option" onClick={() => chooseScope('pick')}><strong>Pick specific</strong><small>Search and choose one or a few</small></button>
      </div>}
      {ready && scope === 'pick' && pickedPins.length > 0 && <div className="pin-picked" aria-label="Chosen PIN codes">
        {pickedPins.map(pin => <span key={pin.pinCode} className="pin-picked-chip">{pin.pinCode}<button type="button" aria-label={`Remove ${pin.pinCode}`} onClick={() => toggle(pin.pinCode, false)}><X size={12} /></button></span>)}
      </div>}
      {ready && <div className="pin-checklist">
        <div className="pin-checklist-head">
          <label className="pin-checklist-all"><Checkbox checked={allVisiblePicked} onCheckedChange={checked => toggleVisible(checked === true)} aria-label="Tick all shown PIN codes" /><span><strong>{picked.size}</strong> of {pins.status === 'ready' ? pins.data.length : 0} ticked</span></label>
          <div className="pin-checklist-search"><Search size={14} aria-hidden="true" /><Input value={filter} onChange={event => setFilter(event.target.value)} placeholder={scope === 'pick' ? 'Search PIN or post office' : 'Filter PIN or post office'} aria-label="Search PIN codes" /></div>
        </div>
        <div className="pin-checklist-rows" role="group" aria-label="PIN codes">
          {visiblePins.map(pin => <label key={pin.pinCode} className="pin-checklist-row"><Checkbox checked={picked.has(pin.pinCode)} onCheckedChange={checked => toggle(pin.pinCode, checked === true)} /><strong>{pin.pinCode}</strong><span title={pin.offices.join(', ')}>{pin.offices.join(', ') || '—'}</span></label>)}
          {visiblePins.length === 0 && <p className="pin-hint pin-checklist-empty">No PIN codes match “{filter}” in {district}.</p>}
        </div>
      </div>}
      {ready && <SlotChoices label="Delivery slots for these PIN codes" slots={slots} value={slotIds} onChange={setSlotIds} />}
    </>}
    <div className="pin-sheet-footer pin-sheet-footer-inline">
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="pin-sheet-actions"><Button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancel</Button>{ready && <Button type="button" className="primary-button" disabled={saving || picked.size === 0} onClick={() => void add()}>{saving ? 'Adding…' : `Add ${picked.size} PIN ${picked.size === 1 ? 'code' : 'codes'}`}</Button>}</div>
    </div>
  </div>
}
