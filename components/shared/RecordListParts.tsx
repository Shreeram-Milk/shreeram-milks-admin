'use client'

import { CircleCheck, CircleOff, Edit2, MoreHorizontal, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const STATUS_OPTIONS = [{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]

/** Search box, status filter and result count shared by the master-data and content lists. */
export function RecordListToolbar({ noun, query, onQueryChange, status, onStatusChange, count }: { noun: string; query: string; onQueryChange: (value: string) => void; status: string; onStatusChange: (value: string) => void; count: number }) {
  return <>
    <label className="workspace-search"><Search size={17} aria-hidden="true" /><Input className="workspace-search-input" value={query} onChange={event => onQueryChange(event.target.value)} placeholder={`Search ${noun}...`} aria-label={`Search ${noun}`} /></label>
    <div className="config-filter-row"><SelectField label="Filter by status" className="config-select product-select-trigger" value={status} onChange={onStatusChange} placeholder="All statuses" options={STATUS_OPTIONS} /><span className="record-count">{count} {noun}</span></div>
  </>
}

/** Edit button plus an overflow menu with Edit and Activate / Deactivate. */
export function RecordRowActions({ name, active, onEdit, onToggle }: { name: string; active: boolean; onEdit: () => void; onToggle: () => void }) {
  return <div className="row-actions">
    <Button variant="ghost" size="icon" className="row-edit-action" aria-label={`Edit ${name}`} onClick={onEdit}><Edit2 size={15} /></Button>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={`Actions for ${name}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem onSelect={onEdit}><Edit2 /> Edit</DropdownMenuItem><DropdownMenuItem onSelect={onToggle}>{active ? <CircleOff /> : <CircleCheck />}{active ? 'Deactivate' : 'Activate'}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </div>
}

/** Explains what deactivating affects before it happens; the service rechecks on the server side later. */
export function DeactivateDialog({ open, noun, name, consequence, onCancel, onConfirm }: { open: boolean; noun: string; name: string; consequence: string; onCancel: () => void; onConfirm: () => void }) {
  return <AlertDialog open={open} onOpenChange={next => { if (!next) onCancel() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">Deactivate {noun}</p>
        <AlertDialogTitle>Deactivate “{name}”?</AlertDialogTitle>
        <AlertDialogDescription>{consequence}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Keep Active</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" onClick={onConfirm}>Deactivate</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
