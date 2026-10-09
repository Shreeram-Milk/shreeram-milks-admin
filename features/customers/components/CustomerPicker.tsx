'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DetailRows } from '@/components/shared/DetailRows'
import { formatAddress, getPrimaryAddress } from '../address'
import { customerService } from '../service'
import { CUSTOMER_TYPE_LABELS, type Customer } from '../types'

const SEARCH_DELAY_MS = 250
const RESULT_LIMIT = 8

type CustomerPickerProps = {
  /** The chosen customer, if any. */
  customer: Customer | undefined
  /** True when the customer can't be changed (editing). */
  locked: boolean
  onSelect: (customer: Customer) => void
  onClear: () => void
  error?: string
  /** Shown under the summary, e.g. when the chosen customer is inactive. */
  warning?: string
}

/** Form-agnostic customer field: a bounded search before a choice, a read-only summary after it. */
export function CustomerPicker({ customer, locked, onSelect, onClear, error, warning }: CustomerPickerProps) {
  return <>
    {customer ? <CustomerSummary customer={customer} onChange={locked ? undefined : onClear} /> : <CustomerSelector onSelect={onSelect} error={error} />}
    {warning && <p className="field-error inactive-customer-note" role="alert">{warning}</p>}
  </>
}

/** Debounced, bounded search over active customers; never loads the whole customer list. */
function CustomerSelector({ onSelect, error }: { onSelect: (customer: Customer) => void; error: string | undefined }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>(() => customerService.searchActive('', RESULT_LIMIT))
  const requestId = useRef(0)
  useEffect(() => {
    const current = ++requestId.current
    const timer = window.setTimeout(() => {
      const found = customerService.searchActive(query, RESULT_LIMIT)
      if (current === requestId.current) setResults(found)
    }, SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [query])
  return <div className="customer-selector">
    <Label htmlFor="customer-search" className="product-form-label">Customer <span>*</span></Label>
    <label className="workspace-search"><Search size={17} aria-hidden="true" /><Input id="customer-search" className="workspace-search-input" type="search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name, mobile, or PIN..." aria-invalid={error ? true : undefined} aria-describedby="customer-results-status" /></label>
    {error && <small className="field-error" role="alert">{error}</small>}
    <p id="customer-results-status" className="help-text" aria-live="polite">{results.length === 0 ? 'No active customers match this search.' : `Showing ${results.length} active ${results.length === 1 ? 'customer' : 'customers'}${results.length === RESULT_LIMIT ? ' — refine the search to narrow down.' : '.'}`}</p>
    {results.length > 0 && <ul className="customer-results" aria-label="Matching customers">{results.map(item => <li key={item.id}>
      <button type="button" className="customer-result" onClick={() => onSelect(item)}>
        <strong>{item.fullName}</strong>
        <span>{item.mobile} · {getPrimaryAddress(item)?.locality} · {getPrimaryAddress(item)?.pinCode}</span>
      </button>
    </li>)}</ul>}
  </div>
}

export function CustomerSummary({ customer, onChange }: { customer: Customer; onChange?: () => void }) {
  const address = getPrimaryAddress(customer)
  return <div className="customer-summary">
    <div className="summary-heading"><strong>{customer.fullName}</strong>{onChange && <Button type="button" variant="outline" className="secondary-button" onClick={onChange}>Change customer</Button>}</div>
    <DetailRows rows={[
      { label: 'Mobile', value: customer.mobile },
      { label: 'Address', value: formatAddress(address) },
      { label: 'PIN', value: address?.pinCode ?? '—' },
      { label: 'Customer type', value: CUSTOMER_TYPE_LABELS[customer.customerType] },
    ]} />
  </div>
}
