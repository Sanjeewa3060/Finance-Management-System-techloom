import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import SectionLoading from './components/SectionLoading.jsx'
import AppSidebar, {
  SIDEBAR_WIDTH,
  SIDEBAR_RAIL_WIDTH,
  SidebarEdgeHandle,
} from './components/AppSidebar.jsx'
import AppTopBar from './components/AppTopBar.jsx'
import Overview from './components/Overview.jsx'
import DepartmentsDashboard from './components/DepartmentsDashboard.jsx'
import Transactions from './components/Transactions.jsx'
import Profile from './components/Profile.jsx'
import CompanyDetail from './components/CompanyDetail.jsx'
import AuditLog from './components/AuditLog.jsx'
import SensitiveEventsLog from './components/SensitiveEventsLog.jsx'
import Reports from './components/Reports.jsx'
import Recurring from './components/Recurring.jsx'
import Categories from './components/Categories.jsx'
import ClientPay from './components/ClientPay.jsx'
import AddDepartmentModal from './components/AddDepartmentModal.jsx'
import AddEntryModal from './components/AddEntryModal.jsx'
import EditTransactionModal from './components/EditTransactionModal.jsx'
import BulkImportModal from './components/BulkImportModal.jsx'
import ImpersonationBanner from './components/ImpersonationBanner.jsx'
import Toasts from './components/Toasts.jsx'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'

const SIDEBAR_STORAGE_KEY = 'kaionex_sidebar_open'
const PEEK_CLOSE_DELAY_MS = 200

function getInitialSidebarOpen() {
  if (typeof window === 'undefined') return false
  try {
    const stored = sessionStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored === 'true' || stored === 'false') return stored === 'true'
  } catch {
    /* ignore */
  }
  return window.matchMedia('(min-width: 1024px)').matches
}

function isMobileSidebarViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 1023px)').matches
}

function isDesktopSidebar() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 1024px)').matches
}

function isSidebarPeekHitTarget(el) {
  if (!el || typeof el.closest !== 'function') return false
  return Boolean(el.closest('.sidebar-edge-handle, #app-sidebar'))
}

export default function AppDashboard({ d }) {
  const location = useLocation()
  const sectionLoading = d.loading || (
    ['/dashboard', '/dashboard/reports', '/dashboard/transactions', '/dashboard/departments'].includes(location.pathname) && d.transactionsLoading
  ) || (location.pathname.includes('sensitive') && d.sensitiveEventsLoading)
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarOpen)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const peekCloseTimerRef = useRef(null)
  const suppressPeekUntilLeaveRef = useRef(false)
  const topbarRef = useRef(null)
  const [topbarHeight, setTopbarHeight] = useState(0)
  useKeyboardShortcuts({ onNewEntry: () => d.openAddEntry?.(), enabled: true })

  const sidebarCollapsed = !sidebarOpen

  const persistSidebarOpen = (open) => {
    try {
      sessionStorage.setItem(SIDEBAR_STORAGE_KEY, String(open))
    } catch {
      /* ignore */
    }
  }

  const clearPeekTimer = useCallback(() => {
    if (peekCloseTimerRef.current) {
      clearTimeout(peekCloseTimerRef.current)
      peekCloseTimerRef.current = null
    }
  }, [])

  const setSidebarOpenPersisted = (value) => {
    setSidebarOpen((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      persistSidebarOpen(next)
      return next
    })
  }

  useEffect(() => {
    const el = topbarRef.current
    if (!el) return undefined
    const measure = () => setTopbarHeight(Math.round(el.getBoundingClientRect().bottom))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => () => clearPeekTimer(), [clearPeekTimer])

  const openSidebarPeek = useCallback(() => {
    if (!sidebarCollapsed || !isDesktopSidebar()) return
    if (suppressPeekUntilLeaveRef.current) return
    clearPeekTimer()
    setSidebarPeek(true)
  }, [sidebarCollapsed, clearPeekTimer])

  const scheduleCloseSidebarPeek = useCallback(() => {
    if (!sidebarCollapsed) return
    suppressPeekUntilLeaveRef.current = false
    clearPeekTimer()
    peekCloseTimerRef.current = setTimeout(() => {
      setSidebarPeek(false)
      peekCloseTimerRef.current = null
    }, PEEK_CLOSE_DELAY_MS)
  }, [sidebarCollapsed, clearPeekTimer])

  useEffect(() => {
    if (!sidebarCollapsed) {
      suppressPeekUntilLeaveRef.current = false
      setSidebarPeek(false)
      return undefined
    }

    function forcePeekClosedOnTabReturn() {
      if (!isDesktopSidebar()) return
      clearPeekTimer()
      setSidebarPeek(false)
      suppressPeekUntilLeaveRef.current = true
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        clearPeekTimer()
        setSidebarPeek(false)
        suppressPeekUntilLeaveRef.current = true
        return
      }
      if (document.visibilityState === 'visible') forcePeekClosedOnTabReturn()
    }

    function onPointerMove(e) {
      if (!suppressPeekUntilLeaveRef.current) return
      if (!isSidebarPeekHitTarget(e.target)) {
        suppressPeekUntilLeaveRef.current = false
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', forcePeekClosedOnTabReturn)
    window.addEventListener('pageshow', forcePeekClosedOnTabReturn)
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', forcePeekClosedOnTabReturn)
      window.removeEventListener('pageshow', forcePeekClosedOnTabReturn)
      document.removeEventListener('pointermove', onPointerMove)
    }
  }, [sidebarCollapsed, clearPeekTimer])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')

    function syncBodyScrollLock() {
      const shouldLock = sidebarOpen && mq.matches
      document.body.classList.toggle('sidebar-open', shouldLock)
      document.body.style.overflow = shouldLock ? 'hidden' : ''
    }

    syncBodyScrollLock()
    mq.addEventListener('change', syncBodyScrollLock)
    return () => {
      mq.removeEventListener('change', syncBodyScrollLock)
      document.body.classList.remove('sidebar-open')
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (sidebarPeek && sidebarCollapsed) {
        clearPeekTimer()
        setSidebarPeek(false)
        return
      }
      if (sidebarOpen && isDesktopSidebar()) {
        clearPeekTimer()
        setSidebarPeek(false)
        setSidebarOpenPersisted(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sidebarCollapsed, sidebarPeek, sidebarOpen, clearPeekTimer])

  function expandSidebar() {
    clearPeekTimer()
    setSidebarPeek(false)
    setSidebarOpenPersisted(true)
  }

  function collapseSidebar() {
    clearPeekTimer()
    setSidebarPeek(false)
    setSidebarOpenPersisted(false)
  }

  function toggleSidebar() {
    if (sidebarCollapsed) expandSidebar()
    else collapseSidebar()
  }

  function closeSidebarOnMobile() {
    if (isMobileSidebarViewport()) {
      setSidebarOpenPersisted(false)
    } else if (sidebarCollapsed && sidebarPeek) {
      clearPeekTimer()
      setSidebarPeek(false)
    }
  }

  const isCompanyScoped =
    d.authUser?.role === 'company' || d.authUser?.role === 'company_user' || d.authUser?.role === 'department'
  const isBranchAccount = d.authUser?.role === 'department'
  const branchLabel =
    isBranchAccount
      ? d.authUser?.name ?? d.departments[0]?.name ?? ''
      : isCompanyScoped && d.departments.length > 0
        ? d.departments.map((x) => x.name).join(', ')
        : ''

  const layoutClass = [
    'dashboard-layout',
    sidebarCollapsed ? 'dashboard-layout--sidebar-collapsed' : '',
    sidebarCollapsed && sidebarPeek ? 'dashboard-layout--sidebar-peek' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const shellMarginClass = sidebarOpen
    ? ' lg:ml-[var(--sidebar-width)]'
    : ' lg:ml-[var(--sidebar-rail-width)]'

  return (
    <div
      className={layoutClass}
      style={{
        '--sidebar-width': SIDEBAR_WIDTH,
        '--sidebar-rail-width': SIDEBAR_RAIL_WIDTH,
        '--sidebar-handle-top': topbarHeight ? `${topbarHeight}px` : undefined,
      }}
    >
      {d.authUser?.impersonatingFrom ? (
        <ImpersonationBanner companyEmail={d.authUser.email} onExit={d.handleExitImpersonation} />
      ) : null}

      <AppSidebar
        isAdmin={d.isAdmin}
        isBranchAccount={isBranchAccount}
        isCompanyScoped={isCompanyScoped}
        branchName={branchLabel}
        mobileOpen={sidebarOpen}
        onClose={closeSidebarOnMobile}
        collapsed={sidebarCollapsed}
        peeking={sidebarPeek}
        onPeekOpen={openSidebarPeek}
        onPeekClose={scheduleCloseSidebarPeek}
      />

      <SidebarEdgeHandle collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div className={`dashboard-shell flex min-h-dvh min-w-0 flex-col${shellMarginClass}`}>
        <AppTopBar
          ref={topbarRef}
          userEmail={d.authUser.email}
          userName={d.authUser.full_name || d.authUser.name}
          avatarUrl={d.authUser.avatar_url}
          isAdmin={d.isAdmin}
          onOpenAddEntry={() => d.openAddEntry?.()}
          onSignOut={d.handleLogout}
          notifications={d.notifications}
          onMarkNotificationRead={d.handleMarkNotificationRead}
          onMarkAllNotificationsRead={d.handleMarkAllNotificationsRead}
          onClearAllNotifications={d.handleClearAllNotifications}
          showProfileLinks={!isBranchAccount}
        />

        <main className="dashboard-main min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4 pt-3 md:px-4 md:pb-6 md:pt-4">
            {d.error ? (
              <div className="mx-auto mb-4 max-w-6xl rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                {d.error}
              </div>
            ) : null}

            <SectionLoading loading={sectionLoading}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <Overview
                    transactions={d.transactions}
                    departments={d.departments}
                    budgetByDepartment={d.budgetByDepartment}
                    companyAggregates={d.companyAggregates}
                    isAdmin={d.isAdmin}
                    departmentTargets={d.departmentTargets}
                    recurringEntries={d.recurringEntries}
                    onLogReportExport={d.handleLogReportExport}
                  />
                }
              />
              <Route
                path="/dashboard/departments"
                element={
                  isCompanyScoped ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    <DepartmentsDashboard
                      isAdmin={d.isAdmin}
                      departmentsProps={{
                        departments: d.departments,
                        departmentAggregates: d.departmentAggregates,
                        loading: d.loading,
                        error: d.error,
                        isAdmin: d.isAdmin,
                        canDeleteDepartment: true,
                        onDeleteDepartment: d.handleDeleteDepartment,
                        budgetByDepartment: d.budgetByDepartment,
                        onSaveBudget: d.handleSaveBudget,
                        budgetMonthKey: d.budgetMonthKey,
                        onBudgetMonthChange: d.setBudgetMonthKey,
                        departmentTargets: d.departmentTargets,
                        onSaveTarget: d.handleSaveTarget,
                        authUser: d.authUser,
                      }}
                      analyticsProps={{
                        departments: d.departments,
                        transactions: d.transactions,
                        loading: d.loading,
                        onOpenAddEntry: d.openAddEntry,
                      }}
                      profilesProps={{
                        profiles: d.companyProfiles,
                        deletedProfiles: d.deletedCompanyProfiles,
                        departments: d.departments,
                        loading: d.loading,
                        onCreate: d.handleCreateCompanyProfile,
                        onDelete: d.handleDeleteCompanyProfile,
                        onRestore: d.handleRestoreCompanyProfile,
                        onToggleActive: d.handleToggleCompanyProfileActive,
                        onResetPassword: d.handleAdminResetCompanyPassword,
                        onSetDeletePassword: d.handleAdminSetDeletePassword,
                        onUpdate: d.handleUpdateCompanyProfile,
                        onImpersonate: d.handleImpersonate,
                        onClearAllData: d.handleClearAllData,
                        onBackupSystemData: d.handleBackupSystemData,
                        onListSystemBackups: d.handleListSystemBackups,
                        onDownloadStoredBackup: d.handleDownloadStoredBackup,
                        authUser: d.authUser,
                      }}
                    />
                  )
                }
              />
              <Route
                path="/dashboard/transactions"
                element={
                  <Transactions
                    transactions={d.transactions}
                    departments={d.scopedDepartments}
                    loading={d.transactionsLoading}
                    error={d.error}
                    onEditTransaction={d.handleEditTransaction}
                    onDeleteTransaction={d.handleDeleteTransaction}
                    isAdmin={d.isAdmin}
                    requiresDeletePassword={isBranchAccount}
                    onVerifyDeletePassword={d.handleVerifyDeletePassword}
                    hideDepartmentField={isCompanyScoped}
                    onOpenBulkImport={() => d.setBulkImportOpen(true)}
                    onOpenAddEntry={d.openAddEntry}
                    onViewDateChange={d.setTransactionsViewDate}
                    searchQuery={d.txSearch}
                    onSearchChange={d.setTxSearch}
                    companyProfiles={d.isAdmin ? d.companyProfiles : []}
                    onLogReportExport={d.handleLogReportExport}
                  />
                }
              />
              <Route
                path="/dashboard/client-pay"
                element={
                  <ClientPay
                    authUser={d.authUser}
                    isAdmin={d.isAdmin}
                    companyProfileId={d.authUser?.company_profile_id}
                    showToast={d.showToast}
                  />
                }
              />
              <Route
                path="/dashboard/reports"
                element={
                  isBranchAccount ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    <Reports
                      transactions={d.transactions}
                      departments={d.departments}
                      isAdmin={d.isAdmin}
                      branchAccounts={d.departments}
                      onLogReportExport={d.handleLogReportExport}
                      categories={d.categories}
                    />
                  )
                }
              />
              <Route
                path="/dashboard/recurring"
                element={
                  <Recurring
                    entries={d.recurringEntries}
                    departments={d.departments}
                    onCreate={d.handleCreateRecurring}
                    onDelete={d.handleDeleteRecurring}
                    onPostDue={d.handlePostRecurringDue}
                    loading={d.loading}
                    authUser={d.authUser}
                  />
                }
              />
              <Route
                path="/dashboard/categories"
                element={
                  d.isAdmin ? (
                    <Categories
                      categories={d.categories}
                      transactions={d.transactions}
                      onCreate={d.handleCreateCategory}
                      onUpdate={d.handleUpdateCategory}
                      onDelete={d.handleDeleteCategory}
                      loading={d.loading}
                      authUser={d.authUser}
                    />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                }
              />
              <Route
                path="/dashboard/admin/companies"
                element={
                  d.isAdmin ? (
                    <Navigate to="/dashboard/departments?tab=analytics" replace />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                }
              />
              <Route
                path="/dashboard/company-profiles"
                element={
                  d.isAdmin ? (
                    <Navigate to="/dashboard/departments?tab=profiles" replace />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                }
              />
              <Route
                path="/dashboard/companies/:companyId"
                element={
                  d.isAdmin ? (
                    <CompanyDetail
                      companyProfiles={d.companyProfiles}
                      departments={d.departments}
                      transactions={d.transactions}
                      departmentBudgets={d.departmentBudgets}
                      loading={d.loading}
                      onSaveAdminNotes={d.handleSaveAdminNotes}
                    />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                }
              />
              <Route
                path="/dashboard/sensitive-events"
                element={
                  d.isAdmin ? (
                    <SensitiveEventsLog
                      events={d.sensitiveEvents}
                      loading={d.sensitiveEventsLoading}
                      error={d.sensitiveEventsError}
                    />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                }
              />
              <Route
                path="/dashboard/audit-log"
                element={
                  d.isAdmin ? (
                    <AuditLog logs={d.auditLogs} loading={d.loading} error={d.auditError} />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                }
              />
              <Route
                path="/dashboard/profile"
                element={
                  isBranchAccount ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    <Profile
                      profile={d.authUser}
                      createdAt={d.profileCreatedAt}
                      branchName={
                        isBranchAccount
                          ? branchLabel
                          : isCompanyScoped && d.departments.length > 0
                            ? d.departments.map((x) => x.name).join(', ')
                            : d.isAdmin
                              ? 'All departments'
                              : ''
                      }
                      onUpdatePassword={d.handleUpdatePassword}
                      onUpdateDetails={d.handleUpdateDetails}
                      onUpdateAdminMeta={d.handleUpdateAdminMeta}
                      onUpdateAvatar={d.handleUpdateAvatar}
                      onRemoveAvatar={d.handleRemoveAvatar}
                      onForceLogout={d.handleLogout}
                      onBackupSystemData={d.handleBackupSystemData}
                      onDownloadLocalBackupOnly={d.handleDownloadLocalBackupOnly}
                      onListSystemBackups={d.handleListSystemBackups}
                      onDownloadStoredBackup={d.handleDownloadStoredBackup}
                    />
                  )
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </SectionLoading>

            <AddDepartmentModal
              open={d.addDepartmentOpen}
              onClose={() => d.setAddDepartmentOpen(false)}
              onSave={d.handleCreateDepartment}
              isAdmin={d.isAdmin}
              loading={d.addDepartmentSaving}
            />
            <AddEntryModal
              open={d.addEntryOpen}
              onClose={() => d.closeAddEntry?.()}
              onSave={d.handleCreateEntry}
              departments={d.scopedDepartments}
              transactions={d.transactions}
              loading={d.addEntrySaving}
              libraryCategories={d.categories}
              recentCategoryNames={d.categorySuggestions}
              onCreateCategory={d.handleCreateCategory}
              isAdmin={d.isAdmin}
              hideDepartmentField={isCompanyScoped}
              initialDate={d.addEntryPresetDate}
              initialDepartmentId={d.addEntryPresetDepartmentId}
              requiresApproval={d.companyRequiresApproval}
              authUserId={d.authUser?.id ?? 'anon'}
              authUser={d.authUser}
            />
            <EditTransactionModal
              open={d.editTransactionOpen}
              transaction={d.selectedTransaction}
              departments={d.scopedDepartments}
              transactions={d.transactions}
              onClose={() => {
                d.setEditTransactionOpen(false)
                d.setSelectedTransaction(null)
                d.clearDepartmentEditVerification?.()
              }}
              onSave={d.handleUpdateTransaction}
              loading={d.editEntrySaving}
              libraryCategories={d.categories}
              recentCategoryNames={d.categorySuggestions}
              onCreateCategory={d.handleCreateCategory}
              isAdmin={d.isAdmin}
              hideDepartmentField={isCompanyScoped}
              authUserId={d.authUser?.id ?? 'anon'}
            />
            <BulkImportModal
              open={d.bulkImportOpen}
              onClose={() => d.setBulkImportOpen(false)}
              onImport={d.handleBulkImport}
              departments={d.departments}
              loading={d.loading}
            />
          </main>
      </div>

      <Toasts toasts={d.toasts} onRemove={d.onRemoveToast} />
    </div>
  )
}
