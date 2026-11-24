'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { describeApiError } from '@/lib/api-errors'
import { deliveryPlacesApi, type DeliveryPlace } from './api'
import { t } from './messages'

/** Bounded, PIN-scoped lookup. Only reviewed identities can be selected; no approximate automatic choice. */
export function PlacePicker({ pinCode, kind, excludeId, selected, onSelect }: { pinCode: string; kind: DeliveryPlace['kind']; excludeId?: string; selected: DeliveryPlace | null; onSelect: (place: DeliveryPlace) => void }) {
  const [search, setSearch] = useState('')
  const [state, setState] = useState<{ loading: boolean; rows: DeliveryPlace[]; error: string }>({ loading: false, rows: [], error: '' })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let alive = true
    const query = search.trim()
    if (query.length < 2) return
    const timer = window.setTimeout(() => {
      setState({ loading: true, rows: [], error: '' })
      deliveryPlacesApi.list({ search: query, pinCode, kind, status: 'approved', page: 1, pageSize: 20 }).then(result => {
        if (alive) setState({ loading: false, rows: result.rows.filter(place => place.id !== excludeId && place.pinCode === pinCode && place.kind === kind && place.status === 'approved'), error: '' })
      }, error => { if (alive) setState({ loading: false, rows: [], error: describeApiError(error) }) })
    }, 250)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [search, pinCode, kind, excludeId, retry])
  return <div className="place-picker">
    <label className="form-field"><span>{t('target')} · {t('samePin', { pin: pinCode })}</span><Input value={search} maxLength={150} onChange={event => { setSearch(event.target.value); setState({ loading: true, rows: [], error: '' }) }} /></label>
    {search.trim().length < 2 ? <p className="help-text">{t('minSearch')}</p> : state.loading ? <p role="status">{t('search')}…</p> : state.error ? <div role="alert"><p>{state.error}</p><Button type="button" variant="outline" onClick={() => setRetry(value => value + 1)}>{t('retry')}</Button></div> : state.rows.length === 0 ? <p className="help-text">{t('noTargets')}</p> : <div role="group" aria-label={t('target')} className="place-options">{state.rows.map(place => <Button type="button" variant="outline" key={place.id} className="place-option" aria-pressed={selected?.id === place.id} onClick={() => onSelect(place)}><span><strong>{place.name}</strong><small>{place.locality} · {place.pinCode}</small></span><span>{t('usePlace')}</span></Button>)}</div>}
    {selected && <p className="setup-note" role="status">{t('selected', { name: selected.name })}</p>}
  </div>
}
