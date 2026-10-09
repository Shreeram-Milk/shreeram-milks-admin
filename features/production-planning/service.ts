import type { IsoDate } from '@/lib/business-time'
import { cutoffRuleService, deliverySlotService, fulfilmentProfileService } from '../configuration/mock-store'
import type { DeliverySlot } from '../configuration/types'
import { deliveryService } from '../deliveries/service'
import { productService } from '../products/service'
import { describeCutoff } from './cutoff'
import { buildProductionPlan } from './plan'
import type { ProductionPlan, SlotCutoffStatus } from './types'

export type ProductionPlanResult = { plan: ProductionPlan; cutoffs: SlotCutoffStatus[]; slots: DeliverySlot[] }

/**
 * Read-only: derives preparation quantities from DeliveryInstance records.
 * It never changes delivery state, and reads only the selected date.
 */
export const productionPlanningService = {
  getPlanForDate({ date, slotId, now = new Date() }: { date: IsoDate; slotId: string; now?: Date }): ProductionPlanResult {
    const slots = deliverySlotService.list()
    const profiles = fulfilmentProfileService.list()
    const deliveries = deliveryService.listForDate(date, slotId || undefined)
    const plan = buildProductionPlan({ deliveries, products: productService.list(), profiles, slots, date, slotId })

    // Cut-off context comes from the fulfilment profiles actually behind the demand (or all tracked profiles if there is none).
    const usedProfileIds = new Set(deliveries.map(delivery => delivery.fulfilmentProfileId))
    const trackedProfiles = profiles.filter(profile => profile.includeInProductionPlanning && profile.cutoffRuleId && (usedProfileIds.size === 0 || usedProfileIds.has(profile.id)))
    const slotsInScope = slotId ? slots.filter(slot => slot.id === slotId) : slots.filter(slot => slot.status === 'active' || plan.slots.some(row => row.slotId === slot.id))
    const rules = new Map(cutoffRuleService.list().map(rule => [rule.id, rule]))
    const cutoffs: SlotCutoffStatus[] = []
    const seen = new Set<string>()
    for (const profile of trackedProfiles) {
      const rule = rules.get(profile.cutoffRuleId)
      if (!rule) continue
      for (const slot of slotsInScope) {
        const condition = rule.conditions.find(item => item.deliverySlotId === slot.id)
        const key = `${slot.id}|${rule.id}`
        if (!condition || seen.has(key)) continue
        seen.add(key)
        const described = describeCutoff({ deliveryDate: date, dayRelation: condition.dayRelation, cutoffTime: condition.cutoffTime, now })
        cutoffs.push({ slotId: slot.id, slotName: slot.name, ruleName: rule.name, state: described.state, label: described.label })
      }
    }
    return { plan, cutoffs, slots }
  },
}
