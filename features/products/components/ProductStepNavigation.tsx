'use client'

import { StepNavigation, type Step } from '@/components/shared/StepNavigation'

export type ProductStepId = 'basics' | 'variants' | 'selling' | 'fulfilment' | 'production' | 'review'
export type ProductStep = Step<ProductStepId>

export function ProductStepNavigation({ steps, active, onChange }: { steps: ProductStep[]; active: ProductStepId; onChange: (step: ProductStepId) => void }) {
  return <StepNavigation title="Product Setup Flow" steps={steps} active={active} onChange={onChange} />
}
