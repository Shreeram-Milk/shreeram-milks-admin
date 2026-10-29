import { ImageOff } from 'lucide-react'
import type { Product } from '../api'
import { PRODUCT_BADGE_LABELS } from '../types'
import { t } from '../messages'

const text = (value: string) => value || t('notAdded')

/** A saved picture, or a plain "no preview" tile. A plain <img>: the source is a short-lived signed link, which next/image cannot optimise. */
function Picture({ url, label }: { url: string; label: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="media-thumb large"><img src={url} alt={label} /></span>
}

/** Read-only view of a product's content for the detail page: what is filled in and what is still missing. */
export function ProductContentSummary({ product }: { product: Product }) {
  return <div className="product-content-summary">
    <div className="product-content-images">
      {product.primaryImage ? <figure><Picture url={product.primaryImage.url} label={t('primaryImage')} /><figcaption>{t('primaryImage')}</figcaption></figure> : <p className="product-hint"><ImageOff size={14} aria-hidden="true" /> {t('noPrimaryImage')}</p>}
      {product.gallery.map((image, index) => <figure key={image.assetId}><Picture url={image.url} label={t('galleryPicture', { number: index + 1 })} /><figcaption>{t('galleryShort', { number: index + 1 })}</figcaption></figure>)}
    </div>
    <dl className="product-detail-rows">
      <div><dt>{t('descriptionEn')}</dt><dd>{text(product.longDescriptionEn)}</dd></div>
      <div><dt>{t('descriptionGu')}</dt><dd>{text(product.longDescriptionGu)}</dd></div>
      <div><dt>{t('nutritionEn')}</dt><dd>{text(product.nutritionEn)}</dd></div>
      <div><dt>{t('nutritionGu')}</dt><dd>{text(product.nutritionGu)}</dd></div>
      <div><dt>{t('highlightsEn')}</dt><dd>{text(product.highlightsEn.join(' · '))}</dd></div>
      <div><dt>{t('highlightsGu')}</dt><dd>{text(product.highlightsGu.join(' · '))}</dd></div>
      <div><dt>{t('badges')}</dt><dd>{product.badges.map(badge => PRODUCT_BADGE_LABELS[badge]).join(', ') || t('none')}</dd></div>
    </dl>
  </div>
}
