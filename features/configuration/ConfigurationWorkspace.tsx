'use client'

import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { formatTimestamp } from '@/lib/business-time'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form'
import { ArrowLeft, Check, CircleCheck, CircleOff, Clock3, Edit2, MapPin, MoreHorizontal, Plus, Search, Truck } from 'lucide-react'
import { FormField as Field, SummaryRow } from '@/components/configuration/FormField'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { SelectField } from '@/components/ui/select-field'
import { Button as AdminButton } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { configurationService, cutoffRuleService, deliverySlotService, fulfilmentProfileService, serviceAreaService, subscriptionRuleService, trialPlanService } from './mock-store'
import type { CutoffRule, DeliveryMethod, DeliverySlot, FeatureKey, FeatureRecord, FulfilmentProfile, PinCodeRecord, RecordStatus, ServiceArea, SubscriptionRule, TrialPlan } from './types'

const featureLabels: Record<FeatureKey, { singular: string; plural: string; group: string; description: string }> = {
  'trial-plans': { singular: 'Trial plan', plural: 'Trial plans', group: 'Configuration', description: 'Set up reusable introductory offers for products.' },
  'subscription-rules': { singular: 'Subscription rule', plural: 'Subscription rules', group: 'Configuration', description: 'Control the supported customer delivery frequencies.' },
  'delivery-slots': { singular: 'Delivery slot', plural: 'Delivery slots', group: 'Operations', description: 'Manage reusable delivery windows for service areas.' },
  'service-areas': { singular: 'Service area', plural: 'Service areas', group: 'Operations', description: 'Define where ShreeRam Milks can fulfil orders.' },
  'cutoff-rules': { singular: 'Cut-off rule', plural: 'Cut-off rules', group: 'Operations', description: 'Set ordering deadlines for each delivery slot.' },
  'fulfilment-profiles': { singular: 'Fulfilment profile', plural: 'Fulfilment profiles', group: 'Operations', description: 'Combine delivery coverage and cut-off settings for products.' },
}
const statuses: RecordStatus[] = ['active', 'inactive']
const enumText = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const formatTime = (time: string) => { const [hours, minutes] = time.split(':').map(Number); return `${(hours % 12) || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}` }
const humanWindow = (slot?: DeliverySlot) => slot ? `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}` : 'Unavailable slot'

type FormValues = {
  name: string; description: string; status: RecordStatus; duration: number; systemType: 'daily' | 'alternate_days' | 'custom_weekdays';
  startTime: string; endTime: string; coverageType: 'pin_code' | 'state' | 'pan_india'; state: string; city: string;
  deliveryMethod: DeliveryMethod; serviceAreaId: string; cutoffRuleId: string; includeInProductionPlanning: boolean;
  conditions: { deliverySlotId: string; dayRelation: 'same_day' | 'previous_day'; cutoffTime: string }[];
}

function buildSchema(feature: FeatureKey) {
  return z.object({
    name: z.string().trim().min(1, 'Enter a name.'), description: z.string().default(''), status: z.enum(statuses), duration: z.coerce.number().optional(),
    systemType: z.enum(['daily', 'alternate_days', 'custom_weekdays']).optional(), startTime: z.string().optional(), endTime: z.string().optional(),
    coverageType: z.enum(['pin_code', 'state', 'pan_india']).optional(), state: z.string().optional(), city: z.string().optional(),
    deliveryMethod: z.enum(['local_delivery', 'shipping']).optional(), serviceAreaId: z.string().optional(), cutoffRuleId: z.string().optional(),
    includeInProductionPlanning: z.boolean().optional(),
    conditions: z.array(z.object({ deliverySlotId: z.string(), dayRelation: z.enum(['same_day', 'previous_day']), cutoffTime: z.string() })).optional(),
  }).superRefine((value, ctx) => {
    if (feature === 'trial-plans' && (!Number.isInteger(value.duration) || !value.duration || value.duration <= 0)) ctx.addIssue({ code: 'custom', path: ['duration'], message: 'Duration must be a positive whole number.' })
    if (feature === 'delivery-slots') {
      if (!value.startTime) ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Choose a start time.' })
      if (!value.endTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Choose an end time.' })
      if (value.startTime && value.endTime && value.endTime <= value.startTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time.' })
    }
    if (feature === 'service-areas') {
      if (value.coverageType !== 'pan_india' && !value.state?.trim()) ctx.addIssue({ code: 'custom', path: ['state'], message: 'Enter a state.' })
      if (value.coverageType === 'pin_code' && !value.city?.trim()) ctx.addIssue({ code: 'custom', path: ['city'], message: 'Enter a city.' })
    }
    if (feature === 'cutoff-rules') {
      const conditions = value.conditions ?? []
      if (!conditions.length) ctx.addIssue({ code: 'custom', path: ['conditions'], message: 'Add at least one slot condition.' })
      if (new Set(conditions.map(condition => condition.deliverySlotId)).size !== conditions.length) ctx.addIssue({ code: 'custom', path: ['conditions'], message: 'Each delivery slot can only appear once.' })
      conditions.forEach((condition, index) => {
        if (!condition.deliverySlotId) ctx.addIssue({ code: 'custom', path: ['conditions', index, 'deliverySlotId'], message: 'Choose an active slot.' })
        if (!condition.cutoffTime) ctx.addIssue({ code: 'custom', path: ['conditions', index, 'cutoffTime'], message: 'Choose a cut-off time.' })
      })
    }
    if (feature === 'fulfilment-profiles' && !value.serviceAreaId) ctx.addIssue({ code: 'custom', path: ['serviceAreaId'], message: 'Choose a coverage area.' })
    if (feature === 'fulfilment-profiles' && value.serviceAreaId) {
      const area = serviceAreaService.getById(value.serviceAreaId)
      if (!area || area.status !== 'active') ctx.addIssue({ code: 'custom', path: ['serviceAreaId'], message: 'Choose an active service area.' })
      else if (value.deliveryMethod === 'local_delivery' && area.coverageType !== 'pin_code') ctx.addIssue({ code: 'custom', path: ['serviceAreaId'], message: 'Local delivery requires a PIN-code service area.' })
      else if (value.deliveryMethod === 'shipping' && area.coverageType === 'pin_code') ctx.addIssue({ code: 'custom', path: ['serviceAreaId'], message: 'Shipping requires State or Pan India coverage.' })
    }
  })
}

const operationsFeatures: FeatureKey[] = ['delivery-slots', 'service-areas', 'cutoff-rules', 'fulfilment-profiles']
const groupOf = (feature: FeatureKey) => operationsFeatures.includes(feature) ? { label: 'Operations', path: 'operations' } : { label: 'Configuration', path: 'configuration' }

export function ConfigurationWorkspace({ segments, section }: { segments: string[]; section: 'configuration' | 'operations' }) {
  const router = useRouter()
  const rawFeature = segments[0] ?? ''
  const feature = (section === 'configuration' ? rawFeature : rawFeature) as FeatureKey
  const meta = featureLabels[feature]
  if (!meta) return <div className="workspace-page"><div className="empty-state"><h1>Configuration not found</h1><p>Choose an item from the navigation to continue.</p><Link className="secondary-button" href="/">Back to dashboard</Link></div></div>
  const mode = segments[1] === 'new' ? 'new' : segments[2] === 'edit' ? 'edit' : segments[1] ? 'detail' : 'list'
  const id = mode === 'edit' ? segments[1] : mode === 'detail' ? segments[1] : undefined
  const record = id ? getOne(feature, id) : undefined
  if ((mode === 'detail' || mode === 'edit') && !record) return <div className="workspace-page"><div className="empty-state"><h1>Record not found</h1><Link className="secondary-button" href={`/${section}/${feature}`}>Return to {meta.plural.toLowerCase()}</Link></div></div>
  if (mode === 'new' || mode === 'edit') return <RecordForm feature={feature} existing={record} onCancel={() => router.push(`/${section}/${feature}`)} onSaved={saved => router.push(feature === 'service-areas' || feature === 'cutoff-rules' || feature === 'fulfilment-profiles' ? `/${section}/${feature}/${saved.id}` : `/${section}/${feature}`)} />
  if (mode === 'detail' && record) return <RecordDetail feature={feature} record={record} onEdit={() => router.push(`/${section}/${feature}/${record.id}/edit`)} onList={() => router.push(`/${section}/${feature}`)} />
  return <RecordList feature={feature} section={section} />
}

function getRows(feature: FeatureKey): FeatureRecord[] {
  switch (feature) {
    case 'trial-plans': return trialPlanService.list()
    case 'subscription-rules': return subscriptionRuleService.list()
    case 'delivery-slots': return deliverySlotService.list()
    case 'service-areas': return serviceAreaService.list()
    case 'cutoff-rules': return cutoffRuleService.list()
    case 'fulfilment-profiles': return fulfilmentProfileService.list()
  }
}
function getOne(feature: FeatureKey, id: string): FeatureRecord | undefined {
  switch (feature) {
    case 'trial-plans': return trialPlanService.getById(id)
    case 'subscription-rules': return subscriptionRuleService.getById(id)
    case 'delivery-slots': return deliverySlotService.getById(id)
    case 'service-areas': return serviceAreaService.getById(id)
    case 'cutoff-rules': return cutoffRuleService.getById(id)
    case 'fulfilment-profiles': return fulfilmentProfileService.getById(id)
  }
}
function setStatus(feature: FeatureKey, id: string, status: RecordStatus) {
  switch (feature) {
    case 'trial-plans': trialPlanService.setStatus(id, status); break
    case 'subscription-rules': subscriptionRuleService.setStatus(id, status); break
    case 'delivery-slots': deliverySlotService.setStatus(id, status); break
    case 'service-areas': serviceAreaService.setStatus(id, status); break
    case 'cutoff-rules': cutoffRuleService.setStatus(id, status); break
    case 'fulfilment-profiles': fulfilmentProfileService.setStatus(id, status); break
  }
}
function saveRecord(feature: FeatureKey, values: FormValues, id?: string): FeatureRecord {
  const base = { name: values.name.trim(), description: values.description, status: values.status, ...(id ? { id } : {}) }
  switch (feature) {
    case 'trial-plans': return trialPlanService.save({ ...base, duration: Number(values.duration), durationUnit: 'days' })
    case 'subscription-rules': return subscriptionRuleService.save({ ...base, systemType: values.systemType ?? 'daily' })
    case 'delivery-slots': return deliverySlotService.save({ ...base, startTime: values.startTime ?? '', endTime: values.endTime ?? '' })
    case 'service-areas': return serviceAreaService.save({ ...base, coverageType: values.coverageType ?? 'pin_code', state: values.coverageType === 'pan_india' ? '' : values.state ?? '', city: values.coverageType === 'pin_code' ? values.city ?? '' : '', pinCodes: (values as FormValues & { confirmRemovePins?: boolean }).confirmRemovePins ? [] : (getOne('service-areas', id ?? '') as ServiceArea | undefined)?.pinCodes ?? [] })
    case 'cutoff-rules': return cutoffRuleService.save({ ...base, conditions: (values.conditions ?? []).map((condition, index) => ({ ...condition, id: `condition-${index}-${id ?? 'new'}` })) })
    case 'fulfilment-profiles': return fulfilmentProfileService.save({ ...base, deliveryMethod: values.deliveryMethod ?? 'local_delivery', serviceAreaId: values.serviceAreaId ?? '', cutoffRuleId: values.deliveryMethod === 'shipping' ? '' : values.cutoffRuleId ?? '', includeInProductionPlanning: values.deliveryMethod === 'shipping' ? false : Boolean(values.includeInProductionPlanning) })
  }
}

function RecordList({ feature, section }: { feature: FeatureKey; section: 'configuration' | 'operations' }) {
  const meta = featureLabels[feature]
  const router = useRouter()
  const [revision, setRevision] = useState(0)
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get('search') ?? ''
  const [query, setQuery] = useState(urlSearch)
  const [syncedSearch, setSyncedSearch] = useState(urlSearch)
  if (urlSearch !== syncedSearch) { setSyncedSearch(urlSearch); setQuery(urlSearch) }
  const [status, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [pending, setPending] = useState<{ id: string; dependencies: string[] } | null>(null)
  const rows = useMemo(() => { void revision; return getRows(feature) }, [feature, revision])
  const counts = configurationService.derivedCounts()
  const filtered = rows.filter(row => (status === 'all' || row.status === status) && `${row.name} ${row.description}`.toLowerCase().includes(query.toLowerCase()))
  const perPage = 8
  const pageRows = filtered.slice(page * perPage, (page + 1) * perPage)
  const href = `/${section}/${feature}`
  return <div className="workspace-page">
    <header className="page-header"><div><PageBreadcrumbs items={[{ label: groupOf(feature).label }, { label: meta.plural }]} /><h1>{meta.plural}</h1><p className="page-description">{meta.description}</p></div>{feature !== 'subscription-rules' && <Link className="primary-button" href={`${href}/new`}><Plus size={16} /> Add {meta.singular}</Link>}</header>
    <section className="config-section">
      <label className="workspace-search"><Search size={17} aria-hidden="true" /><Input className="workspace-search-input" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder={`Search ${meta.plural.toLowerCase()}...`} /></label>
      <div className="config-filter-row"><SelectField label="Filter by status" className="config-select product-select-trigger" value={status} onChange={setStatusFilter} placeholder="All statuses" options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /><span className="record-count">{filtered.length} records</span></div>
      <div className="table-card"><div className="table-scroll"><Table><TableHeader><TableRow>{columnsFor(feature).map(column => <TableHead key={column}>{column}</TableHead>)}<TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader><TableBody>{pageRows.map(row => <ListRow key={row.id} feature={feature} row={row} counts={counts} onOpen={() => router.push(`${href}/${row.id}`)} onEdit={() => router.push(`${href}/${row.id}/edit`)} onToggle={() => { if (row.status === 'inactive') { setStatus(feature, row.id, 'active'); toast.success(`${row.name} activated.`); setRevision(value => value + 1); return } setPending({ id: row.id, dependencies: configurationService.dependencies(feature, row.id) }); }} />)}{pageRows.length === 0 && <TableRow><TableCell colSpan={columnsFor(feature).length + 1}><div className="empty-table">{rows.length ? 'No results match your search and filters.' : `No ${meta.plural.toLowerCase()} yet.`}{rows.length === 0 && feature !== 'subscription-rules' && <Link className="text-button" href={`${href}/new`}>Create the first {meta.singular.toLowerCase()}</Link>}</div></TableCell></TableRow>}</TableBody></Table></div>
      <div className="table-footer"><span>Showing {filtered.length ? page * perPage + 1 : 0}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length}</span><div><TablePagination page={page + 1} pageCount={Math.max(1, Math.ceil(filtered.length / perPage))} onPageChange={nextPage => setPage(nextPage - 1)} /></div></div></div>
    </section>
    <AlertDialog open={Boolean(pending)} onOpenChange={open => { if (!open) setPending(null) }}>{pending && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Dependency check</p><AlertDialogTitle>Deactivate “{getOne(feature, pending.id)?.name}”?</AlertDialogTitle><AlertDialogDescription asChild><div><p>This record is currently referenced by:</p><ul>{pending.dependencies.map((dependency, index) => <li key={`${dependency}-${index}`}>{dependency}</li>)}</ul><p className="warning-note">Existing references will remain visible, but this configuration will not be available for new setup.</p></div></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton variant="outline" className="secondary-button">Cancel</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton className="primary-button" onClick={() => { setStatus(feature, pending.id, 'inactive'); toast.success(`${getOne(feature, pending.id)?.name} deactivated.`); setPending(null); setRevision(value => value + 1) }}>Deactivate</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
  </div>
}

function columnsFor(feature: FeatureKey) {
  const map: Record<FeatureKey, string[]> = {
    'trial-plans': ['Plan Name', 'Duration', 'Status', 'Products Using', 'Updated'],
    'subscription-rules': ['Name', 'System Type', 'Description', 'Status', 'Products Using'],
    'delivery-slots': ['Slot Name', 'Delivery Window', 'Status', 'Used By Service Areas', 'Updated'],
    'service-areas': ['Service Area', 'Coverage Type', 'Location', 'PIN Codes', 'Available Slots', 'Status'],
    'cutoff-rules': ['Rule Name', 'Conditions', 'Status', 'Fulfilment Profiles', 'Updated'],
    'fulfilment-profiles': ['Profile Name', 'Delivery Method', 'Coverage', 'Delivery Slots', 'Cut-off Rule', 'Production Planning', 'Products Using', 'Status'],
  }
  return map[feature]
}

function ListRow({ feature, row, counts, onOpen, onEdit, onToggle }: { feature: FeatureKey; row: FeatureRecord; counts: ReturnType<typeof configurationService.derivedCounts>; onOpen: () => void; onEdit: () => void; onToggle: () => void }) {
  const db = configurationService.referenceData()
  const areaSlots = (area: ServiceArea) => Array.from(new Set(area.pinCodes.flatMap(pin => pin.allowedDeliverySlotIds))).map(id => db.slots.find(slot => slot.id === id)?.name).filter(Boolean).join(', ') || '—'
  let cells: React.ReactNode[] = []
  switch (feature) {
    case 'trial-plans': { const value = row as TrialPlan; cells = [<AdminButton key="name" className="table-link" onClick={onOpen}>{value.name}</AdminButton>, `${value.duration} days`, null, `${counts.trialPlans.get(value.id) ?? 0} products`, formatDate(value.updatedAt)]; break }
    case 'subscription-rules': { const value = row as SubscriptionRule; cells = [<AdminButton key="name" className="table-link" onClick={onOpen}>{value.name}</AdminButton>, <><span className="system-code">{value.systemType}</span>{value.systemType === 'custom_weekdays' && <small className="weekday-note">Mon · Tue · Wed · Thu · Fri · Sat · Sun</small>}</>, value.description || '—', null, `${counts.subscriptionRules.get(value.id) ?? 0} products`]; break }
    case 'delivery-slots': { const value = row as DeliverySlot; cells = [<AdminButton key="name" className="table-link" onClick={onOpen}>{value.name}</AdminButton>, humanWindow(value), null, `${counts.deliverySlots.get(value.id) ?? 0} service areas`, formatDate(value.updatedAt)]; break }
    case 'service-areas': { const value = row as ServiceArea; cells = [<AdminButton key="name" className="table-link" onClick={onOpen}>{value.name}</AdminButton>, enumText(value.coverageType), value.coverageType === 'pan_india' ? 'All India' : [value.city, value.state].filter(Boolean).join(', ') || value.state, `${value.pinCodes.length} PIN codes`, areaSlots(value), null]; break }
    case 'cutoff-rules': { const value = row as CutoffRule; cells = [<AdminButton key="name" className="table-link" onClick={onOpen}>{value.name}</AdminButton>, `${value.conditions.length} slot conditions`, null, `${configurationService.dependencies(feature, value.id).length} profiles`, formatDate(value.updatedAt)]; break }
    case 'fulfilment-profiles': { const value = row as FulfilmentProfile; const area = db.areas.find(item => item.id === value.serviceAreaId); const cutoff = db.cutoffs.find(item => item.id === value.cutoffRuleId); cells = [<AdminButton key="name" className="table-link" onClick={onOpen}>{value.name}</AdminButton>, enumText(value.deliveryMethod), area?.name ?? 'Unavailable area', value.deliveryMethod === 'shipping' ? 'None' : 'Inherited from area', cutoff?.name ?? 'None', value.includeInProductionPlanning ? 'Enabled' : 'Disabled', `${counts.fulfilmentProfiles.get(value.id) ?? 0} products`, null]; break }
  }
  const statusIndex = feature === 'trial-plans' ? 2 : feature === 'subscription-rules' ? 3 : feature === 'delivery-slots' ? 2 : feature === 'service-areas' ? 5 : feature === 'cutoff-rules' ? 2 : 7
  cells[statusIndex] = <StatusBadge status={row.status}>{enumText(row.status)}</StatusBadge>
  return <TableRow>{cells.map((cell, index) => <TableCell key={`${row.id}-${index}`}>{cell}</TableCell>)}<TableCell><div className="row-actions"><AdminButton variant="ghost" size="icon" className="row-edit-action" aria-label={`Edit ${row.name}`} onClick={onEdit}><Edit2 size={15} /></AdminButton><DropdownMenu><DropdownMenuTrigger asChild><AdminButton variant="ghost" size="icon" className="row-menu" aria-label={`Actions for ${row.name}`}><MoreHorizontal size={16} /></AdminButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onEdit}><Edit2 /> Edit</DropdownMenuItem><DropdownMenuItem onSelect={onToggle}>{row.status === 'active' ? <CircleOff /> : <CircleCheck />}{row.status === 'active' ? 'Deactivate' : 'Activate'}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></TableCell></TableRow>
}
const formatDate = (value: string) => formatTimestamp(value)

function RecordForm({ feature, existing, onCancel, onSaved }: { feature: FeatureKey; existing?: FeatureRecord; onCancel: () => void; onSaved: (record: FeatureRecord) => void }) {
  const meta = featureLabels[feature]
  const currentConditions = (existing as CutoffRule | undefined)?.conditions ?? []
  const slotChoices = deliverySlotService.list().filter(slot => slot.status === 'active' || currentConditions.some(condition => condition.deliverySlotId === slot.id))
  const currentProfile = existing as FulfilmentProfile | undefined
  const areaChoices = serviceAreaService.list().filter(area => area.status === 'active' || area.id === currentProfile?.serviceAreaId)
  const cutoffChoices = cutoffRuleService.list().filter(rule => rule.status === 'active' || rule.id === currentProfile?.cutoffRuleId)
  const defaults: FormValues = {
    name: existing?.name ?? '', description: existing?.description ?? '', status: existing?.status ?? 'active', duration: (existing as TrialPlan | undefined)?.duration ?? 5,
    systemType: (existing as SubscriptionRule | undefined)?.systemType ?? 'daily', startTime: (existing as DeliverySlot | undefined)?.startTime ?? '06:00', endTime: (existing as DeliverySlot | undefined)?.endTime ?? '09:00',
    coverageType: (existing as ServiceArea | undefined)?.coverageType ?? 'pin_code', state: (existing as ServiceArea | undefined)?.state ?? '', city: (existing as ServiceArea | undefined)?.city ?? '',
    deliveryMethod: (existing as FulfilmentProfile | undefined)?.deliveryMethod ?? 'local_delivery', serviceAreaId: (existing as FulfilmentProfile | undefined)?.serviceAreaId ?? areaChoices.find(area => area.coverageType === 'pin_code')?.id ?? '',
    cutoffRuleId: (existing as FulfilmentProfile | undefined)?.cutoffRuleId ?? cutoffChoices[0]?.id ?? '', includeInProductionPlanning: (existing as FulfilmentProfile | undefined)?.includeInProductionPlanning ?? false,
    conditions: (existing as CutoffRule | undefined)?.conditions?.map(({ deliverySlotId, dayRelation, cutoffTime }) => ({ deliverySlotId, dayRelation, cutoffTime })) ?? [{ deliverySlotId: slotChoices[0]?.id ?? '', dayRelation: 'previous_day', cutoffTime: '15:00' }],
  }
  const form = useForm<FormValues, unknown, FormValues>({ resolver: zodResolver(buildSchema(feature)) as Resolver<FormValues, unknown, FormValues>, defaultValues: defaults, mode: 'onBlur' })
  const fields = useFieldArray({ control: form.control, name: 'conditions' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [coverageConfirm, setCoverageConfirm] = useState(false)
  const [pendingValues, setPendingValues] = useState<(FormValues & { confirmRemovePins?: boolean }) | null>(null)
  const deliveryMethod = useWatch({ control: form.control, name: 'deliveryMethod' })
  const coverageType = useWatch({ control: form.control, name: 'coverageType' })
  const selectedAreaId = useWatch({ control: form.control, name: 'serviceAreaId' })
  const selectedCutoffId = useWatch({ control: form.control, name: 'cutoffRuleId' })
  const profileName = useWatch({ control: form.control, name: 'name' })
  const planning = useWatch({ control: form.control, name: 'includeInProductionPlanning' })
  const selectedArea = areaChoices.find(area => area.id === selectedAreaId)
  const selectedCutoff = cutoffChoices.find(rule => rule.id === selectedCutoffId)
  const isEdit = Boolean(existing)
  const isDirty = form.formState.isDirty
  const requestCancel = () => {
    if (isEdit && isDirty) {
      setDiscardConfirm(true)
      return
    }
    onCancel()
  }
  useEffect(() => {
    if (feature !== 'fulfilment-profiles' || !deliveryMethod) return
    const currentArea = serviceAreaService.getById(form.getValues('serviceAreaId'))
    const compatible = currentArea?.status === 'active' && (deliveryMethod === 'local_delivery' ? currentArea.coverageType === 'pin_code' : currentArea.coverageType !== 'pin_code')
    if (!compatible) {
      const firstAvailable = serviceAreaService.list().find(area => area.status === 'active' && (deliveryMethod === 'local_delivery' ? area.coverageType === 'pin_code' : area.coverageType !== 'pin_code'))
      form.setValue('serviceAreaId', firstAvailable?.id ?? '', { shouldValidate: true, shouldDirty: true })
    }
    if (deliveryMethod === 'shipping') {
      form.setValue('cutoffRuleId', '', { shouldDirty: true })
      form.setValue('includeInProductionPlanning', false, { shouldDirty: true })
    }
  }, [deliveryMethod, feature, form])
  const persistValues = async (values: FormValues) => {
    setSaving(true); setSaveError('')
    try { await new Promise(resolve => window.setTimeout(resolve, 120)); const record = saveRecord(feature, values, existing?.id); toast.success(`${meta.singular} saved.`); onSaved(record) }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to save this configuration.') }
    finally { setSaving(false) }
  }
  const submit = form.handleSubmit(async values => {
    const existingArea = existing as ServiceArea | undefined
    if (feature === 'service-areas' && existingArea?.coverageType === 'pin_code' && values.coverageType !== 'pin_code' && existingArea.pinCodes.length > 0) {
      setPendingValues({ ...values, confirmRemovePins: true })
      setCoverageConfirm(true)
      return
    }
    await persistValues(values)
  })
  const fieldError = (name: keyof FormValues) => form.formState.errors[name]?.message?.toString()
  return <div className="workspace-page">
    <header className="page-header page-header-form"><div className="page-title-row"><Link className="title-back-button" href="#" onClick={event => { event.preventDefault(); requestCancel() }} aria-label={`Back to ${meta.plural}`}><ArrowLeft size={19} /></Link><div><PageBreadcrumbs items={[{ label: groupOf(feature).label }, { label: meta.plural, href: `/${groupOf(feature).path}/${feature}` }, { label: isEdit ? 'Edit' : 'New' }]} /><h1>{isEdit ? `Edit ${meta.singular}` : `New ${meta.singular}`}</h1><p className="page-description">{isEdit ? 'Update this reusable configuration.' : 'Create a configuration to use across your delivery setup.'}</p></div></div></header>
    <form className="config-form" onSubmit={submit} noValidate>
      <section className="form-card"><div className="form-section-heading"><span>01</span><div><h2>Basic information</h2><p>Give this configuration a clear name and status.</p></div></div>
        <div className="form-grid"><Field label={`${meta.singular} name`} required error={fieldError('name')}><Input {...form.register('name')} placeholder={`Enter ${meta.singular.toLowerCase()} name`} /></Field>
          {feature === 'trial-plans' && <Field label="Duration" required helper="Duration is measured in days." error={fieldError('duration')}><div className="input-suffix"><Input type="number" min={1} step={1} aria-label="Duration in days" {...form.register('duration', { valueAsNumber: true })} /><span>Days</span></div></Field>}
          {feature === 'subscription-rules' && <Field label="System type" helper="System types are fixed. Customers choose days later during subscription setup.">{existing ? <><Input value={enumText(form.watch('systemType'))} disabled aria-label="Fixed system type" /><Input type="hidden" {...form.register('systemType')} /></> : <SelectField label="System type" value={form.watch('systemType')} onChange={value => form.setValue('systemType', value as FormValues['systemType'], { shouldDirty: true, shouldValidate: true })} placeholder="Choose a rule type" options={[{ value: 'daily', label: 'Daily' }, { value: 'alternate_days', label: 'Alternate Days' }, { value: 'custom_weekdays', label: 'Custom Weekdays' }]} />}</Field>}
          {feature === 'delivery-slots' && <><Field label="Start time" required error={fieldError('startTime')}><Input type="time" {...form.register('startTime')} /></Field><Field label="End time" required error={fieldError('endTime')}><Input type="time" {...form.register('endTime')} /></Field></>}
          {feature === 'service-areas' && <><Field label="Coverage type" required><SelectField label="Coverage type" value={coverageType} onChange={value => form.setValue('coverageType', value as FormValues['coverageType'], { shouldDirty: true, shouldValidate: true })} placeholder="Select coverage" options={[{ value: 'pin_code', label: 'PIN Code Based' }, { value: 'state', label: 'State' }, { value: 'pan_india', label: 'Pan India' }]} /></Field>{coverageType !== 'pan_india' && <Field label="State" required error={fieldError('state')}><Input {...form.register('state')} placeholder="e.g. Gujarat" /></Field>}{coverageType === 'pin_code' && <Field label="City" required error={fieldError('city')}><Input {...form.register('city')} placeholder="e.g. Gandhinagar" /></Field>}</>}
          {feature === 'fulfilment-profiles' && <Field label="Delivery method" required><SelectField label="Delivery method" value={deliveryMethod} onChange={value => form.setValue('deliveryMethod', value as DeliveryMethod, { shouldDirty: true, shouldValidate: true })} placeholder="Select a method" options={[{ value: 'local_delivery', label: 'Local Delivery' }, { value: 'shipping', label: 'Shipping' }]} /></Field>}
          {feature === 'fulfilment-profiles' && <Field label="Coverage area" required helper={deliveryMethod === 'local_delivery' ? 'Delivery slots are inherited from the area.' : 'Choose State or Pan India coverage.'} error={fieldError('serviceAreaId')}><SelectField label="Coverage area" value={selectedAreaId} onChange={value => form.setValue('serviceAreaId', value, { shouldDirty: true, shouldValidate: true })} placeholder="Choose a service area" options={areaChoices.filter(area => deliveryMethod === 'local_delivery' ? area.coverageType === 'pin_code' : area.coverageType !== 'pin_code').map(area => ({ value: area.id, label: `${area.name} · ${enumText(area.coverageType)}` }))} /></Field>}
          <Field label="Status"><SelectField label="Status" value={form.watch('status')} onChange={value => form.setValue('status', value as RecordStatus, { shouldDirty: true })} placeholder="Choose a status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Field>
          <Field label="Description" className="span-two"><Textarea rows={3} {...form.register('description')} placeholder="Add helpful context (optional)" /></Field>
        </div>
      </section>
      {feature === 'cutoff-rules' && <section className="form-card"><div className="form-section-heading"><span>02</span><div><h2>Cut-off conditions</h2><p>One condition per delivery slot. Inactive slots are unavailable for new rules.</p></div></div><div className="condition-list">{fields.fields.map((field, index) => <div className="condition-row" key={field.id}><Field label="Delivery slot" required error={form.formState.errors.conditions?.[index]?.deliverySlotId?.message}><SelectField label={`Delivery slot ${index + 1}`} value={form.watch(`conditions.${index}.deliverySlotId`)} onChange={value => form.setValue(`conditions.${index}.deliverySlotId`, value, { shouldDirty: true, shouldValidate: true })} placeholder="Choose a slot" options={slotChoices.map(slot => ({ value: slot.id, label: `${slot.name} · ${humanWindow(slot)}` }))} /></Field><Field label="Day relation" required><SelectField label={`Day relation ${index + 1}`} value={form.watch(`conditions.${index}.dayRelation`)} onChange={value => form.setValue(`conditions.${index}.dayRelation`, value as FormValues['conditions'][number]['dayRelation'], { shouldDirty: true, shouldValidate: true })} placeholder="Select day relation" options={[{ value: 'previous_day', label: 'Previous Day' }, { value: 'same_day', label: 'Same Day' }]} /></Field><Field label="Cut-off time" required error={form.formState.errors.conditions?.[index]?.cutoffTime?.message}><Input type="time" {...form.register(`conditions.${index}.cutoffTime`)} /></Field><AdminButton type="button" className="mini-action" onClick={() => fields.remove(index)} disabled={fields.fields.length < 2}>Remove</AdminButton></div>)}{fieldError('conditions') && <p className="field-error">{fieldError('conditions')}</p>}<AdminButton type="button" className="secondary-button" onClick={() => fields.append({ deliverySlotId: '', dayRelation: 'same_day', cutoffTime: '' })}><Plus size={14} /> Add slot rule</AdminButton></div><div className="preview-list">{(form.watch('conditions') ?? []).filter(condition => condition.deliverySlotId && condition.cutoffTime).map((condition, index) => <p key={`${condition.deliverySlotId}-${index}`}>{cutoffPreview(condition, slotChoices.find(slot => slot.id === condition.deliverySlotId))}</p>)}</div></section>}
      {feature === 'fulfilment-profiles' && deliveryMethod === 'local_delivery' && <section className="form-card"><div className="form-section-heading"><span>02</span><div><h2>Local delivery settings</h2><p>Slots remain inherited from the selected service area.</p></div></div><div className="form-grid"><Field label="Delivery slots"><div className="inherit-box"><Truck size={16} />{selectedArea ? `Inherited from ${selectedArea.name}` : 'Based on customer PIN code'}<small>{selectedArea?.pinCodes.length ?? 0} PIN records · available slots determined per PIN</small></div></Field><Field label="Cut-off rule"><SelectField label="Cut-off rule" value={selectedCutoffId} onChange={value => form.setValue('cutoffRuleId', value === '__none__' ? '' : value, { shouldDirty: true })} placeholder="Select a cut-off rule" options={[{ value: '__none__', label: 'None' }, ...cutoffChoices.map(rule => ({ value: rule.id, label: rule.name }))]} /></Field></div></section>}
      {feature === 'fulfilment-profiles' && deliveryMethod === 'shipping' && <section className="form-card"><div className="form-section-heading"><span>02</span><div><h2>Shipping coverage</h2><p>Local slots and cut-off settings do not apply to shipping.</p></div></div><div className="inherit-box"><MapPin size={16} />{selectedArea?.name ?? 'Choose a State or Pan India service area'}</div></section>}
      {feature === 'fulfilment-profiles' && <section className="form-card"><div className="form-section-heading"><span>03</span><div><h2>Production planning</h2><p>Choose whether products using this profile contribute scheduled quantities.</p></div></div><div className="toggle-row"><Switch id="include-production-planning" aria-label="Include in production planning" checked={form.watch('includeInProductionPlanning')} onCheckedChange={checked => form.setValue('includeInProductionPlanning', checked, { shouldDirty: true })} disabled={deliveryMethod === 'shipping'} /><label htmlFor="include-production-planning"><strong>Include in Production Planning</strong><small>When enabled, products using this profile can contribute scheduled quantities to production planning.</small></label></div>{deliveryMethod === 'shipping' && <p className="help-text">Production planning is disabled for shipping profiles.</p>}</section>}
      {feature === 'fulfilment-profiles' && <aside className="summary-card"><p className="eyebrow">Live summary</p><h2>{profileName || 'Fulfilment profile'}</h2><SummaryRow label="Delivery" value={enumText(deliveryMethod ?? 'local_delivery')} /><SummaryRow label="Coverage" value={selectedArea?.name ?? 'Not selected'} /><SummaryRow label="Slots" value={deliveryMethod === 'shipping' ? 'None' : 'Based on customer PIN code'} /><SummaryRow label="Cut-off" value={deliveryMethod === 'shipping' ? 'None' : selectedCutoff?.name ?? 'None'} /><SummaryRow label="Production planning" value={deliveryMethod === 'shipping' ? 'Disabled' : planning ? 'Enabled' : 'Disabled'} /></aside>}
      {feature === 'subscription-rules' && form.watch('systemType') === 'custom_weekdays' && <section className="form-card"><div className="form-section-heading"><span>02</span><div><h2>Weekday capability</h2><p>Illustrative capability only; customers choose weekdays when subscribing.</p></div></div><div className="weekday-preview">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div></section>}
      {feature === 'delivery-slots' && <div className="preview-strip"><Clock3 size={16} /><span>{form.watch('name') ? `${form.watch('name')} deliveries` : 'Deliveries'} run from {formatTime(form.watch('startTime') || '06:00')} to {formatTime(form.watch('endTime') || '09:00')}.</span></div>}
      {saveError && <div role="alert" className="form-error-banner">{saveError}</div>}
      <div className="save-bar"><AdminButton type="button" className="secondary-button" onClick={requestCancel}>Cancel</AdminButton><AdminButton type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : <><Check size={15} /> Save {meta.singular}</>}</AdminButton></div>
      <AlertDialog open={discardConfirm} onOpenChange={setDiscardConfirm}>{discardConfirm && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Unsaved changes</p><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your changes haven’t been saved. If you leave this page, you’ll lose them.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton type="button" variant="outline" className="secondary-button">Stay on this page</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton type="button" className="primary-button" onClick={onCancel}>Discard changes</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
      <AlertDialog open={coverageConfirm && Boolean(pendingValues)} onOpenChange={open => { if (!open) setCoverageConfirm(false) }}>{coverageConfirm && pendingValues && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">PIN coverage will change</p><AlertDialogTitle>Change coverage type?</AlertDialogTitle><AlertDialogDescription>This service area has {(existing as ServiceArea | undefined)?.pinCodes.length ?? 0} PIN records. Continuing will permanently remove these PIN records and their delivery-slot assignments from this mock configuration when coverage changes to {enumText(pendingValues.coverageType ?? 'state')}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><AdminButton type="button" variant="outline" className="secondary-button" onClick={() => setPendingValues(null)}>Cancel and keep PIN records</AdminButton></AlertDialogCancel><AlertDialogAction asChild><AdminButton type="button" className="primary-button" onClick={() => { setCoverageConfirm(false); void persistValues(pendingValues) }}>Continue and remove PINs</AdminButton></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}</AlertDialog>
    </form>
  </div>
}

function cutoffPreview(condition: { deliverySlotId: string; dayRelation: string; cutoffTime: string }, slot?: DeliverySlot) { const day = condition.dayRelation === 'previous_day' ? 'tomorrow' : 'this'; const time = formatTime(condition.cutoffTime); return `Orders for ${day} ${slot?.name.toLowerCase() ?? 'delivery'} must be placed before ${time} ${condition.dayRelation === 'previous_day' ? 'today' : 'today'}.` }

function RecordDetail({ feature, record, onEdit, onList }: { feature: FeatureKey; record: FeatureRecord; onEdit: () => void; onList: () => void }) {
  const router = useRouter()
  const db = configurationService.referenceData()
  const [pinQuery, setPinQuery] = useState('')
  const [pinSlot, setPinSlot] = useState('all')
  const [pinStatusFilter, setPinStatusFilter] = useState('all')
  const [pinPage, setPinPage] = useState(0)
  const [pinError, setPinError] = useState('')
  const [showPinForm, setShowPinForm] = useState(false)
  const [editingPinId, setEditingPinId] = useState<string | null>(null)
  const [pinStatus, setPinStatus] = useState<RecordStatus>('active')
  const [pinValue, setPinValue] = useState('')
  const [localityValue, setLocalityValue] = useState('')
  const [slotIds, setSlotIds] = useState<string[]>([])
  const area = record as ServiceArea
  const isAreaDetail = feature === 'service-areas'
  const filteredPins = isAreaDetail ? area.pinCodes.filter(pin => `${pin.pinCode} ${pin.locality}`.toLowerCase().includes(pinQuery.toLowerCase()) && (pinSlot === 'all' || pin.allowedDeliverySlotIds.includes(pinSlot)) && (pinStatusFilter === 'all' || pin.status === pinStatusFilter)) : []
  const pinRows = filteredPins.slice(pinPage * 8, (pinPage + 1) * 8)
  const cutoff = record as CutoffRule
  const profile = record as FulfilmentProfile
  const profileArea = db.areas.find(item => item.id === profile.serviceAreaId)
  const addPin = () => {
    setPinError('')
    if (!/^([1-9]\d{5})$/.test(pinValue)) return setPinError('Enter a valid 6-digit Indian PIN code.')
    if (!slotIds.length) return setPinError('Choose at least one delivery slot.')
    if (area.pinCodes.some(pin => pin.pinCode === pinValue && pin.id !== editingPinId)) return setPinError('This PIN code already exists in this service area.')
    const next: PinCodeRecord = { id: editingPinId ?? `pin-${pinValue}`, pinCode: pinValue, locality: localityValue.trim(), allowedDeliverySlotIds: slotIds, status: pinStatus }
    const nextPins = editingPinId ? area.pinCodes.map(pin => pin.id === editingPinId ? next : pin) : [...area.pinCodes, next]
    serviceAreaService.save({ ...area, pinCodes: nextPins })
    toast.success(editingPinId ? `PIN code ${pinValue} updated.` : `PIN code ${pinValue} added.`); setEditingPinId(null); setPinValue(''); setLocalityValue(''); setSlotIds([]); setPinStatus('active'); setShowPinForm(false); router.refresh()
  }
  const editPin = (pin: PinCodeRecord) => { setEditingPinId(pin.id); setPinValue(pin.pinCode); setLocalityValue(pin.locality); setSlotIds(pin.allowedDeliverySlotIds); setPinStatus(pin.status); setPinError(''); setShowPinForm(true) }
  const meta = featureLabels[feature]
  return <div className="workspace-page"><header className="page-header page-header-form"><div className="page-title-row"><Link href="#" className="title-back-button" onClick={event => { event.preventDefault(); onList() }} aria-label={`Back to ${meta.plural}`}><ArrowLeft size={19} /></Link><div><PageBreadcrumbs items={[{ label: groupOf(feature).label }, { label: meta.plural, href: `/${groupOf(feature).path}/${feature}` }, { label: record.name }]} /><h1>{record.name}</h1><p className="page-description">{record.description || `Review this ${meta.singular.toLowerCase()} and its relationships.`}</p></div></div><div className="header-actions"><StatusBadge status={record.status}>{enumText(record.status)}</StatusBadge><AdminButton className="primary-button" onClick={onEdit}><Edit2 size={15} /> Edit {meta.singular}</AdminButton></div></header>
    <section className="detail-grid"><article className="form-card detail-card"><h2>Configuration details</h2>{feature === 'trial-plans' && <><SummaryRow label="Duration" value={`${(record as TrialPlan).duration} days`} /><SummaryRow label="Products using" value={`${configurationService.derivedCounts().trialPlans.get(record.id) ?? 0}`} /></>}{feature === 'subscription-rules' && <><SummaryRow label="System type" value={enumText((record as SubscriptionRule).systemType)} />{(record as SubscriptionRule).systemType === 'custom_weekdays' && <div className="weekday-preview">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day}>{day}</span>)}</div>}</>}{feature === 'delivery-slots' && <><SummaryRow label="Delivery window" value={humanWindow(record as DeliverySlot)} /><p className="preview-strip"><Clock3 size={16} /> Deliveries run from {humanWindow(record as DeliverySlot)}.</p></>}{feature === 'service-areas' && <><SummaryRow label="Coverage type" value={enumText(area.coverageType)} /><SummaryRow label="Location" value={area.coverageType === 'pan_india' ? 'All India' : [area.city, area.state].filter(Boolean).join(', ')} /><SummaryRow label="PIN codes" value={String(area.pinCodes.length)} /></>}{feature === 'cutoff-rules' && <>{cutoff.conditions.map(condition => <SummaryRow key={condition.id} label={db.slots.find(slot => slot.id === condition.deliverySlotId)?.name ?? 'Unavailable slot'} value={`${enumText(condition.dayRelation)} · ${formatTime(condition.cutoffTime)}`} />)}</>}{feature === 'fulfilment-profiles' && <><SummaryRow label="Delivery method" value={enumText(profile.deliveryMethod)} /><SummaryRow label="Coverage" value={profileArea?.name ?? 'Unavailable service area'} /><SummaryRow label="Delivery slots" value={profile.deliveryMethod === 'shipping' ? 'None' : 'Inherited from service area'} /><SummaryRow label="Cut-off rule" value={db.cutoffs.find(item => item.id === profile.cutoffRuleId)?.name ?? 'None'} /><SummaryRow label="Production planning" value={profile.includeInProductionPlanning ? 'Enabled' : 'Disabled'} /></>}</article><aside className="form-card"><h2>Record information</h2><SummaryRow label="Status" value={enumText(record.status)} /><SummaryRow label="Last updated" value={formatDate(record.updatedAt)} /></aside></section>
    {feature === 'cutoff-rules' && <section className="section-block detail-section"><div className="section-heading"><div><h2>Ordering deadline previews</h2><p>Plain-language explanation for each delivery slot.</p></div></div><div className="preview-list">{cutoff.conditions.map(condition => <p key={condition.id}>{cutoffPreview(condition, db.slots.find(slot => slot.id === condition.deliverySlotId))}</p>)}</div></section>}
    {isAreaDetail && area.coverageType === 'pin_code' && <section className="section-block detail-section"><div className="section-heading"><div><h2>PIN code coverage</h2><p>Delivery availability is configured by slot ID for each PIN.</p></div><AdminButton className="primary-button" onClick={() => setShowPinForm(value => !value)}><Plus size={15} /> Add PIN code</AdminButton></div>
      {showPinForm && <div className="pin-editor"><Field label="PIN code" required><Input inputMode="numeric" maxLength={6} value={pinValue} onChange={event => setPinValue(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="382010" /></Field><Field label="Area / locality"><Input value={localityValue} onChange={event => setLocalityValue(event.target.value)} placeholder="Sector 10" /></Field><Field label="Status"><SelectField label="PIN status" className="config-select" value={pinStatus} onChange={value => setPinStatus(value as RecordStatus)} placeholder="Choose a status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Field><div className="form-field"><label>Available delivery slots *</label><div className="slot-checkboxes">{db.slots.map(slot => <label key={slot.id}><Checkbox checked={slotIds.includes(slot.id)} onCheckedChange={checked => setSlotIds(value => checked === true ? [...value, slot.id] : value.filter(id => id !== slot.id))} disabled={slot.status === 'inactive' && !slotIds.includes(slot.id)} />{slot.name}<small>{humanWindow(slot)}{slot.status === 'inactive' ? ' · Inactive' : ''}</small></label>)}</div></div>{pinError && <p className="field-error">{pinError}</p>}<div className="dialog-actions"><AdminButton className="secondary-button" onClick={() => { setShowPinForm(false); setEditingPinId(null) }}>Cancel</AdminButton><AdminButton className="primary-button" onClick={addPin}>{editingPinId ? 'Update PIN code' : 'Save PIN code'}</AdminButton></div></div>}
      <label className="workspace-search"><Search size={17} aria-hidden="true" /><Input className="workspace-search-input" value={pinQuery} onChange={event => { setPinQuery(event.target.value); setPinPage(0) }} placeholder="Search PIN or locality" /></label>
      <div className="config-filter-row"><SelectField label="Filter by delivery slot" className="config-select product-select-trigger" value={pinSlot} onChange={value => { setPinSlot(value); setPinPage(0) }} placeholder="All delivery slots" options={[{ value: 'all', label: 'All delivery slots' }, ...db.slots.map(slot => ({ value: slot.id, label: slot.name }))]} /><SelectField label="Filter PIN code status" className="config-select product-select-trigger" value={pinStatusFilter} onChange={value => { setPinStatusFilter(value); setPinPage(0) }} placeholder="All statuses" options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></div>
      <div className="table-card"><div className="table-scroll"><Table><TableHeader><TableRow><TableHead>PIN Code</TableHead><TableHead>Area / Locality</TableHead><TableHead>Available Delivery Slots</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{pinRows.map(pin => <TableRow key={pin.id}><TableCell className="order-id">{pin.pinCode}</TableCell><TableCell>{pin.locality || '—'}</TableCell><TableCell>{pin.allowedDeliverySlotIds.map(id => db.slots.find(slot => slot.id === id)?.name ?? 'Inactive slot').join(', ')}</TableCell><TableCell><StatusBadge status={pin.status}>{enumText(pin.status)}</StatusBadge></TableCell><TableCell><AdminButton className="mini-action" onClick={() => editPin(pin)}>Edit</AdminButton></TableCell></TableRow>)}{pinRows.length === 0 && <TableRow><TableCell colSpan={5}><div className="empty-table">No PIN codes match this filter.</div></TableCell></TableRow>}</TableBody></Table></div><div className="table-footer"><span>{filteredPins.length} matching PIN records</span><div><TablePagination page={pinPage + 1} pageCount={Math.max(1, Math.ceil(filteredPins.length / 8))} onPageChange={nextPage => setPinPage(nextPage - 1)} /></div></div></div>
    </section>}
    </div>
}
