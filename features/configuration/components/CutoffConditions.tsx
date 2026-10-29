'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import type { DeliverySlot } from '../api'
import { cutoffPreview, formatTime, humanWindow, timeChoices } from '../format'
import type { FormValues } from '../form-values'
import { t, type ConfigKey } from '../messages'

type Condition = FormValues['conditions'][number]
type Day = 'previous_day' | 'same_day'
const SAME = 'same_as_cutoff'
const DAY_BUTTONS: Array<{ value: Day; title: ConfigKey; hint: ConfigKey }> = [
  { value: 'previous_day', title: 'theDayBefore', hint: 'theDayBeforeHint' },
  { value: 'same_day', title: 'theSameDay', hint: 'theSameDayHint' },
]

function DayPicker({ label, value, onChange }: { label: string; value: Day; onChange: (value: Day) => void }) {
  return <div className="cutoff-days" role="radiogroup" aria-label={label}>
    {DAY_BUTTONS.map(day => <button type="button" role="radio" aria-checked={value === day.value} key={day.value} className={`cutoff-day${value === day.value ? ' is-active' : ''}`} onClick={() => onChange(day.value)}>
      <strong>{t(day.title)}</strong><span>{t(day.hint)}</span>
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
    <div className="form-section-heading"><span>02</span><div><h2>{t('whenClose')}</h2><p>{t('whenCloseHint')}</p></div></div>
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
            <p className="cutoff-q">{t('whichDelivery')}</p>
            <SelectField label={t('deliveryTimeN', { number: index + 1 })} className="cutoff-wide" value={condition?.deliverySlotId ?? ''} onChange={value => set(index, 'deliverySlotId', value)} placeholder={t('chooseDeliveryTime')} options={slotChoices.map(item => ({ value: item.id, label: `${humanWindow(item)}  (${item.name})`, disabled: taken.has(item.id) }))} />
          </div></div>
          <div className="cutoff-step"><span className="cutoff-num">2</span><div>
            <p className="cutoff-q">{t('whichDay')}</p>
            <DayPicker label={t('closingDayN', { number: index + 1 })} value={day} onChange={value => set(index, 'dayRelation', value)} />
          </div></div>
          <div className="cutoff-step"><span className="cutoff-num">3</span><div>
            <p className="cutoff-q">{t('whatTime')}</p>
            <SelectField label={t('closingTimeN', { number: index + 1 })} className="cutoff-wide" value={condition?.cutoffTime ?? ''} onChange={value => set(index, 'cutoffTime', value)} placeholder={t('chooseTime')} options={timeChoices(condition?.cutoffTime ?? '', latest)} />
            {latest ? <p className="cutoff-hint">{t('startsAt', { time: formatTime(latest) })}</p> : null}
            {tooLate ? <p className="field-error" role="alert">{t('tooLate')}</p> : null}
          </div></div>
          <div className="cutoff-step"><span className="cutoff-num">4</span><div>
            <p className="cutoff-q">{t('untilCancel')}</p>
            <SelectField label={t('cancelDeadlineN', { number: index + 1 })} className="cutoff-wide" value={ownCancel ? 'own' : SAME} onChange={value => { set(index, 'cancelDayRelation', value === SAME ? '' : day); if (value === SAME) set(index, 'cancelTime', '') }} placeholder={t('choose')} options={[{ value: SAME, label: t('untilClose') }, { value: 'own', label: t('untilEarlier') }]} />
            {ownCancel ? <div className="cutoff-sub">
              <DayPicker label={t('cancelDayN', { number: index + 1 })} value={(condition?.cancelDayRelation || 'same_day') as Day} onChange={value => set(index, 'cancelDayRelation', value)} />
              <SelectField label={t('cancelTimeN', { number: index + 1 })} className="cutoff-wide" value={condition?.cancelTime ?? ''} onChange={value => set(index, 'cancelTime', value)} placeholder={t('chooseTime')} options={timeChoices(condition?.cancelTime ?? '')} />
            </div> : null}
          </div></div>
          {errors?.deliverySlotId?.message || errors?.cutoffTime?.message || errors?.cancelTime?.message ? <p className="field-error" role="alert">{errors?.deliverySlotId?.message ?? errors?.cutoffTime?.message ?? errors?.cancelTime?.message}</p> : null}
          {condition?.deliverySlotId && condition.cutoffTime ? <p className="cutoff-preview"><strong>{t('inSimpleWords')}</strong> {cutoffPreview(condition, slot)}</p> : <p className="cutoff-hint">{t('fillSteps')}</p>}
          {fields.fields.length > 1 ? <Button type="button" variant="ghost" className="text-button cutoff-remove" onClick={() => fields.remove(index)}><Trash2 size={14} /> {t('removeDeliveryTime')}</Button> : null}
        </div>
      })}
      {error ? <p className="field-error">{error}</p> : null}
      <p className="cutoff-hint">{t('newOrdersOnly')}</p>
      <Button type="button" className="secondary-button" onClick={() => fields.append({ deliverySlotId: '', dayRelation: 'previous_day', cutoffTime: '', cancelDayRelation: '', cancelTime: '' })}><Plus size={14} /> {t('addDeliveryTime')}</Button>
    </div>
  </section>
}
