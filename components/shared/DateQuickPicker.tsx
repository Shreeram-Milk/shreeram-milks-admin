'use client'

import { Button } from '@/components/ui/button'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { addDays, todayInBusinessZone, type IsoDate } from '@/lib/business-time'

/** Today / Tomorrow shortcuts plus a calendar; the value is always a `yyyy-MM-dd` string. */
export function DateQuickPicker({ value, onChange, label }: { value: IsoDate; onChange: (value: IsoDate) => void; label: string }) {
  const today = todayInBusinessZone()
  const tomorrow = addDays(today, 1)
  return <div className="date-quick-picker" role="group" aria-label={label}>
    <Button type="button" variant="outline" className={`secondary-button ${value === today ? 'is-active' : ''}`} aria-pressed={value === today} onClick={() => onChange(today)}>Today</Button>
    <Button type="button" variant="outline" className={`secondary-button ${value === tomorrow ? 'is-active' : ''}`} aria-pressed={value === tomorrow} onClick={() => onChange(tomorrow)}>Tomorrow</Button>
    <div className="date-quick-picker-calendar"><DatePickerField label={label} value={value} onChange={onChange} /></div>
  </div>
}
