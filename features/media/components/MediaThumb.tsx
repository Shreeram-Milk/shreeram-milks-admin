import { FileText, ImageOff } from 'lucide-react'
import type { MediaAsset } from '../types'

/** Small preview tile: the image when there is one to show, otherwise an icon for the kind of file. */
export function MediaThumb({ asset, size = 'small' }: { asset: Pick<MediaAsset, 'type' | 'url' | 'altTextEn' | 'displayName'>; size?: 'small' | 'large' }) {
  const previewable = asset.type === 'image' && asset.url.startsWith('data:')
  return <span className={`media-thumb ${size}`}>
    {previewable
      // eslint-disable-next-line @next/next/no-img-element -- mock data URLs cannot go through the image optimizer
      ? <img src={asset.url} alt={asset.altTextEn || asset.displayName} />
      : asset.type === 'document' ? <FileText size={size === 'large' ? 40 : 20} aria-label="Document" /> : <ImageOff size={size === 'large' ? 40 : 20} aria-label="No preview available" />}
  </span>
}
