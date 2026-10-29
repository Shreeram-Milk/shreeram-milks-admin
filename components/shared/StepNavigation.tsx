'use client'

import { Button } from '@/components/ui/button'
import { tc } from '@/lib/i18n/common'

export type Step<Id extends string = string> = { id: Id; label: string; description: string }

/** Step tiles for multi-step admin forms: one step is shown at a time. Unframed, so the tiles sit directly above the form section they control. */
export function StepNavigation<Id extends string>({ title, steps, active, onChange }: { title: string; steps: Step<Id>[]; active: Id; onChange: (step: Id) => void }) {
  const activeIndex = steps.findIndex(step => step.id === active)
  return <nav className="product-step-card" aria-label={tc('steps', { title })}>
    <div className="product-step-grid">{steps.map((step, index) => <Button key={step.id} type="button" onClick={() => onChange(step.id)} aria-current={active === step.id ? 'step' : undefined} className={`product-step-tile ${active === step.id ? 'active' : index < activeIndex ? 'completed' : ''}`}><span>{index + 1}</span><strong>{step.label}</strong></Button>)}</div>
  </nav>
}
