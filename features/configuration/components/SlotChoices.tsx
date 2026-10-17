'use client'

import { Check } from 'lucide-react'
import type { DeliverySlot } from '../api'
import { humanWindow } from '../format'

type Props = { slots: DeliverySlot[]; value: string[]; onChange: (ids: string[]) => void; label: string }

/** Delivery slots as readable option cards: name, window, and a tick when chosen. Inactive slots stay visible if already chosen. */
export function SlotChoices({ slots, value, onChange, label }: Props) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])
  return <fieldset className="pin-field">
    <legend>{label} <span aria-hidden="true">*</span></legend>
    <div className="slot-choice-grid">
      {slots.map(slot => {
        const checked = value.includes(slot.id)
        const disabled = slot.status === 'inactive' && !checked
        return <button key={slot.id} type="button" role="checkbox" aria-checked={checked} disabled={disabled} className="slot-choice" onClick={() => toggle(slot.id)}>
          <span className="slot-choice-mark" aria-hidden="true">{checked && <Check size={12} strokeWidth={3} />}</span>
          <span className="slot-choice-copy"><strong>{slot.name}</strong><small>{humanWindow(slot)}{slot.status === 'inactive' ? ' · Inactive' : ''}</small></span>
        </button>
      })}
    </div>
  </fieldset>
}
