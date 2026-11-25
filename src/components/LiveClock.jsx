import React, { useEffect, useState } from 'react'
import { formatLiveClock, formatLiveDate } from '../utils/dates.js'

function getTickMs() {
  if (typeof window === 'undefined') return 1000
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 60_000 : 1000
}

export default function LiveClock({ className = '', variant = 'default' }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let intervalId = null

    function tick() {
      setNow(new Date())
    }

    function startInterval() {
      if (intervalId !== null) window.clearInterval(intervalId)
      intervalId = window.setInterval(tick, getTickMs())
    }

    tick()
    startInterval()

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = () => startInterval()
    motionQuery.addEventListener('change', onMotionChange)

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId)
      motionQuery.removeEventListener('change', onMotionChange)
    }
  }, [])

  if (variant === 'topbar') {
    const dateLabel = formatLiveDate(now)
    const timeLabel = formatLiveClock(now, { showSeconds: true })
    return (
      <time
        dateTime={now.toISOString()}
        className={`topbar-datetime hidden min-w-0 flex-col items-end justify-center px-2.5 py-1 text-right sm:inline-flex ${className}`}
        aria-label={`${dateLabel}, ${timeLabel}`}
      >
        <span className="text-[10px] font-medium leading-tight text-slate-400 sm:text-[11px]">{dateLabel}</span>
        <span className="font-mono text-xs font-semibold leading-tight tabular-nums tracking-wide text-emerald-600 dark:text-emerald-300 sm:text-[13px]">
          {timeLabel}
        </span>
      </time>
    )
  }

  return (
    <div
      className={`live-clock flex min-w-0 items-center gap-2 tabular-nums ${className}`}
      aria-live="off"
      aria-label={`Current time ${formatLiveClock(now, { showSeconds: true })}`}
    >
      <time dateTime={now.toISOString()} className="live-clock__time text-sm font-medium text-slate-200 md:text-base">
        <span className="md:hidden">{formatLiveClock(now, { showSeconds: false })}</span>
        <span className="hidden md:inline">{formatLiveClock(now, { showSeconds: true })}</span>
      </time>
      <span className="live-clock__date hidden truncate text-xs text-slate-400 lg:inline">{formatLiveDate(now)}</span>
    </div>
  )
}
