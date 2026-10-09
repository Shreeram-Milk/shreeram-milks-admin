import { AlertTriangle } from 'lucide-react'

/** Non-blocking operational warning for a delivery whose configuration is no longer valid. */
export function ServiceabilityWarning({ message }: { message: string }) {
  return <p className="delivery-warning" role="status"><AlertTriangle size={14} aria-hidden="true" /><span><strong>Serviceability issue</strong> {message}</span></p>
}
