'use client'

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type ControlProps = { id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }

/** Labelled login input with a leading icon. Wires the id, invalid state and error description onto the control. */
export function LoginField({ label, icon: Icon, error, action, children }: { label: string; icon: LucideIcon; error?: string; action?: ReactNode; children: ReactElement<ControlProps> }) {
  const id = useId()
  const errorId = `${id}-error`
  const control = isValidElement(children) ? cloneElement(children, { id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? errorId : undefined }) : children
  return <div className="login-field">
    <div className="login-field-label"><label htmlFor={id}>{label}</label>{action}</div>
    <div className="login-field-control"><Icon className="login-field-icon" size={18} strokeWidth={1.8} aria-hidden="true" />{control}</div>
    {error && <small id={errorId} className="login-field-error">{error}</small>}
  </div>
}
