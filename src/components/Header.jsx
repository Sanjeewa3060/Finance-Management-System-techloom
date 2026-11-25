import React from 'react'
import Tabs from './Tabs.jsx'
import NotificationsBell from './NotificationsBell.jsx'
import UpdateAvailableBanner from './UpdateAvailableBanner.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

export default function Header({
  onOpenAddEntry,
  onSignOut,
  isAdmin = false,
  userEmail = '',
  branchName = '',
  notifications = [],
  onMarkNotificationRead,
  showDesktopTabs = true,
  updateAvailable = false,
  onRefreshApp,
  onDismissUpdate,
  updateChecking = false,
}) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="glass sticky top-0 z-30 border-b border-slate-700/60">
      {updateAvailable ? (
        <UpdateAvailableBanner
          onUpdate={onRefreshApp}
          onDismiss={onDismissUpdate}
          checking={updateChecking}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-2xl bg-emerald-500" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
              Finance Management System
            </h1>
            <p className="truncate text-xs text-slate-400" title={branchName}>
              {isAdmin ? 'Admin · all departments' : `Department${branchName ? ` · ${branchName}` : ''}`}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto md:gap-2">
          {updateAvailable ? (
            <div className="hidden sm:block">
              <UpdateAvailableBanner
                placement="inline"
                onUpdate={onRefreshApp}
                onDismiss={onDismissUpdate}
                checking={updateChecking}
              />
            </div>
          ) : null}
          <NotificationsBell notifications={notifications} onMarkRead={onMarkNotificationRead} />
          <button
            type="button"
            onClick={toggleTheme}
            className="glass-soft rounded-xl px-3 py-2 text-sm"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            onClick={onOpenAddEntry}
            className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Add Entry
          </button>
          {onSignOut ? (
            <button type="button" onClick={onSignOut} className="glass-soft rounded-xl px-3 py-2 text-sm font-medium text-slate-100">
              Sign out
            </button>
          ) : null}
          <span
            className="glass-soft hidden max-w-[140px] truncate rounded-xl px-3 py-2 text-xs text-slate-300 xl:inline-block"
            title={userEmail}
          >
            {userEmail}
          </span>
        </div>
      </div>

      {showDesktopTabs ? (
        <div className="border-t border-slate-800/70 px-4 pb-3 pt-2 sm:hidden">
          <Tabs isAdmin={isAdmin} />
        </div>
      ) : null}
    </header>
  )
}
