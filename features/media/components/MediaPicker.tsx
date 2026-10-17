'use client'

import Link from 'next/link'
import { SelectField } from '@/components/ui/select-field'
import { mediaService } from '../service'
import type { MediaType } from '../types'
import { MediaThumb } from './MediaThumb'

const NONE = '__none__'

/** Chooses a file from the Media Library, optionally limited to images or documents, and previews the choice. */
export function MediaPicker({ id, label, value, onChange, type, allowNone = true }: { id?: string; label: string; value: string; onChange: (assetId: string) => void; type?: MediaType; allowNone?: boolean }) {
  const asset = value ? mediaService.getById(value) : undefined
  const options = mediaService.options(type)
  return <div className="media-picker-field">
    <SelectField id={id} label={label} placeholder={`Choose ${type === 'image' ? 'an image' : type === 'document' ? 'a document' : 'a file'}`} value={value || (allowNone ? NONE : '')} onChange={next => onChange(next === NONE ? '' : next)} options={[...(allowNone ? [{ value: NONE, label: 'None' }] : []), ...options]} />
    <div className="media-picker-preview">
      {asset ? <><MediaThumb asset={asset} /><span>{asset.fileName}</span></> : value ? <span>This file is no longer in the library.</span> : <span>Nothing chosen.</span>}
      <Link className="product-name-link" href="/content/media">Open Media Library</Link>
    </div>
  </div>
}
