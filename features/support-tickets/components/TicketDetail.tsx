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

/** One ticket, loaded from the backend. The conversation, replies and status moves all go through the server, which checks every rule again. */
export function TicketDetail({ id }: { id: string }) {
  const { state, reload } = useLoaded(() => supportTicketApi.get(id), id)
  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>This ticket could not be loaded</strong><span>{state.message}</span><div className="setup-actions"><Button className="secondary-button" variant="outline" onClick={reload}>Try again</Button><Link className="secondary-button" href="/support">Back to tickets</Link></div></div>
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
  const send = handleSubmit(async values => { if (await run(() => supportTicketApi.reply(ticket.id, values.body), 'Reply sent.')) reset({ body: '' }) })

  return <div className="workspace-page products-page order-detail">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" aria-label="Back to tickets" onClick={() => router.push('/support')}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: 'Support Tickets', href: '/support' }, { label: number }]} />
          <div className="od-title"><h1>{number}</h1><TicketStatusBadge status={ticket.status} /></div>
          <p className="page-description">{TICKET_CATEGORY_LABELS[ticket.category]} · opened {formatTimestamp(ticket.createdAt)}</p></div>
      </div>
      <div className="header-actions">
        {next.includes('in_progress') && ticket.status === 'resolved' && <Button variant="outline" className="secondary-button" disabled={busy} onClick={() => move('in_progress', 'Ticket reopened.')}><RotateCcw size={15} /> Reopen</Button>}
        {next.includes('in_progress') && ticket.status === 'open' && <Button variant="outline" className="secondary-button" disabled={busy} onClick={() => move('in_progress', 'Marked as in progress.')}>Start Working</Button>}
        {next.includes('resolved') && <Button className="primary-button" disabled={busy} onClick={() => move('resolved', 'Marked as resolved.')}><Check size={15} /> Mark Resolved</Button>}
        {next.includes('closed') && <Button className="primary-button" disabled={busy} onClick={() => setClosing(true)}><Lock size={15} /> Close Ticket</Button>}
      </div>
    </header>
    <div className="od-layout">
      <div className="od-main">
        <section className="panel" aria-labelledby="ticket-thread-title">
          <header className="panel-header"><div><h2 id="ticket-thread-title">Conversation</h2><p>{messages.length} {messages.length === 1 ? 'message' : 'messages'}</p></div></header>
          <ol className="ticket-thread">{messages.map(message => <li key={message.id} data-author={message.author}>
            <div className="ticket-bubble"><p>{message.body}</p></div>
            <span>{message.author === 'admin' ? `ShreeRam team (${message.authorName})` : message.authorName || 'Customer'} · {formatTimestamp(message.createdAt)}</span>
          </li>)}</ol>
          {ticket.status === 'closed'
            ? <p className="od-empty">This ticket is closed. The customer can open a new report from the app if they need more help.</p>
            : <form className="ticket-reply" onSubmit={send} noValidate>
              <label htmlFor="ticket-reply-body" className="product-form-label">Reply to customer</label>
              <Textarea id="ticket-reply-body" rows={3} maxLength={1000} aria-invalid={Boolean(errors.body)} {...register('body')} />
              {errors.body && <small className="field-error">{errors.body.message}</small>}
              <div className="ticket-reply-actions"><Button type="submit" className="primary-button" disabled={busy}><Send size={15} /> {busy ? 'Sending…' : 'Send Reply'}</Button></div>
            </form>}
        </section>
      </div>
      <aside className="od-side" aria-label="Ticket context">
        <section className="panel"><header className="panel-header"><h2>Customer</h2></header>
          <div className="od-side-body">
            <p className="od-customer"><Link className="product-name-link" href={`/customers/${ticket.customerId}`}>{ticket.customerName || formatCustomerPhone(ticket.customerPhone)}</Link></p>
            <p className="od-muted">{formatCustomerPhone(ticket.customerPhone)}</p>
            <p className="od-muted"><Link className="product-name-link" href={`/support?customer=${ticket.customerId}`}>All tickets for this customer</Link></p>
          </div>
        </section>
        <section className="panel"><header className="panel-header"><h2>Details</h2></header>
          <div className="od-side-body">
            <DetailRows rows={[
              { label: 'Category', value: TICKET_CATEGORY_LABELS[ticket.category] },
              { label: 'Assigned to', value: ticket.assigneeEmail ?? 'Unassigned' },
              { label: 'Resolved', value: ticket.resolvedAt ? formatTimestamp(ticket.resolvedAt) : '—' },
              { label: 'Closed', value: ticket.closedAt ? formatTimestamp(ticket.closedAt) : '—' },
            ]} />
            {ticket.status !== 'closed' && (ticket.assigneeAdminId
              ? <Button variant="outline" className="secondary-button" disabled={busy} onClick={() => run(() => supportTicketApi.assign(ticket.id, false), 'Ticket released.')}><UserMinus size={15} /> Release ticket</Button>
              : <Button variant="outline" className="secondary-button" disabled={busy} onClick={() => run(() => supportTicketApi.assign(ticket.id, true), 'You are now looking after this ticket.')}><UserCheck size={15} /> Take this ticket</Button>)}
          </div>
        </section>
        <p className="od-meta">Refunds and credits are handled from the customer’s account, not from the ticket.</p>
      </aside>
    </div>
    <AlertDialog open={closing} onOpenChange={setClosing}>
      <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader><p className="eyebrow">Close ticket</p><AlertDialogTitle>Close {number}?</AlertDialogTitle><AlertDialogDescription>A closed ticket can’t be reopened or replied to. If the customer needs more help later, they open a new report from the app.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Keep Open</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" onClick={() => { setClosing(false); void move('closed', 'Ticket closed.') }}>Close Ticket</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
