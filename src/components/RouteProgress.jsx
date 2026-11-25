import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'

export const ROUTE_PROGRESS_EVENT = 'fms-route-progress'

/** Call before navigate() for instant feedback on sidebar / in-app links. */
export function startRouteProgress() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ROUTE_PROGRESS_EVENT))
}

function isInteractiveClickTarget(el) {
  if (!el || typeof el.closest !== 'function') return null
  return el.closest(
    'button, a[href], [role="button"], input[type="submit"], input[type="button"], summary',
  )
}

function shouldIgnoreInteractive(el) {
  if (!el) return true
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return true
  if (el.getAttribute('data-no-loader') === 'true') return true
  if (el.closest('[data-no-loader="true"]')) return true
  return false
}

function RouteProgressBar({ phase }) {
  if (phase === 'idle' || typeof document === 'undefined') return null
  return createPortal(
    <div
      className={`route-progress ${phase === 'finishing' ? 'route-progress--finishing' : 'route-progress--active'}`}
      role="progressbar"
      aria-busy="true"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Loading"
    >
      <div className="route-progress__bar" />
    </div>,
    document.body,
  )
}

/**
 * Reddit/EMS-style top bar on route changes and every button / link click.
 */
export default function RouteProgress() {
  const location = useLocation()
  const [phase, setPhase] = useState('idle')
  const firstLoad = useRef(true)
  const finishTimer = useRef(null)
  const idleTimer = useRef(null)
  const lastKey = useRef(`${location.pathname}${location.search}`)

  const clearTimers = useCallback(() => {
    if (finishTimer.current) clearTimeout(finishTimer.current)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    finishTimer.current = null
    idleTimer.current = null
  }, [])

  const begin = useCallback(() => {
    clearTimers()
    setPhase('loading')
  }, [clearTimers])

  const complete = useCallback(() => {
    clearTimers()
    setPhase((prev) => (prev === 'idle' ? 'idle' : 'finishing'))
    finishTimer.current = setTimeout(() => setPhase('idle'), 240)
  }, [clearTimers])

  const pulse = useCallback(
    (ms = 700) => {
      begin()
      idleTimer.current = setTimeout(() => complete(), ms)
    },
    [begin, complete],
  )

  // Manual start (sidebar / programmatic)
  useEffect(() => {
    function onManualStart() {
      pulse(900)
    }
    window.addEventListener(ROUTE_PROGRESS_EVENT, onManualStart)
    return () => window.removeEventListener(ROUTE_PROGRESS_EVENT, onManualStart)
  }, [pulse])

  // Every button / link click
  useEffect(() => {
    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return
      const target = isInteractiveClickTarget(e.target)
      if (!target || shouldIgnoreInteractive(target)) return
      pulse(700)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [pulse])

  // Every real route / query change
  useEffect(() => {
    const key = `${location.pathname}${location.search}`
    if (firstLoad.current) {
      firstLoad.current = false
      lastKey.current = key
      return undefined
    }
    if (key === lastKey.current) return undefined
    lastKey.current = key
    begin()
    idleTimer.current = setTimeout(() => complete(), 480)
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [location.pathname, location.search, begin, complete])

  useEffect(() => () => clearTimers(), [clearTimers])

  return <RouteProgressBar phase={phase} />
}
