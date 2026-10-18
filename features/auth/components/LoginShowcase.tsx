import Image from 'next/image'
import { ShoppingBag, Truck, Users } from 'lucide-react'

const capabilities = [
  { icon: ShoppingBag, title: 'Orders', text: 'From a new order to the next delivery.' },
  { icon: Truck, title: 'Deliveries', text: 'Keep delivery schedules and slots in sync.' },
  { icon: Users, title: 'Customers', text: 'A little more care, in every interaction.' },
]

/** Brand introduction beside the sign-in form; omitted on narrow screens. */
export function LoginShowcase() {
  return <aside className="login-aside" aria-label="ShreeRam Milks workspace">
    <div className="login-aside-brand"><Image src="/icon.svg" alt="" width={44} height={44} unoptimized /><div><span>ShreeRam Milks</span><small>Admin workspace</small></div></div>
    <div className="login-aside-content">
      <div className="login-aside-copy">
        <span className="login-eyebrow">THE BUSINESS BEHIND EVERY MORNING</span>
        <h2>Everyday operations.<br /><em>Under control.</em></h2>
        <p>A clearer view of your business. One workspace for the people, plans and deliveries that keep it moving.</p>
      </div>
      <ul className="login-capabilities">
        {capabilities.map(({ icon: Icon, title, text }) => <li key={title}>
          <span className="login-capability-icon"><Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span>
          <div><strong>{title}</strong><span>{text}</span></div>
        </li>)}
      </ul>
    </div>
    <p className="login-aside-footer"><span />Fresh starts. Every day.</p>
  </aside>
}
