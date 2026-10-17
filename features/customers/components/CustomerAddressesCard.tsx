'use client'

import { Button } from '@/components/ui/button'
import { DetailRows } from '@/components/shared/DetailRows'
import { Skeleton } from '@/components/ui/skeleton'
import { useLoaded } from '../../configuration/use-loaded'
import { customerRecordApi } from '../api'
import { ADDRESS_LABELS, DROP_LOCATION_LABELS, HANDOFF_LABELS, formatCustomerPhone } from '../record-schema'

/** Where the customer lives and how they want deliveries handled. Read-only for staff: the customer edits these in the app. */
export function CustomerAddressesCard({ customerId }: { customerId: string }) {
  const { state, reload } = useLoaded(() => customerRecordApi.addresses(customerId), customerId)
  return <section className="form-card" aria-labelledby="customer-addresses-title">
    <div className="form-section-header"><div className="form-section-heading"><div><h2 id="customer-addresses-title">Addresses and delivery notes</h2><p>Saved by the customer in the app. You can read them here; only the customer can change them.</p></div></div></div>
    {state.status === 'loading' && <Skeleton className="h-24 w-full" />}
    {state.status === 'error' && <div className="product-state" role="alert"><strong>Addresses could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={reload}>Try again</Button></div>}
    {state.status === 'ready' && <>
      {state.data.addresses.length === 0
        ? <p className="help-text">No saved address yet.</p>
        : state.data.addresses.map(address => <div key={address.id} className="customer-address-block">
          <h3>{ADDRESS_LABELS[address.label]}{address.isDefault ? ' · Default' : ''}</h3>
          <DetailRows rows={[
            { label: 'Receiver', value: `${address.recipientName} · ${formatCustomerPhone(address.recipientPhone)}` },
            { label: 'Address', value: [address.line1, address.line2, address.landmark].filter(Boolean).join(', ') },
            { label: 'City and PIN', value: [address.city, address.pinCode].filter(Boolean).join(' · ') },
          ]} />
        </div>)}
      <h3>Delivery notes</h3>
      <DetailRows rows={[
        { label: 'Leave it at', value: DROP_LOCATION_LABELS[state.data.instructions.dropLocation] },
        { label: 'Handover', value: HANDOFF_LABELS[state.data.instructions.handoff] },
        { label: 'Do not ring the bell', value: state.data.instructions.noDoorbell ? 'Yes' : 'No' },
        { label: 'Do not call', value: state.data.instructions.noCall ? 'Yes' : 'No' },
        { label: 'Message after delivery', value: state.data.instructions.notifyAfterDelivery ? 'Yes' : 'No' },
        { label: 'Extra note', value: state.data.instructions.additionalInstructions || '—' },
      ]} />
    </>}
  </section>
}
