import { Check } from 'lucide-react'

type Props = { /** Which step the admin is on now: 1 = area details, 2 = PIN codes. */ current: 1 | 2; /** Step 2 counts as done once the area has at least one PIN code. */ pinsDone?: boolean }

const STEPS = [
  { title: 'Area details', hint: 'Name, kind of coverage and place' },
  { title: 'PIN codes and slots', hint: 'Which PIN codes you deliver to, and in which slots' },
]

/** The progress bar for setting up a PIN-code service area, shown on the form (step 1) and on the area's page (step 2). */
export function AreaSetupSteps({ current, pinsDone = false }: Props) {
  return <ol className="setup-steps" aria-label="Service area setup">
    {STEPS.map((step, index) => {
      const number = index + 1
      const state = number < current || (number === 2 && pinsDone) ? 'done' : number === current ? 'current' : 'upcoming'
      return <li key={step.title} className={`setup-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
        <span className="setup-step-mark">{state === 'done' ? <Check size={15} aria-label="Done" /> : number}</span>
        <div><strong>Step {number} of {STEPS.length} · {step.title}</strong><small>{step.hint}</small></div>
      </li>
    })}
  </ol>
}
