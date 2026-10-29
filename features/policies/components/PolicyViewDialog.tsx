'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDisplayDate, formatTimestamp } from '@/lib/business-time'
import { POLICY_STATUS_LABELS, POLICY_TYPE_LABELS, type PolicyDocument } from '../types'
import { t } from '../messages'

/** Read-only view of any version, in both languages. */
export function PolicyViewDialog({ policy, onClose }: { policy: PolicyDocument; onClose: () => void }) {
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <DialogHeader>
        <DialogTitle>{t('viewTitle', { policy: POLICY_TYPE_LABELS[policy.type], version: policy.version })}</DialogTitle>
        <DialogDescription>{t('viewDescription', { status: POLICY_STATUS_LABELS[policy.status], date: formatDisplayDate(policy.effectiveDate) })}{policy.publishedAt ? t('viewPublished', { when: formatTimestamp(policy.publishedAt) }) : ''}</DialogDescription>
      </DialogHeader>
      <div className="policy-view">
        <section aria-label={t('english')}><h3>{policy.titleEn}</h3><p>{policy.bodyEn}</p></section>
        <section aria-label={t('gujarati')}><h3>{policy.titleGu || t('noGuTitle')}</h3><p>{policy.bodyGu || t('noGuText')}</p></section>
      </div>
      <DialogFooter><Button type="button" className="primary-button" onClick={onClose}>{t('close')}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
