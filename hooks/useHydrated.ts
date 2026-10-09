'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * False during server rendering and the first client render, true afterwards.
 * Lets screens that read browser storage wait for the client without a setState-in-effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
