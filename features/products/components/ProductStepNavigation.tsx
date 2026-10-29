'use client'

import { StepNavigation, type Step } from '@/components/shared/StepNavigation'
import { t } from '../messages'

export type ProductStepId = 'basics' | 'content' | 'variants' | 'selling' | 'delivery'
export type ProductStep = Step<ProductStepId>

export function ProductStepNavigation({ steps, active, onChange }: { steps: ProductStep[]; active: ProductStepId; onChange: (step: ProductStepId) => void }) {
  return <StepNavigation title={t('productSteps')} steps={steps} active={active} onChange={onChange} />
}
