import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError, apiRequest, UNAUTHENTICATED_EVENT } from '@/lib/api-client'
import { describeApiError, safeNextPath } from '@/lib/api-errors'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

const respond = (status: number, body?: unknown) => { globalThis.fetch = (async () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch }

describe('api client', () => {
  it('sends the cookie, a JSON body and the right method, to the backend address', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    globalThis.fetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ ok: true }), { status: 200 }) }) as typeof fetch
    await apiRequest('/admin/banners', { method: 'POST', body: { titleEn: 'Hi' } })
    assert.equal(seen?.url, 'http://localhost:4000/admin/banners')
    assert.equal(seen?.init.credentials, 'include')
    assert.equal(seen?.init.method, 'POST')
    assert.equal(seen?.init.body, JSON.stringify({ titleEn: 'Hi' }))
    assert.deepEqual(seen?.init.headers, { 'Content-Type': 'application/json' })
  })
  it('returns the parsed body, and nothing for 204', async () => {
    respond(200, { banners: [] })
    assert.deepEqual(await apiRequest('/x'), { banners: [] })
    respond(204)
    assert.equal(await apiRequest('/x', { method: 'POST' }), undefined)
  })
  it('turns an error body into an ApiError with the stable code, status and details', async () => {
    respond(400, { error: { code: 'VALIDATION_ERROR', message: 'The request is not valid.', details: [{ field: 'titleEn', message: 'Enter a headline.' }] } })
    await assert.rejects(apiRequest('/x'), (error: unknown) => error instanceof ApiError && error.status === 400 && error.code === 'VALIDATION_ERROR' && Array.isArray(error.details))
  })
  it('reports an unreachable server as NETWORK_ERROR, and a non-JSON failure as UNKNOWN_ERROR', async () => {
    globalThis.fetch = (async () => { throw new TypeError('fetch failed') }) as typeof fetch
    await assert.rejects(apiRequest('/x'), (error: unknown) => error instanceof ApiError && error.code === 'NETWORK_ERROR' && error.status === 0)
    globalThis.fetch = (async () => new Response('<html>Bad gateway</html>', { status: 502 })) as typeof fetch
    await assert.rejects(apiRequest('/x'), (error: unknown) => error instanceof ApiError && error.code === 'UNKNOWN_ERROR' && error.status === 502)
  })
  it('announces an ended session so the app can go back to the login page', async () => {
    const events: string[] = []
    Object.assign(globalThis.window, { dispatchEvent: (event: Event) => { events.push(event.type); return true } })
    respond(401, { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } })
    await assert.rejects(apiRequest('/admin/banners'))
    assert.deepEqual(events, [UNAUTHENTICATED_EVENT])
    delete (globalThis.window as unknown as Record<string, unknown>).dispatchEvent
  })
})

describe('error messages', () => {
  it('gives a plain sentence for each known code and never shows server internals', () => {
    assert.match(describeApiError(new ApiError(401, 'INVALID_CREDENTIALS', 'x')), /email or password/)
    assert.match(describeApiError(new ApiError(429, 'ACCOUNT_LOCKED', 'x')), /15 minutes/)
    assert.match(describeApiError(new ApiError(0, 'NETWORK_ERROR', 'x')), /Cannot reach the server/)
    assert.match(describeApiError(new ApiError(500, 'INTERNAL_ERROR', 'SELECT * FROM secrets')), /Something went wrong/)
    assert.doesNotMatch(describeApiError(new ApiError(500, 'INTERNAL_ERROR', 'SELECT * FROM secrets')), /SELECT/)
    assert.match(describeApiError(new Error('boom')), /Something went wrong/)
  })
  it('shows the first field problem for a validation error', () => {
    assert.equal(describeApiError(new ApiError(400, 'VALIDATION_ERROR', 'x', [{ field: 'titleEn', message: 'Enter a headline.' }])), 'Enter a headline.')
  })
})

describe('where to go after signing in', () => {
  it('only goes to a path on this site', () => {
    assert.equal(safeNextPath('/content/banners'), '/content/banners')
    assert.equal(safeNextPath('/orders?status=draft'), '/orders?status=draft')
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', null, undefined, '/login', '/login?next=/x']) assert.equal(safeNextPath(bad as string | null | undefined), '/')
  })
})
