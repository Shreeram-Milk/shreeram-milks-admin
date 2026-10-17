'use client'

import { useEffect, useRef, useState } from 'react'
import { describeApiError } from '@/lib/api-errors'

export type Loaded<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/**
 * Runs `load` when `key` changes (or `reload` is called) and reports loading, error or the data.
 * An answer that arrives after a newer request, or after the screen closed, is ignored.
 */
export function useLoaded<T>(load: () => Promise<T>, key: string): { state: Loaded<T>; reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  // `load` is a new function on every render; the latest one is kept here so only `key` and `reloadKey` trigger a fetch.
  const latest = useRef(load)
  useEffect(() => { latest.current = load })
  useEffect(() => {
    let cancelled = false
    latest.current().then(
      data => { if (!cancelled) setState({ status: 'ready', data }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [key, reloadKey])
  return { state, reload: () => { setState({ status: 'loading' }); setReloadKey(count => count + 1) } }
}
