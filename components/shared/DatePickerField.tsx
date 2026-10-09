'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { calendarDateToIso, formatDisplayDate, isoToCalendarDate, type IsoDate } from '@/lib/business-time'

type DatePickerFieldProps = {
  id?: string
  label: string
  value: IsoDate
  onChange: (value: IsoDate) => void
  /** Earliest selectable date (inclusive). */
  minDate?: IsoDate
  disabled?: boolean
  placeholder?: string
  invalid?: boolean
  describedBy?: string
}

/** Date input backed by the shared Calendar; value is always a `yyyy-MM-dd` string. */
export function DatePickerField({ id, label, value, onChange, minDate, disabled, placeholder = 'Select a date', invalid, describedBy }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = isoToCalendarDate(value)
  const earliest = minDate ? isoToCalendarDate(minDate) : undefined
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button id={id} type="button" variant="outline" disabled={disabled} aria-label={`${label}${value ? `: ${formatDisplayDate(value)}` : ''}`} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="date-picker-trigger">
        <CalendarIcon size={15} aria-hidden="true" />
        <span>{value ? formatDisplayDate(value) : placeholder}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent>
      <Calendar mode="single" selected={selected} defaultMonth={selected ?? earliest} disabled={earliest ? { before: earliest } : undefined} onSelect={date => { if (date) { onChange(calendarDateToIso(date)); setOpen(false) } }} autoFocus />
    </PopoverContent>
  </Popover>
}
