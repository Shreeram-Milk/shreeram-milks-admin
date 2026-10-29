import { ApiError } from './api-client'
import { commonMessages, tc } from './i18n/common'

type FieldIssue = { field?: unknown; message?: unknown }
type ErrorCode = keyof typeof commonMessages.en
const isKnownCode = (code: string): code is ErrorCode => /^[A-Z_]+$/.test(code) && code in commonMessages.en

/**
 * Turns any failure into one plain sentence for a toast or an inline message, in the admin's language. Never shows server
 * internals. Sentences the server writes itself (a field problem, a 409 conflict) come in English, the server's language.
 */
export function describeApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return tc('somethingWrong')
  if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    const first = error.details[0] as FieldIssue | undefined
    if (first && typeof first.message === 'string') return first.message
  }
  // A picture problem is found in the browser, so its sentence is already in the admin's language.
  if (error.code === 'INVALID_IMAGE' && error.message) return error.message
  if (isKnownCode(error.code)) return tc(error.code)
  // A conflict (409) carries a plain, safe sentence written for staff, such as "This question already exists".
  if (error.status === 409 && error.message) return error.message
  return tc('somethingWrong')
}

/** After sign-in, only go to a path on this site. Anything else (another site, `//evil.com`) falls back to the dashboard. */
export function safeNextPath(next: string | null | undefined): string {
  return next && /^\/(?!\/)[^\s\\]*$/.test(next) && !next.startsWith('/login') ? next : '/'
}
