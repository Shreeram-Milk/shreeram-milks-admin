import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { deliveryPlacesApi } from './api'
import { customerRecordApi } from '../customers/api'
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
describe('delivery place API boundaries', () => {
  it('sends bounded reviewed lookups with PIN and kind, through the authenticated API client', async () => {
    globalThis.fetch = async (url, init) => {
      const parsed = new URL(String(url))
      assert.equal(parsed.pathname, '/admin/delivery-places')
      assert.equal(parsed.searchParams.get('pinCode'), '382007')
      assert.equal(parsed.searchParams.get('kind'), 'society')
      assert.equal(parsed.searchParams.get('status'), 'approved')
      assert.equal(parsed.searchParams.get('pageSize'), '20')
      assert.equal(init?.credentials, 'include')
      return new Response(JSON.stringify({ rows: [], total: 0 }), { status: 200 })
    }
    await deliveryPlacesApi.list({ pinCode: '382007', kind: 'society', status: 'approved', search: 'Aster', page: 1, pageSize: 20 })
  })
  it('merges an explicitly selected identity; never silently edits addresses in this request', async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(new URL(String(url)).pathname, '/admin/delivery-places/source/merge')
      assert.equal(init?.method, 'POST')
      assert.deepEqual(JSON.parse(String(init?.body)), { targetId: 'target' })
      return new Response('{}', { status: 200 })
    }
    await deliveryPlacesApi.merge('source', 'target')
  })
  it('address grouping sends only the selected identity and can clear it explicitly', async () => {
    const sent: unknown[] = []
    globalThis.fetch = async (url, init) => {
      assert.equal(new URL(String(url)).pathname, '/admin/customers/customer/addresses/address/delivery-place')
      assert.equal(init?.method, 'PATCH')
      sent.push(JSON.parse(String(init?.body)))
      return new Response('{}', { status: 200 })
    }
    await customerRecordApi.assignDeliveryPlace('customer', 'address', 'place')
    await customerRecordApi.assignDeliveryPlace('customer', 'address', null)
    assert.deepEqual(sent, [{ deliveryPlaceId: 'place' }, { deliveryPlaceId: null }])
  })
})
