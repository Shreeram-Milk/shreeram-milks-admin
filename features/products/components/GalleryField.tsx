'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, LayoutGrid, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { describeApiError } from '@/lib/api-errors'
import { MEDIA_RULES, imageProblem, uploadImage } from '@/lib/media-upload'
import { MAX_GALLERY_IMAGES } from '../types'

type Props = {
  assetIds: string[]
  /** Links to show for each picture: the saved ones from the server, and a local preview for ones just uploaded. The form owns them, so they survive leaving this step. */
  urls: Record<string, string>
  onChange: (assetIds: string[]) => void
  onPreview: (assetId: string, url: string) => void
  /** Told while any block is uploading, so the form can hold the Save button until the picture has arrived. */
  onBusyChange?: (busy: boolean) => void
}

/** One place for a picture. It is empty until the admin chooses a file for it; `assetId` is set once the upload has finished. */
type Block = { key: string; assetId: string | null; uploading: boolean; error: string }

const newKey = () => crypto.randomUUID()

/**
 * The extra pictures on a product page, as a row of blocks. "Add image blocks" asks how many blocks to make (1 to the room left,
 * at most MAX_GALLERY_IMAGES in all); each block is its own uploader and uses the same pipeline as every other picture:
 * shrunk in the browser, sent straight to storage, and only its id is saved with the product.
 */
export function GalleryField({ assetIds, urls, onChange, onPreview, onBusyChange }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => assetIds.map(assetId => ({ key: newKey(), assetId, uploading: false, error: '' })))
  // Uploads can finish in any order, so the latest blocks are read from here rather than from a possibly stale render.
  const latest = useRef(blocks)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [count, setCount] = useState('5')
  const [countError, setCountError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const target = useRef<string | null>(null)

  const room = MAX_GALLERY_IMAGES - blocks.length
  const anyUploading = blocks.some(block => block.uploading)
  useEffect(() => { onBusyChange?.(anyUploading) }, [anyUploading, onBusyChange])

  /** Applies a change to the blocks and tells the form which pictures are saved, in block order. */
  const update = (next: Block[]) => {
    latest.current = next
    setBlocks(next)
    onChange(next.flatMap(block => (block.assetId ? [block.assetId] : [])))
  }
  const patch = (key: string, changes: Partial<Block>) => update(latest.current.map(block => (block.key === key ? { ...block, ...changes } : block)))

  const openDialog = () => { setCount(String(Math.min(5, room))); setCountError(''); setDialogOpen(true) }
  const createBlocks = () => {
    const wanted = Number(count)
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > room) { setCountError(`Enter a whole number from 1 to ${room}.`); return }
    update([...latest.current, ...Array.from({ length: wanted }, (): Block => ({ key: newKey(), assetId: null, uploading: false, error: '' }))])
    setDialogOpen(false)
  }

  const choose = (key: string) => { target.current = key; input.current?.click() }
  const upload = async (file: File | undefined) => {
    const key = target.current
    if (input.current) input.current.value = ''
    if (!file || !key) return
    const problem = imageProblem(file, 'product')
    if (problem) { patch(key, { error: problem }); toast.error(problem); return }
    patch(key, { uploading: true, error: '' })
    try {
      const id = await uploadImage(file, 'product')
      onPreview(id, URL.createObjectURL(file))
      patch(key, { assetId: id, uploading: false, error: '' })
      toast.success('Picture uploaded. Save to keep it.')
    } catch (failure) {
      const message = describeApiError(failure)
      patch(key, { uploading: false, error: message })
      toast.error(message)
    }
  }

  return <div className="product-gallery">
    <span className="product-form-label">Gallery ({blocks.filter(block => block.assetId).length} of {MAX_GALLERY_IMAGES} pictures)</span>
    <input ref={input} type="file" accept={MEDIA_RULES.product.types.join(',')} hidden onChange={event => void upload(event.target.files?.[0])} aria-label="Choose a gallery picture" />
    {blocks.length > 0 && <ul className="gallery-blocks">{blocks.map((block, index) => <li key={block.key} className="gallery-block">
      {block.assetId
        ? <>
          {urls[block.assetId]
            // A plain <img>: the source is a local preview or a short-lived signed link, which next/image cannot optimise.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={urls[block.assetId]} alt={`Gallery picture ${index + 1}`} className="gallery-block-image" />
            : <span className="gallery-block-empty">No preview</span>}
          <Button type="button" variant="ghost" size="icon" className="gallery-block-remove" aria-label={`Remove gallery picture ${index + 1}`} onClick={() => update(latest.current.filter(item => item.key !== block.key))}><Trash2 size={14} /></Button>
        </>
        : <>
          <button type="button" className="gallery-block-empty" disabled={block.uploading} onClick={() => choose(block.key)} aria-label={`Upload gallery picture ${index + 1}`}>
            <ImagePlus size={20} aria-hidden="true" />
            <span>{block.uploading ? 'Uploading…' : 'Click to upload'}</span>
          </button>
          {!block.uploading && <Button type="button" variant="ghost" size="icon" className="gallery-block-remove" aria-label={`Remove empty block ${index + 1}`} onClick={() => update(latest.current.filter(item => item.key !== block.key))}><X size={14} /></Button>}
        </>}
      {block.error && <small className="field-error" role="alert">{block.error}</small>}
    </li>)}</ul>}
    <div><Button type="button" variant="outline" className="secondary-button" disabled={room <= 0} onClick={openDialog}><LayoutGrid size={15} /> Add image blocks</Button></div>
    <p className="product-hint">{room > 0 ? `You can add up to ${MAX_GALLERY_IMAGES} gallery pictures; ${room} more ${room === 1 ? 'block' : 'blocks'} available. ` : `The gallery is full (${MAX_GALLERY_IMAGES} pictures). `}JPEG, PNG or WebP. Large photos are shrunk automatically.</p>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="record-editor-dialog">
        <DialogHeader>
          <DialogTitle>Add image blocks</DialogTitle>
          <DialogDescription>How many pictures do you want to add? Each one becomes an empty block you click to upload. You can add up to {room} more.</DialogDescription>
        </DialogHeader>
        <form onSubmit={event => { event.preventDefault(); createBlocks() }}>
          <label className="product-form-label" htmlFor="gallery-block-count">Number of blocks (1 to {room})</label>
          <Input id="gallery-block-count" type="number" inputMode="numeric" min={1} max={room} value={count} autoFocus onChange={event => { setCount(event.target.value); setCountError('') }} aria-invalid={Boolean(countError)} aria-describedby={countError ? 'gallery-block-count-error' : undefined} />
          {countError && <p id="gallery-block-count-error" className="field-error" role="alert">{countError}</p>}
          <DialogFooter className="dialog-actions">
            <Button type="button" variant="outline" className="secondary-button" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" className="primary-button">Create blocks</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
}
