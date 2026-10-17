'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { describeApiError } from '@/lib/api-errors'
import { notificationApi, type MessageTemplate } from './api'
import { TemplateDialog } from './components/TemplateDialog'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; templates: MessageTemplate[] }

/**
 * The automatic messages customers receive. The six events are fixed by the system; staff change the wording (English and Gujarati)
 * and can switch a message off. A message that is off sends nothing, neither to the phone nor to the bell.
 */
export function TemplatesWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    notificationApi.templates().then(
      templates => { if (!cancelled) setState({ status: 'ready', templates }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey])

  const replace = (updated: MessageTemplate) => setState(current => (current.status === 'ready' ? { status: 'ready', templates: current.templates.map(item => (item.key === updated.key ? updated : item)) } : current))
  const toggle = async (template: MessageTemplate) => {
    setSaving(template.key)
    try {
      const updated = await notificationApi.saveTemplate(template.key, { title: template.title, titleGujarati: template.titleGujarati, body: template.body, bodyGujarati: template.bodyGujarati, enabled: !template.enabled })
      replace(updated)
      toast.success(updated.enabled ? `"${template.label}" is on.` : `"${template.label}" is off. Customers will not receive it.`)
    } catch (failure) {
      toast.error(describeApiError(failure))
    } finally {
      setSaving(null)
    }
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Messages could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>Try again</Button></div>

  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Notifications' }, { label: 'Automatic messages' }]} /><h1>Automatic messages</h1><p className="page-description">What customers are told when something happens. You can change the words and switch a message off. Customers also see every message in the bell inside the app.</p></div>
    </header>
    <section className="config-section">
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>When it is sent</TableHead><TableHead>What customers read</TableHead><TableHead>Gujarati</TableHead><TableHead>On</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
        <TableBody>
          {state.templates.map(item => <TableRow key={item.key}>
            <TableCell><strong>{item.label}</strong><small className="cell-note">{item.trigger}</small></TableCell>
            <TableCell><strong>{item.title}</strong><small className="cell-note">{item.body}</small></TableCell>
            <TableCell>{item.titleGujarati && item.bodyGujarati ? 'Added' : 'English is used'}</TableCell>
            <TableCell><Switch checked={item.enabled} disabled={saving === item.key} onCheckedChange={() => void toggle(item)} aria-label={`${item.label} is ${item.enabled ? 'on' : 'off'}`} /></TableCell>
            <TableCell><Button variant="outline" className="secondary-button" onClick={() => setEditing(item)}>Edit words</Button></TableCell>
          </TableRow>)}
        </TableBody>
      </Table></div></div>
    </section>
    {editing && <TemplateDialog key={editing.key} template={editing} onClose={() => setEditing(null)} onSaved={replace} />}
  </div>
}
