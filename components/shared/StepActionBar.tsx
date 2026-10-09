'use client'

import { Button } from '@/components/ui/button'

type StepActionBarProps = {
  stepIndex: number
  stepCount: number
  onCancel: () => void
  onBack: () => void
  onContinue: () => void
  /** Rendered on the last step (and always while editing). */
  submitActions: React.ReactNode
  showSubmit: boolean
}

/** Sticky Back / Continue / save bar shared by the multi-step forms. */
export function StepActionBar({ stepIndex, stepCount, onCancel, onBack, onContinue, submitActions, showSubmit }: StepActionBarProps) {
  const isLast = stepIndex === stepCount - 1
  return <div className="product-save-bar">
    <div className="product-step-actions">
      {stepIndex === 0 ? <Button type="button" variant="outline" className="secondary-button" onClick={onCancel}>Cancel</Button> : <Button type="button" variant="outline" className="secondary-button" onClick={onBack}>Back</Button>}
      <span>Step {stepIndex + 1} of {stepCount}</span>
    </div>
    <div className="product-step-actions">
      {!isLast && <Button type="button" className="primary-button" onClick={onContinue}>Continue</Button>}
      {showSubmit && submitActions}
    </div>
  </div>
}
