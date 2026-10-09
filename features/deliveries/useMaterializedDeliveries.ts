'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { todayInBusinessZone } from '@/lib/business-time'
import { deliveryService } from './service'

let lastRunDate = ''
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/**
 * Mock stand-in for a scheduled job: once per page load (and again after the business date changes) it
 * idempotently materialises the next 14 days of deliveries and posts any missing credit charges.
 * Returns false until that has run, so screens can show a skeleton instead of stale data.
 */
export function useMaterializedDeliveries(): boolean {
  const today = todayInBusinessZone()
  const ready = useSyncExternalStore(subscribe, () => lastRunDate === today, () => false)
  useEffect(() => {
    if (lastRunDate === today) return
    deliveryService.materializeUpcoming()
    lastRunDate = today
    listeners.forEach(listener => listener())
  }, [today])
  return ready
}
