'use client'

import { useEffect, useState } from 'react'
import { categoryApi } from '../categories/api'
import { offerApi } from '../offers/api'
import { productApi } from '../products/api'
import { BANNER_CTA_LABELS, CTA_WITH_TARGET, type Banner } from './types'
import { t } from './messages'

type Option = { value: string; label: string }
type Targets = { categories: Option[]; products: Option[]; offers: Option[] }

/** The most products the banner picker lists. A catalogue larger than this needs a searchable picker. */
const MAX_PRODUCT_CHOICES = 100

/**
 * What a banner can open: the categories and live products from the backend. Loaded once per screen.
 * `label` names a banner's target for list rows; a target that no longer exists is shown plainly, never hidden.
 */
export function useLinkTargets() {
  const [targets, setTargets] = useState<Targets | null>(null)
  useEffect(() => {
    let cancelled = false
    Promise.all([categoryApi.all(), productApi.list({ search: '', status: 'active', categoryId: '', page: 1, pageSize: MAX_PRODUCT_CHOICES }), offerApi.list().catch(() => [])]).then(
      ([categories, products, offers]) => {
        if (cancelled) return
        setTargets({
          categories: categories.filter(item => item.status === 'active').map(item => ({ value: item.id, label: item.name })),
          products: products.rows.map(item => ({ value: item.id, label: item.name })),
          // Scratch-card offers are hidden from customers, so a banner cannot open them.
          offers: offers.filter(item => item.status === 'active' && !item.rewardOnly).map(item => ({ value: item.id, label: item.code ? `${item.title} (${item.code})` : item.title })),
        })
      },
      // The picker stays empty and the labels fall back to a plain message; the banner screens still work.
      () => { if (!cancelled) setTargets({ categories: [], products: [], offers: [] }) },
    )
    return () => { cancelled = true }
  }, [])

  return {
    loaded: targets !== null,
    options: (ctaType: Banner['ctaType']): Option[] => (ctaType === 'product' ? targets?.products : ctaType === 'category' ? targets?.categories : ctaType === 'offer' ? targets?.offers : undefined) ?? [],
    label: (banner: Pick<Banner, 'ctaType' | 'ctaTarget'>): string => {
      if (!CTA_WITH_TARGET.includes(banner.ctaType)) return BANNER_CTA_LABELS[banner.ctaType]
      if (!targets) return '…'
      const list = banner.ctaType === 'product' ? targets.products : banner.ctaType === 'offer' ? targets.offers : targets.categories
      return list.find(option => option.value === banner.ctaTarget)?.label ?? (banner.ctaType === 'product' ? t('missingProduct') : banner.ctaType === 'offer' ? t('missingOffer') : t('missingCategory'))
    },
  }
}
