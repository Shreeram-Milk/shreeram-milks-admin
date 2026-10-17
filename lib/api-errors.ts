import { ApiError } from './api-client'

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'The email or password is not correct.',
  INVALID_CODE: 'That code is not correct or has expired. Sign in again to get a new one.',
  ACCOUNT_LOCKED: 'Too many wrong attempts. Please wait 15 minutes and try again.',
  EMAIL_FAILED: 'We could not email the login code. Please try again in a moment.',
  RATE_LIMITED: 'Too many attempts. Please wait a few minutes and try again.',
  UNAUTHENTICATED: 'Your session has ended. Please sign in again.',
  NETWORK_ERROR: 'Cannot reach the server. Check that the backend is running and try again.',
  ORIGIN_NOT_ALLOWED: 'The server does not allow this site. Add its address to the backend’s allowed origins.',
  BANNER_NOT_FOUND: 'That banner no longer exists. Refresh the list.',
  UPLOAD_FAILED: 'The picture could not be sent to storage. Storage may not allow this site yet, or the access keys are wrong.',
  STORAGE_NOT_CONFIGURED: 'File storage is not set up on the server. Restart the backend after adding the storage settings.',
  UPLOAD_NOT_FOUND: 'The picture did not arrive in storage. Please upload it again.',
  UPLOAD_MISMATCH: 'The uploaded picture is not what was expected. Please upload it again.',
  MEDIA_NOT_FOUND: 'That picture no longer exists. Please upload it again.',
  PAYLOAD_TOO_LARGE: 'That is too much text to send at once.',
}

type FieldIssue = { field?: unknown; message?: unknown }

/** Turns any failure into one plain sentence for a toast or an inline message. Never shows server internals. */
export function describeApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.'
  if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    const first = error.details[0] as FieldIssue | undefined
    if (first && typeof first.message === 'string') return first.message
  }
  // A conflict (409) carries a plain, safe sentence written for staff, such as "This question already exists".
  if (error.status === 409 && error.message) return error.message
  return MESSAGES[error.code] ?? 'Something went wrong. Please try again.'
}

/** After sign-in, only go to a path on this site. Anything else (another site, `//evil.com`) falls back to the dashboard. */
export function safeNextPath(next: string | null | undefined): string {
  return next && /^\/(?!\/)[^\s\\]*$/.test(next) && !next.startsWith('/login') ? next : '/'
}
