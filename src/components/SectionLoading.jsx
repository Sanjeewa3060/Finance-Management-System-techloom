import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** Shared loading feedback for every dashboard route and query-based tab. */
export default function SectionLoading({ loading, children }) {
  const location = useLocation()
  const routeKey = `${location.pathname}${location.search}`
  const [readyKey, setReadyKey] = useState(null)
  const busy = loading || readyKey !== routeKey

  useEffect(() => {
    const timer = setTimeout(() => setReadyKey(routeKey), 250)
    return () => clearTimeout(timer)
  }, [routeKey])

  return (
    <div className="relative min-h-40" aria-busy={busy}>
      {busy && (
        <div className="absolute inset-x-0 top-0 flex min-h-40 items-center justify-center gap-3" role="status" aria-live="polite">
          <span className="h-6 w-6 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 motion-safe:animate-spin" aria-hidden="true" />
          <span className="text-sm text-slate-400">Loading section…</span>
        </div>
      )}
      <div className={busy ? 'invisible' : ''} inert={busy ? true : undefined} aria-hidden={busy ? true : undefined}>
        {children}
      </div>
    </div>
  )
}
