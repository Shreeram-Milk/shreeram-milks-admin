import { apiRequest } from '@/lib/api-client'

export type RecordStatus = 'active' | 'inactive'
export type SubscriptionType = 'daily' | 'alternate_days' | 'custom_weekdays'
export type CoverageType = 'pin_code' | 'state' | 'pan_india'
export type DeliveryMethod = 'local_delivery' | 'shipping'
export type DayRelation = 'same_day' | 'previous_day'
export type FeatureKey = 'trial-plans' | 'subscription-rules' | 'delivery-slots' | 'service-areas' | 'cutoff-rules'

export type BaseRecord = { id: string; name: string; description: string; status: RecordStatus; updatedAt: string }
export type TrialPlan = BaseRecord & { durationDays: number }
/** `lengthOptions`: how many deliveries a customer may choose (for example 15 or 30). */
/** `minDays`/`maxDays`: the shortest and longest plan, in days from the first to the last delivery day. */
export type SubscriptionRule = BaseRecord & { systemType: SubscriptionType; lengthOptions: number[]; minDays: number; maxDays: number }
export type DeliverySlot = BaseRecord & { startTime: string; endTime: string }
export type ServiceArea = BaseRecord & { coverageType: CoverageType; state: string; city: string; pinCount: number; slotIds: string[] }
/** `cancelDayRelation`/`cancelTime`: until when customers may cancel or skip; null means the same as the cut-off. */
export type CutoffCondition = { deliverySlotId: string; dayRelation: DayRelation; cutoffTime: string; cancelDayRelation?: DayRelation | null; cancelTime?: string | null }
export type CutoffRule = BaseRecord & { conditions: CutoffCondition[] }
export type FeatureRecord = TrialPlan | SubscriptionRule | DeliverySlot | ServiceArea | CutoffRule
export type Pin = { id: string; pinCode: string; locality: string; status: RecordStatus; allowedDeliverySlotIds: string[] }
/** One thing that uses a record, as the server reports it when switching off is refused. */
export type Usage = { label: string; count: number; examples: string[] }

export type ListParams = { search: string; status: RecordStatus | ''; page: number; pageSize: number; deliveryMethod?: DeliveryMethod | '' }
export type ListResult<T> = { rows: T[]; total: number }

/** The calls every master-data list shares. The backend validates everything again; these never decide what is allowed. */
export function recordApi<T extends BaseRecord>(path: string, key: string) {
  return {
    list: ({ search, status, page, pageSize, deliveryMethod }: ListParams) => {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) query.set('search', search)
      if (status) query.set('status', status)
      if (deliveryMethod) query.set('deliveryMethod', deliveryMethod)
      return apiRequest<ListResult<T>>(`${path}?${query}`)
    },
    /** Every record, for pick-lists. There are only a handful of each kind. */
    all: () => apiRequest<{ rows: T[] }>(`${path}/all`).then(response => response.rows),
    get: (id: string) => apiRequest<Record<string, T>>(`${path}/${id}`).then(response => response[key] as T),
    create: (input: object) => apiRequest<Record<string, T>>(path, { method: 'POST', body: input }).then(response => response[key] as T),
    update: (id: string, input: object) => apiRequest<Record<string, T>>(`${path}/${id}`, { method: 'PUT', body: input }).then(response => response[key] as T),
    /** Switching off something that is in use is refused (code IN_USE) until `confirmInUse` is true. */
    setStatus: (id: string, status: RecordStatus, confirmInUse = false) => apiRequest<Record<string, T>>(`${path}/${id}/status`, { method: 'PATCH', body: { status, confirmInUse } }).then(response => response[key] as T),
    /** Deletes a record nothing uses. A record that is in use is refused (code IN_USE) and can only be switched off. */
    remove: (id: string) => apiRequest(`${path}/${id}`, { method: 'DELETE' }),
  }
}

export const configApi = {
  'trial-plans': recordApi<TrialPlan>('/admin/trial-plans', 'trialPlan'),
  'subscription-rules': recordApi<SubscriptionRule>('/admin/subscription-rules', 'subscriptionRule'),
  'delivery-slots': recordApi<DeliverySlot>('/admin/delivery-slots', 'slot'),
  'service-areas': recordApi<ServiceArea>('/admin/service-areas', 'area'),
  'cutoff-rules': recordApi<CutoffRule>('/admin/cutoff-rules', 'rule'),
} satisfies Record<FeatureKey, ReturnType<typeof recordApi>>

export type PinListParams = { search: string; status: RecordStatus | ''; slotId: string; page: number; pageSize: number }
export type PinPayload = { pinCode: string; locality: string; allowedDeliverySlotIds: string[]; status: RecordStatus }
export type BulkPinPayload = { pinCodes: string[]; locality: string; /** Own locality for particular PINs; the others use `locality`. */ localities?: Record<string, string>; allowedDeliverySlotIds: string[]; status: RecordStatus }

export const pinApi = {
  list: (areaId: string, { search, status, slotId, page, pageSize }: PinListParams) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    if (slotId) query.set('slotId', slotId)
    return apiRequest<ListResult<Pin>>(`/admin/service-areas/${areaId}/pins?${query}`)
  },
  create: (areaId: string, input: PinPayload) => apiRequest<{ pin: Pin }>(`/admin/service-areas/${areaId}/pins`, { method: 'POST', body: input }).then(response => response.pin),
  update: (areaId: string, pinId: string, input: PinPayload) => apiRequest<{ pin: Pin }>(`/admin/service-areas/${areaId}/pins/${pinId}`, { method: 'PUT', body: input }).then(response => response.pin),
  /** "Paste many": PIN codes the area already has are skipped, not changed. */
  addMany: (areaId: string, input: BulkPinPayload) => apiRequest<{ added: string[]; skipped: string[] }>(`/admin/service-areas/${areaId}/pins/bulk`, { method: 'POST', body: input }),
}

export type DirectoryPin = { pinCode: string; offices: string[] }

/** The national PIN list, used only to help pick PIN codes. It never decides where you deliver. */
export const directoryApi = {
  states: () => apiRequest<{ states: string[] }>('/admin/pin-directory/states').then(response => response.states),
  districts: (state: string) => apiRequest<{ districts: string[] }>(`/admin/pin-directory/districts?${new URLSearchParams({ state })}`).then(response => response.districts),
  pins: (state: string, district: string) => apiRequest<{ pins: DirectoryPin[] }>(`/admin/pin-directory/pins?${new URLSearchParams({ state, district })}`).then(response => response.pins),
}
