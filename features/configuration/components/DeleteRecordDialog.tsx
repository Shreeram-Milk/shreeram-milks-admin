'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ApiError } from '@/lib/api-client'
import { describeApiError } from '@/lib/api-errors'
import { describeUsage, readUsages } from '../format'
import type { RecordStatus, Usage } from '../api'

type Target = { id: string; name: string; status: RecordStatus }

/**
 * Delete flow for a master value. The admin confirms first; the server then decides. If anything still uses
 * the value the server refuses, and this dialog switches to a warning that offers Deactivate instead.
 */
export function DeleteRecordDialog({ target, noun, remove, deactivate, onClose, onChanged }: {
  target: Target
  /** Plain words such as "delivery slot". */
  noun: string
  remove: (id: string) => Promise<unknown>
  /** Switches the value off, with the admin's confirmation already given. */
  deactivate: (id: string) => Promise<unknown>
  onClose: () => void
  onChanged: () => void
}) {
  const [usages, setUsages] = useState<Usage[] | null>(null)
  const [busy, setBusy] = useState(false)

  const finish = (message: string) => { toast.success(message); onChanged(); onClose() }
  const confirmDelete = async () => {
    setBusy(true)
    try {
      await remove(target.id)
      finish(`${target.name} deleted.`)
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'IN_USE') setUsages(readUsages(failure.details))
      else { toast.error(describeApiError(failure)); onChanged(); onClose() }
    } finally { setBusy(false) }
  }
  const confirmDeactivate = async () => {
    setBusy(true)
    try {
      await deactivate(target.id)
      finish(`${target.name} deactivated.`)
    } catch (failure) { toast.error(describeApiError(failure)); onClose() } finally { setBusy(false) }
  }

  return <AlertDialog open onOpenChange={next => { if (!next && !busy) onClose() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">{usages ? 'Cannot delete' : 'Delete'}</p>
        <AlertDialogTitle>{usages ? `“${target.name}” is in use` : `Delete “${target.name}”?`}</AlertDialogTitle>
        <AlertDialogDescription asChild><div>
          {usages ? <>
            <p>This {noun} is used by:</p>
            <ul>{usages.filter(usage => usage.count > 0).map(usage => <li key={usage.label}>{describeUsage(usage)}</li>)}</ul>
            <p className="warning-note">{target.status === 'active' ? 'It cannot be deleted while it is used. Deactivate it instead: existing references stay visible as inactive, and it will not be available for new setup.' : 'It cannot be deleted while it is used. It is already inactive, so it is not available for new setup.'}</p>
          </> : <p className="warning-note">This permanently deletes this {noun} and cannot be undone. If it is used anywhere, nothing is deleted and you can deactivate it instead.</p>}
        </div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions">
        <AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>{usages ? 'Close' : 'Keep it'}</Button></AlertDialogCancel>
        {usages
          ? target.status === 'active' && <AlertDialogAction asChild><Button className="primary-button" disabled={busy} onClick={event => { event.preventDefault(); void confirmDeactivate() }}>Deactivate instead</Button></AlertDialogAction>
          : <AlertDialogAction asChild><Button className="primary-button destructive-button" disabled={busy} onClick={event => { event.preventDefault(); void confirmDelete() }}>{busy ? 'Deleting…' : 'Delete'}</Button></AlertDialogAction>}
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
