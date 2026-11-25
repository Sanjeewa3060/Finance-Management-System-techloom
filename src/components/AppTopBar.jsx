import React, { forwardRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Sun, Moon, PlusCircle, Tags } from 'lucide-react'
import NotificationsBell from './NotificationsBell.jsx'
import AppIcon from './AppIcon.jsx'
import LiveClock from './LiveClock.jsx'
import UserProfileMenu from './UserProfileMenu.jsx'
import ProductLauncher from './ProductLauncher.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

const HEADER_ICON_BTN =
  'topbar-icon-btn inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300'

function TopbarDivider() {
  return (
    <span
      className="mx-0.5 hidden h-6 w-px shrink-0 bg-slate-300/80 dark:bg-slate-600/60 sm:block"
      aria-hidden
    />
  )
}

function pageTitle(pathname, isAdmin) {
  if (pathname.startsWith('/dashboard/departments')) return 'Departments'
  if (pathname.startsWith('/dashboard/transactions')) return 'Transactions'
  if (pathname.startsWith('/dashboard/client-pay')) return 'Client Pay'
  if (pathname.startsWith('/dashboard/reports')) return 'Reports'
  if (pathname.startsWith('/dashboard/categories')) return 'Categories'
  if (pathname.startsWith('/dashboard/recurring')) return 'Recurring'
  if (pathname.startsWith('/dashboard/profile')) return 'Profile'
  if (pathname.startsWith('/dashboard/sensitive-events')) return 'Sensitive Events'
  if (pathname.startsWith('/dashboard/audit')) return 'Audit Log'
  if (pathname.startsWith('/dashboard/companies')) return 'Departments'
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return isAdmin ? 'Team dashboard' : 'My workspace'
  }
  return isAdmin ? 'Team dashboard' : 'My workspace'
}

const AppTopBar = forwardRef(function AppTopBar(
  {
    userEmail = '',
    userName = '',
    avatarUrl = '',
    isAdmin = false,
    onOpenAddEntry,
    onSignOut,
    notifications = [],
    onMarkNotificationRead,
    onMarkAllNotificationsRead,
    onClearAllNotifications,
    showProfileLinks = true,
  },
  ref,
) {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  const title = pageTitle(pathname, isAdmin)
  const dark = theme === 'dark'

  return (
    <header
      ref={ref}
      className="app-topbar sticky top-0 z-40 flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-slate-700/40 px-3 py-2 sm:px-4 lg:px-6"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="font-display min-w-0 flex-1 truncate text-sm font-semibold text-emerald-400 sm:text-base">
          {title}
        </h1>
      </div>

      <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
        {isAdmin ? (
          <NavLink
            to="/dashboard/categories"
            className={({ isActive }) =>
              `shrink-0 whitespace-nowrap !gap-1.5 !px-3 !py-1.5 text-sm ${
                isActive
                  ? 'theme-btn-secondary !border-emerald-500/50 !bg-emerald-500/10 !text-emerald-300'
                  : 'theme-btn-secondary'
              }`
            }
            title="Categories"
            aria-current={pathname.startsWith('/dashboard/categories') ? 'page' : undefined}
          >
            <AppIcon icon={Tags} size="sm" />
            <span className="hidden md:inline">Categories</span>
          </NavLink>
        ) : null}
        <button type="button" onClick={onOpenAddEntry} className="theme-btn-primary shrink-0 !gap-1.5 !px-3 !py-1.5 text-sm">
          <AppIcon icon={PlusCircle} size="sm" className="text-white" />
          <span className="sm:hidden">Add</span>
          <span className="hidden sm:inline">Add Entry</span>
        </button>

        <div
          className="topbar-controls inline-flex min-w-0 max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-slate-600/50 dark:bg-slate-900/50 sm:flex-nowrap"
          role="group"
          aria-label="Account and preferences"
        >
          <ProductLauncher />
          <LiveClock variant="topbar" />
          <TopbarDivider />
          <button
            type="button"
            onClick={toggleTheme}
            className={HEADER_ICON_BTN}
            title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle theme"
          >
            <AppIcon icon={dark ? Sun : Moon} size="sm" />
          </button>
          <NotificationsBell
            notifications={notifications}
            onMarkRead={onMarkNotificationRead}
            onMarkAllRead={onMarkAllNotificationsRead}
            onClearAll={onClearAllNotifications}
            showClearAll={(notifications ?? []).length > 0}
            variant="header"
          />
          <TopbarDivider />
          <UserProfileMenu
            variant="navbar"
            userEmail={userEmail}
            userName={userName}
            avatarUrl={avatarUrl}
            onSignOut={onSignOut}
            showProfileLinks={showProfileLinks}
          />
        </div>
      </div>
    </header>
  )
})

export default AppTopBar
