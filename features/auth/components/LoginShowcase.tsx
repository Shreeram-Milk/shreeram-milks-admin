import Image from 'next/image'
import { CalendarClock, Factory, Truck, Users } from 'lucide-react'

const capabilities = [
  { icon: Truck, title: 'Deliveries', text: 'Routes, slots and cutoffs for every PIN.' },
  { icon: CalendarClock, title: 'Subscriptions', text: 'Pauses, skips and renewals in one view.' },
  { icon: Factory, title: 'Production', text: 'Know tomorrow’s quantities tonight.' },
  { icon: Users, title: 'Customers', text: 'Orders, credit and support together.' },
]

/** Decorative brand panel beside the sign-in form. Hidden from assistive tech and on narrow screens. */
export function LoginShowcase() {
  return <aside className="login-aside" aria-hidden="true">
    <div className="login-aside-glow" />
    <div className="login-aside-brand"><Image src="/icon.svg" alt="" width={36} height={36} unoptimized /><span>ShreeRam Milks</span></div>
    <div className="login-aside-copy">
      <span className="login-eyebrow"><span className="login-eyebrow-dot" />Admin console</span>
      <h2>Fresh milk, delivered on time. <em>Every single morning.</em></h2>
      <p>One workspace for deliveries, subscriptions, production and customers.</p>
    </div>
    <ul className="login-capabilities">
      {capabilities.map(({ icon: Icon, title, text }) => <li key={title}>
        <span className="login-capability-icon"><Icon size={18} strokeWidth={1.8} /></span>
        <div><strong>{title}</strong><span>{text}</span></div>
      </li>)}
    </ul>
  </aside>
}
