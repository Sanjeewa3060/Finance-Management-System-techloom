import React, { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import AppIcon from './AppIcon.jsx'

function fmtTime(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function NotificationsBell({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  iconOnly = false,
  showClearAll = false,
  variant = 'default',
}) {
  const [open, setOpen] = useState(false)
  const wasOpenRef = useRef(false)
  const rootRef = useRef(null)
  const unread = (notifications ?? []).filter((n) => !n.is_read).length

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      onMarkAllRead?.()
    }
    wasOpenRef.current = open
  }, [open, onMarkAllRead])

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    function onPointerDown(e) {
      if (rootRef.current?.contains(e.target)) return
      setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  const isHeader = variant === 'header' || iconOnly
  const btnClass = isHeader
    ? `topbar-icon-btn relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300${
        open ? ' bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : ''
      }`
    : 'theme-btn-secondary relative w-full'

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={btnClass}
        aria-label={unread > 0 ? `${unread} notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <AppIcon icon={Bell} size={isHeader ? 'sm' : 'lg'} />
        {!isHeader ? <span>Notifications</span> : null}
        {unread > 0 ? (
          <span
            className={`absolute flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-bold leading-none text-white ${
              isHeader ? '-right-0.5 -top-0.5' : 'right-2 top-1/2 -translate-y-1/2 h-4 min-w-4 text-[10px]'
            }`}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="theme-dropdown absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-auto rounded-xl p-2 shadow-xl">
          {showClearAll && (notifications ?? []).length > 0 ? (
            <div className="mb-2 border-b border-slate-700/40 pb-2">
              <button
                type="button"
                onClick={() => {
                  onClearAll?.()
                }}
                className="theme-dropdown-item w-full rounded-lg px-2 py-2 text-left text-xs font-medium text-rose-300"
              >
                Clear
              </button>
            </div>
          ) : null}
          {(notifications ?? []).length === 0 ? (
            <p className="p-3 text-xs text-slate-500">No notifications</p>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onMarkRead?.(n.id)}
                className={`theme-dropdown-item mb-1 w-full rounded-lg p-2 text-left text-xs ${
                  n.is_read ? 'text-slate-500' : 'theme-dropdown-item--unread font-medium'
                } ${n.is_sensitive ? 'border-l-2 border-amber-500/80 pl-2' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span>{n.title}</span>
                  {n.is_sensitive ? (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase text-amber-300">
                      Sensitive
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 whitespace-pre-wrap text-slate-400">{n.body}</div>
                {n.created_at ? <div className="mt-1 text-[10px] text-slate-500">{fmtTime(n.created_at)}</div> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
