'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { describeApiError } from '@/lib/api-errors'
import { customerRecordApi, type CustomerRecordAddress } from '@/features/customers/api'
import type { DeliveryPlace } from './api'
import { PlacePicker } from './PlacePicker'
import { t } from './messages'

export function AddressPlaceDialog({ customerId, address, onClose, onSaved }: { customerId: string; address: CustomerRecordAddress; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<DeliveryPlace['kind']>(address.addressKind === 'independent' ? 'locality' : 'society')
  const [selected, setSelected] = useState<DeliveryPlace | null>(null)
  const [clear, setClear] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState('')
  const save = async () => {
    if (inFlight.current || !acknowledged || (!clear && (!selected || selected.pinCode !== address.pinCode))) return
    inFlight.current = true; setBusy(true); setError('')
    try { await customerRecordApi.assignDeliveryPlace(customerId, address.id, clear ? null : selected!.id); toast.success(t('assignSaved')); onSaved() }
    catch (error) { setError(describeApiError(error)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}><DialogContent className="record-editor-dialog"><DialogHeader><DialogTitle>{t('assignmentTitle')}</DialogTitle><DialogDescription>{t('assignmentHint')}</DialogDescription></DialogHeader>
    <p>{[address.line1, address.line2, address.city, address.pinCode].filter(Boolean).join(', ')}</p>
    <SelectField placeholder={t('all')} label={t('kind')} disabled={busy} value={kind} onChange={value => { setKind(value === 'locality' ? 'locality' : 'society'); setSelected(null); setAcknowledged(false) }} options={[{ value: 'society', label: t('society') }, { value: 'locality', label: t('area') }]} />
    {!clear && <PlacePicker key={kind} pinCode={address.pinCode} kind={kind} selected={selected} onSelect={place => { setSelected(place); setAcknowledged(false) }} />}
    <label className="place-ack"><input type="checkbox" checked={clear} disabled={busy} onChange={event => { setClear(event.target.checked); setSelected(null); setAcknowledged(false) }} /><span>{t('clear')}</span></label>
    <label className="place-ack"><input type="checkbox" checked={acknowledged} disabled={busy || (!clear && !selected)} onChange={event => setAcknowledged(event.target.checked)} /><span>{t('acknowledge')}</span></label>
    <Link href="/operations/delivery-places" className="text-button">{t('manage')}</Link>
    {error && <p className="field-error" role="alert">{error}</p>}
    <DialogFooter className="dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t('close')}</Button><Button type="button" disabled={busy || !acknowledged || (!clear && !selected)} onClick={() => void save()}>{t(busy ? 'saving' : 'save')}</Button></DialogFooter>
  </DialogContent></Dialog>
}
