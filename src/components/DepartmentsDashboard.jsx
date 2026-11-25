import React, { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building, Building2, LineChart } from 'lucide-react'
import AppIcon from './AppIcon.jsx'
import Departments from './Departments.jsx'
import AdminCompanyInsights from './AdminCompanyInsights.jsx'
import CompanyProfiles from './CompanyProfiles.jsx'

const TABS = [
  { id: 'manage', label: 'Departments', icon: Building2 },
  { id: 'analytics', label: 'Department Analytics', icon: LineChart, adminOnly: true },
  { id: 'profiles', label: 'Department Profiles', icon: Building, adminOnly: true },
]

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 ${
        active ? 'theme-tab-active' : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      <AppIcon icon={icon} size="sm" />
      <span className="whitespace-nowrap">{children}</span>
    </button>
  )
}

export default function DepartmentsDashboard({
  isAdmin = false,
  departmentsProps,
  analyticsProps,
  profilesProps,
}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => !tab.adminOnly || isAdmin),
    [isAdmin],
  )

  const tabFromUrl = searchParams.get('tab')
  const activeTab = visibleTabs.some((t) => t.id === tabFromUrl) ? tabFromUrl : 'manage'

  function setTab(id) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id === 'manage') {
          next.delete('tab')
          next.delete('department')
          next.delete('branch')
        } else {
          next.set('tab', id)
          if (id !== 'analytics') {
            next.delete('department')
            next.delete('branch')
          }
        }
        return next
      },
      { replace: true },
    )
  }

  if (!isAdmin) {
    return <Departments {...departmentsProps} />
  }

  return (
    <div className="mx-auto max-w-none">
      <div className="glass mb-3 overflow-hidden rounded-xl">
        <div className="finance-scroll flex overflow-x-auto border-b border-slate-700/60">
          {visibleTabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setTab(tab.id)}
              icon={tab.icon}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
      </div>

      {activeTab === 'manage' ? <Departments {...departmentsProps} /> : null}
      {activeTab === 'analytics' ? (
        <div className="department-analytics-page">
          <AdminCompanyInsights {...analyticsProps} />
        </div>
      ) : null}
      {activeTab === 'profiles' ? <CompanyProfiles {...profilesProps} /> : null}
    </div>
  )
}
