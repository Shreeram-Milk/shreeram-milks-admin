'use client'

import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { describeUsage } from '../format'
import type { Usage } from '../api'
import { t } from '../messages'

/** Shown when the server refuses to switch something off because it is still used; the admin can switch it off anyway. */
export function InUseDialog({ open, name, usages, onCancel, onConfirm }: { open: boolean; name: string; usages: Usage[]; onCancel: () => void; onConfirm: () => void }) {
  return <AlertDialog open={open} onOpenChange={next => { if (!next) onCancel() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">{t('dependencyCheck')}</p>
        <AlertDialogTitle>{t('deactivateName', { name })}</AlertDialogTitle>
        <AlertDialogDescription asChild><div>
          <p>{t('usedBy')}</p>
          <ul>{usages.filter(usage => usage.count > 0).map(usage => <li key={usage.label}>{describeUsage(usage)}</li>)}</ul>
          <p className="warning-note">{t('stayVisible')}</p>
        </div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">{t('keepActive')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" onClick={onConfirm}>{t('deactivate')}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
