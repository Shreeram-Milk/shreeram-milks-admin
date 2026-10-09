'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type SelectFieldOption = { value: string; label: string; disabled?: boolean }
export function SelectField({ value, onChange, options, placeholder, label, className = '', id }: {
  value: string
  onChange: (value: string) => void
  options: SelectFieldOption[]
  placeholder: string
  label: string
  className?: string
  id?: string
}) {
  return <Select value={value || undefined} onValueChange={onChange}>
    <SelectTrigger id={id} className={className || 'w-full'} aria-label={label}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {options.filter(option => option.value !== '').map(option => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>
}
