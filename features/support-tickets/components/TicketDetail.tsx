'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, Check, Lock, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DetailRows } from '@/components/shared/DetailRows'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { formatTimestamp } from '@/lib/business-time'
import { CUSTOMER_TYPE_LABELS } from '../../customers/types'
import { replySchema, type ReplyFormValues } from '../schema'
import { supportTicketService } from '../service'
import { TICKET_CATEGORY_LABELS, TICKET_TRANSITIONS, type TicketStatus } from '../types'
import { TicketStatusBadge } from './TicketStatusBadge'

export function TicketDetail({ id }: { id: string }) {
  const router = useRouter()
  const [revision, setRevision] = useState(0)
  const [closing, setClosing] = useState(false)
  const [assignee, setAssignee] = useState<string | null>(null)
  const view = useMemo(() => { void revision; return supportTicketService.getView(id) }, [id, revision])
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ReplyFormValues>({ resolver: zodResolver(replySchema), defaultValues: { body: '' } })
  if (!view) return <div className="product-state"><strong>Ticket not found</strong><Link className="secondary-button" href="/support">Back to tickets</Link></div>

  const { ticket, customer, orderNumber } = view
  const next = TICKET_TRANSITIONS[ticket.status]
  const refresh = () => setRevision(value => value + 1)
  const run = (action: () => void, success: string) => {
    try { action(); toast.success(success); refresh() } catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Something went wrong.') }
  }
  const move = (status: TicketStatus, success: string) => run(() => supportTicketService.changeStatus(id, status), success)
  const send = handleSubmit(values => run(() => { supportTicketService.addMessage(id, 'admin', values.body); reset({ body: '' }) }, 'Reply sent.'))
  const assigneeValue = assignee ?? ticket.assignee

  return <div className="workspace-page products-page order-detail">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" aria-label="Back to tickets" onClick={() => router.push('/support')}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: 'Support Tickets', href: '/support' }, { label: ticket.ticketNumber }]} />
          <div className="od-title"><h1>{ticket.ticketNumber}</h1><TicketStatusBadge status={ticket.status} /></div>
          <p className="page-description">{TICKET_CATEGORY_LABELS[ticket.category]} · opened {formatTimestamp(ticket.createdAt)}</p></div>
      </div>
      <div className="header-actions">
        {next.includes('in_progress') && ticket.status === 'open' && <Button variant="outline" className="secondary-button" onClick={() => move('in_progress', 'Marked as in progress.')}>Start Working</Button>}
        {next.includes('in_progress') && ticket.status === 'resolved' && <Button variant="outline" className="secondary-button" onClick={() => move('in_progress', 'Ticket reopened.')}><RotateCcw size={15} /> Reopen</Button>}
        {next.includes('resolved') && <Button className="primary-button" onClick={() => move('resolved', 'Marked as resolved.')}><Check size={15} /> Mark Resolved</Button>}
        {next.includes('closed') && <Button className="primary-button" onClick={() => setClosing(true)}><Lock size={15} /> Close Ticket</Button>}
      </div>
    </header>
    <div className="od-layout">
      <div className="od-main">
        <section className="panel" aria-labelledby="ticket-thread-title">
          <header className="panel-header"><div><h2 id="ticket-thread-title">Conversation</h2><p>{ticket.messages.length} {ticket.messages.length === 1 ? 'message' : 'messages'}</p></div></header>
          <ol className="ticket-thread">{ticket.messages.map(message => <li key={message.id} data-author={message.author}>
            <div className="ticket-bubble"><p>{message.body}</p></div>
            <span>{message.author === 'admin' ? 'ShreeRam team' : customer?.fullName ?? 'Customer'} · {formatTimestamp(message.createdAt)}</span>
          </li>)}</ol>
          {ticket.status === 'closed'
            ? <p className="od-empty">This ticket is closed. Log a new ticket if the customer needs more help.</p>
            : <form className="ticket-reply" onSubmit={send} noValidate>
              <label htmlFor="ticket-reply-body" className="product-form-label">Reply to customer</label>
              <Textarea id="ticket-reply-body" rows={3} maxLength={1000} aria-invalid={Boolean(errors.body)} {...register('body')} />
              {errors.body && <small className="field-error">{errors.body.message}</small>}
              <div className="ticket-reply-actions"><Button type="submit" className="primary-button" disabled={isSubmitting}><Send size={15} /> Send Reply</Button></div>
            </form>}
        </section>
      </div>
      <aside className="od-side" aria-label="Ticket context">
        <section className="panel"><header className="panel-header"><h2>Customer</h2></header>
          <div className="od-side-body">
            <p className="od-customer">{customer ? <Link className="product-name-link" href={`/customers/${customer.id}`}>{customer.fullName}</Link> : 'Unknown customer'}</p>
            {customer && <p className="od-muted">{CUSTOMER_TYPE_LABELS[customer.customerType]} customer · {customer.mobile}</p>}
            {customer && <p className="od-muted"><Link className="product-name-link" href={`/support?customer=${customer.id}`}>All tickets for this customer</Link></p>}
          </div>
        </section>
        <section className="panel"><header className="panel-header"><h2>Details</h2></header>
          <div className="od-side-body"><DetailRows rows={[
            { label: 'Order', value: ticket.orderId ? <Link className="product-name-link" href={`/orders/${ticket.orderId}`}>{orderNumber}</Link> : 'None' },
            { label: 'Category', value: TICKET_CATEGORY_LABELS[ticket.category] },
            { label: 'Resolved', value: ticket.resolvedAt ? formatTimestamp(ticket.resolvedAt) : '—' },
          ]} />
            {ticket.status !== 'closed' && <form className="ticket-assign" onSubmit={event => { event.preventDefault(); run(() => supportTicketService.assign(id, assigneeValue), 'Assignee saved.'); setAssignee(null) }}>
              <label htmlFor="ticket-assignee" className="product-form-label">Assigned to</label>
              <div><Input id="ticket-assignee" value={assigneeValue} maxLength={60} placeholder="Unassigned" onChange={event => setAssignee(event.target.value)} /><Button type="submit" variant="outline" className="secondary-button" disabled={assigneeValue === ticket.assignee}>Save</Button></div>
            </form>}
          </div>
        </section>
        <p className="od-meta">Refunds and credits are handled from the customer’s account, not from the ticket.</p>
      </aside>
    </div>
    <AlertDialog open={closing} onOpenChange={setClosing}>
      <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader><p className="eyebrow">Close ticket</p><AlertDialogTitle>Close {ticket.ticketNumber}?</AlertDialogTitle><AlertDialogDescription>A closed ticket can’t be reopened or replied to. If the customer needs more help later, log a new ticket.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Keep Open</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" onClick={() => { setClosing(false); move('closed', 'Ticket closed.') }}>Close Ticket</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
