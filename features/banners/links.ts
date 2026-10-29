'use client'

import { useEffect, useState } from 'react'
import { categoryApi } from '../categories/api'
import { productApi } from '../products/api'
import type { Banner } from './types'
import { t } from './messages'

type Option = { value: string; label: string }
type Targets = { categories: Option[]; products: Option[] }

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
    Promise.all([categoryApi.all(), productApi.list({ search: '', status: 'active', categoryId: '', page: 1, pageSize: MAX_PRODUCT_CHOICES })]).then(
      ([categories, products]) => { if (!cancelled) setTargets({ categories: categories.filter(item => item.status === 'active').map(item => ({ value: item.id, label: item.name })), products: products.rows.map(item => ({ value: item.id, label: item.name })) }) },
      // The picker stays empty and the labels fall back to a plain message; the banner screens still work.
      () => { if (!cancelled) setTargets({ categories: [], products: [] }) },
    )
    return () => { cancelled = true }
  }, [])

  return {
    loaded: targets !== null,
    options: (ctaType: Banner['ctaType']): Option[] => (ctaType === 'product' ? targets?.products : ctaType === 'category' ? targets?.categories : undefined) ?? [],
    label: (banner: Pick<Banner, 'ctaType' | 'ctaTarget'>): string => {
      if (banner.ctaType === 'none') return t('ctaNone')
      if (banner.ctaType === 'offers') return t('ctaOffers')
      if (!targets) return '…'
      const list = banner.ctaType === 'product' ? targets.products : targets.categories
      return list.find(option => option.value === banner.ctaTarget)?.label ?? (banner.ctaType === 'product' ? t('missingProduct') : t('missingCategory'))
    },
  }
}
