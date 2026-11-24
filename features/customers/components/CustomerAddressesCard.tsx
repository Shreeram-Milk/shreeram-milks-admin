'use client'

import { useState } from 'react'
import { AddressPlaceDialog } from '@/features/delivery-places/AddressPlaceDialog'
import { t as tp } from '@/features/delivery-places/messages'
import type { CustomerRecordAddress } from '../api'
import { Button } from '@/components/ui/button'
import { DetailRows } from '@/components/shared/DetailRows'
import { Skeleton } from '@/components/ui/skeleton'
import { useLoaded } from '../../configuration/use-loaded'
import { customerRecordApi } from '../api'
import { ADDRESS_LABELS, DROP_LOCATION_LABELS, HANDOFF_LABELS, formatCustomerPhone } from '../record-schema'
import { tc } from '@/lib/i18n/common'
import { t } from '../messages'

/** Where the customer lives and how they want deliveries handled. Street details stay customer-owned; staff may assign a reviewed delivery group. */
export function CustomerAddressesCard({ customerId }: { customerId: string }) {
  const [assigning, setAssigning] = useState<CustomerRecordAddress | null>(null)
  const { state, reload } = useLoaded(() => customerRecordApi.addresses(customerId), customerId)
  return <section className="form-card" aria-labelledby="customer-addresses-title">
    <div className="form-section-header"><div className="form-section-heading"><div><h2 id="customer-addresses-title">{t('addressesTitle')}</h2><p>{t('addressesIntro')}</p></div></div></div>
    {state.status === 'loading' && <Skeleton className="h-24 w-full" />}
    {state.status === 'error' && <div className="product-state" role="alert"><strong>{t('addressesFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={reload}>{tc('tryAgain')}</Button></div>}
    {state.status === 'ready' && <>
      {state.data.addresses.length === 0
        ? <p className="help-text">{t('noAddress')}</p>
        : state.data.addresses.map(address => <div key={address.id} className="customer-address-block">
          <h3>{ADDRESS_LABELS[address.label]}{address.isDefault ? t('default') : ''}</h3>
          <DetailRows rows={[
            { label: t('receiver'), value: `${address.recipientName} · ${formatCustomerPhone(address.recipientPhone)}` },
            { label: t('address'), value: [address.line1, address.line2, address.landmark].filter(Boolean).join(', ') },
            { label: tp('deliveryDetails'), value: address.deliveryDetailsConfirmed ? tp('detailsConfirmed') : tp('needsClarification') },
            ...(['building', 'towerWing', 'floor', 'unit', 'lane'] as const).map(field => ({ label: tp(field), value: address.deliveryDetails?.[field] || tp('notProvided') })),
            { label: tp('currentGroup'), value: address.deliveryPlaceName || tp('clear') },
            { label: t('cityPin'), value: [address.city, address.pinCode].filter(Boolean).join(' · ') },
          ]} />
          {!address.deliveryDetailsConfirmed && <p className="help-text">{tp('clarificationHint')}</p>}
          <Button type="button" variant="outline" className="secondary-button" onClick={() => setAssigning(address)}>{tp('assign')}</Button>
        </div>)}
      <h3>{t('deliveryNotes')}</h3>
      <DetailRows rows={[
        { label: t('leaveItAt'), value: DROP_LOCATION_LABELS[state.data.instructions.dropLocation] },
        { label: t('handover'), value: HANDOFF_LABELS[state.data.instructions.handoff] },
        { label: t('noBell'), value: state.data.instructions.noDoorbell ? tc('yes') : tc('no') },
        { label: t('noCall'), value: state.data.instructions.noCall ? tc('yes') : tc('no') },
        { label: t('messageAfter'), value: state.data.instructions.notifyAfterDelivery ? tc('yes') : tc('no') },
        { label: t('extraNote'), value: state.data.instructions.additionalInstructions || '—' },
      ]} />
    </>}
    {assigning && <AddressPlaceDialog customerId={customerId} address={assigning} onClose={() => setAssigning(null)} onSaved={() => { setAssigning(null); reload() }} />}
  </section>
}
