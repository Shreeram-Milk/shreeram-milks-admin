'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, Check, Lock, RotateCcw, Send, UserCheck, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DetailRows } from '@/components/shared/DetailRows'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { useLoaded } from '../../configuration/use-loaded'
import { formatCustomerPhone } from '../../customers/record-schema'
import { formatTicketNumber, supportTicketApi, type SupportTicketThread } from '../api'
import { replySchema, type ReplyFormValues } from '../schema'
import { TICKET_CATEGORY_LABELS, TICKET_TRANSITIONS, type TicketStatus } from '../types'
import { TicketStatusBadge } from './TicketStatusBadge'
import { tc } from '@/lib/i18n/common'
import { t } from '../messages'

/** One ticket, loaded from the backend. The conversation, replies and status moves all go through the server, which checks every rule again. */
export function TicketDetail({ id }: { id: string }) {
  const { state, reload } = useLoaded(() => supportTicketApi.get(id), id)
  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('detailFailed')}</strong><span>{state.message}</span><div className="setup-actions"><Button className="secondary-button" variant="outline" onClick={reload}>{tc('tryAgain')}</Button><Link className="secondary-button" href="/support">{t('backToTickets')}</Link></div></div>
  return <TicketThreadView key={id} initial={state.data} />
}

function TicketThreadView({ initial }: { initial: SupportTicketThread }) {
  const router = useRouter()
  const [thread, setThread] = useState(initial)
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const { ticket, messages } = thread
  const next = TICKET_TRANSITIONS[ticket.status]
  const number = formatTicketNumber(ticket.ticketNumber)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReplyFormValues>({ resolver: zodResolver(replySchema), defaultValues: { body: '' } })

  // Every action asks the server and shows what the server answered; a failure leaves the page as it was.
  const run = async (action: () => Promise<SupportTicketThread>, success: string): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    try { setThread(await action()); toast.success(success); return true } catch (failure) { toast.error(describeApiError(failure)); return false } finally { setBusy(false) }
  }
  const move = (status: TicketStatus, success: string) => run(() => supportTicketApi.setStatus(ticket.id, status), success)
  const send = handleSubmit(async values => { if (await run(() => supportTicketApi.reply(ticket.id, values.body), t('replySent'))) reset({ body: '' }) })

  return <div className="workspace-page products-page order-detail">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" aria-label={t('backToTickets')} onClick={() => router.push('/support')}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: t('title'), href: '/support' }, { label: number }]} />
          <div className="od-title"><h1>{number}</h1><TicketStatusBadge status={ticket.status} /></div>
          <p className="page-description">{t('openedOn', { category: TICKET_CATEGORY_LABELS[ticket.category], when: formatTimestamp(ticket.createdAt) })}</p></div>
      </div>
      <div className="header-actions">
        {next.includes('in_progress') && ticket.status === 'resolved' && <Button variant="outline" className="secondary-button" disabled={busy} onClick={() => move('in_progress', t('reopened'))}><RotateCcw size={15} /> {t('reopen')}</Button>}
        {next.includes('in_progress') && ticket.status === 'open' && <Button variant="outline" className="secondary-button" disabled={busy} onClick={() => move('in_progress', t('markedInProgress'))}>{t('startWorking')}</Button>}
        {next.includes('resolved') && <Button className="primary-button" disabled={busy} onClick={() => move('resolved', t('markedResolved'))}><Check size={15} /> {t('markResolved')}</Button>}
        {next.includes('closed') && <Button className="primary-button" disabled={busy} onClick={() => setClosing(true)}><Lock size={15} /> {t('closeTicket')}</Button>}
      </div>
    </header>
    <div className="od-layout">
      <div className="od-main">
        <section className="panel" aria-labelledby="ticket-thread-title">
          <header className="panel-header"><div><h2 id="ticket-thread-title">{t('conversation')}</h2><p>{t(messages.length === 1 ? 'messageOne' : 'messageMany', { count: messages.length })}</p></div></header>
          <ol className="ticket-thread">{messages.map(message => <li key={message.id} data-author={message.author}>
            <div className="ticket-bubble"><p>{message.body}</p></div>
            <span>{message.author === 'admin' ? t('team', { name: message.authorName }) : message.authorName || t('customerFallback')} · {formatTimestamp(message.createdAt)}</span>
          </li>)}</ol>
          {ticket.status === 'closed'
            ? <p className="od-empty">{t('closedNote')}</p>
            : <form className="ticket-reply" onSubmit={send} noValidate>
              <label htmlFor="ticket-reply-body" className="product-form-label">{t('replyToCustomer')}</label>
              <Textarea id="ticket-reply-body" rows={3} maxLength={1000} aria-invalid={Boolean(errors.body)} {...register('body')} />
              {errors.body && <small className="field-error">{errors.body.message}</small>}
              <div className="ticket-reply-actions"><Button type="submit" className="primary-button" disabled={busy}><Send size={15} /> {busy ? t('sending') : t('sendReply')}</Button></div>
            </form>}
        </section>
      </div>
      <aside className="od-side" aria-label={t('ticketContext')}>
        <section className="panel"><header className="panel-header"><h2>{t('customer')}</h2></header>
          <div className="od-side-body">
            <p className="od-customer"><Link className="product-name-link" href={`/customers/${ticket.customerId}`}>{ticket.customerName || formatCustomerPhone(ticket.customerPhone)}</Link></p>
            <p className="od-muted">{formatCustomerPhone(ticket.customerPhone)}</p>
            <p className="od-muted"><Link className="product-name-link" href={`/support?customer=${ticket.customerId}`}>{t('allForCustomer')}</Link></p>
          </div>
        </section>
        <section className="panel"><header className="panel-header"><h2>{t('details')}</h2></header>
          <div className="od-side-body">
            <DetailRows rows={[
              { label: t('category'), value: TICKET_CATEGORY_LABELS[ticket.category] },
              { label: t('assignedTo'), value: ticket.assigneeEmail ?? t('unassigned') },
              { label: t('resolved'), value: ticket.resolvedAt ? formatTimestamp(ticket.resolvedAt) : '—' },
              { label: t('closed'), value: ticket.closedAt ? formatTimestamp(ticket.closedAt) : '—' },
            ]} />
            {ticket.status !== 'closed' && (ticket.assigneeAdminId
              ? <Button variant="outline" className="secondary-button" disabled={busy} onClick={() => run(() => supportTicketApi.assign(ticket.id, false), t('released'))}><UserMinus size={15} /> {t('releaseTicket')}</Button>
              : <Button variant="outline" className="secondary-button" disabled={busy} onClick={() => run(() => supportTicketApi.assign(ticket.id, true), t('taken'))}><UserCheck size={15} /> {t('takeTicket')}</Button>)}
          </div>
        </section>
        <p className="od-meta">{t('refundsNote')}</p>
      </aside>
    </div>
    <AlertDialog open={closing} onOpenChange={setClosing}>
      <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader><p className="eyebrow">{t('closeEyebrow')}</p><AlertDialogTitle>{t('closeTitle', { number })}</AlertDialogTitle><AlertDialogDescription>{t('closeBody')}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">{t('keepOpen')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" onClick={() => { setClosing(false); void move('closed', t('ticketClosed')) }}>{t('closeTicket')}</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
