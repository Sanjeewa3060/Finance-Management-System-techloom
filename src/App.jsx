import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import AppDashboard from './AppDashboard.jsx'
import Login from './components/Login.jsx'
import Landing from './components/Landing.jsx'
import ForgotPassword from './components/ForgotPassword.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import { useTheme } from './context/ThemeContext.jsx'
import { supabase, supabaseConfigError, checkSupabaseConnection } from './lib/supabase.js'
import {
  computeDepartmentAggregates,
  computeMonthlyTrends,
  computeTotals,
} from './utils/calculations.js'
import { hashPassword, verifyPassword, isPasswordHashed } from './utils/password.js'
import { logAudit } from './utils/audit.js'
import { formatSupabaseError } from './utils/supabaseErrors.js'
import { createLinkedDepartment, ensureLinkedDepartment, syncLinkedDepartments } from './utils/departmentProfileSync.js'
import { clearAuthStorage, loadStoredAuthUser, persistAuthUser, syncAuthUser } from './utils/authStorage.js'
import { isLoginBlocked, recordLoginAttempt, clearLoginAttempts } from './utils/loginSecurity.js'
import { fetchTransactionsScoped, loadExtrasData, requestPasswordReset, tryLoginCompanyUser, useExtendedFeatures } from './hooks/useExtendedFeatures.js'
import { ensureSessionValid, registerSession, revokeCurrentSession } from './utils/sessions.js'
import { saveProfileMeta } from './utils/profilePrefs.js'
import { uploadAvatar } from './utils/avatar.js'
import { checkBudgetAndNotify } from './utils/notifications.js'
import { useAppUpdate } from './hooks/useAppUpdate.js'
import UpdateAvailableBanner from './components/UpdateAvailableBanner.jsx'
import UpdateGuideMascot from './components/UpdateGuideMascot.jsx'
import { computeBranchAggregates } from './utils/companyAnalytics.js'
import { fetchCompanyProfilesForAdmin, safeUpdateLastLogin, verifyDeleteTransactionPassword, verifyAuthUserPassword, sanitizeCompanyProfileForAdmin } from './utils/safeQuery.js'
import { formatDayHeading, parseISODate, todayISO } from './utils/dates.js'
import { countsAsBudgetSpend } from './utils/entryTypes.js'
import {
  insertTransaction,
  resolvedOtherDirectionForAudit,
  updateTransaction,
} from './utils/transactionOtherDirection.js'
import { recordTransactionEdit } from './utils/transactionEditHistory.js'
import { clearAllSystemData } from './utils/clearSystemData.js'
import {
  createManualSystemBackup,
  downloadLocalBackupOnly,
  ensureDailySystemBackup,
  listSystemBackups,
  downloadStoredBackup,
} from './utils/systemBackup.js'
import { getDeviceInfo } from './utils/deviceInfo.js'
import { DEFAULT_CURRENCY } from './utils/money.js'
import { buildSensitiveMessage, fetchSensitiveEvents, maybePurgeExpiredSensitiveEvents, recordActorSensitiveActivity, recordSensitiveActivity } from './utils/sensitiveEvents.js'


const POST_UPDATE_PATH_KEY = 'kaionex_post_update_path'

function avatarTarget(authUser) {
  if (!authUser) return null
  if (authUser.role === 'admin') return { table: 'admin_accounts', id: authUser.id, folder: 'admin' }
  if (authUser.role === 'department') return { table: 'departments', id: authUser.department_id ?? authUser.id, folder: 'department' }
  if (authUser.role === 'company_user') {
    return { table: 'company_users', id: authUser.id, folder: 'company-user' }
  }
  if (authUser.role === 'company') return { table: 'company_profiles', id: authUser.id, folder: 'company' }
  return null
}

function Spinner() {
  return (
    <div className="flex items-center gap-3" role="status" aria-label="Loading">
      <img
        src="/favicon.png"
        alt=""
        className="kaionex-loading-logo"
        width={28}
        height={28}
        draggable={false}
      />
      <div className="text-sm text-slate-300">Loading...</div>
    </div>
  )
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

export default function App() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [authUser, setAuthUser] = useState(null) // { id, role, email, full_name, phone, address }
  const [authHydrated, setAuthHydrated] = useState(false)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [dbConnectionError, setDbConnectionError] = useState(null)
  const [dbConnectionChecking, setDbConnectionChecking] = useState(true)

  const [departments, setDepartments] = useState([])
  const [transactions, setTransactions] = useState([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [departmentBudgets, setDepartmentBudgets] = useState([])
  const [companyProfiles, setCompanyProfiles] = useState([])
  const [deletedCompanyProfiles, setDeletedCompanyProfiles] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [auditError, setAuditError] = useState(null)
  const [sensitiveEvents, setSensitiveEvents] = useState([])
  const [sensitiveEventsError, setSensitiveEventsError] = useState(null)
  const [sensitiveEventsUsingFallback, setSensitiveEventsUsingFallback] = useState(false)
  const [sensitiveEventsLoading, setSensitiveEventsLoading] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [addDepartmentOpen, setAddDepartmentOpen] = useState(false)
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [addEntryPresetDate, setAddEntryPresetDate] = useState(null)
  const [addEntryPresetDepartmentId, setAddEntryPresetDepartmentId] = useState(null)
  const [transactionsViewDate, setTransactionsViewDate] = useState(todayISO)

  const [addDepartmentSaving, setAddDepartmentSaving] = useState(false)
  const [addEntrySaving, setAddEntrySaving] = useState(false)
  const [editEntrySaving, setEditEntrySaving] = useState(false)
  const [editTransactionOpen, setEditTransactionOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [toasts, setToasts] = useState([])
  const [authResetLoading, setAuthResetLoading] = useState(false)
  const [authResetError, setAuthResetError] = useState(null)

  const isAdmin = authUser?.role === 'admin'
  const isBranchAccount = authUser?.role === 'department'
  const companyDepartmentIds = useMemo(() => {
    if (!authUser || isAdmin) return (departments ?? []).map((d) => d.id)
    if (isBranchAccount) return [authUser.department_id ?? authUser.id].filter(Boolean)
    if (authUser.role === 'company_user' && authUser.sub_role === 'manager' && authUser.department_id) {
      return [authUser.department_id]
    }
    return (departments ?? []).map((d) => d.id)
  }, [authUser, isAdmin, isBranchAccount, departments])
  const scopedDepartments = useMemo(() => {
    if (!authUser || isAdmin) return departments
    if (isBranchAccount) {
      const id = authUser.department_id ?? authUser.id
      return departments.filter((d) => d.id === id)
    }
    if (authUser.role === 'company_user' && authUser.sub_role === 'manager' && authUser.department_id) {
      return departments.filter((d) => d.id === authUser.department_id)
    }
    return departments
  }, [authUser, isAdmin, isBranchAccount, departments])

  const refreshDataRef = React.useRef(null)
  const refreshGenRef = React.useRef(0)
  const departmentEditVerifiedRef = React.useRef(false)

  const showToast = useCallback((kind, message) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), kind, message, durationMs: 3200 }])
  }, [])

  const ext = useExtendedFeatures({
    authUser,
    setAuthUser,
    showToast,
    isAdmin,
    companyDepartmentIds,
    departments,
    refreshData: () => refreshDataRef.current?.(),
    navigate,
  })

  const { updateAvailable, checking: updateChecking, dismissUpdate, reloadForUpdate } = useAppUpdate({
    enabled: true,
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const user = loadStoredAuthUser()
        if (user) {
          const valid = await ensureSessionValid(user)
          if (cancelled) return
          if (!valid) {
            clearAuthStorage()
            setAuthUser(null)
          } else {
            setAuthUser(user)
            await registerSession(user)
          }
        }
      } catch {
        clearAuthStorage()
      } finally {
        if (!cancelled) setAuthHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setDbConnectionChecking(true)
      const result = await checkSupabaseConnection()
      if (!cancelled) {
        setDbConnectionError(result.ok ? null : result.error)
        setDbConnectionChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!authHydrated || !authUser) return
    syncAuthUser(authUser)
  }, [authUser, authHydrated])

  useEffect(() => {
    if (!authHydrated || !authUser) return
    try {
      const path = sessionStorage.getItem(POST_UPDATE_PATH_KEY)
      if (path && path !== window.location.pathname) {
        sessionStorage.removeItem(POST_UPDATE_PATH_KEY)
        navigate(path, { replace: true })
      } else if (path) {
        sessionStorage.removeItem(POST_UPDATE_PATH_KEY)
      }
    } catch {
      /* ignore */
    }
  }, [authHydrated, authUser, navigate])

  const upgradePasswordIfNeeded = useCallback(async (plain, stored, table, id) => {
    if (isPasswordHashed(stored)) return
    const hashed = await hashPassword(plain)
    await supabase.from(table).update({ password: hashed }).eq('id', id)
  }, [])

  const reloadSensitiveEvents = useCallback(async ({ showLoading = true } = {}) => {
    if (!supabase || authUser?.role !== 'admin') {
      setSensitiveEvents([])
      setSensitiveEventsError(null)
      setSensitiveEventsUsingFallback(false)
      setSensitiveEventsLoading(false)
      return
    }
    if (showLoading) setSensitiveEventsLoading(true)
    try {
      await maybePurgeExpiredSensitiveEvents()
      const sensitiveResult = await fetchSensitiveEvents(supabase)
      setSensitiveEvents(sensitiveResult.data ?? [])
      setSensitiveEventsUsingFallback(sensitiveResult.usingFallback)
      setSensitiveEventsError(sensitiveResult.error ?? null)
    } catch (e) {
      setSensitiveEventsError(formatSupabaseError(e) ?? 'Failed to load sensitive events.')
    } finally {
      if (showLoading) setSensitiveEventsLoading(false)
    }
  }, [authUser?.role])

  useEffect(() => {
    if (!authHydrated || !authUser) return undefined
    let cancelled = false

    async function load() {
      if (cancelled) return
      await reloadSensitiveEvents({ showLoading: true })
    }

    load()
    const onFocus = () => {
      if (!cancelled) reloadSensitiveEvents({ showLoading: false })
    }
    const interval = setInterval(() => {
      if (!cancelled) reloadSensitiveEvents({ showLoading: false })
    }, 60_000)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [authHydrated, authUser, reloadSensitiveEvents])

  const reloadTransactions = useCallback(async ({ showLoading = true } = {}) => {
    if (!supabase || !authUser) {
      setTransactions([])
      setTransactionsLoading(false)
      return
    }
    if (showLoading) setTransactionsLoading(true)
    try {
      const currentIsAdmin = authUser.role === 'admin'
      const companyId = authUser.company_profile_id ?? authUser.id
      let deptQuery = supabase
        .from('departments')
        .select('id,name,color,company_profile_id,email,full_name,phone,address,is_active,avatar_url,created_at')
        .order('created_at', { ascending: false })
      if (!currentIsAdmin) {
        if (authUser.role === 'department') {
          deptQuery = deptQuery.eq('id', authUser.department_id ?? authUser.id)
        } else if (authUser.role === 'company_user' && authUser.sub_role === 'manager' && authUser.department_id) {
          deptQuery = deptQuery.eq('id', authUser.department_id)
        } else if (authUser.role === 'company' || authUser.role === 'company_user') {
          deptQuery = deptQuery.eq('company_profile_id', companyId)
        }
      }

      if (currentIsAdmin) {
        const [{ data: deptData, error: deptError }, txnData] = await Promise.all([
          deptQuery,
          fetchTransactionsScoped([], true),
        ])
        if (deptError) throw deptError
        setDepartments(deptData ?? [])
        setTransactions(txnData)
      } else {
        const { data: deptData, error: deptError } = await deptQuery
        if (deptError) throw deptError
        setDepartments(deptData ?? [])
        const scopedDepartmentIds = (deptData ?? []).map((d) => d.id)
        const txnData = await fetchTransactionsScoped(scopedDepartmentIds, false)
        setTransactions(txnData)
      }
    } catch (e) {
      console.warn('transactions load:', e?.message ?? e)
    } finally {
      if (showLoading) setTransactionsLoading(false)
    }
  }, [authUser])

  useEffect(() => {
    if (!authHydrated || !authUser) return undefined
    let cancelled = false

    async function load() {
      if (cancelled) return
      await reloadTransactions({ showLoading: true })
    }

    load()
    const onFocus = () => {
      if (!cancelled) reloadTransactions({ showLoading: false })
    }
    const interval = setInterval(() => {
      if (!cancelled) reloadTransactions({ showLoading: false })
    }, 60_000)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [authHydrated, authUser, reloadTransactions])

  const refreshData = useCallback(async (currentUser = authUser) => {
    if (!supabase) {
      setLoading(false)
      setError(supabaseConfigError ?? 'Supabase client not initialized.')
      return
    }
    if (!currentUser) {
      setLoading(false)
      setDepartments([])
      setTransactions([])
      setDepartmentBudgets([])
      setCompanyProfiles([])
      setDeletedCompanyProfiles([])
      return
    }

    setError(null)
    const refreshGen = ++refreshGenRef.current
    setLoading(true)
    try {
      const currentIsAdmin = currentUser?.role === 'admin'
      const companyId = currentUser?.company_profile_id ?? currentUser?.id
      let deptQuery = supabase
        .from('departments')
        .select('id,name,color,company_profile_id,email,full_name,phone,address,is_active,avatar_url,created_at')
        .order('created_at', { ascending: false })
      if (!currentIsAdmin) {
        if (currentUser.role === 'department') {
          deptQuery = deptQuery.eq('id', currentUser.department_id ?? currentUser.id)
        } else if (currentUser.role === 'company_user' && currentUser.sub_role === 'manager' && currentUser.department_id) {
          deptQuery = deptQuery.eq('id', currentUser.department_id)
        } else if (currentUser.role === 'company' || currentUser.role === 'company_user') {
          deptQuery = deptQuery.eq('company_profile_id', companyId)
        }
      }

      const { data: deptData, error: deptError } = await deptQuery
      if (deptError) throw deptError

      let resolvedDeptData = deptData ?? []

      if (currentIsAdmin) {
        const { data: profileData, error: profileErr } = await fetchCompanyProfilesForAdmin()
        if (profileErr) throw profileErr
        const allProfiles = profileData ?? []
        let backfilled = false
        for (const profile of allProfiles.filter((p) => !p.deleted_at && p.is_active !== false)) {
          const hasLinked = resolvedDeptData.some((d) => d.company_profile_id === profile.id)
          if (!hasLinked) {
            try {
              await ensureLinkedDepartment(profile)
              backfilled = true
            } catch (e) {
              console.warn('ensureLinkedDepartment skipped:', profile.email, e?.message)
            }
          }
        }
        if (backfilled) {
          const { data: refreshedDepts, error: refreshDeptErr } = await supabase
            .from('departments')
            .select('id,name,color,company_profile_id,email,full_name,phone,address,is_active,avatar_url,created_at')
            .order('created_at', { ascending: false })
          if (refreshDeptErr) throw refreshDeptErr
          resolvedDeptData = refreshedDepts ?? []
        }

        // Keep deactivated profiles visible so admins can Activate again.
        // Soft-deleted (deleted_at) rows go to a separate restore list.
        setCompanyProfiles(
          allProfiles.filter((p) => !p.deleted_at).map(sanitizeCompanyProfileForAdmin),
        )
        setDeletedCompanyProfiles(
          allProfiles.filter((p) => p.deleted_at).map(sanitizeCompanyProfileForAdmin),
        )

        const { data: logs, error: logsErr } = await supabase
          .from('audit_logs')
          .select('id,actor_role,actor_id,actor_email,action,entity_type,entity_id,details,created_at')
          .order('created_at', { ascending: false })
          .limit(200)
        if (logsErr) {
          setAuditError(logsErr.message)
          setAuditLogs([])
        } else {
          setAuditError(null)
          setAuditLogs(logs ?? [])
        }

        await maybePurgeExpiredSensitiveEvents()

        const sensitiveResult = await fetchSensitiveEvents(supabase)
        setSensitiveEvents(sensitiveResult.data ?? [])
        setSensitiveEventsUsingFallback(sensitiveResult.usingFallback)
        setSensitiveEventsError(sensitiveResult.error ?? null)
      } else {
        setCompanyProfiles([])
        setDeletedCompanyProfiles([])
        setAuditLogs([])
        setAuditError(null)
        setSensitiveEvents([])
        setSensitiveEventsError(null)
        setSensitiveEventsUsingFallback(false)
      }

      setDepartments(resolvedDeptData)
      const scopedDepartmentIds = resolvedDeptData.map((d) => d.id)

      const txnData = await fetchTransactionsScoped(scopedDepartmentIds, currentIsAdmin)
      setTransactions(txnData)

      const monthKey = ext.budgetMonthKey || new Date().toISOString().slice(0, 7)
      let budgetQuery = supabase
        .from('department_budgets')
        .select('department_id,budget_amount,month_key')
        .eq('month_key', monthKey)
      if (!currentIsAdmin) {
        if (scopedDepartmentIds.length > 0) budgetQuery = budgetQuery.in('department_id', scopedDepartmentIds)
        else {
          setDepartmentBudgets([])
          budgetQuery = null
        }
      }
      if (budgetQuery) {
        const { data: budgetData } = await budgetQuery
        setDepartmentBudgets(budgetData ?? [])
      }

      const scopedCompanyId = currentUser?.company_profile_id ?? currentUser?.id
      await loadExtrasData(currentUser, scopedDepartmentIds, scopedCompanyId, {
        setCategories: ext.setCategories,
        setRecurringEntries: ext.setRecurringEntries,
        setNotifications: ext.setNotifications,
        setCompanyUsers: ext.setCompanyUsers,
        setDepartmentTargets: ext.setDepartmentTargets,
        setTaxReportSettings: ext.setTaxReportSettings,
      })
    } catch (e) {
      setError(formatSupabaseError(e) ?? 'Failed to fetch data.')
      setDepartments([])
      setTransactions([])
      setDepartmentBudgets([])
      setCompanyProfiles([])
      setDeletedCompanyProfiles([])
    } finally {
      if (refreshGen === refreshGenRef.current) setLoading(false)
    }
  }, [authUser, ext.budgetMonthKey, ext.setCategories, ext.setRecurringEntries, ext.setNotifications, ext.setCompanyUsers, ext.setDepartmentTargets, ext.setTaxReportSettings])

  refreshDataRef.current = refreshData

  const retryDbConnection = useCallback(async () => {
    setDbConnectionChecking(true)
    const result = await checkSupabaseConnection()
    setDbConnectionError(result.ok ? null : result.error)
    setDbConnectionChecking(false)
    return result
  }, [])

  useEffect(() => {
    if (authUser) refreshData(authUser)
    else setLoading(false)
  }, [authUser, refreshData])

  // EMS-style daily backup: if admin opens the app and today's snapshot is missing, create it.
  useEffect(() => {
    if (!authUser || authUser.role !== 'admin' || !supabase) return undefined
    let cancelled = false
    let running = false
    const checkDailyBackup = async () => {
      if (running || cancelled) return
      running = true
      try {
        const result = await ensureDailySystemBackup({ createdBy: authUser.id, trigger: 'auto' })
        if (cancelled || !result.ran) return
        await logAudit({
          actor: authUser,
          action: 'backup_system_data',
          entityType: 'system',
          entityId: 'all',
          details: {
            trigger: 'auto',
            backupDate: result.backup?.backupDate,
            rowCount: result.backup?.rowCount,
          },
        })
      } catch (e) {
        console.warn('daily backup:', e?.message || e)
      } finally {
        running = false
      }
    }
    checkDailyBackup()
    const timer = setInterval(checkDailyBackup, 15 * 60 * 1000)
    window.addEventListener('focus', checkDailyBackup)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', checkDailyBackup)
    }
  }, [authUser])

  const baseTotals = useMemo(() => computeTotals(transactions), [transactions])
  const departmentAggregates = useMemo(() => computeDepartmentAggregates(departments, transactions), [departments, transactions])
  const budgetByDepartment = useMemo(() => {
    const byDept = {}
    for (const b of departmentBudgets ?? []) byDept[b.department_id] = Number(b.budget_amount ?? 0)
    return byDept
  }, [departmentBudgets])
  const totals = useMemo(() => ({ ...baseTotals, monthlyTrends: computeMonthlyTrends(transactions), budgetByDepartment }), [baseTotals, transactions, budgetByDepartment])
  const companyAggregates = useMemo(() => {
    if (!isAdmin) return []
    return computeBranchAggregates(departments, transactions)
  }, [isAdmin, departments, transactions])

  const categorySuggestions = useMemo(() => {
    const cats = [
      ...(transactions ?? []).map((t) => t.category),
      ...(ext.categories ?? []).map((c) => c.name),
    ].filter(Boolean)
    return Array.from(new Set(cats)).sort((a, b) => a.localeCompare(b))
  }, [transactions, ext.categories])

  const handleLogin = useCallback(async ({ email, password, rememberMe = false, device: loginDevice }) => {
    if (!supabase) {
      setAuthError(supabaseConfigError ?? 'Database not configured.')
      return
    }
    setAuthSubmitting(true)
    setAuthError(null)

    const device = loginDevice ?? getDeviceInfo()
    const normalized = normalizeEmail(email)

    async function logLoginFailed(reason) {
      const message = buildSensitiveMessage({
        action: 'Login failed',
        actorEmail: normalized,
        deviceLabel: device.label,
        extra: reason,
      })
      await recordSensitiveActivity({
        eventType: 'login_failed',
        actor: { email: normalized, role: 'unknown' },
        success: false,
        message,
        device,
        notifyTitle: 'Login failed',
        notifyBody: message,
      })
    }

    async function finishLogin(user) {
      const message = buildSensitiveMessage({
        action: 'Login successful',
        actorEmail: user.email,
        deviceLabel: device.label,
      })
      await recordSensitiveActivity({
        eventType: 'login_success',
        actor: user,
        success: true,
        message,
        device,
        notifyTitle: 'Login successful',
        notifyBody: message,
      })
      setDbConnectionError(null)
      await registerSession(user)
      persistAuthUser(user, rememberMe)
      setAuthUser(user)
      await refreshData(user)
      navigate('/dashboard')
    }

    try {
      if (dbConnectionError) {
        const conn = await retryDbConnection()
        if (!conn.ok) {
          setAuthError(conn.error ?? 'Cannot reach the database.')
          return
        }
      }

      if (await isLoginBlocked(normalized)) {
        await logLoginFailed('Too many attempts — blocked for 15 minutes')
        setAuthError('Too many attempts. Try again in 15 minutes.')
        return
      }

      const { data: adminRows, error: adminErr } = await supabase
        .from('admin_accounts')
        .select('id,email,password,avatar_url,created_at')
        .eq('email', normalized)
        .limit(1)

      if (adminErr) throw adminErr
      if (adminRows?.length && (await verifyPassword(password, adminRows[0].password))) {
        await upgradePasswordIfNeeded(password, adminRows[0].password, 'admin_accounts', adminRows[0].id)
        await clearLoginAttempts(normalized)
        await safeUpdateLastLogin('admin_accounts', adminRows[0].id)
        const user = {
          id: adminRows[0].id,
          role: 'admin',
          email: adminRows[0].email,
          avatar_url: adminRows[0].avatar_url,
          created_at: adminRows[0].created_at,
        }
        await finishLogin(user)
        return
      }

      const { data: deptRows, error: deptErr } = await supabase
        .from('departments')
        .select('id,name,email,password,full_name,phone,address,avatar_url,is_active,created_at')
        .eq('email', normalized)
        .limit(1)

      if (deptErr && !String(deptErr.message).includes('does not exist')) throw deptErr
      if (deptRows?.length && deptRows[0].password) {
        if (await verifyPassword(password, deptRows[0].password)) {
          const dept = deptRows[0]
          if (dept.is_active === false) {
            await logLoginFailed('Department account inactive')
            setAuthError('This department account is inactive. Contact admin.')
            return
          }
          await upgradePasswordIfNeeded(password, dept.password, 'departments', dept.id)
          await clearLoginAttempts(normalized)
          await safeUpdateLastLogin('departments', dept.id)
          const user = {
            id: dept.id,
            role: 'department',
            email: dept.email,
            department_id: dept.id,
            name: dept.name,
            full_name: dept.full_name,
            phone: dept.phone,
            address: dept.address,
            avatar_url: dept.avatar_url,
            created_at: dept.created_at,
          }
          await finishLogin(user)
          return
        }
        await recordLoginAttempt(normalized)
        await logLoginFailed('Invalid password — department account')
        setAuthError('Invalid email or password.')
        return
      }

      const { data: companyRows, error: companyErr } = await supabase
        .from('company_profiles')
        .select('id,email,password,full_name,phone,address,avatar_url,is_active,deleted_at,created_at')
        .eq('email', normalized)
        .limit(1)

      if (companyErr) throw companyErr
      if (companyRows?.length && (await verifyPassword(password, companyRows[0].password))) {
        const c = companyRows[0]
        await upgradePasswordIfNeeded(password, companyRows[0].password, 'company_profiles', c.id)
        if (c.deleted_at) {
          await logLoginFailed('Account removed')
          setAuthError('This account has been removed. Contact admin to restore it.')
          return
        }
        if (c.is_active === false) {
          await logLoginFailed('Account inactive')
          setAuthError('Account is inactive. Contact admin.')
          return
        }
        await clearLoginAttempts(normalized)
        await safeUpdateLastLogin('company_profiles', c.id)
        const user = {
          id: c.id,
          role: 'company',
          email: c.email,
          full_name: c.full_name,
          phone: c.phone,
          address: c.address,
          avatar_url: c.avatar_url,
          created_at: c.created_at,
        }
        await finishLogin(user)
        return
      }

      const teamUser = await tryLoginCompanyUser(normalized, password, upgradePasswordIfNeeded)
      if (teamUser) {
        await clearLoginAttempts(normalized)
        await safeUpdateLastLogin('company_users', teamUser.id)
        await finishLogin(teamUser)
        return
      }

      await recordLoginAttempt(normalized)
      await logLoginFailed('Invalid email or password')
      setAuthError('Invalid email or password.')
    } catch (e) {
      const reason = e?.message ?? 'Login error'
      if (normalized) {
        await logLoginFailed(reason).catch(() => {})
      }
      setAuthError(formatSupabaseError(e))
    } finally {
      setAuthSubmitting(false)
    }
  }, [navigate, refreshData, upgradePasswordIfNeeded, dbConnectionError, retryDbConnection])

  const handleLogout = useCallback(async () => {
    const user = authUser
    setAuthUser(null)
    setAuthError(null)
    if (user) await revokeCurrentSession(user)
    clearAuthStorage()
    navigate('/login')
  }, [navigate, authUser])

  useEffect(() => {
    if (!authHydrated || !authUser) return

    async function checkRevoked() {
      const valid = await ensureSessionValid(authUser)
      if (!valid) handleLogout()
    }

    function onVisible() {
      if (document.visibilityState === 'visible') checkRevoked()
    }

    const interval = setInterval(checkRevoked, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [authHydrated, authUser, handleLogout])

  const handleCreateDepartment = useCallback(async ({ name, color, email, password }) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    setAddDepartmentSaving(true)
    try {
      const normalizedEmail = email ? normalizeEmail(email) : null
      if (isAdmin && !normalizedEmail) throw new Error('Department login email is required.')
      if (isAdmin && (!password || password.length < 8)) {
        throw new Error('Department password must be at least 8 characters.')
      }

      const insertPayload = {
        id: crypto.randomUUID(),
        name,
        color,
        company_profile_id: isAdmin ? null : authUser?.id,
      }
      if (isAdmin && normalizedEmail) {
        insertPayload.email = normalizedEmail
        insertPayload.password = await hashPassword(password)
        insertPayload.is_active = true
      }

      const { data: insertedDept, error: insertError } = await supabase
        .from('departments')
        .insert(insertPayload)
        .select('id')
        .single()
      if (insertError) throw new Error(formatSupabaseError(insertError))
      await logAudit({
        actor: authUser,
        action: 'create',
        entityType: 'department',
        entityId: insertedDept?.id,
        details: { name, email: normalizedEmail },
      })
      await refreshData()
      showToast('success', 'Department created with its own login.')
    } finally {
      setAddDepartmentSaving(false)
    }
  }, [refreshData, showToast, isAdmin, authUser])

  const handleCreateEntry = useCallback(async (payload) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    setAddEntrySaving(true)
    try {
      const {
        department_id,
        type,
        other_direction = null,
        category,
        description,
        amount,
        entry_date,
        currency = DEFAULT_CURRENCY,
        exchange_rate = 1,
        vat_rate = 0,
        payment_method = 'cash',
        attachment_path = null,
        receipt_url = null,
        raw_ocr_data = null,
        invoice_ref = null,
        due_date = null,
      } = payload
      const finalDepartmentId = isAdmin
        ? department_id
        : companyDepartmentIds.includes(department_id)
          ? department_id
          : companyDepartmentIds[0]
      if (!finalDepartmentId) throw new Error('Create a department first.')
      const status = isAdmin ? 'approved' : 'pending'
      const otherDir = type === 'other' ? other_direction || 'expense' : null
      const { data: insertedTx, error: insertError } = await insertTransaction(supabase, {
        department_id: finalDepartmentId,
        type,
        other_direction: otherDir,
        category,
        description,
        amount,
        entry_date,
        status,
        currency,
        exchange_rate,
        vat_rate,
        attachment_path,
        receipt_url,
        raw_ocr_data,
        invoice_ref,
        due_date,
        payment_method,
      })
      if (insertError) throw new Error(formatSupabaseError(insertError))
      await logAudit({
        actor: authUser,
        action: 'create',
        entityType: 'transaction',
        entityId: insertedTx?.id,
        details: {
          department_id: finalDepartmentId,
          type,
          other_direction: resolvedOtherDirectionForAudit({ type, other_direction: otherDir }),
          category,
          amount,
        },
      })
      ext.setLastEntry(payload)
      const dept = departments.find((d) => d.id === finalDepartmentId)
      const spend = countsAsBudgetSpend({ type, other_direction: otherDir }) ? Number(amount) : 0
      const budget = Number(departmentBudgets.find((b) => b.department_id === finalDepartmentId)?.budget_amount ?? 0)
      if (dept && spend > 0 && budget) {
        await checkBudgetAndNotify({
          userRole: authUser.role,
          userId: authUser.id,
          departmentName: dept.name,
          costs: spend,
          budget,
        })
      }
      await refreshData()
      const dayLabel = formatDayHeading(entry_date)
      showToast(
        'success',
        status === 'pending' ? `Entry for ${dayLabel} submitted for approval.` : `Entry saved for ${dayLabel}.`,
      )
    } finally {
      setAddEntrySaving(false)
    }
  }, [refreshData, showToast, isAdmin, companyDepartmentIds, authUser, ext, departments, departmentBudgets])

  const handleDeleteDepartment = useCallback(async (id, password) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    setError(null)
    setLoading(true)
    const device = getDeviceInfo()
    const attemptMsg = buildSensitiveMessage({
      action: 'Delete department attempt',
      actorEmail: authUser?.email,
      deviceLabel: device.label,
    })
    await recordSensitiveActivity({
      eventType: 'delete_attempt',
      actor: authUser,
      entityType: 'department',
      entityId: id,
      success: false,
      message: attemptMsg,
      device,
      notifyTitle: 'Delete attempt',
      notifyBody: attemptMsg,
    })
    try {
      if (!password) throw new Error('Login password is required to delete.')
      await verifyAuthUserPassword(authUser, password)
      if (!isAdmin && !companyDepartmentIds.includes(id)) {
        throw new Error('You can only delete your own departments.')
      }
      const dept = departments.find((d) => d.id === id)
      const { error: delError } = await supabase.from('departments').delete().eq('id', id)
      if (delError) throw delError
      if (dept?.company_profile_id) {
        const { error: profileDelError } = await supabase.from('company_profiles').delete().eq('id', dept.company_profile_id)
        if (profileDelError) throw profileDelError
      }
      await logAudit({ actor: authUser, action: 'delete', entityType: 'department', entityId: id })
      const successMsg = buildSensitiveMessage({
        action: 'Department deleted',
        actorEmail: authUser?.email,
        deviceLabel: device.label,
      })
      await recordSensitiveActivity({
        eventType: 'delete_success',
        actor: authUser,
        entityType: 'department',
        entityId: id,
        success: true,
        message: successMsg,
        device,
        notifyTitle: 'Delete success',
        notifyBody: successMsg,
      })
      await refreshData()
      showToast('success', 'Department deleted.')
    } catch (e) {
      const failMsg = buildSensitiveMessage({
        action: 'Failed delete department',
        actorEmail: authUser?.email,
        deviceLabel: device.label,
        extra: e?.message ?? 'Unknown error',
      })
      await recordSensitiveActivity({
        eventType: 'delete_failed',
        actor: authUser,
        entityType: 'department',
        entityId: id,
        success: false,
        message: failMsg,
        device,
        notifyTitle: 'Delete failed',
        notifyBody: failMsg,
      })
      setError(e?.message ?? 'Failed to delete department.')
      throw e
    } finally {
      setLoading(false)
    }
  }, [refreshData, showToast, isAdmin, companyDepartmentIds, authUser, departments])

  const handleDeleteTransaction = useCallback(async (id, password) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    setError(null)
    setLoading(true)
    const device = getDeviceInfo()
    const isDepartmentActor = authUser?.role === 'department'
    const attemptMsg = buildSensitiveMessage({
      action: 'Delete entry attempt',
      actorEmail: authUser?.email,
      deviceLabel: device.label,
      extra: isDepartmentActor ? 'Department account' : undefined,
    })
    if (isDepartmentActor) {
      await recordSensitiveActivity({
        eventType: 'delete_attempt',
        actor: authUser,
        entityType: 'transaction',
        entityId: id,
        success: false,
        message: attemptMsg,
        device,
        notifyTitle: 'Delete attempt',
        notifyBody: attemptMsg,
      })
    }
    try {
      if (!password) throw new Error(isAdmin ? 'Login password is required to delete entries.' : 'Delete password is required to delete entries.')
      if (isAdmin) {
        await verifyAuthUserPassword(authUser, password)
      } else {
        await verifyDeleteTransactionPassword(authUser, password)
      }
      let query = supabase.from('transactions').delete().eq('id', id)
      if (!isAdmin) {
        if (companyDepartmentIds.length === 0) throw new Error('No departments found for this account.')
        query = query.in('department_id', companyDepartmentIds)
      }
      const { error: delError } = await query
      if (delError) throw delError
      await logAudit({ actor: authUser, action: 'delete', entityType: 'transaction', entityId: id })
      const successMsg = buildSensitiveMessage({
        action: 'Entry deleted',
        actorEmail: authUser?.email,
        deviceLabel: device.label,
      })
      if (isDepartmentActor) {
        await recordSensitiveActivity({
          eventType: 'delete_success',
          actor: authUser,
          entityType: 'transaction',
          entityId: id,
          success: true,
          message: successMsg,
          device,
          notifyTitle: 'Delete success',
          notifyBody: successMsg,
        })
      }
      await refreshData()
      showToast('success', 'Transaction deleted.')
    } catch (e) {
      const failMsg = buildSensitiveMessage({
        action: 'Failed delete entry',
        actorEmail: authUser?.email,
        deviceLabel: device.label,
        extra: e?.message ?? 'Unknown error',
      })
      if (isDepartmentActor) {
        await recordSensitiveActivity({
          eventType: 'delete_failed',
          actor: authUser,
          entityType: 'transaction',
          entityId: id,
          success: false,
          message: failMsg,
          device,
          notifyTitle: 'Delete failed',
          notifyBody: failMsg,
        })
      }
      setError(e?.message ?? 'Failed to delete transaction.')
      throw e
    } finally {
      setLoading(false)
    }
  }, [refreshData, showToast, isAdmin, companyDepartmentIds, authUser])

  const handleVerifyDeletePassword = useCallback(async (password) => {
    await verifyDeleteTransactionPassword(authUser, password)
  }, [authUser])

  const clearDepartmentEditVerification = useCallback(() => {
    departmentEditVerifiedRef.current = false
  }, [])

  const handleEditTransaction = useCallback((tx, { verified = false } = {}) => {
    if (authUser?.role === 'department' && !verified) {
      showToast('error', 'Enter the delete password before editing.')
      return
    }
    if (authUser?.role === 'department') {
      departmentEditVerifiedRef.current = true
    }
    setSelectedTransaction(tx)
    setEditTransactionOpen(true)
  }, [authUser?.role, showToast])

  const handleUpdateTransaction = useCallback(async ({
    id,
    department_id,
    type,
    other_direction = null,
    category,
    description,
    amount,
    entry_date,
    payment_method = 'cash',
    attachment_path,
    receipt_url,
    raw_ocr_data,
  }) => {
    if (authUser?.role === 'department' && !departmentEditVerifiedRef.current) {
      showToast('error', 'Enter the delete password before editing.')
      return
    }
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    setEditEntrySaving(true)
    try {
      const otherDir = type === 'other' ? other_direction || 'expense' : null
      const before =
        selectedTransaction?.id === id
          ? selectedTransaction
          : (transactions ?? []).find((t) => t.id === id) ?? null
      const after = {
        department_id,
        type,
        other_direction: otherDir,
        category,
        description,
        amount,
        entry_date,
        payment_method,
        attachment_path,
        receipt_url,
        raw_ocr_data,
      }
      const applyScope = (query) => {
        if (!isAdmin) {
          if (companyDepartmentIds.length === 0) throw new Error('No departments found for this account.')
          if (!companyDepartmentIds.includes(department_id)) throw new Error('Invalid department for your account.')
          return query.in('department_id', companyDepartmentIds)
        }
        return query
      }
      const { error: updateError } = await updateTransaction(
        supabase,
        id,
        after,
        { applyScope },
      )
      if (updateError) throw new Error(formatSupabaseError(updateError))
      const historyResult = await recordTransactionEdit({
        transactionId: id,
        actor: authUser,
        before,
        after,
      })
      await logAudit({
        actor: authUser,
        action: 'update',
        entityType: 'transaction',
        entityId: id,
        details: {
          department_id,
          type,
          other_direction: resolvedOtherDirectionForAudit({ type, other_direction: otherDir }),
          category,
          amount,
        },
      })
      if (authUser?.role === 'department') {
        await recordActorSensitiveActivity({
          action: 'Entry updated',
          eventType: 'entry_update',
          actor: authUser,
          entityType: 'transaction',
          entityId: id,
          success: true,
          device: getDeviceInfo(),
          extra: `${type} · ${category} · ${Number(amount).toFixed(2)}`,
          notifyTitle: 'Entry updated',
        })
      }
      await refreshData()
      if (historyResult?.error) {
        // Transaction row was saved; history insert failed — error includes
        // Supabase code/message/details/hint (see formatHistorySupabaseError).
        throw new Error(
          `Transaction saved, but edit history was not recorded. ${historyResult.error}`,
        )
      }
      showToast('success', 'Transaction updated.')
    } catch (e) {
      if (authUser?.role === 'department') {
        await recordActorSensitiveActivity({
          action: 'Entry update failed',
          eventType: 'entry_update',
          actor: authUser,
          entityType: 'transaction',
          entityId: id,
          success: false,
          device: getDeviceInfo(),
          extra: e?.message ?? 'Unknown error',
          notifyTitle: 'Entry update failed',
        })
      }
      throw e
    } finally {
      setEditEntrySaving(false)
      if (authUser?.role === 'department') {
        departmentEditVerifiedRef.current = false
      }
    }
  }, [refreshData, showToast, isAdmin, companyDepartmentIds, authUser, selectedTransaction, transactions])

  const handleSaveBudget = useCallback(async (departmentId, budgetAmount) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    if (!isAdmin && !companyDepartmentIds.includes(departmentId)) {
      throw new Error('You can only update budgets for your own departments.')
    }
    const monthKey = ext.budgetMonthKey || new Date().toISOString().slice(0, 7)
    const { error: upsertError } = await supabase
      .from('department_budgets')
      .upsert({ department_id: departmentId, month_key: monthKey, budget_amount: String(budgetAmount) }, { onConflict: 'department_id,month_key' })
    if (upsertError) throw upsertError
    await logAudit({
      actor: authUser,
      action: 'upsert',
      entityType: 'department_budget',
      entityId: departmentId,
      details: { month_key: monthKey, budget_amount: budgetAmount },
    })
    await refreshData()
    showToast('success', 'Budget saved.')
  }, [refreshData, showToast, isAdmin, companyDepartmentIds, authUser, ext.budgetMonthKey])

  const handleCreateCompanyProfile = useCallback(async ({ name, email, password, deletePassword }) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    const trimmedName = String(name ?? '').trim()
    if (!trimmedName) throw new Error('Department name is required.')
    const normalized = normalizeEmail(email)
    if (!deletePassword || deletePassword.length < 4) {
      throw new Error('Delete transaction password must be at least 4 characters.')
    }
    const passwordHash = await hashPassword(password)
    const deletePasswordHash = await hashPassword(deletePassword)
    const profileId = crypto.randomUUID()

    const { data: inserted, error: insertError } = await supabase
      .from('company_profiles')
      .insert({
        id: profileId,
        email: normalized,
        password: passwordHash,
        delete_password: deletePasswordHash,
        is_active: true,
      })
      .select('id')
      .single()
    if (insertError) throw new Error(formatSupabaseError(insertError))
    try {
      await createLinkedDepartment({
        profileId: inserted.id,
        email: normalized,
        passwordHash,
        deletePasswordHash,
        name: trimmedName,
        isActive: true,
      })
    } catch (deptErr) {
      await supabase.from('company_profiles').delete().eq('id', inserted.id)
      throw deptErr
    }
    await logAudit({
      actor: authUser,
      action: 'create',
      entityType: 'company_profile',
      entityId: inserted?.id,
      details: { email: normalized, department_name: trimmedName },
    })
    try {
      await refreshData()
    } catch (refreshErr) {
      // Row was created; missing columns like is_active should not undo create.
      console.warn('refresh after create skipped:', refreshErr?.message ?? refreshErr)
    }
    showToast('success', `${trimmedName} created. Find it under Departments in the sidebar.`)
  }, [refreshData, showToast, authUser])

  const handleDeleteCompanyProfile = useCallback(async (id, password) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    if (!password) throw new Error('Login password is required to delete.')
    await verifyAuthUserPassword(authUser, password)
    const { error: deptDelError } = await supabase.from('departments').delete().eq('company_profile_id', id)
    if (deptDelError) throw deptDelError
    const { error: delError } = await supabase.from('company_profiles').delete().eq('id', id)
    if (delError) throw delError
    await logAudit({ actor: authUser, action: 'delete', entityType: 'company_profile', entityId: id })
    await refreshData()
    showToast('success', 'Department permanently deleted.')
  }, [refreshData, showToast, authUser])

  const handleRestoreCompanyProfile = useCallback(async (id) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    const { error: restoreError } = await supabase
      .from('company_profiles')
      .update({ deleted_at: null, is_active: true })
      .eq('id', id)
    if (restoreError) throw restoreError
    await syncLinkedDepartments(id, { deleted_at: null, is_active: true })
    await logAudit({ actor: authUser, action: 'restore', entityType: 'company_profile', entityId: id })
    await refreshData()
    showToast('success', 'Department account restored.')
  }, [refreshData, showToast, authUser])

  const handleClearAllData = useCallback(async (adminPassword) => {
    if (!isAdmin) throw new Error('Only admins can clear system data.')
    if (!authUser || authUser.role !== 'admin') {
      throw new Error('Only admins can clear system data.')
    }
    await verifyAuthUserPassword(authUser, adminPassword)
    await clearAllSystemData()
    await logAudit({ actor: authUser, action: 'clear_all_data', entityType: 'system', entityId: 'all' })
    await refreshData()
    showToast('success', 'All system data cleared. Default categories restored.')
  }, [isAdmin, refreshData, showToast, authUser])

  const handleBackupSystemData = useCallback(async ({ download = false } = {}) => {
    if (!isAdmin) throw new Error('Only admins can back up system data.')
    if (!authUser || authUser.role !== 'admin') {
      throw new Error('Only admins can back up system data.')
    }
    const result = await createManualSystemBackup({ download, createdBy: authUser.id })
    const totalRows = result.rowCount ?? Object.values(result.tableCounts ?? {}).reduce((sum, n) => sum + n, 0)
    await logAudit({
      actor: authUser,
      action: 'backup_system_data',
      entityType: 'system',
      entityId: 'all',
      details: {
        filename: result.filename,
        totalRows,
        tableCounts: result.tableCounts,
        trigger: 'manual',
        stored: result.stored !== false,
        place: result.place,
        downloaded: Boolean(download),
      },
    })
    showToast(
      'success',
      download
        ? `Backup saved on the server and downloaded (${result.filename}).`
        : `Backup saved on the server (${result.filename || result.id}).`,
    )
    return result
  }, [isAdmin, authUser, showToast])

  const handleDownloadLocalBackupOnly = useCallback(async () => {
    if (!isAdmin) throw new Error('Only admins can download backups.')
    const result = await downloadLocalBackupOnly()
    showToast('success', `Downloaded local copy only (${result.filename}). Server storage is not configured yet.`)
    return result
  }, [isAdmin, showToast])

  const handleListSystemBackups = useCallback(async () => {
    if (!isAdmin) throw new Error('Only admins can list backups.')
    return listSystemBackups()
  }, [isAdmin])

  const handleDownloadStoredBackup = useCallback(
    async (id) => {
      if (!isAdmin) throw new Error('Only admins can download backups.')
      const result = await downloadStoredBackup(id)
      showToast('success', `Downloaded ${result.filename}.`)
      return result
    },
    [isAdmin, showToast],
  )

  const handleToggleCompanyProfileActive = useCallback(async (id, isActive) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    const profile = [...companyProfiles, ...deletedCompanyProfiles].find((p) => p.id === id)
    if (profile?.deleted_at) {
      throw new Error('Restore this account before changing its status.')
    }
    const { error: updateError } = await supabase
      .from('company_profiles')
      .update({ is_active: isActive })
      .eq('id', id)
    if (updateError) {
      if (String(updateError.message).includes('is_active')) {
        throw new Error('Run supabase/account_lifecycle.sql in Supabase to enable account deactivation.')
      }
      throw updateError
    }
    await syncLinkedDepartments(id, { is_active: isActive })
    await logAudit({
      actor: authUser,
      action: isActive ? 'activate' : 'deactivate',
      entityType: 'company_profile',
      entityId: id,
    })
    await refreshData()
    showToast('success', `Department account ${isActive ? 'activated' : 'deactivated'}.`)
  }, [refreshData, showToast, authUser, companyProfiles, deletedCompanyProfiles])

  const handleAdminResetCompanyPassword = useCallback(async (id, newPassword) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    if (!newPassword || newPassword.length < 4) {
      throw new Error('Password must be at least 4 characters.')
    }
    const passwordHash = await hashPassword(newPassword)
    const { error: updateError } = await supabase
      .from('company_profiles')
      .update({ password: passwordHash })
      .eq('id', id)
    if (updateError) throw updateError
    await syncLinkedDepartments(id, { password: passwordHash })
    await logAudit({ actor: authUser, action: 'reset_password', entityType: 'company_profile', entityId: id })
    await recordActorSensitiveActivity({
      action: 'Password reset',
      eventType: 'password_reset',
      actor: authUser,
      entityType: 'company_profile',
      entityId: id,
      success: true,
      device: getDeviceInfo(),
      extra: 'Admin reset department login password',
      notifyTitle: 'Password reset',
    })
    await refreshData()
    showToast('success', 'Department password reset.')
  }, [refreshData, showToast, authUser])

  const handleAdminSetDeletePassword = useCallback(async (id, newPassword) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    if (!newPassword || newPassword.length < 4) {
      throw new Error('Delete password must be at least 4 characters.')
    }
    const deletePasswordHash = await hashPassword(newPassword)
    const { error: updateError } = await supabase
      .from('company_profiles')
      .update({ delete_password: deletePasswordHash })
      .eq('id', id)
    if (updateError) {
      if (String(updateError.message).includes('delete_password')) {
        throw new Error('Run supabase/delete_transaction_password.sql in Supabase to enable delete passwords.')
      }
      throw updateError
    }
    await syncLinkedDepartments(id, { delete_password: deletePasswordHash })
    await logAudit({ actor: authUser, action: 'set_delete_password', entityType: 'company_profile', entityId: id })
    await recordActorSensitiveActivity({
      action: 'Delete password changed',
      eventType: 'password_change',
      actor: authUser,
      entityType: 'company_profile',
      entityId: id,
      success: true,
      device: getDeviceInfo(),
      extra: 'Admin updated delete transaction password',
      notifyTitle: 'Delete password changed',
    })
    await refreshData()
    showToast('success', 'Delete transaction password updated.')
  }, [refreshData, showToast, authUser])

  const handleUpdateCompanyProfile = useCallback(async (id, { name, email, full_name, phone, address, adminPassword }) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    if (!authUser || authUser.role !== 'admin') {
      throw new Error('Only admins can edit department profiles.')
    }
    await verifyAuthUserPassword(authUser, adminPassword)

    const trimmedName = String(name ?? '').trim()
    if (!trimmedName) throw new Error('Department name is required.')
    const normalized = normalizeEmail(email)

    const profilePatch = {
      email: normalized,
      full_name: full_name?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
    }

    const { error: updateError } = await supabase.from('company_profiles').update(profilePatch).eq('id', id)
    if (updateError) throw new Error(formatSupabaseError(updateError))

    await syncLinkedDepartments(id, {
      name: trimmedName.slice(0, 80),
      email: normalized,
      full_name: profilePatch.full_name,
      phone: profilePatch.phone,
      address: profilePatch.address,
    })

    await logAudit({
      actor: authUser,
      action: 'update',
      entityType: 'company_profile',
      entityId: id,
      details: { email: normalized, department_name: trimmedName },
    })
    await recordActorSensitiveActivity({
      action: 'Profile updated',
      eventType: 'profile_update',
      actor: authUser,
      entityType: 'company_profile',
      entityId: id,
      success: true,
      device: getDeviceInfo(),
      extra: `Department profile updated for ${normalized}`,
      notifyTitle: 'Profile updated',
    })
    await refreshData()
    showToast('success', 'Department profile updated.')
  }, [refreshData, showToast, authUser])

  const handleUpdatePassword = useCallback(async ({ currentPassword, newPassword }) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    if (!authUser) throw new Error('Not logged in.')

    let table = 'company_profiles'
    let id = authUser.id
    if (authUser.role === 'admin') table = 'admin_accounts'
    else if (authUser.role === 'department') {
      table = 'departments'
      id = authUser.department_id ?? authUser.id
    } else if (authUser.role === 'company_user') {
      table = 'company_users'
      id = authUser.id
    }

    const entityType =
      authUser.role === 'admin'
        ? 'admin_account'
        : authUser.role === 'department'
          ? 'department'
          : authUser.role === 'company_user'
            ? 'company_user'
            : 'company_profile'

    const roleLabel = authUser.role === 'department' ? 'Department account' : authUser.role

    try {
      const { data: row, error: fetchErr } = await supabase.from(table).select('password').eq('id', id).single()
      if (fetchErr) throw fetchErr
      if (!(await verifyPassword(currentPassword, row.password))) {
        await recordActorSensitiveActivity({
          action: 'Password change failed',
          eventType: 'password_change',
          actor: authUser,
          entityType,
          entityId: authUser.id,
          success: false,
          device: getDeviceInfo(),
          extra: `${roleLabel} — current password is incorrect`,
          notifyTitle: 'Password change failed',
        })
        throw new Error('Current password is incorrect.')
      }

      const passwordHash = await hashPassword(newPassword)
      const { error } = await supabase.from(table).update({ password: passwordHash }).eq('id', id)
      if (error) throw error

      await logAudit({ actor: authUser, action: 'change_password', entityType, entityId: authUser.id })
      await recordActorSensitiveActivity({
        action: 'Password changed',
        eventType: 'password_change',
        actor: authUser,
        entityType,
        entityId: authUser.id,
        success: true,
        device: getDeviceInfo(),
        extra: roleLabel,
        notifyTitle: 'Password changed',
      })
      showToast('success', 'Password updated.')
    } catch (e) {
      if (e?.message !== 'Current password is incorrect.') {
        await recordActorSensitiveActivity({
          action: 'Password change failed',
          eventType: 'password_change',
          actor: authUser,
          entityType,
          entityId: authUser.id,
          success: false,
          device: getDeviceInfo(),
          extra: `${roleLabel} — ${e?.message ?? 'Unknown error'}`,
          notifyTitle: 'Password change failed',
        })
      }
      throw e
    }
  }, [authUser, showToast])

  const handleUpdateDetails = useCallback(async ({ full_name, phone, address }) => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    if (!authUser) return

    if (authUser.role === 'department') {
      const deptId = authUser.department_id ?? authUser.id
      const { error: updateError } = await supabase
        .from('departments')
        .update({ full_name, phone, address })
        .eq('id', deptId)
      if (updateError) throw new Error(formatSupabaseError(updateError))
      setAuthUser((prev) => ({ ...prev, full_name, phone, address }))
      await recordActorSensitiveActivity({
        action: 'Profile updated',
        eventType: 'profile_update',
        actor: authUser,
        entityType: 'department',
        entityId: deptId,
        success: true,
        device: getDeviceInfo(),
        extra: 'Department profile details updated',
        notifyTitle: 'Department profile updated',
      })
      await refreshData()
      showToast('success', 'Department profile saved.')
      return
    }

    const companyId = authUser.role === 'company' ? authUser.id : authUser.company_profile_id
    if (!companyId) return

    const { error: updateError } = await supabase
      .from('company_profiles')
      .update({ full_name, phone, address })
      .eq('id', companyId)
    if (updateError) throw updateError
    setAuthUser((prev) => ({ ...prev, full_name, phone, address }))
    await recordActorSensitiveActivity({
      action: 'Profile updated',
      eventType: 'profile_update',
      actor: authUser,
      entityType: 'company_profile',
      entityId: companyId,
      success: true,
      device: getDeviceInfo(),
      extra: 'Personal details updated',
      notifyTitle: 'Profile updated',
    })
    await refreshData()
    showToast('success', 'Personal details saved.')
  }, [authUser, refreshData, showToast])

  const handleUpdateAdminMeta = useCallback(async ({ full_name, phone, location }) => {
    if (!authUser || authUser.role !== 'admin') return
    saveProfileMeta(authUser.id, { full_name, phone, location })
    setAuthUser((prev) => ({ ...prev, full_name, phone, address: location }))
    await recordActorSensitiveActivity({
      action: 'Profile updated',
      eventType: 'profile_update',
      actor: authUser,
      entityType: 'admin_account',
      entityId: authUser.id,
      success: true,
      device: getDeviceInfo(),
      extra: 'Admin profile details updated',
      notifyTitle: 'Profile updated',
    })
    showToast('success', 'Profile saved.')
  }, [authUser, showToast])

  const handleUpdateAvatar = useCallback(
    async (file) => {
      if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
      if (!authUser) throw new Error('Not logged in.')
      const target = avatarTarget(authUser)
      if (!target) throw new Error('Cannot update photo for this account.')

      let url
      try {
        url = await uploadAvatar(supabase, { file, userId: target.id, folder: target.folder })
      } catch (e) {
        throw new Error(formatSupabaseError(e))
      }
      const { error } = await supabase.from(target.table).update({ avatar_url: url }).eq('id', target.id)
      if (error) throw new Error(formatSupabaseError(error))
      if (authUser.role === 'admin') saveProfileMeta(authUser.id, { avatar_url: url })
      setAuthUser((prev) => ({ ...prev, avatar_url: url }))
      await recordActorSensitiveActivity({
        action: 'Profile updated',
        eventType: 'profile_update',
        actor: authUser,
        entityType: target.table === 'admin_accounts' ? 'admin_account' : target.table === 'departments' ? 'department' : target.table === 'company_users' ? 'company_user' : 'company_profile',
        entityId: target.id,
        success: true,
        device: getDeviceInfo(),
        extra: 'Avatar uploaded',
        notifyTitle: 'Profile updated',
      })
      showToast('success', 'Profile photo updated.')
      return url
    },
    [authUser, showToast],
  )

  const handleRemoveAvatar = useCallback(async () => {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase not configured.')
    if (!authUser) throw new Error('Not logged in.')
    const target = avatarTarget(authUser)
    if (!target) throw new Error('Cannot update photo for this account.')

    const { error } = await supabase.from(target.table).update({ avatar_url: null }).eq('id', target.id)
    if (error && authUser.role !== 'admin') throw new Error(formatSupabaseError(error))
    if (authUser.role === 'admin') saveProfileMeta(authUser.id, { avatar_url: '' })
    setAuthUser((prev) => ({ ...prev, avatar_url: null }))
    await recordActorSensitiveActivity({
      action: 'Profile updated',
      eventType: 'profile_update',
      actor: authUser,
      entityType: target.table === 'admin_accounts' ? 'admin_account' : target.table === 'departments' ? 'department' : target.table === 'company_users' ? 'company_user' : 'company_profile',
      entityId: target.id,
      success: true,
      device: getDeviceInfo(),
      extra: 'Avatar removed',
      notifyTitle: 'Profile updated',
    })
    showToast('success', 'Profile photo removed.')
  }, [authUser, showToast])

  const handleLogReportExport = useCallback(async (extra) => {
    if (!authUser) return
    await recordActorSensitiveActivity({
      action: 'Report exported',
      eventType: 'report_export',
      actor: authUser,
      entityType: 'report',
      success: true,
      device: getDeviceInfo(),
      extra: extra ?? '',
      notifyTitle: 'Report exported',
    })
  }, [authUser])

  const updateBanner = updateAvailable ? (
    <UpdateAvailableBanner onUpdate={reloadForUpdate} onDismiss={dismissUpdate} checking={updateChecking} />
  ) : null

  if (!authHydrated) {
    return (
      <>
        {updateBanner}
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      </>
    )
  }

  if (!authUser) {
    return (
      <>
      {updateBanner}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <Login
              onLogin={handleLogin}
              loading={authSubmitting || dbConnectionChecking}
              error={authError}
              connectionWarning={dbConnectionError}
              onRetryConnection={retryDbConnection}
            />
          }
        />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route
          path="/forgot-password"
          element={
            <ForgotPassword
              onRequestReset={async (email) => {
                setAuthResetLoading(true)
                setAuthResetError(null)
                try {
                  return await requestPasswordReset(email)
                } catch (e) {
                  setAuthResetError(e?.message ?? 'Request failed')
                  return null
                } finally {
                  setAuthResetLoading(false)
                }
              }}
              loading={authResetLoading}
              error={authResetError}
            />
          }
        />
        <Route
          path="/reset-password"
          element={
            <ResetPassword
              onReset={async (payload) => {
                setAuthResetLoading(true)
                setAuthResetError(null)
                try {
                  await ext.handleResetPassword(payload)
                } catch (e) {
                  setAuthResetError(e?.message ?? 'Reset failed')
                  throw e
                } finally {
                  setAuthResetLoading(false)
                }
              }}
              loading={authResetLoading}
              error={authResetError}
            />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </>
    )
  }

  const dashboard = {
    authUser,
    isAdmin,
    loading,
    error,
    departments,
    scopedDepartments,
    transactions,
    transactionsLoading,
    departmentBudgets,
    companyProfiles,
    deletedCompanyProfiles,
    auditLogs,
    auditError,
    sensitiveEvents,
    sensitiveEventsError,
    sensitiveEventsUsingFallback,
    sensitiveEventsLoading,
    departmentAggregates,
    budgetByDepartment,
    companyAggregates,
    categorySuggestions,
    toasts,
    showToast,
    onRemoveToast: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    addDepartmentOpen,
    setAddDepartmentOpen,
    addEntryOpen,
    setAddEntryOpen,
    addEntryPresetDate,
    addEntryPresetDepartmentId,
    transactionsViewDate,
    setTransactionsViewDate,
    openAddEntry: (preset) => {
      const date = typeof preset === 'string' ? preset : preset?.date
      const departmentId = typeof preset === 'object' && preset ? preset.departmentId : null
      const onTransactionsPage =
        typeof window !== 'undefined' && window.location.pathname.includes('/dashboard/transactions')
      let pageDate = null
      if (onTransactionsPage) {
        try {
          const fromUrl = new URLSearchParams(window.location.search).get('date')
          pageDate = parseISODate(fromUrl) ? fromUrl : transactionsViewDate
        } catch {
          pageDate = transactionsViewDate
        }
      }
      // Explicit day from the Transactions list, or the day currently shown there
      // when Add Entry is opened from the header/keyboard.
      setAddEntryPresetDate(date ?? pageDate ?? null)
      setAddEntryPresetDepartmentId(departmentId ?? null)
      setAddEntryOpen(true)
      ext.reloadCategories?.()
    },
    closeAddEntry: () => {
      setAddEntryOpen(false)
      setAddEntryPresetDate(null)
      setAddEntryPresetDepartmentId(null)
    },
    addDepartmentSaving,
    addEntrySaving,
    editEntrySaving,
    editTransactionOpen,
    setEditTransactionOpen,
    selectedTransaction,
    setSelectedTransaction,
    bulkImportOpen: ext.bulkImportOpen,
    setBulkImportOpen: ext.setBulkImportOpen,
    categories: ext.categories,
    stockAdjustments: ext.stockAdjustments,
    recurringEntries: ext.recurringEntries,
    notifications: ext.notifications,
    companyUsers: ext.companyUsers,
    departmentTargets: ext.departmentTargets,
    budgetMonthKey: ext.budgetMonthKey,
    setBudgetMonthKey: ext.setBudgetMonthKey,
    txSearch: ext.txSearch,
    setTxSearch: ext.setTxSearch,
    lastEntry: ext.lastEntry,
    companyRequiresApproval: ext.companyRequiresApproval,
    theme,
    toggleTheme,
    handleLogout,
    handleCreateDepartment,
    handleCreateEntry,
    handleDeleteDepartment,
    handleDeleteTransaction,
    handleEditTransaction,
    handleUpdateTransaction,
    handleVerifyDeletePassword,
    clearDepartmentEditVerification,
    handleSaveBudget,
    handleCreateCompanyProfile,
    handleDeleteCompanyProfile,
    handleRestoreCompanyProfile,
    handleClearAllData,
    handleBackupSystemData,
    handleDownloadLocalBackupOnly,
    handleListSystemBackups,
    handleDownloadStoredBackup,
    handleToggleCompanyProfileActive,
    handleAdminResetCompanyPassword,
    handleAdminSetDeletePassword,
    handleUpdateCompanyProfile,
    handleUpdatePassword,
    handleUpdateDetails,
    handleUpdateAdminMeta,
    handleUpdateAvatar,
    handleRemoveAvatar,
    handleLogReportExport,
    profileCreatedAt: authUser?.created_at,
    handleImpersonate: ext.handleImpersonate,
    handleExitImpersonation: ext.handleExitImpersonation,
    handleMarkNotificationRead: ext.handleMarkNotificationRead,
    handleMarkAllNotificationsRead: ext.handleMarkAllNotificationsRead,
    handleClearAllNotifications: ext.handleClearAllNotifications,
    handleBulkImport: ext.handleBulkImport,
    handleApproveTransaction: ext.handleApproveTransaction,
    handleRejectTransaction: ext.handleRejectTransaction,
    handleCreateRecurring: ext.handleCreateRecurring,
    handleDeleteRecurring: ext.handleDeleteRecurring,
    handlePostRecurringDue: ext.handlePostRecurringDue,
    handleCreateCategory: ext.handleCreateCategory,
    handleUpdateCategory: ext.handleUpdateCategory,
    handleDeleteCategory: ext.handleDeleteCategory,
    handleSaveStockAdjustment: ext.handleSaveStockAdjustment,
    handleCreateCompanyUser: ext.handleCreateCompanyUser,
    handleDeleteCompanyUser: ext.handleDeleteCompanyUser,
    handleSaveAdminNotes: ext.handleSaveAdminNotes,
    handleSaveTarget: ext.handleSaveTarget,
    handleSaveTaxReportSettings: ext.handleSaveTaxReportSettings,
    taxReportSettings: ext.taxReportSettings,
    taxReportSettingsSaving: ext.taxReportSettingsSaving,
    handleDuplicateLastEntry: ext.handleDuplicateLastEntry,
    companyUsersCompanyId: ext.companyUsersCompanyId,
    updateAvailable,
    reloadForUpdate,
    dismissUpdate,
    updateChecking,
  }

  return (
    <>
      {updateBanner}
      <AppDashboard d={dashboard} />
      <UpdateGuideMascot key={`${authUser.role}:${authUser.id}`} userId={`${authUser.role}:${authUser.id}`}
        updateAvailable={updateAvailable} onUpdate={reloadForUpdate} checking={updateChecking} />
    </>
  )
}
