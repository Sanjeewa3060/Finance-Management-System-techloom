import React, { useEffect } from 'react'

export default function Toasts({ toasts, onRemove }) {
  useEffect(() => {
    if (!toasts?.length) return
    const timers = toasts.map((t) =>
      setTimeout(() => {
        onRemove?.(t.id)
      }, t.durationMs ?? 3500),
    )

    return () => {
      timers.forEach((id) => clearTimeout(id))
    }
  }, [toasts, onRemove])

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {(toasts ?? []).map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-lg ${
            t.kind === 'success'
              ? 'theme-toast-success border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
              : t.kind === 'error'
                ? 'theme-toast-error border-rose-500/40 bg-rose-500/15 text-rose-200'
                : 'theme-toast-default border-slate-700 bg-slate-900 text-slate-100'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => onRemove?.(t.id)}
              className="rounded border border-current/30 px-1.5 py-0.5 text-[11px]"
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
