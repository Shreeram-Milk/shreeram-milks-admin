'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { describeApiError } from '@/lib/api-errors'
import { categoryApi, type CategoryRecord } from '../api'
import { categorySchema, type CategoryFormValues } from '../schema'

const blank = (sortOrder: number): CategoryFormValues => ({ name: '', nameGujarati: '', description: '', sortOrder, status: 'active' })
const fromCategory = (category: CategoryRecord): CategoryFormValues => ({ name: category.name, nameGujarati: category.nameGu, description: category.description, sortOrder: category.sortOrder, status: category.status })

/** Mounted fresh for each create/edit, so the form always starts from the right record. The server checks the save again. */
export function CategoryDialog({ category, nextSortOrder, onClose, onDone }: { category: CategoryRecord | null; nextSortOrder: number; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema), defaultValues: category ? fromCategory(category) : blank(nextSortOrder) })
  const [error, setError] = useState('')
  const submit = handleSubmit(async values => {
    setError('')
    try {
      const payload = { name: values.name, nameGu: values.nameGujarati, description: values.description, sortOrder: values.sortOrder, status: values.status }
      if (category) await categoryApi.update(category.id, payload); else await categoryApi.create(payload)
      toast.success(category ? 'Category saved.' : 'Category created.')
      onClose()
      onDone()
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{category ? `Edit ${category.name}` : 'Add category'}</DialogTitle><DialogDescription>Products are linked to a category, and customers browse the catalogue by it.</DialogDescription></DialogHeader>
        <div className="record-editor-fields">
          <FormField label="Name" required error={errors.name?.message}><Input {...register('name')} autoComplete="off" placeholder="Milk" /></FormField>
          <FormField label="Gujarati name" error={errors.nameGujarati?.message} helper="Shown to customers who use the Gujarati app."><Input {...register('nameGujarati')} autoComplete="off" placeholder="દૂધ" /></FormField>
          <FormField label="Display order" error={errors.sortOrder?.message} helper="Lower numbers appear first."><Input {...register('sortOrder', { valueAsNumber: true })} type="number" min={0} inputMode="numeric" /></FormField>
          <FormField label="Description" error={errors.description?.message} className="field-wide"><Textarea {...register('description')} rows={2} maxLength={200} placeholder="Optional note for staff" /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{category ? 'Save Category' : 'Create Category'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
