import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, CircleHelp, LogOut, Settings, User } from 'lucide-react'
import AppIcon from './AppIcon.jsx'
import DropdownMenu from './DropdownMenu.jsx'

const SUPPORT_MAILTO =
  'mailto:support@kaionex.com?subject=Finance%20Management%20System%20support'

function displayName(userName, userEmail) {
  const name = String(userName ?? '').trim()
  if (name) return name
  const email = String(userEmail ?? '').trim()
  if (!email) return 'User'
  return email.split('@')[0] || 'User'
}

function initials(userName, userEmail) {
  const label = displayName(userName, userEmail)
  const parts = label.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

function MenuItem({ icon, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`theme-dropdown-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm ${className}`}
      role="menuitem"
      {...props}
    >
      <AppIcon icon={icon} size="sm" className="shrink-0 opacity-80" />
      {children}
    </button>
  )
}

function MenuLink({ icon, to, children, onNavigate, onClose }) {
  return (
    <Link
      to={to}
      className="theme-dropdown-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm"
      role="menuitem"
      onClick={() => {
        onClose()
        onNavigate?.()
      }}
    >
      <AppIcon icon={icon} size="sm" className="shrink-0 opacity-80" />
      {children}
    </Link>
  )
}

export default function UserProfileMenu({
  userEmail = '',
  userName = '',
  avatarUrl = '',
  onSignOut,
  variant = 'navbar',
  onNavigate,
  showProfileLinks = true,
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const name = displayName(userName, userEmail)
  const isSidebar = variant === 'sidebar'

  function closeMenu() {
    setOpen(false)
  }

  function handleSignOut() {
    closeMenu()
    onNavigate?.()
    onSignOut?.()
  }

  const itemClass =
    'theme-dropdown-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm'

  return (
    <div className={isSidebar ? 'w-full' : 'relative shrink-0'}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`user-menu-trigger ${isSidebar ? 'user-menu-trigger--sidebar w-full' : 'user-menu-trigger--navbar'}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span className="user-menu-avatar flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-600 text-xs font-semibold text-white">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(userName, userEmail)
          )}
        </span>
        <span className={`min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800 dark:text-slate-100 ${isSidebar ? '' : 'hidden max-w-[8rem] sm:inline'}`}>
          {name}
        </span>
        <AppIcon icon={open ? ChevronUp : ChevronDown} size="sm" className="shrink-0 text-slate-500 dark:text-slate-400" />
      </button>

      <DropdownMenu open={open} anchorRef={anchorRef} onClose={closeMenu} width={240}>
        <div className="user-menu-header px-3 py-3">
          <p className="truncate text-sm font-semibold text-slate-100">{name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{userEmail || '—'}</p>
        </div>

        <div className="px-1 pb-1">
          {showProfileLinks ? (
            <>
              <MenuLink icon={User} to="/dashboard/profile" onNavigate={onNavigate} onClose={closeMenu}>
                Edit profile
              </MenuLink>
              <MenuLink
                icon={Settings}
                to="/dashboard/profile?tab=security"
                onNavigate={onNavigate}
                onClose={closeMenu}
              >
                Account settings
              </MenuLink>
            </>
          ) : null}
          <a href={SUPPORT_MAILTO} className={itemClass} role="menuitem" onClick={closeMenu}>
            <AppIcon icon={CircleHelp} size="sm" className="shrink-0 opacity-80" />
            Support
          </a>
          {onSignOut ? (
            <MenuItem
              icon={LogOut}
              className="text-rose-400 hover:bg-rose-500/10 dark:text-rose-300"
              onClick={handleSignOut}
            >
              Sign out
            </MenuItem>
          ) : null}
        </div>
      </DropdownMenu>
    </div>
  )
}
