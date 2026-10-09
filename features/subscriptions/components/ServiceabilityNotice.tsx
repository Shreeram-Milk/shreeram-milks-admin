'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ServiceabilityNoticeProps = {
  reason: string
  /** Absent when the customer is fixed (editing). */
  onChangeCustomer?: () => void
  onChangeProduct: () => void
}

/** Blocking message shown when the customer cannot receive the chosen product. */
export function ServiceabilityNotice({ reason, onChangeCustomer, onChangeProduct }: ServiceabilityNoticeProps) {
  return <div className="serviceability-notice" role="alert">
    <AlertTriangle size={18} aria-hidden="true" />
    <div>
      <strong>Delivery isn’t available</strong>
      <p>{reason}</p>
      <div className="serviceability-actions">
        {onChangeCustomer && <Button type="button" variant="outline" className="secondary-button" onClick={onChangeCustomer}>Change Customer</Button>}
        <Button type="button" variant="outline" className="secondary-button" onClick={onChangeProduct}>Change Product</Button>
      </div>
    </div>
  </div>
}
