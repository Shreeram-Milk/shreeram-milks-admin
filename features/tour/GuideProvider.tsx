'use client'

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { Pause, Play, SkipForward, X } from 'lucide-react'
import { t } from './messages'
import { TOURS, type TourName } from './registry'
import type { DemoStage } from './workflow-demo/model'

const WorkflowDemo = lazy(() => import('./workflow-demo/WorkflowDemo'))

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
  /** Isolated example scene on the real route, for workflows that must show saving or money movement without doing either. */
  demo?: DemoStage
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
  const pausedRef = useRef(false)
  const [failed, setFailed] = useState(false)
  // How much of the step's clip has been heard (0 to 1): the caption shows the words up to there, like live subtitles.
  const [heard, setHeard] = useState(0)
  const audio = useRef<HTMLAudioElement | null>(null)
  const pathRef = useRef(pathname)
  useEffect(() => { pathRef.current = pathname }, [pathname])
  const tour = name ? TOURS[name] : null
  const step = tour?.steps[index] ?? null

  const finish = useCallback(() => {
    audio.current?.pause(); audio.current = null
    const leave = name ? TOURS[name].leave : undefined
    pausedRef.current = false
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
      pausedRef.current = false
      setPaused(false); setIndex(0); setName(wanted)
    }).catch(() => setFailed(true))
  }, [])

  // One step: go to its page, open what it needs, light it up, play the clip while filling the example, then move on.
  useEffect(() => {
    if (!step || !clips || !name) return
    let alive = true
    let after: number | undefined
    let sound: HTMLAudioElement | null = null
    let frame = 0
    const place = () => { if (alive) setSpot(spotOf(step.target)) }
    void (async () => {
      setSpot(null)
      setHeard(0)
      if (step.closeFirst) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300) }
      if (step.page && pathRef.current !== step.page.split('?')[0]) { router.push(step.page); await wait(400) }
      let element = await waitFor(step.target, step.page ? 6000 : step.open ? 400 : 3000)
      if (!alive) return
      if (step.open) {
        const opener = await waitFor(step.open, 3000)
        if (!alive) return
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
        const playing = sound
        const follow = () => {
          if (!alive) return
          if (playing.duration > 0) setHeard(Math.min(1, playing.currentTime / playing.duration))
          frame = window.requestAnimationFrame(follow)
        }
        frame = window.requestAnimationFrame(follow)
        sound.onended = () => { setHeard(1); after = window.setTimeout(next, 500) }
        sound.onerror = () => { setHeard(1); after = window.setTimeout(next, 5000) }
        // A browser that will not play sound before a click: show the whole sentence instead of waiting for the voice.
        if (!pausedRef.current) void sound.play().catch(() => { if (alive) { pausedRef.current = true; setPaused(true); setHeard(1) } })
      } else { setHeard(1); after = window.setTimeout(next, 5000) }
      if (step.fill && element) { await wait(900); if (alive) { await doFill(element, step.fill, () => alive); place() } }
    })()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      alive = false
      window.clearTimeout(after)
      window.cancelAnimationFrame(frame)
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
    if (sound.paused) {
      pausedRef.current = false; setPaused(false)
      void sound.play().catch(() => { pausedRef.current = true; setPaused(true) })
    } else { sound.pause(); pausedRef.current = true; setPaused(true) }
  }

  const value = useMemo<Guide>(() => ({ play, playing: name }), [play, name])
  // The pill sits at the top, out of the way; only when the lit-up part is right under it does it move to the bottom.
  const atBottom = Boolean(spot && spot.top < 150)
  const words = step ? step.text.split(' ') : []
  const said = Math.ceil(words.length * heard)
  // Shown one short phrase at a time (ending at a full stop or comma, at most 8 words), like live captions.
  const phrases: number[][] = []
  words.forEach((word, position) => {
    const last = phrases[phrases.length - 1]
    if (!last || last.length >= 8) phrases.push([position]); else last.push(position)
    if (/[.,?!]$/.test(word)) phrases.push([])
  })
  const filled = phrases.filter(phrase => phrase.length > 0)
  const current = filled.find(phrase => phrase.some(position => position >= Math.max(0, said - 1))) ?? filled[filled.length - 1] ?? []
  return <GuideContext.Provider value={value}>
    <div style={{ display: 'contents' }} inert={Boolean(step?.demo)}>{children}</div>
    {step?.demo ? <Suspense fallback={null}><WorkflowDemo stage={step.demo} /></Suspense> : null}
    {failed ? <div className="tour-failed" role="alert" data-tour-ui="">{t('notReady')}</div> : null}
    {step && tour && typeof document !== 'undefined' ? createPortal(<div className="tour-layer" data-tour-ui="" role="dialog" aria-modal="false" aria-label={tour.title}>
      {spot ? <div className="tour-spot" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} aria-hidden="true" /> : <div className="tour-dim" aria-hidden="true" />}
      <div className={`tour-pill-wrap${atBottom ? ' at-bottom' : ''}`}>
        <div className={`tour-pill${paused ? ' is-paused' : ''}`}>
          <span className="tour-orb" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          {/* The whole sentence for screen readers; on screen, the current phrase with each word appearing as it is spoken. */}
          <p className="tour-caption" lang="gu" aria-label={step.text}>{current.map(position => <span key={`${index}-${position}`} aria-hidden="true" className={position < said ? 'is-said' : undefined}>{words[position]} </span>)}</p>
          <span className="tour-count" aria-hidden="true">{index + 1}/{tour.steps.length}</span>
          <span className="tour-pill-actions">
            <button type="button" className="tour-round" onClick={togglePause} aria-label={paused ? t('resume') : t('pause')}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
            <button type="button" className="tour-round is-main" onClick={next} aria-label={index + 1 >= tour.steps.length ? t('finish') : t('next')}><SkipForward size={14} /></button>
            <button type="button" className="tour-round" onClick={finish} aria-label={t('close')}><X size={14} /></button>
          </span>
        </div>
        {step.example ? <span className="tour-chip" lang="gu"><b>{t('example')}</b>{step.example}</span> : null}
      </div>
    </div>, document.body) : null}
  </GuideContext.Provider>
}
