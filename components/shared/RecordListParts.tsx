'use client'

import { CircleCheck, CircleOff, Edit2, MoreHorizontal, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { tc } from '@/lib/i18n/common'

const statusOptions = () => [{ value: 'all', label: tc('allStatuses') }, { value: 'active', label: tc('active') }, { value: 'inactive', label: tc('inactive') }]

/** Search box, status filter and result count shared by the master-data and content lists. */
export function RecordListToolbar({ noun, query, onQueryChange, status, onStatusChange, count }: { noun: string; query: string; onQueryChange: (value: string) => void; status: string; onStatusChange: (value: string) => void; count: number }) {
  return <>
    <label className="workspace-search"><Search size={17} aria-hidden="true" /><Input className="workspace-search-input" value={query} onChange={event => onQueryChange(event.target.value)} placeholder={tc('searchNoun', { noun })} aria-label={tc('searchNounLabel', { noun })} /></label>
    <div className="config-filter-row"><SelectField label={tc('filterByStatus')} className="config-select product-select-trigger" value={status} onChange={onStatusChange} placeholder={tc('allStatuses')} options={statusOptions()} /><span className="record-count">{tc('countNoun', { count, noun })}</span></div>
  </>
}

/** Edit button plus an overflow menu with Edit, Activate / Deactivate and, where the record can be deleted, Delete. */
export function RecordRowActions({ name, active, onEdit, onToggle, onDelete }: { name: string; active: boolean; onEdit: () => void; onToggle: () => void; onDelete?: () => void }) {
  return <div className="row-actions">
    <Button variant="ghost" size="icon" className="row-edit-action" aria-label={tc('editName', { name })} onClick={onEdit}><Edit2 size={15} /></Button>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={tc('actionsFor', { name })}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem onSelect={onEdit}><Edit2 /> {tc('edit')}</DropdownMenuItem><DropdownMenuItem onSelect={onToggle}>{active ? <CircleOff /> : <CircleCheck />}{active ? tc('deactivate') : tc('activate')}</DropdownMenuItem>{onDelete && <DropdownMenuItem onSelect={onDelete}><Trash2 /> {tc('delete')}</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
  </div>
}

/** Explains what deactivating affects before it happens; the service rechecks on the server side later. */
export function DeactivateDialog({ open, noun, name, consequence, onCancel, onConfirm }: { open: boolean; noun: string; name: string; consequence: string; onCancel: () => void; onConfirm: () => void }) {
  return <AlertDialog open={open} onOpenChange={next => { if (!next) onCancel() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">{tc('deactivateNoun', { noun })}</p>
        <AlertDialogTitle>{tc('deactivateName', { name })}</AlertDialogTitle>
        <AlertDialogDescription>{consequence}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">{tc('keepActive')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" onClick={onConfirm}>{tc('deactivate')}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
