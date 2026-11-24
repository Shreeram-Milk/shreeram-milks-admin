'use client'

import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { SelectField } from '@/components/ui/select-field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { describeApiError } from '@/lib/api-errors'
import { deliveryPlacesApi, type DeliveryPlace } from './api'
import { PlacePicker } from './PlacePicker'
import { t } from './messages'

export function PlaceReviewDialog({ place, onClose, onSaved }: { place?: DeliveryPlace; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(place?.name ?? '')
  const [locality, setLocality] = useState(place?.locality ?? '')
  const [status, setStatus] = useState<'pending' | 'approved'>(place?.status === 'pending' ? 'pending' : 'approved')
  const [pinCode, setPinCode] = useState(place?.pinCode ?? '')
  const [kind, setKind] = useState<DeliveryPlace['kind']>(place?.kind ?? 'society')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState('')
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    if ((!place && !/^[1-9][0-9]{5}$/.test(pinCode)) || name.trim().length < 2 || name.trim().length > 150 || locality.trim().length > 150) { setError(t('invalidName')); return }
    inFlight.current = true; setBusy(true); setError('')
    try { if (place) await deliveryPlacesApi.update(place.id, { name: name.trim(), locality: locality.trim(), status }); else await deliveryPlacesApi.create({ name: name.trim(), locality: locality.trim(), status, pinCode, kind }); toast.success(t('saved')); onSaved() }
    catch (error) { setError(describeApiError(error)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}><DialogContent className="record-editor-dialog"><DialogHeader><DialogTitle>{t(place ? 'review' : 'add')}</DialogTitle><DialogDescription>{t(place ? 'immutable' : 'createHint')}{place ? ` · ${place.pinCode}` : ''}</DialogDescription></DialogHeader><form onSubmit={save} id="review-place" className="record-editor-fields one-column">
    {!place && <><FormField label={t('pin')} required><Input value={pinCode} maxLength={6} inputMode="numeric" disabled={busy} onChange={event => setPinCode(event.target.value.replace(/[^0-9]/g, ''))} /></FormField><SelectField placeholder={t('all')} label={t('kind')} value={kind} disabled={busy} onChange={value => setKind(value === 'locality' ? 'locality' : 'society')} options={[{ value: 'society', label: t('society') }, { value: 'locality', label: t('area') }]} /></>}
    <FormField label={t('name')} required><Input value={name} maxLength={150} disabled={busy} onChange={event => setName(event.target.value)} /></FormField>
    <FormField label={t('locality')}><Input value={locality} maxLength={150} disabled={busy} onChange={event => setLocality(event.target.value)} /></FormField>
    <SelectField placeholder={t('all')} label={t('status')} value={status} disabled={busy} onChange={value => setStatus(value === 'approved' ? 'approved' : 'pending')} options={[{ value: 'pending', label: t('pending') }, { value: 'approved', label: t('approved') }]} />
    {error && <p className="field-error" role="alert">{error}</p>}
  </form><DialogFooter className="dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t('close')}</Button><Button type="submit" form="review-place" disabled={busy}>{t(busy ? 'saving' : 'save')}</Button></DialogFooter></DialogContent></Dialog>
}

export function PlaceMergeDialog({ place, onClose, onSaved }: { place: DeliveryPlace; onClose: () => void; onSaved: () => void }) {
  const [selected, setSelected] = useState<DeliveryPlace | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState('')
  const merge = async () => {
    if (inFlight.current || !acknowledged || !selected || selected.pinCode !== place.pinCode || selected.kind !== place.kind || selected.id === place.id) return
    inFlight.current = true; setBusy(true); setError('')
    try { await deliveryPlacesApi.merge(place.id, selected.id); toast.success(t('mergedDone')); onSaved() }
    catch (error) { setError(describeApiError(error)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}><DialogContent className="record-editor-dialog"><DialogHeader><DialogTitle>{t('mergeTitle')}</DialogTitle><DialogDescription>{t('mergeHint')}</DialogDescription></DialogHeader><strong>{place.name} · {place.pinCode}</strong>
    <PlacePicker pinCode={place.pinCode} kind={place.kind} excludeId={place.id} selected={selected} onSelect={next => { setSelected(next); setAcknowledged(false) }} />
    <p className="warning-note">{t('mergeNotice')}</p>
    <label className="place-ack"><input type="checkbox" checked={acknowledged} disabled={busy || !selected} onChange={event => setAcknowledged(event.target.checked)} /><span>{t('acknowledge')}</span></label>
    {error && <p className="field-error" role="alert">{error}</p>}
    <DialogFooter className="dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t('close')}</Button><Button type="button" disabled={busy || !selected || !acknowledged} onClick={() => void merge()}>{t(busy ? 'saving' : 'confirm')}</Button></DialogFooter></DialogContent></Dialog>
}
