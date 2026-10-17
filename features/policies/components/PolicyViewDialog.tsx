'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDisplayDate, formatTimestamp } from '@/lib/business-time'
import { POLICY_STATUS_LABELS, POLICY_TYPE_LABELS, type PolicyDocument } from '../types'

/** Read-only view of any version, in both languages. */
export function PolicyViewDialog({ policy, onClose }: { policy: PolicyDocument; onClose: () => void }) {
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <DialogHeader>
        <DialogTitle>{POLICY_TYPE_LABELS[policy.type]} · version {policy.version}</DialogTitle>
        <DialogDescription>{POLICY_STATUS_LABELS[policy.status]} · effective {formatDisplayDate(policy.effectiveDate)}{policy.publishedAt ? ` · published ${formatTimestamp(policy.publishedAt)}` : ''}</DialogDescription>
      </DialogHeader>
      <div className="policy-view">
        <section aria-label="English"><h3>{policy.titleEn}</h3><p>{policy.bodyEn}</p></section>
        <section aria-label="Gujarati"><h3>{policy.titleGu || 'Gujarati title not added'}</h3><p>{policy.bodyGu || 'Gujarati text not added yet.'}</p></section>
      </div>
      <DialogFooter><Button type="button" className="primary-button" onClick={onClose}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
