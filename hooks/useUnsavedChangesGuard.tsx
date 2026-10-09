'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

/**
 * Protects dirty forms: browser unload, in-app link clicks, and explicit Cancel/Back buttons.
 * Render `dialog` once inside the form screen and call `leave(path)` for programmatic exits.
 */
export function useUnsavedChangesGuard(isDirty: boolean, fallbackPath: string) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const dirty = useRef(isDirty)
  useEffect(() => { dirty.current = isDirty }, [isDirty])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    const onAnchorClick = (event: MouseEvent) => {
      if (!dirty.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) return
      const destination = new URL(anchor.href, location.href)
      if (destination.origin !== location.origin || (destination.pathname === location.pathname && destination.search === location.search)) return
      event.preventDefault()
      event.stopPropagation()
      setPending(`${destination.pathname}${destination.search}${destination.hash}`)
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('click', onAnchorClick, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('click', onAnchorClick, true) }
  }, [])

  const leave = (destination: string = fallbackPath) => {
    if (dirty.current) setPending(destination)
    else router.push(destination)
  }

  const dialog = <AlertDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null) }}>
    {pending !== null && <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader><p className="eyebrow">Unsaved changes</p><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your unsaved changes will be lost.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions">
        <AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Stay</Button></AlertDialogCancel>
        <AlertDialogAction asChild><Button className="primary-button" onClick={() => { dirty.current = false; router.push(pending) }}>Discard Changes</Button></AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>}
  </AlertDialog>

  return { leave, dialog }
}
