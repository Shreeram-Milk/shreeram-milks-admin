import type { ConfigurationDatabase, FeatureKey, FeatureRecord } from './types'

const STORAGE_KEY = 'shreeram-admin-configuration-v1'
const now = () => new Date().toISOString()
const base = (id: string, name: string, description: string, status: 'active' | 'inactive' = 'active') => ({ id, name, description, status, updatedAt: now() })

export const initialDatabase: ConfigurationDatabase = {
  trialPlans: [
    { ...base('trial-3-day', '3-Day Trial', 'A short introductory trial.'), duration: 3, durationUnit: 'days' },
    { ...base('trial-7-day', '7-Day Trial', 'A full week to experience the service.'), duration: 7, durationUnit: 'days' },
  ],
  subscriptionRules: [
    { ...base('rule-daily', 'Daily', 'Delivery every day.'), systemType: 'daily' },
    { ...base('rule-alternate', 'Alternate Days', 'Delivery on alternating days.'), systemType: 'alternate_days' },
    { ...base('rule-weekdays', 'Custom Weekdays', 'Customers choose their delivery weekdays.'), systemType: 'custom_weekdays' },
  ],
  deliverySlots: [
    { ...base('slot-morning', 'Morning', 'Early-day delivery window.'), startTime: '06:00', endTime: '09:00' },
    { ...base('slot-evening', 'Evening', 'Evening delivery window.'), startTime: '17:00', endTime: '20:00' },
  ],
  serviceAreas: [
    { ...base('area-gandhinagar', 'Gandhinagar Local Delivery', 'Local delivery around Gandhinagar.'), coverageType: 'pin_code', state: 'Gujarat', city: 'Gandhinagar', pinCodes: [
      { id: 'pin-382010', pinCode: '382010', locality: 'Sector 10', allowedDeliverySlotIds: ['slot-morning', 'slot-evening'], status: 'active' },
      { id: 'pin-382011', pinCode: '382011', locality: 'Sector 11', allowedDeliverySlotIds: ['slot-morning'], status: 'active' },
      { id: 'pin-382012', pinCode: '382012', locality: 'Sector 12', allowedDeliverySlotIds: ['slot-evening'], status: 'active' },
    ] },
    { ...base('area-pan-india', 'Pan India', 'Nationwide shipping coverage.'), coverageType: 'pan_india', state: '', city: '', pinCodes: [] },
    { ...base('area-gujarat', 'Gujarat', 'State-wide shipping coverage.'), coverageType: 'state', state: 'Gujarat', city: '', pinCodes: [] },
  ],
  cutoffRules: [{ ...base('cutoff-standard-milk', 'Standard Milk Cut-off', 'Ordering deadlines for milk deliveries.'), conditions: [
    { id: 'condition-morning', deliverySlotId: 'slot-morning', dayRelation: 'previous_day', cutoffTime: '15:00' },
    { id: 'condition-evening', deliverySlotId: 'slot-evening', dayRelation: 'same_day', cutoffTime: '11:00' },
  ] }],
  fulfilmentProfiles: [
    { ...base('profile-gandhinagar', 'Gandhinagar Milk Standard', 'Local milk fulfilment settings.'), deliveryMethod: 'local_delivery', serviceAreaId: 'area-gandhinagar', cutoffRuleId: 'cutoff-standard-milk', includeInProductionPlanning: true },
    { ...base('profile-shipping', 'Pan India Shipping', 'Nationwide shipping settings.'), deliveryMethod: 'shipping', serviceAreaId: 'area-pan-india', cutoffRuleId: '', includeInProductionPlanning: false },
  ],
  productReferences: { trialPlanIds: ['trial-3-day', 'trial-3-day', 'trial-7-day', 'trial-7-day'], subscriptionRuleIds: ['rule-daily', 'rule-daily', 'rule-alternate', 'rule-alternate', 'rule-weekdays', 'rule-weekdays'], fulfilmentProfileIds: ['profile-gandhinagar', 'profile-gandhinagar', 'profile-gandhinagar', 'profile-shipping'] },
}

const readDatabase = (): ConfigurationDatabase => {
  if (typeof window === 'undefined') return initialDatabase
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDatabase)); return initialDatabase }
    return JSON.parse(raw) as ConfigurationDatabase
  } catch { return initialDatabase }
}
const writeDatabase = (db: ConfigurationDatabase) => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db)) }
const listKey: Record<FeatureKey, keyof ConfigurationDatabase> = {
  'trial-plans': 'trialPlans', 'subscription-rules': 'subscriptionRules', 'delivery-slots': 'deliverySlots',
  'service-areas': 'serviceAreas', 'cutoff-rules': 'cutoffRules', 'fulfilment-profiles': 'fulfilmentProfiles',
}
const getRows = <T extends FeatureRecord>(db: ConfigurationDatabase, feature: FeatureKey) => db[listKey[feature]] as T[]
const duplicateName = (rows: FeatureRecord[], name: string, id?: string) => rows.some(row => row.id !== id && row.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())
const makeId = (feature: FeatureKey) => `${feature.replaceAll('-', '')}-${crypto.randomUUID()}`

export const configurationRepository = {
  list<T extends FeatureRecord>(feature: FeatureKey): T[] { return getRows<T>(readDatabase(), feature) },
  get<T extends FeatureRecord>(feature: FeatureKey, id: string): T | undefined { return getRows<T>(readDatabase(), feature).find(row => row.id === id) },
  save<T extends FeatureRecord>(feature: FeatureKey, values: Omit<T, 'id' | 'updatedAt'> & Partial<Pick<T, 'id'>>): T {
    const db = readDatabase()
    const rows = getRows<T>(db, feature)
    const name = values.name.trim()
    if (!name) throw new Error('Name is required.')
    if (duplicateName(rows, name, values.id)) throw new Error(`A ${feature.replaceAll('-', ' ').replace(/s$/, '')} with this name already exists.`)
    const record = { ...values, name, description: values.description.trim(), id: values.id ?? makeId(feature), updatedAt: now() } as T
    const nextRows = values.id ? rows.map(row => row.id === values.id ? record : row) : [...rows, record]
    writeDatabase({ ...db, [listKey[feature]]: nextRows })
    return record
  },
  setStatus(feature: FeatureKey, id: string, status: 'active' | 'inactive') {
    const db = readDatabase()
    const rows = getRows<FeatureRecord>(db, feature)
    const nextRows = rows.map(row => row.id === id ? { ...row, status, updatedAt: now() } : row)
    if (!rows.some(row => row.id === id)) throw new Error('Configuration not found.')
    writeDatabase({ ...db, [listKey[feature]]: nextRows })
  },
  dependencies(feature: FeatureKey, id: string): string[] {
    const db = readDatabase()
    const refCount = (ids: string[]) => ids.filter(value => value === id).length
    if (feature === 'trial-plans') return [`${refCount(db.productReferences.trialPlanIds)} product references`]
    if (feature === 'subscription-rules') return [`${refCount(db.productReferences.subscriptionRuleIds)} product references`]
    if (feature === 'delivery-slots') {
      const serviceAreaCount = db.serviceAreas.filter(area => area.pinCodes.some(pin => pin.allowedDeliverySlotIds.includes(id))).length
      const cutoffCount = db.cutoffRules.filter(rule => rule.conditions.some(condition => condition.deliverySlotId === id)).length
      return [`${serviceAreaCount} service areas`, `${cutoffCount} cut-off rules`]
    }
    if (feature === 'service-areas') return db.fulfilmentProfiles.filter(profile => profile.serviceAreaId === id).map(profile => profile.name)
    if (feature === 'cutoff-rules') return db.fulfilmentProfiles.filter(profile => profile.cutoffRuleId === id).map(profile => profile.name)
    return [`${refCount(db.productReferences.fulfilmentProfileIds)} product references`]
  },
  derivedCounts() {
    const db = readDatabase()
    return {
      trialPlans: new Map(db.trialPlans.map(row => [row.id, db.productReferences.trialPlanIds.filter(id => id === row.id).length])),
      subscriptionRules: new Map(db.subscriptionRules.map(row => [row.id, db.productReferences.subscriptionRuleIds.filter(id => id === row.id).length])),
      fulfilmentProfiles: new Map(db.fulfilmentProfiles.map(row => [row.id, db.productReferences.fulfilmentProfileIds.filter(id => id === row.id).length])),
      deliverySlots: new Map(db.deliverySlots.map(slot => [slot.id, db.serviceAreas.filter(area => area.pinCodes.some(pin => pin.allowedDeliverySlotIds.includes(slot.id))).length])),
    }
  },
  referenceData() { const db = readDatabase(); return { slots: db.deliverySlots, areas: db.serviceAreas, cutoffs: db.cutoffRules } },
  setProductReferences(references: ConfigurationDatabase['productReferences']) {
    const db = readDatabase()
    writeDatabase({ ...db, productReferences: references })
  },
}
