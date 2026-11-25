import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Receipt,
  BarChart3,
  ShieldAlert,
  User,
  FileText,
} from 'lucide-react'
import AppIcon from './AppIcon.jsx'
import { startRouteProgress } from './RouteProgress.jsx'

const MAIN_NAV = [
  { to: '/dashboard', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/departments', label: 'Departments', icon: Building2, hideWhenCompanyScoped: true },
  { to: '/dashboard/transactions', label: 'Transactions', icon: Receipt },
  { to: '/dashboard/client-pay', label: 'Client Pay', icon: FileText },
  { to: '/dashboard/reports', label: 'Reports', icon: BarChart3, hideForBranchAccount: true },
]

const ADMIN_NAV = [
  { to: '/dashboard/sensitive-events', label: 'Sensitive Events Log', icon: ShieldAlert },
]

const ACCOUNT_NAV = [
  { to: '/dashboard/profile', label: 'Profile', icon: User },
]

function visibleMainNav(isCompanyScoped, isBranchAccount) {
  let nav = MAIN_NAV
  if (isCompanyScoped) nav = nav.filter((item) => !item.hideWhenCompanyScoped)
  if (isBranchAccount) nav = nav.filter((item) => !item.hideForBranchAccount)
  return nav
}

function linkClass(isActive, vertical, iconOnly) {
  const base = iconOnly
    ? 'sidebar-nav-link sidebar-nav-link--icon-only'
    : vertical
      ? 'sidebar-nav-link'
      : 'sidebar-nav-link whitespace-nowrap'
  return isActive ? `${base} sidebar-nav-link--active` : base
}

function NavItem({ item, vertical, iconOnly, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) => linkClass(isActive, vertical, iconOnly)}
      onClick={() => {
        startRouteProgress()
        onNavigate?.()
      }}
    >
      <span className={`flex items-center ${iconOnly ? 'justify-center' : 'gap-3'}`}>
        <AppIcon icon={item.icon} size="md" className="sidebar-nav-icon" />
        <span className="sidebar-nav-label">{item.label}</span>
      </span>
    </NavLink>
  )
}

export default function Tabs({
  isAdmin = false,
  isBranchAccount = false,
  isCompanyScoped = false,
  orientation = 'horizontal',
  iconOnly = false,
  onNavigate,
}) {
  const vertical = orientation === 'vertical'
  const mainNav = visibleMainNav(isCompanyScoped, isBranchAccount)
  const allNav = [...mainNav, ...(isAdmin ? ADMIN_NAV : []), ...(isBranchAccount ? [] : ACCOUNT_NAV)]

  return (
    <nav aria-label="Sections" className={vertical ? 'flex flex-col' : 'finance-scroll flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1'}>
      <div className={vertical ? `flex flex-col gap-1.5 ${iconOnly ? 'px-0' : 'px-1'}` : 'contents'}>
        {allNav.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            vertical={vertical}
            iconOnly={iconOnly}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  )
}
