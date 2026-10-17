import { ImageOff } from 'lucide-react'
import type { Product } from '../api'
import { PRODUCT_BADGE_LABELS } from '../types'

const text = (value: string) => value || 'Not added'

/** A saved picture, or a plain "no preview" tile. A plain <img>: the source is a short-lived signed link, which next/image cannot optimise. */
function Picture({ url, label }: { url: string; label: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="media-thumb large"><img src={url} alt={label} /></span>
}

/** Read-only view of a product's content for the detail page: what is filled in and what is still missing. */
export function ProductContentSummary({ product }: { product: Product }) {
  return <div className="product-content-summary">
    <div className="product-content-images">
      {product.primaryImage ? <figure><Picture url={product.primaryImage.url} label="Primary image" /><figcaption>Primary image</figcaption></figure> : <p className="product-hint"><ImageOff size={14} aria-hidden="true" /> No primary image yet.</p>}
      {product.gallery.map((image, index) => <figure key={image.assetId}><Picture url={image.url} label={`Gallery picture ${index + 1}`} /><figcaption>Gallery {index + 1}</figcaption></figure>)}
    </div>
    <dl className="product-detail-rows">
      <div><dt>Description (English)</dt><dd>{text(product.longDescriptionEn)}</dd></div>
      <div><dt>Description (Gujarati)</dt><dd>{text(product.longDescriptionGu)}</dd></div>
      <div><dt>Nutrition (English)</dt><dd>{text(product.nutritionEn)}</dd></div>
      <div><dt>Nutrition (Gujarati)</dt><dd>{text(product.nutritionGu)}</dd></div>
      <div><dt>Highlights (English)</dt><dd>{product.highlightsEn.join(' · ') || 'Not added'}</dd></div>
      <div><dt>Highlights (Gujarati)</dt><dd>{product.highlightsGu.join(' · ') || 'Not added'}</dd></div>
      <div><dt>Badges</dt><dd>{product.badges.map(badge => PRODUCT_BADGE_LABELS[badge]).join(', ') || 'None'}</dd></div>
    </dl>
  </div>
}
