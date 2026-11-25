import React, { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import Tabs from './Tabs.jsx'
import CompanyLogo from './CompanyLogo.jsx'
import AppIcon from './AppIcon.jsx'

const SIDEBAR_WIDTH = '16.25rem' /* 260px */
const SIDEBAR_RAIL_WIDTH = '3.5rem'

function useDesktopSidebar() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return desktop
}

/** Round handle centred on the sidebar / content divider edge (Reddit / EMS style). */
export function SidebarEdgeHandle({ collapsed, onToggle }) {
  return (
    <button
      type="button"
      className="sidebar-edge-handle"
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label={collapsed ? 'Expand sidebar' : 'Hide menu'}
      aria-expanded={!collapsed}
      aria-controls="app-sidebar"
      title={collapsed ? 'Expand sidebar' : 'Hide menu'}
      onPointerDown={(e) => {
        /* Fire on pointer down so a hover-peek layout shift cannot steal the click. */
        if (e.button != null && e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        onToggle?.()
      }}
    >
      <AppIcon icon={Menu} size="sm" className="shrink-0" />
    </button>
  )
}

export default function AppSidebar({
  isAdmin,
  branchName,
  isBranchAccount,
  isCompanyScoped,
  mobileOpen,
  onClose,
  collapsed = false,
  peeking = false,
  onPeekOpen,
  onPeekClose,
}) {
  const desktop = useDesktopSidebar()
  const iconRail = collapsed && !peeking && desktop
  /* Desktop collapsed: keep panel mounted as icon rail; mobile still uses drawer open flag. */
  const visible = mobileOpen || peeking || iconRail

  const subtitle = isAdmin
    ? 'Admin · all departments'
    : isBranchAccount
      ? `Department · ${branchName || 'Account'}`
      : branchName
        ? `Department · ${branchName}`
        : 'Department'

  const showOverlay = mobileOpen && !peeking && !desktop

  return (
    <>
      {showOverlay ? (
        <button
          type="button"
          className="app-sidebar-overlay theme-sidebar-overlay fixed inset-0 bg-slate-950/60"
          aria-label="Close menu"
          onClick={onClose}
        />
      ) : null}

      <aside
        id="app-sidebar"
        data-open={visible ? 'true' : 'false'}
        data-collapsed={collapsed ? 'true' : 'false'}
        data-peek={peeking ? 'true' : 'false'}
        data-icon-rail={iconRail ? 'true' : 'false'}
        aria-hidden={!visible}
        style={{ width: iconRail ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH }}
        className="app-sidebar fixed inset-y-0 left-0 z-[130] flex h-screen flex-col border-r"
        onMouseEnter={collapsed ? onPeekOpen : undefined}
        onMouseLeave={collapsed ? onPeekClose : undefined}
      >
        <div
          className={`sidebar-brand shrink-0 border-b border-slate-700/40 ${
            iconRail ? 'sidebar-brand--rail px-1 py-3' : 'px-4 py-4'
          }`}
        >
          {iconRail ? (
            <img
              src="/favicon.png"
              alt="Kaionex"
              className="sidebar-brand-mark"
              width={28}
              height={28}
              draggable={false}
            />
          ) : (
            <>
              <div className="app-sidebar-close mb-2 flex items-start justify-between gap-2 lg:hidden">
                <span className="sr-only">Navigation menu</span>
                <button
                  type="button"
                  onClick={onClose}
                  className="theme-btn-secondary ml-auto h-10 w-10 shrink-0 px-0"
                  aria-label="Close menu"
                >
                  <AppIcon icon={X} size="md" />
                </button>
              </div>
              <CompanyLogo size="sidebar" />
              <p className="mt-2 truncate text-xs text-slate-400">Finance Management System (FMS)</p>
              <p className="mt-2 truncate text-xs text-slate-500" title={subtitle}>
                {subtitle}
              </p>
            </>
          )}
        </div>

        <div className="finance-scroll sidebar-nav-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2">
          <Tabs
            isAdmin={isAdmin}
            isBranchAccount={isBranchAccount}
            isCompanyScoped={isCompanyScoped}
            orientation="vertical"
            iconOnly={iconRail}
            onNavigate={onClose}
          />
        </div>

        <div
          className={`sidebar-footer shrink-0 ${iconRail ? 'sidebar-footer--rail' : ''}`}
          aria-hidden={iconRail ? true : undefined}
        >
          {!iconRail ? <p className="sidebar-footer-version">FMS v1.1.0</p> : null}
        </div>
      </aside>
    </>
  )
}

export { SIDEBAR_WIDTH, SIDEBAR_RAIL_WIDTH }
