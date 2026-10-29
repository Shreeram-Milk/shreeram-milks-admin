'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { describeApiError } from '@/lib/api-errors'
import { customerRecordApi, type CustomerRecord } from '../../customers/api'
import { MAX_CHOSEN_CUSTOMERS } from '../schema'
import { t } from '../messages'

const RESULTS = 8

/**
 * Pick customers one by one: type a name or phone, tick the ones you want. Only a few results are fetched at a time (the search is
 * done by the server), and the ones already chosen stay shown below, so nothing is lost when the search changes.
 */
export function CustomerPicker({ selected, onChange }: { selected: CustomerRecord[]; onChange: (customers: CustomerRecord[]) => void }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<CustomerRecord[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (search.length < 2) return
    let cancelled = false
    customerRecordApi.list({ search, status: 'active', customerType: '', page: 1, pageSize: RESULTS }).then(
      result => { if (!cancelled) { setResults(result.rows); setMessage(result.rows.length === 0 ? t('noMatch') : '') } },
      failure => { if (!cancelled) setMessage(describeApiError(failure)) },
    )
    return () => { cancelled = true }
  }, [search])

  const chosen = new Set(selected.map(customer => customer.id))
  const toggle = (customer: CustomerRecord) => {
    if (chosen.has(customer.id)) onChange(selected.filter(item => item.id !== customer.id))
    else if (selected.length < MAX_CHOSEN_CUSTOMERS) onChange([...selected, customer])
  }
  const label = (customer: CustomerRecord) => `${customer.name.trim() || t('noName')}${customer.phone ? ` · ${customer.phone}` : ''}`
  return <div className="customer-picker">
    <ListSearchInput label={t('findCustomers')} value={search} onCommit={setSearch} placeholder={t('findPlaceholder')} />
    {search.length >= 2 && <ul className="customer-picker-results">
      {results.map(customer => <li key={customer.id}><label><Checkbox checked={chosen.has(customer.id)} onCheckedChange={() => toggle(customer)} /> <span>{label(customer)}</span></label></li>)}
      {message && <li className="help-text">{message}</li>}
    </ul>}
    {selected.length > 0 && <div className="customer-picker-chosen" aria-label={t('chosenCustomers')}>
      {selected.map(customer => <button type="button" key={customer.id} className="day-chip is-active" onClick={() => toggle(customer)} aria-label={t('remove', { name: label(customer) })}>{label(customer)} <X size={12} aria-hidden="true" /></button>)}
    </div>}
  </div>
}
