'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import type { DeliverySlot } from '../api'
import { cutoffPreview, humanWindow } from '../format'
import type { FormValues } from '../form-values'

type Condition = FormValues['conditions'][number]
const DAY_OPTIONS = [{ value: 'previous_day', label: 'the day before' }, { value: 'same_day', label: 'the delivery day' }]
const SAME = 'same_as_cutoff'

/**
 * The order-by times of one rule, written as sentences to fill in: "For Morning delivery, take orders until 9:00 PM on the day
 * before." Each sentence saves the same slot, day and time as before.
 */
export function CutoffConditions({ form, fields, slotChoices, error }: { form: UseFormReturn<FormValues, unknown, FormValues>; fields: UseFieldArrayReturn<FormValues, 'conditions'>; slotChoices: DeliverySlot[]; error?: string }) {
  const conditions = form.watch('conditions') ?? []
  const set = <Key extends keyof Condition>(index: number, key: Key, value: Condition[Key]) => form.setValue(`conditions.${index}.${key}` as `conditions.${number}.${Key}`, value as never, { shouldDirty: true, shouldValidate: true })

  return <section className="form-card">
    <div className="form-section-heading"><span>02</span><div><h2>Order-by times</h2><p>One sentence for each delivery slot. Fill in the blanks.</p></div></div>
    <div className="cutoff-sentences">
      {fields.fields.map((field, index) => {
        const condition = conditions[index]
        const errors = form.formState.errors.conditions?.[index]
        const ownCancel = Boolean(condition?.cancelDayRelation)
        return <div className="cutoff-sentence" key={field.id}>
          <p className="cutoff-line">
            <span>For</span>
            <SelectField label={`Delivery slot ${index + 1}`} className="cutoff-pick" value={condition?.deliverySlotId ?? ''} onChange={value => set(index, 'deliverySlotId', value)} placeholder="choose a slot" options={slotChoices.map(slot => ({ value: slot.id, label: `${slot.name} (${humanWindow(slot)})` }))} />
            <span>delivery, take orders until</span>
            <Input type="time" className="cutoff-time" aria-label={`Order-by time ${index + 1}`} {...form.register(`conditions.${index}.cutoffTime`)} />
            <span>on</span>
            <SelectField label={`Order-by day ${index + 1}`} className="cutoff-pick" value={condition?.dayRelation ?? 'same_day'} onChange={value => set(index, 'dayRelation', value as Condition['dayRelation'])} placeholder="choose a day" options={DAY_OPTIONS} />
          </p>
          <p className="cutoff-line">
            <span>Customers can skip or cancel until</span>
            <SelectField label={`Skip deadline ${index + 1}`} className="cutoff-pick" value={ownCancel ? 'own' : SAME} onChange={value => { set(index, 'cancelDayRelation', value === SAME ? '' : (condition?.dayRelation ?? 'same_day')); if (value === SAME) set(index, 'cancelTime', '') }} placeholder="the same time" options={[{ value: SAME, label: 'the same time' }, { value: 'own', label: 'an earlier time' }]} />
            {ownCancel ? <>
              <Input type="time" className="cutoff-time" aria-label={`Skip deadline time ${index + 1}`} {...form.register(`conditions.${index}.cancelTime`)} />
              <span>on</span>
              <SelectField label={`Skip deadline day ${index + 1}`} className="cutoff-pick" value={condition?.cancelDayRelation || 'same_day'} onChange={value => set(index, 'cancelDayRelation', value as 'same_day' | 'previous_day')} placeholder="choose a day" options={DAY_OPTIONS} />
            </> : null}
          </p>
          {errors?.deliverySlotId?.message || errors?.cutoffTime?.message || errors?.cancelTime?.message ? <p className="field-error" role="alert">{errors?.deliverySlotId?.message ?? errors?.cutoffTime?.message ?? errors?.cancelTime?.message}</p> : null}
          {condition?.deliverySlotId && condition.cutoffTime ? <p className="cutoff-preview">{cutoffPreview(condition, slotChoices.find(slot => slot.id === condition.deliverySlotId))}</p> : null}
          {fields.fields.length > 1 ? <Button type="button" variant="ghost" className="text-button cutoff-remove" onClick={() => fields.remove(index)}><Trash2 size={14} /> Remove this slot</Button> : null}
        </div>
      })}
      {error ? <p className="field-error">{error}</p> : null}
      <Button type="button" className="secondary-button" onClick={() => fields.append({ deliverySlotId: '', dayRelation: 'previous_day', cutoffTime: '', cancelDayRelation: '', cancelTime: '' })}><Plus size={14} /> Add another slot</Button>
    </div>
  </section>
}
