'use client'

import { StepNavigation, type Step } from '@/components/shared/StepNavigation'

export type ProductStepId = 'basics' | 'content' | 'variants' | 'selling' | 'delivery'
export type ProductStep = Step<ProductStepId>

export function ProductStepNavigation({ steps, active, onChange }: { steps: ProductStep[]; active: ProductStepId; onChange: (step: ProductStepId) => void }) {
  return <StepNavigation title="Product steps" steps={steps} active={active} onChange={onChange} />
}
