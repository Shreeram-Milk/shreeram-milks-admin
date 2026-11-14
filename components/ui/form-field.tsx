'use client'

import { cloneElement, isValidElement, Children, useId, type ReactElement, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/** `tour` marks the field for the spoken page guide (data-tour), so the guide can light it up. */
export function FormField({ label, children, className = '', required = false, helper, error, tour }: { label: string; children: ReactNode; className?: string; required?: boolean; helper?: string; error?: string; tour?: string }) {
  const id = useId()
  const child = Children.only(children)
  const control = isValidElement(child) ? cloneElement(child as ReactElement<{ id?: string }>, { id }) : child
  return <div className={className} data-tour={tour}><Label htmlFor={id} className="product-form-label">{label}{required && <span> *</span>}</Label>{control}{helper && <small className="help-text">{helper}</small>}{error && <small className="field-error">{error}</small>}</div>
}
