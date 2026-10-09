'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

/** Search box that reports the committed value after a short pause in typing. */
export function ListSearchInput({ value, onCommit, placeholder, label, delayMs = 300 }: { value: string; onCommit: (value: string) => void; placeholder: string; label: string; delayMs?: number }) {
  const [draft, setDraft] = useState(value)
  // Follow external changes (e.g. "Clear filters") by adjusting state during render rather than in an effect.
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) { setSyncedValue(value); setDraft(value) }
  useEffect(() => {
    if (draft.trim() === value) return
    const timer = window.setTimeout(() => onCommit(draft.trim()), delayMs)
    return () => window.clearTimeout(timer)
  }, [draft, value, delayMs, onCommit])
  return <label className="workspace-search"><Search size={17} aria-hidden="true" /><Input className="workspace-search-input" type="search" aria-label={label} value={draft} onChange={event => setDraft(event.target.value)} placeholder={placeholder} /></label>
}
