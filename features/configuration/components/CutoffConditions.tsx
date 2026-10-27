'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import type { DeliverySlot } from '../api'
import { cutoffPreview, formatTime, humanWindow, timeChoices } from '../format'
import type { FormValues } from '../form-values'

type Condition = FormValues['conditions'][number]
type Day = 'previous_day' | 'same_day'
const SAME = 'same_as_cutoff'
const DAY_BUTTONS: Array<{ value: Day; title: string; hint: string }> = [
  { value: 'previous_day', title: 'The day before', hint: 'Orders close the day before delivery' },
  { value: 'same_day', title: 'The same day', hint: 'Orders close on the delivery day itself' },
]

function DayPicker({ label, value, onChange }: { label: string; value: Day; onChange: (value: Day) => void }) {
  return <div className="cutoff-days" role="radiogroup" aria-label={label}>
    {DAY_BUTTONS.map(day => <button type="button" role="radio" aria-checked={value === day.value} key={day.value} className={`cutoff-day${value === day.value ? ' is-active' : ''}`} onClick={() => onChange(day.value)}>
      <strong>{day.title}</strong><span>{day.hint}</span>
    </button>)}
  </div>
}

/**
 * The order-by times of one rule, as steps anyone can follow: 1) which delivery time, 2) which day orders close, 3) at what
 * time, 4) until when customers may cancel. Slots are shown by their time of day first, because a name can be changed.
 */
export function CutoffConditions({ form, fields, slotChoices, error }: { form: UseFormReturn<FormValues, unknown, FormValues>; fields: UseFieldArrayReturn<FormValues, 'conditions'>; slotChoices: DeliverySlot[]; error?: string }) {
  const conditions = form.watch('conditions') ?? []
  const set = <Key extends keyof Condition>(index: number, key: Key, value: Condition[Key]) => form.setValue(`conditions.${index}.${key}` as `conditions.${number}.${Key}`, value as never, { shouldDirty: true, shouldValidate: true })

  return <section className="form-card">
    <div className="form-section-heading"><span>02</span><div><h2>When do orders close?</h2><p>Add one block for each delivery time. Customers cannot order after the closing time you choose.</p></div></div>
    <div className="cutoff-sentences">
      {fields.fields.map((field, index) => {
        const condition = conditions[index]
        const errors = form.formState.errors.conditions?.[index]
        const slot = slotChoices.find(item => item.id === condition?.deliverySlotId)
        const ownCancel = Boolean(condition?.cancelDayRelation)
        const day = condition?.dayRelation ?? 'previous_day'
        const taken = new Set(conditions.filter((_, other) => other !== index).map(item => item.deliverySlotId))
        // Orders for a delivery that has already started would be too late to make, so a same-day closing time cannot be after the slot starts.
        const latest = day === 'same_day' ? slot?.startTime : undefined
        const tooLate = Boolean(latest && condition?.cutoffTime && condition.cutoffTime > latest)
        return <div className="cutoff-sentence" key={field.id}>
          <div className="cutoff-step"><span className="cutoff-num">1</span><div>
            <p className="cutoff-q">Which delivery time is this for?</p>
            <SelectField label={`Delivery time ${index + 1}`} className="cutoff-wide" value={condition?.deliverySlotId ?? ''} onChange={value => set(index, 'deliverySlotId', value)} placeholder="Choose a delivery time" options={slotChoices.map(item => ({ value: item.id, label: `${humanWindow(item)}  (${item.name})`, disabled: taken.has(item.id) }))} />
          </div></div>
          <div className="cutoff-step"><span className="cutoff-num">2</span><div>
            <p className="cutoff-q">On which day do orders close?</p>
            <DayPicker label={`Closing day ${index + 1}`} value={day} onChange={value => set(index, 'dayRelation', value)} />
          </div></div>
          <div className="cutoff-step"><span className="cutoff-num">3</span><div>
            <p className="cutoff-q">At what time do orders close?</p>
            <SelectField label={`Closing time ${index + 1}`} className="cutoff-wide" value={condition?.cutoffTime ?? ''} onChange={value => set(index, 'cutoffTime', value)} placeholder="Choose a time" options={timeChoices(condition?.cutoffTime ?? '', latest)} />
            {latest ? <p className="cutoff-hint">This delivery starts at {formatTime(latest)}, so orders must close by then.</p> : null}
            {tooLate ? <p className="field-error" role="alert">This time is after the delivery starts. Choose an earlier time or “The day before”.</p> : null}
          </div></div>
          <div className="cutoff-step"><span className="cutoff-num">4</span><div>
            <p className="cutoff-q">Until when can customers cancel or skip?</p>
            <SelectField label={`Cancel deadline ${index + 1}`} className="cutoff-wide" value={ownCancel ? 'own' : SAME} onChange={value => { set(index, 'cancelDayRelation', value === SAME ? '' : day); if (value === SAME) set(index, 'cancelTime', '') }} placeholder="Choose" options={[{ value: SAME, label: 'Until orders close (same time)' }, { value: 'own', label: 'Until an earlier time I choose' }]} />
            {ownCancel ? <div className="cutoff-sub">
              <DayPicker label={`Cancel day ${index + 1}`} value={(condition?.cancelDayRelation || 'same_day') as Day} onChange={value => set(index, 'cancelDayRelation', value)} />
              <SelectField label={`Cancel time ${index + 1}`} className="cutoff-wide" value={condition?.cancelTime ?? ''} onChange={value => set(index, 'cancelTime', value)} placeholder="Choose a time" options={timeChoices(condition?.cancelTime ?? '')} />
            </div> : null}
          </div></div>
          {errors?.deliverySlotId?.message || errors?.cutoffTime?.message || errors?.cancelTime?.message ? <p className="field-error" role="alert">{errors?.deliverySlotId?.message ?? errors?.cutoffTime?.message ?? errors?.cancelTime?.message}</p> : null}
          {condition?.deliverySlotId && condition.cutoffTime ? <p className="cutoff-preview"><strong>In simple words:</strong> {cutoffPreview(condition, slot)}</p> : <p className="cutoff-hint">Fill the steps above and the rule will be explained here in simple words.</p>}
          {fields.fields.length > 1 ? <Button type="button" variant="ghost" className="text-button cutoff-remove" onClick={() => fields.remove(index)}><Trash2 size={14} /> Remove this delivery time</Button> : null}
        </div>
      })}
      {error ? <p className="field-error">{error}</p> : null}
      <p className="cutoff-hint">Saving a change affects new orders only. Orders already placed keep the closing time they had.</p>
      <Button type="button" className="secondary-button" onClick={() => fields.append({ deliverySlotId: '', dayRelation: 'previous_day', cutoffTime: '', cancelDayRelation: '', cancelTime: '' })}><Plus size={14} /> Add another delivery time</Button>
    </div>
  </section>
}
