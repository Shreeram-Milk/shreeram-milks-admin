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
import { tc } from '@/lib/i18n/common'
import { t } from '../messages'

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
    if (mode === 'many' && pinCodes.length === 0) return setError(t('errPasteOne'))
    if (pinCodes.length > MAX_PASTED_PINS) return setError(t('errPasteMax', { max: MAX_PASTED_PINS }))
    const bad = pinCodes.find(code => !PIN_CODE.test(code))
    if (bad !== undefined) return setError(mode === 'many' ? t('errBadPin', { pin: bad }) : t('errValidPin'))
    if (slotIds.length === 0) return setError(t('errChooseSlotOne'))
    setError(''); setSaving(true)
    try {
      if (mode === 'many') {
        const { added, skipped } = await pinApi.addMany(area.id, { pinCodes, locality: locality.trim(), allowedDeliverySlotIds: slotIds, status })
        toast.success(t(added.length === 1 ? 'addedOne' : 'addedMany', { count: added.length, skipped: skipped.length ? t('skippedSome', { count: skipped.length }) : '' }))
      } else {
        const payload = { pinCode: pinCodes[0] ?? '', locality: locality.trim(), allowedDeliverySlotIds: slotIds, status }
        if (editing) await pinApi.update(area.id, editing.id, payload); else await pinApi.create(area.id, payload)
        toast.success(editing ? t('pinUpdated', { pin: payload.pinCode }) : t('pinAdded', { pin: payload.pinCode }))
      }
      leave(onSaved)
    } catch (failure) { setError(describeApiError(failure)); setSaving(false) }
  }

  const sharedFields = <>
    <div className="pin-form-row">
      <Field label={t('areaLocality')} helper={mode === 'many' ? t('appliedToAll') : undefined}><Input value={locality} onChange={event => setLocality(event.target.value)} placeholder={t('localityPlaceholder')} /></Field>
      <Field label={t('status')}><SelectField label={t('pinStatus')} value={status} onChange={value => setStatus(value as RecordStatus)} placeholder={t('chooseStatus')} options={[{ value: 'active', label: tc('active') }, { value: 'inactive', label: tc('inactive') }]} /></Field>
    </div>
    <SlotChoices label={t('deliverySlotsCol')} slots={slots} value={slotIds} onChange={setSlotIds} />
  </>
  const manyLabel = pasted.codes.length > 0 ? t(pasted.codes.length === 1 ? 'addCountOne' : 'addCountMany', { count: pasted.codes.length }) : t('addPinCodes')
  const actionLabel = saving ? t('saving') : mode === 'many' ? manyLabel : editing ? t('updatePin') : t('addPin')

  return <Sheet open={open} onOpenChange={next => { if (!next && !saving) leave(onClose) }}>
    <SheetContent side="right" className="pin-sheet w-full sm:max-w-[560px]">
      <SheetHeader className="pin-sheet-header">
        <SheetTitle>{editing ? t('editPinTitle', { pin: editing.pinCode }) : t('addPinCodes')}</SheetTitle>
        <SheetDescription>{editing ? t('editPinHint') : t('addPinsHint', { area: area.name })}</SheetDescription>
      </SheetHeader>
      <div className="pin-sheet-body">
        {editing ? <div className="pin-sheet-stack">
          <Field label={t('pinCode')} required><Input inputMode="numeric" maxLength={6} value={pinCode} onChange={event => setPinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
          {sharedFields}
        </div> : <Tabs value={mode} onValueChange={value => { setMode(value as PinEditorMode); setError('') }}>
          <TabsList className="pin-tabs"><TabsTrigger value="one">{t('singlePin')}</TabsTrigger><TabsTrigger value="many">{t('pasteList')}</TabsTrigger><TabsTrigger value="city">{t('fromCity')}</TabsTrigger></TabsList>
          <TabsContent value="one" className="pin-sheet-stack">
            <Field label={t('pinCode')} required><Input inputMode="numeric" maxLength={6} value={pinCode} onChange={event => setPinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="382010" /></Field>
            {sharedFields}
          </TabsContent>
          <TabsContent value="many" className="pin-sheet-stack">
            <Field label={t('pinCodes')} required helper={t('pasteHelper', { max: MAX_PASTED_PINS })}>
              <Textarea rows={6} className="pin-paste" value={pinsText} onChange={event => setPinsText(event.target.value)} placeholder={'382010\n382011\n382012'} />
            </Field>
            {pasted.codes.length > 0 && <div className="pin-paste-summary" aria-live="polite">
              <span className="pin-count-chip ok">{t('validCount', { count: pasted.codes.length - pasted.invalid.length })}</span>
              {pasted.invalid.length > 0 && <span className="pin-count-chip bad">{t('invalidCount', { count: pasted.invalid.length })}</span>}
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
        <div className="pin-sheet-actions"><Button className="secondary-button" disabled={saving} onClick={() => leave(onClose)}>{t('cancel')}</Button><Button className="primary-button" disabled={saving} onClick={() => void save()}>{actionLabel}</Button></div>
      </div>}
    </SheetContent>
  </Sheet>
}
