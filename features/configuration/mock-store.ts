import { configurationRepository } from './mock-repository'
import type { CutoffRule, DeliverySlot, FulfilmentProfile, ServiceArea, SubscriptionRule, TrialPlan } from './types'

type SaveValues<T extends { id: string; updatedAt: string }> = Omit<T, 'id' | 'updatedAt'> & Partial<Pick<T, 'id'>>

export const trialPlanService = {
  list: () => configurationRepository.list<TrialPlan>('trial-plans'),
  getById: (id: string) => configurationRepository.get<TrialPlan>('trial-plans', id),
  save: (values: SaveValues<TrialPlan>) => configurationRepository.save<TrialPlan>('trial-plans', values),
  setStatus: (id: string, status: 'active' | 'inactive') => configurationRepository.setStatus('trial-plans', id, status),
}
export const subscriptionRuleService = {
  list: () => configurationRepository.list<SubscriptionRule>('subscription-rules'),
  getById: (id: string) => configurationRepository.get<SubscriptionRule>('subscription-rules', id),
  save: (values: SaveValues<SubscriptionRule>) => configurationRepository.save<SubscriptionRule>('subscription-rules', values),
  setStatus: (id: string, status: 'active' | 'inactive') => configurationRepository.setStatus('subscription-rules', id, status),
}
export const deliverySlotService = {
  list: () => configurationRepository.list<DeliverySlot>('delivery-slots'),
  getById: (id: string) => configurationRepository.get<DeliverySlot>('delivery-slots', id),
  save: (values: SaveValues<DeliverySlot>) => configurationRepository.save<DeliverySlot>('delivery-slots', values),
  setStatus: (id: string, status: 'active' | 'inactive') => configurationRepository.setStatus('delivery-slots', id, status),
}
export const serviceAreaService = {
  list: () => configurationRepository.list<ServiceArea>('service-areas'),
  getById: (id: string) => configurationRepository.get<ServiceArea>('service-areas', id),
  save: (values: SaveValues<ServiceArea>) => configurationRepository.save<ServiceArea>('service-areas', values),
  setStatus: (id: string, status: 'active' | 'inactive') => configurationRepository.setStatus('service-areas', id, status),
}
export const cutoffRuleService = {
  list: () => configurationRepository.list<CutoffRule>('cutoff-rules'),
  getById: (id: string) => configurationRepository.get<CutoffRule>('cutoff-rules', id),
  save: (values: SaveValues<CutoffRule>) => configurationRepository.save<CutoffRule>('cutoff-rules', values),
  setStatus: (id: string, status: 'active' | 'inactive') => configurationRepository.setStatus('cutoff-rules', id, status),
}
export const fulfilmentProfileService = {
  list: () => configurationRepository.list<FulfilmentProfile>('fulfilment-profiles'),
  getById: (id: string) => configurationRepository.get<FulfilmentProfile>('fulfilment-profiles', id),
  save: (values: SaveValues<FulfilmentProfile>) => {
    const area = serviceAreaService.getById(values.serviceAreaId)
    if (!area || area.status !== 'active') throw new Error('Select an active service area before saving.')
    if (values.deliveryMethod === 'local_delivery' && area.coverageType !== 'pin_code') throw new Error('Local delivery requires a PIN-code service area.')
    if (values.deliveryMethod === 'shipping' && area.coverageType === 'pin_code') throw new Error('Shipping requires State or Pan India coverage.')
    if (values.deliveryMethod === 'shipping' && (values.cutoffRuleId || values.includeInProductionPlanning)) throw new Error('Shipping profiles cannot use a cut-off rule or production planning.')
    return configurationRepository.save<FulfilmentProfile>('fulfilment-profiles', values)
  },
  setStatus: (id: string, status: 'active' | 'inactive') => configurationRepository.setStatus('fulfilment-profiles', id, status),
}

export const configurationService = {
  dependencies: configurationRepository.dependencies,
  derivedCounts: configurationRepository.derivedCounts,
  referenceData: configurationRepository.referenceData,
  setProductReferences: configurationRepository.setProductReferences,
}
