'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { ACCEPT_ATTRIBUTE, fileProblem, formatFileSize, MAX_INLINE_PREVIEW_BYTES } from '../rules'
import { mediaService } from '../service'
import { MEDIA_TYPE_LABELS, type MediaAsset } from '../types'
import { MediaThumb } from './MediaThumb'

const metadataSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter a name for this file.').max(80, 'Keep the name under 80 characters.'),
  altTextEn: z.string().trim().max(160, 'Keep the description under 160 characters.'),
  altTextGu: z.string().trim().max(160, 'Keep the description under 160 characters.'),
})
type MetadataValues = z.infer<typeof metadataSchema>

type PickedFile = { name: string; type: string; size: number; previewUrl?: string }

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

/** Adds a file (mock upload) or, for an existing asset, edits its name and alt text. Mounted fresh each time. */
export function MediaDialog({ asset, onClose, onDone }: { asset: MediaAsset | null; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<MetadataValues>({ resolver: zodResolver(metadataSchema), defaultValues: { displayName: asset?.displayName ?? '', altTextEn: asset?.altTextEn ?? '', altTextGu: asset?.altTextGu ?? '' } })
  const [picked, setPicked] = useState<PickedFile | null>(null)
  const [fileError, setFileError] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setFileError('')
    if (!file) return
    const problem = fileProblem(file)
    if (problem) { setPicked(null); setFileError(problem); return }
    const previewUrl = file.type.startsWith('image/') && file.size <= MAX_INLINE_PREVIEW_BYTES ? await readAsDataUrl(file).catch(() => undefined) : undefined
    setPicked({ name: file.name, type: file.type, size: file.size, previewUrl })
    setValue('displayName', file.name.replace(/\.[^.]+$/, ''), { shouldValidate: true })
  }

  const submit = handleSubmit(values => {
    setError('')
    try {
      if (asset) { mediaService.update(asset.id, values); toast.success('File details saved.') }
      else {
        if (!picked) { setFileError('Choose a file to add.'); return }
        mediaService.add({ ...values, fileName: picked.name, mimeType: picked.type, fileSizeBytes: picked.size, previewUrl: picked.previewUrl })
        toast.success('File added.')
      }
      onClose()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the file.')
    }
  })

  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{asset ? 'Edit file details' : 'Add file'}</DialogTitle><DialogDescription>{asset ? 'Rename the file or update its description. The file itself stays the same.' : 'JPG, PNG or WebP images up to 5 MB, or PDF documents up to 10 MB. This is a preview only; nothing is uploaded yet.'}</DialogDescription></DialogHeader>
        <div className="record-editor-fields">
          {asset
            ? <div className="media-summary"><MediaThumb asset={asset} size="large" /><div><strong>{asset.fileName}</strong><span>{MEDIA_TYPE_LABELS[asset.type]} · {formatFileSize(asset.fileSizeBytes)}</span></div></div>
            : <div className="media-picker">
              <input ref={input} id="media-file" type="file" accept={ACCEPT_ATTRIBUTE} className="sr-only" onChange={event => void onFile(event)} aria-describedby="media-file-error" />
              <Button type="button" variant="outline" className="secondary-button" onClick={() => input.current?.click()}><Upload size={15} /> {picked ? 'Choose a different file' : 'Choose file'}</Button>
              {picked && <span className="media-picked">{picked.name} · {formatFileSize(picked.size)}</span>}
              <small id="media-file-error" className="field-error" role={fileError ? 'alert' : undefined}>{fileError}</small>
            </div>}
          <FormField label="Name" required error={errors.displayName?.message}><Input {...register('displayName')} autoComplete="off" /></FormField>
          <div className="record-editor-fields two-column">
            <FormField label="Description (English)" error={errors.altTextEn?.message} helper="Read aloud by screen readers and shown if the image can’t load."><Input {...register('altTextEn')} autoComplete="off" /></FormField>
            <FormField label="Description (Gujarati)" error={errors.altTextGu?.message}><Input {...register('altTextGu')} autoComplete="off" /></FormField>
          </div>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{asset ? 'Save Details' : 'Add File'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
