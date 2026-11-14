'use client'

import { useEffect, useRef } from 'react'
import { BookOpen, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGuide } from './GuideProvider'
import { t } from './messages'
import type { TourName } from './registry'

export type { Tour, TourStep } from './GuideProvider'

/** The button that plays one spoken guide. `autoStart` plays it once when the page opens (from a "How to add one" link). */
export function PageTour({ name, label, kind = 'about', autoStart = false }: { name: TourName; label?: string; kind?: 'about' | 'howTo' | 'start'; autoStart?: boolean }) {
  const { play } = useGuide()
  const started = useRef(false)
  useEffect(() => {
    if (!autoStart || started.current) return
    const timer = window.setTimeout(() => { started.current = true; play(name) }, 700)
    return () => window.clearTimeout(timer)
  }, [autoStart, name, play])
  const Icon = kind === 'howTo' ? BookOpen : Play
  return <Button type="button" className={`${kind === 'start' ? 'primary-button' : 'secondary-button'} tour-button`} onClick={() => play(name)} data-tour-ui="">
    <Icon size={15} aria-hidden="true" />{label ?? (kind === 'howTo' ? t('howTo') : kind === 'start' ? t('startHere') : t('play'))}
  </Button>
}

/** Radix dialogs close when something outside them is clicked. The guide's own card must not count as "outside". */
export const keepOpenForTour = (event: { target: EventTarget | null; preventDefault: () => void }) => {
  if (event.target instanceof Element && event.target.closest('[data-tour-ui]')) event.preventDefault()
}
