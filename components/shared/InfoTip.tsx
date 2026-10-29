'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { tc } from '@/lib/i18n/common'

/** A small "i" button that explains a screen or setting in plain words. Works with mouse, keyboard focus and touch. */
export function InfoTip({ label, text, className }: { label: string; text: string; className?: string }) {
  return <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={`info-tip ${className ?? ''}`} aria-label={tc('whatIs', { label })}><Info size={14} aria-hidden="true" /></button>
      </TooltipTrigger>
      <TooltipContent side="right" className="info-tip-content">{text}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
}
