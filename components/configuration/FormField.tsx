import type { ReactNode } from 'react'
import { FormField as UIFormField } from '@/components/ui/form-field'

export function FormField({ label, required = false, helper, error, className = '', children }: { label: string; required?: boolean; helper?: string; error?: string; className?: string; children: ReactNode }) {
  return <UIFormField label={label} required={required} helper={helper} error={error} className={`form-field ${className}`}>{children}</UIFormField>
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="summary-row"><span>{label}</span><strong>{value}</strong></div>
}
