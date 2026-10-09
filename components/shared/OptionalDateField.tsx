'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePickerField } from '@/components/shared/DatePickerField'
import type { IsoDate } from '@/lib/business-time'

/** A date picker whose value may be empty ("no date"), with a clear button once a date is chosen. */
export function OptionalDateField({ id, label, value, onChange, placeholder = 'No date', minDate }: { id?: string; label: string; value: IsoDate | ''; onChange: (value: IsoDate | '') => void; placeholder?: string; minDate?: IsoDate }) {
  return <div className="optional-date">
    <DatePickerField id={id} label={label} value={value} onChange={onChange} placeholder={placeholder} minDate={minDate} />
    {value && <Button type="button" variant="ghost" size="icon" className="optional-date-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange('')}><X size={14} /></Button>}
  </div>
}
