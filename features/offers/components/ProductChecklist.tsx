'use client'

import { useId, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { t } from '../messages'

type Option = { value: string; label: string }

/** Pick several products from a bounded list, with a search box. Used where an offer is limited to chosen products. */
export function ProductChecklist({ label, options, selected, onChange }: { label: string; options: Option[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState('')
  const id = useId()
  const shown = options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (value: string, checked: boolean) => onChange(checked ? [...selected, value] : selected.filter(item => item !== value))
  return <div className="product-checklist">
    <Input aria-label={t('searchProducts', { label })} placeholder={t('searchProductsPlaceholder')} value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
    <div role="group" aria-label={label} style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8, display: 'grid', gap: 8 }}>
      {shown.map(option => <label key={option.value} htmlFor={`${id}-${option.value}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Checkbox id={`${id}-${option.value}`} checked={selected.includes(option.value)} onCheckedChange={checked => toggle(option.value, checked === true)} />
        <span>{option.label}</span>
      </label>)}
      {shown.length === 0 && <span className="product-hint">{options.length === 0 ? t('noActive') : t('noProductMatch')}</span>}
    </div>
    <small className="cell-note">{t('selected', { count: selected.length })}</small>
  </div>
}
