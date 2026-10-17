'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { describeApiError } from '@/lib/api-errors'
import { MEDIA_RULES, imageProblem, uploadImage, type MediaPurpose } from '@/lib/media-upload'

type Props = {
  purpose: MediaPurpose
  /** The field's name, for example "Picture" or "Icon". */
  label: string
  hint: string
  /** The saved file's link, shown until a new one is chosen. */
  currentUrl: string | null
  hasImage: boolean
  onChange: (assetId: string | null) => void
  /** When the parent keeps the picture's preview (so it survives leaving and returning to this field), it gets the link here. */
  onPreview?: (assetId: string, url: string) => void
  onBusyChange: (busy: boolean) => void
  /** Whether the file can be removed again. Slides always need a picture, so they cannot. */
  removable?: boolean
  error?: string
}

/** Picks a file, uploads it straight away and reports its id. The record only stores that id when the form is saved. */
export function ImageUploadField({ purpose, label, hint, currentUrl, hasImage, onChange, onPreview, onBusyChange, removable = true, error: fieldError }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const shown = preview ?? (removed ? null : currentUrl)
  const noun = label.toLowerCase()
  const choose = async (file: File | undefined) => {
    if (!file) return
    const problem = imageProblem(file, purpose)
    if (problem) { setError(problem); toast.error(problem); return }
    setError('')
    setUploading(true)
    onBusyChange(true)
    try {
      const id = await uploadImage(file, purpose)
      onChange(id)
      const url = URL.createObjectURL(file)
      if (onPreview) onPreview(id, url)
      else setPreview(url)
      setRemoved(false)
      toast.success(`${label} uploaded. Save to keep it.`)
    } catch (failure) {
      const message = describeApiError(failure)
      setError(message)
      toast.error(message)
    } finally {
      setUploading(false)
      onBusyChange(false)
      if (input.current) input.current.value = ''
    }
  }
  const remove = () => { setPreview(null); setRemoved(true); setError(''); onChange(null); toast.success(`${label} removed. Save to apply this.`) }
  const shownError = error || fieldError

  return <div className="banner-image-field">
    <span className="field-label">{label}</span>
    <div className="banner-image-box">
      {/* A plain <img>: the source is a local preview or a short-lived signed link, which next/image cannot optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {shown ? <img src={shown} alt={`${label} preview`} className="banner-image-preview" /> : <span className="banner-image-empty"><ImagePlus size={22} aria-hidden="true" />No {noun}</span>}
    </div>
    <div className="banner-image-actions">
      <input ref={input} type="file" accept={MEDIA_RULES[purpose].types.join(',')} hidden onChange={event => void choose(event.target.files?.[0])} aria-label={`Choose a ${noun}`} />
      <Button type="button" variant="outline" className="secondary-button" disabled={uploading} onClick={() => input.current?.click()}>{uploading ? 'Uploading…' : shown || hasImage ? `Change ${noun}` : `Choose ${noun}`}</Button>
      {removable && (shown || (hasImage && !removed)) && <Button type="button" variant="outline" className="secondary-button" disabled={uploading} onClick={remove}><Trash2 size={15} /> Remove</Button>}
    </div>
    <p className="product-hint">{hint}</p>
    {shownError && <p className="field-error" role="alert">{shownError}</p>}
  </div>
}
