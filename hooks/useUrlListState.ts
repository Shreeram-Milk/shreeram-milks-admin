'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

/** `'free'` accepts any string (e.g. an id); an array restricts the param to those values. */
export type ListFilterSpec = Record<string, readonly string[] | 'free'>

const SEARCH_MAX_LENGTH = 100

/**
 * List screen state (search, filters, page) kept in the URL so views are shareable.
 * Unknown or invalid values fall back to their defaults instead of being trusted.
 */
export function useUrlListState<Spec extends ListFilterSpec>(spec: Spec) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const search = (params.get('search') ?? '').slice(0, SEARCH_MAX_LENGTH)
  const parsedPage = Number.parseInt(params.get('page') ?? '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const paramsKey = params.toString()
  const filters = useMemo(() => {
    const result = {} as { [K in keyof Spec]: string }
    for (const key of Object.keys(spec) as Array<keyof Spec & string>) {
      const raw = params.get(key) ?? ''
      const allowed = spec[key]
      result[key] = allowed === 'free' || allowed.includes(raw) ? raw : ''
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `spec` is a module-level constant; paramsKey tracks URL changes
  }, [paramsKey])

  const update = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(paramsKey)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || (key === 'page' && value === 1)) next.delete(key)
      else next.set(key, String(value))
    }
    if (!('page' in changes)) next.delete('page')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [paramsKey, pathname, router])

  const clear = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router])
  const hasActiveFilters = Boolean(search) || Object.values(filters).some(Boolean)

  return { search, page, filters, update, clear, hasActiveFilters }
}
