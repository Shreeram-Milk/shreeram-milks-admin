'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FormField as Field } from '@/components/configuration/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { describeApiError } from '@/lib/api-errors'
import { MAX_PASTED_PINS, parsePinList } from '../pin-list'
import { pinApi, type DeliverySlot, type Pin, type RecordStatus, type ServiceArea } from '../api'
import { DirectoryPicker } from './DirectoryPicker'
import { SlotChoices } from './SlotChoices'

const PIN_CODE = /^[1-9]\d{5}$/
/** Matches the slide-out length in globals.css (.pin-sheet[data-state="closed"]). */
const CLOSE_ANIMATION_MS = 240

export type PinEditorMode = 'one' | 'many' | 'city'
type Props = { area: ServiceArea; slots: DeliverySlot[]; mode: PinEditorMode; editing: Pin | null; onClose: () => void; onSaved: () => void }

/** Side panel for adding PIN codes (one, a pasted list, or from a city) or editing one PIN. */
export function PinCodeEditor({ area, slots, mode: startMode, editing, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<PinEditorMode>(editing ? 'one' : startMode)
  const [pinCode, setPinCode] = useState(editing?.pinCode ?? '')
  const [pinsText, setPinsText] = useState('')
  const [locality, setLocality] = useState(editing?.locality ?? '')
  const [status, setStatus] = useState<RecordStatus>(editing?.status ?? 'active')
  const [slotIds, setSlotIds] = useState<string[]>(editing?.allowedDeliverySlotIds ?? [])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Closing first plays the slide-out, then tells the parent, so the panel never just vanishes.
  const [open, setOpen] = useState(true)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current) }, [])
  const leave = (after: () => void) => {
    if (!open) return
    setOpen(false)
    leaveTimer.current = setTimeout(after, CLOSE_ANIMATION_MS)
  }

  // Live check of a pasted list, so mistakes show before saving.
  const pasted = useMemo(() => {
    const codes = parsePinList(pinsText)
    return { codes, invalid: codes.filter(code => !PIN_CODE.test(code)) }
  }, [pinsText])

  const save = async () => {
    const pinCodes = mode === 'many' ? pasted.codes : [pinCode]
    if (mode === 'many' && pinCodes.length === 0) return setError('Paste at least one PIN code.')
    if (pinCodes.length > MAX_PASTED_PINS) return setError(`Paste at most ${MAX_PASTED_PINS} PIN codes at a time.`)
    const bad = pinCodes.find(code => !PIN_CODE.test(code))
    if (bad !== undefined) return setError(mode === 'many' ? `“${bad}” is not a valid 6-digit PIN code. Fix it and try again.` : 'Enter a valid 6-digit Indian PIN code.')
    if (slotIds.length === 0) return setError('Choose at least one delivery slot.')
    setError(''); setSaving(true)
    try {
      if (mode === 'many') {
        const { added, skipped } = await pinApi.addMany(area.id, { pinCodes, locality: locality.trim(), allowedDeliverySlotIds: slotIds, status })
        toast.success(`${added.length} PIN ${added.length === 1 ? 'code' : 'codes'} added${skipped.length ? `, ${skipped.length} already in this area` : ''}.`)
      } else {
        const payload = { pinCode: pinCodes[0] ?? '', locality: locality.trim(), allowedDeliverySlotIds: slotIds, status }
        if (editing) await pinApi.update(area.id, editing.id, payload); else await pinApi.create(area.id, payload)
        toast.success(editing ? `PIN code ${payload.pinCode} updated.` : `PIN code ${payload.pinCode} added.`)
      }
      leave(onSaved)
    } catch (failure) { setError(describeApiError(failure)); setSaving(false) }
  }

  const sharedFields = <>
    <div className="pin-form-row">
      <Field label="Area / locality" helper={mode === 'many' ? 'Applied to every PIN in the list.' : undefined}><Input value={locality} onChange={event => setLocality(event.target.value)} placeholder="Sector 10" /></Field>
      <Field label="Status"><SelectField label="PIN status" value={status} onChange={value => setStatus(value as RecordStatus)} placeholder="Choose a status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Field>
    </div>
    <SlotChoices label="Delivery slots" slots={slots} value={slotIds} onChange={setSlotIds} />
  </>
  const manyLabel = pasted.codes.length > 0 ? `Add ${pasted.codes.length} PIN ${pasted.codes.length === 1 ? 'code' : 'codes'}` : 'Add PIN codes'
  const actionLabel = saving ? 'Saving…' : mode === 'many' ? manyLabel : editing ? 'Update PIN code' : 'Add PIN code'

  return <Sheet open={open} onOpenChange={next => { if (!next && !saving) leave(onClose) }}>
    <SheetContent side="right" className="pin-sheet w-full sm:max-w-[560px]">
      <SheetHeader className="pin-sheet-header">
        <SheetTitle>{editing ? `Edit PIN code ${editing.pinCode}` : 'Add PIN codes'}</SheetTitle>
        <SheetDescription>{editing ? 'Change its locality, status or delivery slots.' : `Add the PIN codes ${area.name} delivers to, and the slots each one gets.`}</SheetDescription>
      </SheetHeader>
      <div className="pin-sheet-body">
        {editing ? <div className="pin-sheet-stack">
          <Field label="PIN code" required><Input inputMode="numeric" maxLength={6} value={pinCode} onChange={event => setPinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
          {sharedFields}
        </div> : <Tabs value={mode} onValueChange={value => { setMode(value as PinEditorMode); setError('') }}>
          <TabsList className="pin-tabs"><TabsTrigger value="one">Single PIN</TabsTrigger><TabsTrigger value="many">Paste a list</TabsTrigger><TabsTrigger value="city">From a city</TabsTrigger></TabsList>
          <TabsContent value="one" className="pin-sheet-stack">
            <Field label="PIN code" required><Input inputMode="numeric" maxLength={6} value={pinCode} onChange={event => setPinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="382010" /></Field>
            {sharedFields}
          </TabsContent>
          <TabsContent value="many" className="pin-sheet-stack">
            <Field label="PIN codes" required helper={`One per line, or separated by commas or spaces. Up to ${MAX_PASTED_PINS} at a time; PIN codes already in this area are skipped.`}>
              <Textarea rows={6} className="pin-paste" value={pinsText} onChange={event => setPinsText(event.target.value)} placeholder={'382010\n382011\n382012'} />
            </Field>
            {pasted.codes.length > 0 && <div className="pin-paste-summary" aria-live="polite">
              <span className="pin-count-chip ok">{pasted.codes.length - pasted.invalid.length} valid</span>
              {pasted.invalid.length > 0 && <span className="pin-count-chip bad">{pasted.invalid.length} invalid</span>}
              {pasted.invalid.length > 0 && <span className="pin-paste-bad">{pasted.invalid.slice(0, 6).join(', ')}{pasted.invalid.length > 6 ? '…' : ''}</span>}
            </div>}
            {sharedFields}
          </TabsContent>
          <TabsContent value="city">
            <DirectoryPicker area={area} slots={slots} onClose={() => leave(onClose)} onAdded={() => leave(onSaved)} />
          </TabsContent>
        </Tabs>}
      </div>
      {mode !== 'city' && <div className="pin-sheet-footer">
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="pin-sheet-actions"><Button className="secondary-button" disabled={saving} onClick={() => leave(onClose)}>Cancel</Button><Button className="primary-button" disabled={saving} onClick={() => void save()}>{actionLabel}</Button></div>
      </div>}
    </SheetContent>
  </Sheet>
}
