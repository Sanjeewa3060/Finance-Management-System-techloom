import React from 'react'
import { RefreshCw } from 'lucide-react'
import AppIcon from './AppIcon.jsx'

/** Shown at top of app when a new deploy is detected — user chooses when to refresh. */
export default function UpdateAvailableBanner({ onUpdate, onDismiss, checking = false, placement = 'top' }) {
  if (placement === 'inline') {
    return (
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/50 bg-transparent px-3 py-2 glass-soft"
        role="status"
        aria-live="polite"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-xs font-medium text-slate-900 dark:text-slate-100">New update available</span>
        <button
          type="button"
          onClick={onUpdate}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          <AppIcon icon={RefreshCw} size="sm" className={checking ? 'animate-spin' : ''} />
          {checking ? '…' : 'Refresh'}
        </button>
        <button type="button" onClick={onDismiss} className="text-xs text-slate-400 hover:text-slate-200">
          Later
        </button>
      </div>
    )
  }

  return (
    <div
      className="sticky top-0 z-[100] border-b border-emerald-500/50 glass px-4 py-3 shadow-lg backdrop-blur-md"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="relative mt-1.5 flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">New update available</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              A newer version of Finance Management System is ready. Click{' '}
              <strong className="font-medium text-slate-800 dark:text-slate-200">Refresh now</strong> to load it. You
              will stay signed in.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="glass-soft rounded-lg border border-slate-600/60 px-3 py-2 text-sm text-slate-300 hover:border-emerald-500/40"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onUpdate}
            disabled={checking}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-900/40 hover:bg-emerald-400 disabled:opacity-50"
          >
            <AppIcon icon={RefreshCw} size="sm" className={checking ? 'animate-spin' : ''} />
            {checking ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </div>
    </div>
  )
}
