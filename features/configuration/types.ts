export type RecordStatus = 'active' | 'inactive'
export type SubscriptionType = 'daily' | 'alternate_days' | 'custom_weekdays'
export type CoverageType = 'pin_code' | 'state' | 'pan_india'
export type DeliveryMethod = 'local_delivery' | 'shipping'
export type DayRelation = 'same_day' | 'previous_day'

export interface BaseRecord { id: string; name: string; description: string; status: RecordStatus; updatedAt: string }
export interface TrialPlan extends BaseRecord { duration: number; durationUnit: 'days' }
export interface SubscriptionRule extends BaseRecord { systemType: SubscriptionType }
export interface DeliverySlot extends BaseRecord { startTime: string; endTime: string }
export interface PinCodeRecord { id: string; pinCode: string; locality: string; allowedDeliverySlotIds: string[]; status: RecordStatus }
export interface ServiceArea extends BaseRecord {
  coverageType: CoverageType
  state: string
  city: string
  pinCodes: PinCodeRecord[]
}
export interface CutoffCondition { id: string; deliverySlotId: string; dayRelation: DayRelation; cutoffTime: string }
export interface CutoffRule extends BaseRecord { conditions: CutoffCondition[] }
export interface FulfilmentProfile extends BaseRecord {
  deliveryMethod: DeliveryMethod
  serviceAreaId: string
  cutoffRuleId: string
  includeInProductionPlanning: boolean
}
export interface ProductConfigurationReferences {
  trialPlanIds: string[]
  subscriptionRuleIds: string[]
  fulfilmentProfileIds: string[]
}
export interface ConfigurationDatabase {
  trialPlans: TrialPlan[]
  subscriptionRules: SubscriptionRule[]
  deliverySlots: DeliverySlot[]
  serviceAreas: ServiceArea[]
  cutoffRules: CutoffRule[]
  fulfilmentProfiles: FulfilmentProfile[]
  productReferences: ProductConfigurationReferences
}
export type FeatureKey = 'trial-plans' | 'subscription-rules' | 'delivery-slots' | 'service-areas' | 'cutoff-rules' | 'fulfilment-profiles'
export type FeatureRecord = TrialPlan | SubscriptionRule | DeliverySlot | ServiceArea | CutoffRule | FulfilmentProfile

