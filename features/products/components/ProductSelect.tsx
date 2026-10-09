'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type ProductSelectOption = { value: string; label: string }

export function ProductSelect({ value, onChange, options, placeholder, label, id }: {
  value: string
  onChange: (value: string) => void
  options: ProductSelectOption[]
  placeholder: string
  label: string
  id?: string
}) {
  return <Select value={value || undefined} onValueChange={onChange}>
    <SelectTrigger id={id} className="product-select-trigger w-full" aria-label={label}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent className="product-select-popup">
      {options.map(option => <SelectItem className="product-select-item" key={option.value} value={option.value}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>
}
