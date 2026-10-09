import type { ReactNode } from 'react'

/** Numbered card used by multi-step forms (subscriptions, orders, trials). */
export function FormSection({ id, number, title, description, children }: { id?: string; number: string; title: string; description: string; children: ReactNode }) {
  return <section id={id} className="form-card" aria-labelledby={id ? `${id}-title` : undefined}>
    <div className="form-section-header"><div className="form-section-heading"><span>{number}</span><div><h2 id={id ? `${id}-title` : undefined}>{title}</h2><p>{description}</p></div></div></div>
    {children}
  </section>
}
