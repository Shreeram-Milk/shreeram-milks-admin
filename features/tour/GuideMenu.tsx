'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { GraduationCap, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useGuide } from './GuideProvider'
import { t, type TourKey } from './messages'
import { TOURS, type TourName } from './registry'

/** The guides that walk across pages, in the order a new owner needs them. */
const FLOWS: Array<{ name: TourName; label: TourKey }> = [
  { name: 'start-here', label: 'flowStart' },
  { name: 'flow-morning', label: 'flowMorning' },
  { name: 'flow-pins', label: 'flowPins' },
  { name: 'flow-new-product', label: 'flowProduct' },
  { name: 'flow-credit', label: 'flowCredit' },
  { name: 'flow-cancelled', label: 'flowCancelled' },
  { name: 'flow-subscription', label: 'flowSubscription' },
  { name: 'flow-wallet', label: 'flowWallet' },
]

/** Which guide explains the page that is open: a list explains itself, a "new" form shows how one is made. */
const PAGES: Array<[RegExp, TourName]> = [
  [/^\/$/, 'start-here'],
  [/^\/orders\/?$/, 'orders'],
  [/^\/orders\/[^/]+$/, 'order-detail'],
  [/^\/deliveries\/?$/, 'deliveries'],
  [/^\/deliveries\/rider-sheet/, 'rider-sheet'],
  [/^\/production-planning/, 'production'],
  [/^\/subscriptions\/?$/, 'subscriptions'],
  [/^\/subscriptions\/[^/]+$/, 'subscription-detail'],
  [/^\/trials/, 'trials'],
  [/^\/support/, 'support'],
  [/^\/customers\/?$/, 'customers'],
  [/^\/customers\/[^/]+$/, 'customer-detail'],
  [/^\/prepaid-adjustments/, 'money-owed'],
  [/^\/credit-accounts\/?$/, 'credit'],
  [/^\/credit-accounts\/[^/]+$/, 'credit-detail'],
  [/^\/online-payments/, 'payments'],
  [/^\/wallet-refunds\/?$/, 'wallets'],
  [/^\/products\/?$/, 'products'],
  [/^\/products\/new$/, 'products-add'],
  [/^\/configuration\/categories/, 'categories'],
  [/^\/operations\/delivery-slots\/new$/, 'delivery-slots-add'],
  [/^\/operations\/delivery-slots\/?$/, 'delivery-slots'],
  [/^\/operations\/service-areas\/new$/, 'service-areas-add'],
  [/^\/operations\/service-areas\/[^/]+$/, 'service-areas-pins'],
  [/^\/operations\/service-areas\/?$/, 'service-areas'],
  [/^\/operations\/cutoff-rules\/new$/, 'cutoff-rules-add'],
  [/^\/operations\/cutoff-rules\/?$/, 'cutoff-rules'],
  [/^\/configuration\/trial-plans\/new$/, 'trial-plans-add'],
  [/^\/configuration\/trial-plans\/?$/, 'trial-plans'],
  [/^\/configuration\/subscription-rules\/new$/, 'subscription-rules-add'],
  [/^\/configuration\/subscription-rules\/?$/, 'subscription-rules'],
  [/^\/content\/banners\/new/, 'banners-add'],
  [/^\/content\/banners/, 'banners'],
  [/^\/content\/offers\/new/, 'offers-add'],
  [/^\/content\/offers/, 'offers'],
  [/^\/content\/faqs/, 'faqs'],
  [/^\/content\/policies/, 'policies'],
  [/^\/content\/onboarding/, 'onboarding'],
  [/^\/notifications\/templates/, 'messages-auto'],
  [/^\/notifications\/broadcasts/, 'messages-send'],
  [/^\/content\/app-settings/, 'app-settings'],
  [/^\/website\/home/, 'website'],
]
export const tourForPath = (path: string): TourName | null => PAGES.find(([pattern, name]) => pattern.test(path) && name in TOURS)?.[1] ?? null

/**
 * The top bar's guide controls: "This page" plays the guide for the page that is open, and "Guides" lists the walk-throughs that
 * move across pages. A link that ends in ?guide=1 (the "How to add one" buttons) starts the page's guide by itself.
 */
export function GuideMenu() {
  const { play, playing } = useGuide()
  const path = usePathname()
  const auto = useSearchParams().get('guide') === '1'
  const here = tourForPath(path)
  const startedFor = useRef('')

  useEffect(() => {
    if (!auto || !here || startedFor.current === path) return
    const timer = window.setTimeout(() => { startedFor.current = path; play(here) }, 800)
    return () => window.clearTimeout(timer)
  }, [auto, here, path, play])

  return <div className="guide-controls">
    {here ? <Button variant="outline" className="secondary-button tour-button" data-tour-ui="" disabled={playing === here} onClick={() => play(here)}><Play size={15} aria-hidden="true" />{t('thisPage')}</Button> : null}
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" className="secondary-button tour-button" data-tour="guide-menu"><GraduationCap size={16} aria-hidden="true" />{t('guides')}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="guide-menu">
        <DropdownMenuLabel>{t('guidesHint')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FLOWS.filter(flow => flow.name in TOURS).map((flow, index) => <DropdownMenuItem key={flow.name} onSelect={() => play(flow.name)}><span className="guide-menu-number">{index + 1}</span>{t(flow.label)}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
}
