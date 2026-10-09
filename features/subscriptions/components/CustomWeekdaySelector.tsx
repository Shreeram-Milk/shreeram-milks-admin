'use client'

import { Toggle } from '@/components/ui/toggle'
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_SHORT_LABELS } from '../types'

/** Mon–Sun toggle group. Value is the list of selected weekday numbers (0 = Sunday … 6 = Saturday). */
export function CustomWeekdaySelector({ value, onChange, invalid, describedBy }: { value: number[]; onChange: (weekdays: number[]) => void; invalid?: boolean; describedBy?: string }) {
  const toggle = (day: number, pressed: boolean) => onChange(pressed ? [...value, day] : value.filter(item => item !== day))
  return <div className="weekday-selector" role="group" aria-label="Delivery days" aria-describedby={describedBy}>
    {WEEKDAY_DISPLAY_ORDER.map(day => <Toggle key={day} variant="outline" pressed={value.includes(day)} onPressedChange={pressed => toggle(day, pressed)} aria-invalid={invalid || undefined} aria-label={WEEKDAY_SHORT_LABELS[day]} className="weekday-toggle">{WEEKDAY_SHORT_LABELS[day]}</Toggle>)}
  </div>
}
