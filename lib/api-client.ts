/**
 * The one place the admin talks to the backend. Every feature calls the API through `apiRequest`, never `fetch`
 * directly, so the address, cookies and error handling stay in one spot.
 */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) { super(message) }
}

/** Fired when the backend says the session has ended, so the app can send the admin back to the login page. */
export const UNAUTHENTICATED_EVENT = 'admin:unauthenticated'

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type RequestOptions = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown }
type ErrorBody = { error?: { code?: unknown; message?: unknown; details?: unknown } }

export async function apiRequest<Response = void>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<Response> {
  let response: globalThis.Response
  try {
    // `include` sends and accepts the sign-in cookie, which the browser keeps out of reach of page scripts.
    response = await fetch(`${BASE_URL}${path}`, { method, credentials: 'include', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'The server could not be reached.')
  }
  if (response.status === 204) return undefined as Response
  const payload = (await response.json().catch(() => null)) as (ErrorBody & Record<string, unknown>) | null
  if (!response.ok) {
    const error = payload?.error
    const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN_ERROR'
    if (code === 'UNAUTHENTICATED' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT))
    throw new ApiError(response.status, code, typeof error?.message === 'string' ? error.message : 'The request failed.', error?.details)
  }
  return payload as Response
}
