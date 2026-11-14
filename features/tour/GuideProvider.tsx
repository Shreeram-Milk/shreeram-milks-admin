'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { Pause, Play, SkipForward, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from './messages'
import { TOURS, type TourName } from './registry'

/** What a step does to its part of the page while the voice explains it. It never presses Save. */
export type TourFill = {
  /** Types this into the box, letter by letter (times and numbers appear at once). */
  type?: string
  /** Picks the option whose words contain this, from a drop-down. "Milk|દૂધ" matches either language. */
  choose?: string
  /** Ticks (true) or unticks (false) the tick box. */
  tick?: boolean
  /** Presses the button whose words contain this (only choices like "The day before", never Save). */
  press?: string
  /** Which box inside the lit-up part, when it holds more than one (CSS selector). */
  field?: string
}
export type TourStep = {
  id: string
  /** The `data-tour` mark of the part this step lights up, or `css:<selector>`. */
  target: string
  text: string
  example?: string
  /** Go to this page first (a flow moves across pages). */
  page?: string
  /** Press this first when the target is not on screen yet (opens a form, a menu, a step of a long form). Same format as target. */
  open?: string
  fill?: TourFill
  /** Close an open pop-up first (the Escape key), for example after a size was filled in. */
  closeFirst?: boolean
}
/** `leave`: where to go when the guide ends, so a form it filled is thrown away and never saved. `escape` closes a pop-up. */
export type Tour = { title: string; steps: TourStep[]; leave?: { page?: string; escape?: boolean } }
type Spot = { top: number; left: number; width: number; height: number } | null
type Guide = { play: (name: TourName) => void; playing: TourName | null }

const PAD = 8
const GuideContext = createContext<Guide>({ play: () => undefined, playing: null })
export const useGuide = () => useContext(GuideContext)

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))
const find = (target: string): HTMLElement | null => target.startsWith('css:') ? document.querySelector<HTMLElement>(target.slice(4)) : document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
const visible = (element: HTMLElement | null) => Boolean(element && (element.offsetWidth > 0 || element.offsetHeight > 0))
async function waitFor(target: string, ms = 6000): Promise<HTMLElement | null> {
  for (let spent = 0; spent < ms; spent += 120) {
    const element = find(target)
    if (visible(element)) return element
    await wait(120)
  }
  return find(target)
}
function spotOf(target: string): Spot {
  const element = find(target)
  if (!visible(element) || !element) return null
  const rect = element.getBoundingClientRect()
  return { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
}

/** Sets a box's value the way typing does, so the page's form notices it. */
function setNative(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}
const pointer = (element: Element, type: string) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', pointerId: 1, isPrimary: true }))
/** A full mouse press: menus, tabs and drop-downs each listen to a different part of it. */
function press(element: HTMLElement) {
  pointer(element, 'pointerdown'); element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
  pointer(element, 'pointerup'); element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
  element.click()
}
const words = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

async function doFill(root: HTMLElement, fill: TourFill, alive: () => boolean) {
  const scope = fill.field ? root.querySelector<HTMLElement>(fill.field) ?? root : root
  if (fill.type !== undefined) {
    const box = scope.matches('input, textarea') ? scope as HTMLInputElement : scope.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]):not([type=checkbox]), textarea')
    if (!box) return
    box.focus({ preventScroll: true })
    if (box instanceof HTMLInputElement && ['time', 'number', 'date'].includes(box.type)) { setNative(box, fill.type); return }
    setNative(box, '')
    for (let index = 1; index <= fill.type.length && alive(); index += 1) { setNative(box, fill.type.slice(0, index)); await wait(70) }
    box.blur()
  }
  if (fill.choose !== undefined) {
    const wanted = fill.choose.toLowerCase().split('|')
    const trigger = scope.querySelector<HTMLElement>('[role="combobox"]') ?? (scope.matches('[role="combobox"]') ? scope : null)
    if (!trigger) return
    pointer(trigger, 'pointerdown')
    await wait(300)
    // A drop-down ignores the first mouse release after it opens (so the opening click cannot pick an option): spend it here.
    pointer(document.body, 'pointerup')
    await wait(80)
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => wanted.some(word => words(item).includes(word)))
    if (option) { pointer(option, 'pointermove'); press(option) } else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wait(150)
  }
  if (fill.tick !== undefined) {
    const box = scope.matches('[role="checkbox"]') ? scope : scope.querySelector<HTMLElement>('[role="checkbox"]')
    if (box && (box.getAttribute('aria-checked') === 'true') !== fill.tick) box.click()
  }
  if (fill.press !== undefined) {
    const wanted = fill.press.toLowerCase().split('|')
    const button = [...scope.querySelectorAll<HTMLElement>('button, [role="radio"], [role="tab"]')].find(item => wanted.some(word => words(item).includes(word)))
    if (button && !/save|સેવ|સાચવો|publish/i.test(words(button))) press(button)
  }
}

/**
 * The spoken guides, kept in the admin frame so one can walk across pages. Each step opens what it needs, lights up its part,
 * plays its clip and, on forms, fills in the example while the voice talks. It never saves; when it ends it leaves the form.
 */
export function GuideProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [name, setName] = useState<TourName | null>(null)
  const [index, setIndex] = useState(0)
  const [clips, setClips] = useState<Record<string, string> | null>(null)
  const [spot, setSpot] = useState<Spot>(null)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const pathRef = useRef(pathname)
  useEffect(() => { pathRef.current = pathname }, [pathname])
  const tour = name ? TOURS[name] : null
  const step = tour?.steps[index] ?? null

  const finish = useCallback(() => {
    audio.current?.pause(); audio.current = null
    const leave = name ? TOURS[name].leave : undefined
    setName(null); setIndex(0); setSpot(null); setPaused(false); setClips(null)
    if (leave?.escape) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    if (leave?.page && pathRef.current !== leave.page.split('?')[0]) router.push(leave.page)
  }, [name, router])
  const next = useCallback(() => {
    if (!tour) return
    if (index + 1 >= tour.steps.length) finish(); else setIndex(index + 1)
  }, [tour, index, finish])

  const play = useCallback((wanted: TourName) => {
    audio.current?.pause()
    setFailed(false)
    void fetch(`/tours/${wanted}/index.json`, { cache: 'no-cache' }).then(async response => {
      if (!response.ok) throw new Error(String(response.status))
      setClips(await response.json() as Record<string, string>)
      setPaused(false); setIndex(0); setName(wanted)
    }).catch(() => setFailed(true))
  }, [])

  // One step: go to its page, open what it needs, light it up, play the clip while filling the example, then move on.
  useEffect(() => {
    if (!step || !clips || !name) return
    let alive = true
    let after: number | undefined
    let sound: HTMLAudioElement | null = null
    const place = () => { if (alive) setSpot(spotOf(step.target)) }
    void (async () => {
      setSpot(null)
      if (step.closeFirst) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300) }
      if (step.page && pathRef.current !== step.page.split('?')[0]) { router.push(step.page); await wait(400) }
      let element = await waitFor(step.target, step.page ? 6000 : step.open ? 400 : 3000)
      if (step.open) {
        const opener = await waitFor(step.open, 3000)
        const folded = opener?.getAttribute('aria-expanded') === 'false'
        if (opener && (!visible(element) || folded)) { press(opener); element = await waitFor(step.target, 5000) }
      }
      if (!alive) return
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(place, 380)
      const clip = clips[step.id]
      sound = clip ? new Audio(`/tours/${name}/${clip}`) : null
      audio.current = sound
      if (sound) {
        sound.onended = () => { after = window.setTimeout(next, 500) }
        sound.onerror = () => { after = window.setTimeout(next, 5000) }
        void sound.play().catch(() => setPaused(true))
      } else after = window.setTimeout(next, 5000)
      if (step.fill && element) { await wait(900); if (alive) { await doFill(element, step.fill, () => alive); place() } }
    })()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      alive = false
      window.clearTimeout(after)
      window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place)
      sound?.pause()
    }
  }, [step, clips, name, next, router])

  useEffect(() => {
    if (!name) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && event.isTrusted) finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [name, finish])

  const togglePause = () => {
    const sound = audio.current
    if (!sound) return
    if (sound.paused) { void sound.play(); setPaused(false) } else { sound.pause(); setPaused(true) }
  }

  const value = useMemo<Guide>(() => ({ play, playing: name }), [play, name])
  return <GuideContext.Provider value={value}>
    {children}
    {failed ? <div className="tour-failed" role="alert" data-tour-ui="">{t('notReady')}</div> : null}
    {step && tour && typeof document !== 'undefined' ? createPortal(<div className="tour-layer" data-tour-ui="" role="dialog" aria-modal="false" aria-label={tour.title}>
      {spot ? <div className="tour-spot" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} aria-hidden="true" /> : <div className="tour-dim" aria-hidden="true" />}
      <div className="tour-card" aria-live="polite">
        <div className="tour-card-head"><span>{tour.title} · {t('stepOf', { step: index + 1, count: tour.steps.length })}</span>
          <button type="button" className="tour-icon" onClick={finish} aria-label={t('close')}><X size={16} /></button>
        </div>
        <p lang="gu">{step.text}</p>
        {step.example ? <div className="tour-example" lang="gu"><span>{t('example')}</span><strong>{step.example}</strong></div> : null}
        <div className="tour-progress" aria-hidden="true">{tour.steps.map((item, position) => <i key={item.id} className={position <= index ? 'is-done' : undefined} />)}</div>
        <div className="tour-actions">
          <Button type="button" variant="outline" className="secondary-button" onClick={togglePause}>{paused ? <><Play size={15} />{t('resume')}</> : <><Pause size={15} />{t('pause')}</>}</Button>
          <Button type="button" className="primary-button" onClick={next}><SkipForward size={15} />{index + 1 >= tour.steps.length ? t('finish') : t('next')}</Button>
        </div>
      </div>
    </div>, document.body) : null}
  </GuideContext.Provider>
}
