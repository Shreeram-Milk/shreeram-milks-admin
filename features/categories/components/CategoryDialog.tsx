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
import { t } from '../messages'

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
      toast.success(category ? t('saved') : t('created'))
      onClose()
      onDone()
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{category ? t('editName', { name: category.name }) : t('addTitle')}</DialogTitle><DialogDescription>{t('dialogDescription')}</DialogDescription></DialogHeader>
        <div className="record-editor-fields">
          <FormField label={t('name')} required error={errors.name?.message}><Input {...register('name')} autoComplete="off" placeholder={t('namePlaceholder')} /></FormField>
          <FormField label={t('gujaratiName')} error={errors.nameGujarati?.message} helper={t('gujaratiHelper')}><Input {...register('nameGujarati')} autoComplete="off" placeholder="દૂધ" /></FormField>
          <FormField label={t('displayOrder')} error={errors.sortOrder?.message} helper={t('displayOrderHelper')}><Input {...register('sortOrder', { valueAsNumber: true })} type="number" min={0} inputMode="numeric" /></FormField>
          <FormField label={t('descriptionField')} error={errors.description?.message} className="field-wide"><Textarea {...register('description')} rows={2} maxLength={200} placeholder={t('descriptionPlaceholder')} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>{t('cancel')}</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{category ? t('saveCategory') : t('createCategory')}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
