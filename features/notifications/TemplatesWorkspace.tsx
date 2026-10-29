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
import { tc } from '@/lib/i18n/common'
import { eventText, t } from './messages'

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
      toast.success(updated.enabled ? t('isOn', { name: eventText(template).label }) : t('isOff', { name: eventText(template).label }))
    } catch (failure) {
      toast.error(describeApiError(failure))
    } finally {
      setSaving(null)
    }
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button></div>

  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('notifications') }, { label: t('automaticMessages') }]} /><h1>{t('automaticMessages')}</h1><p className="page-description">{t('templatesDescription')}</p></div>
    </header>
    <section className="config-section">
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>{t('whenSent')}</TableHead><TableHead>{t('whatRead')}</TableHead><TableHead>{t('gujarati')}</TableHead><TableHead>{t('on')}</TableHead><TableHead scope="col" aria-label={t('actions')} /></TableRow></TableHeader>
        <TableBody>
          {state.templates.map(item => <TableRow key={item.key}>
            <TableCell><strong>{eventText(item).label}</strong><small className="cell-note">{eventText(item).trigger}</small></TableCell>
            <TableCell><strong>{item.title}</strong><small className="cell-note">{item.body}</small></TableCell>
            <TableCell>{item.titleGujarati && item.bodyGujarati ? t('added') : t('englishUsed')}</TableCell>
            <TableCell><Switch checked={item.enabled} disabled={saving === item.key} onCheckedChange={() => void toggle(item)} aria-label={t('switchState', { name: eventText(item).label, state: item.enabled ? t('stateOn') : t('stateOff') })} /></TableCell>
            <TableCell><Button variant="outline" className="secondary-button" onClick={() => setEditing(item)}>{t('editWords')}</Button></TableCell>
          </TableRow>)}
        </TableBody>
      </Table></div></div>
    </section>
    {editing && <TemplateDialog key={editing.key} template={editing} onClose={() => setEditing(null)} onSaved={replace} />}
  </div>
}
