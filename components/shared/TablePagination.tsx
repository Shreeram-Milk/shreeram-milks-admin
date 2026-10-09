'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'

type TablePaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  density?: 'compact' | 'default'
}

export function TablePagination({ page, pageCount, onPageChange, density = 'default' }: TablePaginationProps) {
  const previousDisabled = page <= 1
  const nextDisabled = page >= pageCount
  const changePage = (event: MouseEvent<HTMLAnchorElement>, nextPage: number, disabled: boolean) => {
    event.preventDefault()
    if (!disabled) onPageChange(nextPage)
  }
  const disabledClass = 'pointer-events-none opacity-40'

  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        {density === 'compact' ? (
          <>
            <PaginationItem><PaginationLink href="#" size="icon" aria-label="Previous page" aria-disabled={previousDisabled} tabIndex={previousDisabled ? -1 : 0} className={`mini-action ${previousDisabled ? disabledClass : ''}`} onClick={event => changePage(event, page - 1, previousDisabled)}><ChevronLeft size={16} /></PaginationLink></PaginationItem>
            <PaginationItem><PaginationLink href="#" size="icon" aria-label="Next page" aria-disabled={nextDisabled} tabIndex={nextDisabled ? -1 : 0} className={`mini-action ${nextDisabled ? disabledClass : ''}`} onClick={event => changePage(event, page + 1, nextDisabled)}><ChevronRight size={16} /></PaginationLink></PaginationItem>
          </>
        ) : (
          <>
            <PaginationItem><PaginationPrevious href="#" aria-disabled={previousDisabled} tabIndex={previousDisabled ? -1 : 0} className={`pagination-button ${previousDisabled ? disabledClass : ''}`} onClick={event => changePage(event, page - 1, previousDisabled)} /></PaginationItem>
            <PaginationItem><PaginationNext href="#" aria-disabled={nextDisabled} tabIndex={nextDisabled ? -1 : 0} className={`pagination-button ${nextDisabled ? disabledClass : ''}`} onClick={event => changePage(event, page + 1, nextDisabled)} /></PaginationItem>
          </>
        )}
      </PaginationContent>
    </Pagination>
  )
}
