'use client'

import { useController, type Control, type FieldValues, type Path } from 'react-hook-form'
import { SelectField, type SelectFieldOption } from '@/components/ui/select-field'

/** react-hook-form-bound SelectField. Accepts `id` so FormField can wire its label to the trigger. */
export function FormSelect<Values extends FieldValues>({ control, name, label, placeholder, options, id }: { control: Control<Values>; name: Path<Values>; label: string; placeholder: string; options: SelectFieldOption[]; id?: string }) {
  const { field } = useController({ control, name })
  return <SelectField id={id} label={label} placeholder={placeholder} options={options} value={String(field.value ?? '')} onChange={field.onChange} />
}
