import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { TX_SELECT, TX_SELECT_BASIC, TX_SELECT_NO_OTHER_DIR } from '../utils/constants.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { logAudit } from '../utils/audit.js'
import { buildSensitiveMessage, recordActorSensitiveActivity, recordSensitiveActivity } from '../utils/sensitiveEvents.js'
import { getDeviceInfo } from '../utils/deviceInfo.js'
import { parseTransactionsCsv } from '../utils/csvImport.js'
import { createNotification, fetchNotificationsForUser } from '../utils/notifications.js'
import { isMissingSchemaError, queryWithColumnFallback, safeSaveAdminNotes, verifyAuthUserPassword } from '../utils/safeQuery.js'
import { formatSupabaseError } from '../utils/supabaseErrors.js'
import { ensureLinkedDepartment } from '../utils/departmentProfileSync.js'
import { ensureDefaultCategories } from '../utils/defaultCategories.js'
import { isEntryType } from '../utils/entryTypes.js'
import { normalizeTransactionRows } from '../utils/transactionOtherDirection.js'
import {
  DEFAULT_TAX_REPORT_SETTINGS,
  loadTaxSettingsFromStorage,
  normalizeTaxSettings,
  saveTaxSettingsToStorage,
} from '../utils/taxComputation.js'

const IMPERSONATOR_KEY = 'kaionex_impersonator_v1'

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function loadExtrasData(currentUser, scopedDepartmentIds, companyProfileId, setters) {
  if (!supabase || !currentUser) return
  const { setCategories, setRecurringEntries, setNotifications, setCompanyUsers, setDepartmentTargets, setTaxReportSettings } = setters

  try {
    // Defaults are seeded only when the categories table is empty.
    // Soft-deleted rows count, so wiping the library keeps it empty.
    await ensureDefaultCategories(supabase)
    const { data: cats, error: catsError } = await supabase
      .from('categories')
      .select('id,name,entry_type,is_active')
      .order('name')
    if (catsError) {
      console.warn('categories load:', catsError.message)
      setCategories([])
    } else {
      setCategories((cats ?? []).filter((c) => c.is_active !== false))
    }
  } catch {
    setCategories([])
  }

  try {
    let recQuery = supabase.from('recurring_entries').select('*').eq('is_active', true)
    if (currentUser.role !== 'admin' && scopedDepartmentIds.length) {
      recQuery = recQuery.in('department_id', scopedDepartmentIds)
    }
    const { data: rec, error: recError } = await recQuery
    if (recError) {
      if (!isMissingSchemaError(recError)) console.warn('recurring_entries load:', recError.message)
      setRecurringEntries([])
    } else {
      setRecurringEntries(rec ?? [])
    }
  } catch {
    setRecurringEntries([])
  }

  try {
    setNotifications(await fetchNotificationsForUser(currentUser))
  } catch {
    setNotifications([])
  }

  try {
    if (currentUser.role === 'admin') {
      const { data: users } = await supabase.from('company_users').select('id,company_profile_id,email,role,department_id,is_active')
      setCompanyUsers(users ?? [])
    } else if (companyProfileId) {
      const { data: users } = await supabase
        .from('company_users')
        .select('id,company_profile_id,email,role,department_id,is_active')
        .eq('company_profile_id', companyProfileId)
      setCompanyUsers(users ?? [])
    } else {
      setCompanyUsers([])
    }
  } catch {
    setCompanyUsers([])
  }

  try {
    if (scopedDepartmentIds.length) {
      const { data: targets } = await supabase
        .from('department_targets')
        .select('department_id,month_key,revenue_target')
        .in('department_id', scopedDepartmentIds)
      setDepartmentTargets(targets ?? [])
    } else {
      setDepartmentTargets([])
    }
  } catch {
    setDepartmentTargets([])
  }

  if (setTaxReportSettings) {
    try {
      const { data, error } = await supabase.from('tax_report_settings').select('*').order('updated_at', { ascending: false }).limit(1)
      if (!error && data?.length) {
        setTaxReportSettings(normalizeTaxSettings(data[0]))
      } else {
        const stored = loadTaxSettingsFromStorage()
        setTaxReportSettings(stored ?? DEFAULT_TAX_REPORT_SETTINGS)
      }
    } catch {
      const stored = loadTaxSettingsFromStorage()
      setTaxReportSettings(stored ?? DEFAULT_TAX_REPORT_SETTINGS)
    }
  }
}

export async function fetchTransactionsScoped(scopedDepartmentIds, currentIsAdmin) {
  if (!supabase) return []
  let q
  if (currentIsAdmin) {
    q = supabase.from('transactions').select(TX_SELECT).order('entry_date', { ascending: false })
  } else if (scopedDepartmentIds.length) {
    q = supabase.from('transactions').select(TX_SELECT).in('department_id', scopedDepartmentIds).order('entry_date', { ascending: false })
  } else {
    return []
  }
  let { data, error } = await q
  if (error && String(error.message).includes('other_direction')) {
    if (currentIsAdmin) {
      q = supabase.from('transactions').select(TX_SELECT_NO_OTHER_DIR).order('entry_date', { ascending: false })
    } else if (scopedDepartmentIds.length) {
      q = supabase
        .from('transactions')
        .select(TX_SELECT_NO_OTHER_DIR)
        .in('department_id', scopedDepartmentIds)
        .order('entry_date', { ascending: false })
    }
    ;({ data, error } = await q)
  }
  if (
    error &&
    (String(error.message).includes('receipt_url') || String(error.message).includes('raw_ocr_data'))
  ) {
    const selectNoReceipt = TX_SELECT.replace(',receipt_url,raw_ocr_data', '')
    if (currentIsAdmin) {
      q = supabase.from('transactions').select(selectNoReceipt).order('entry_date', { ascending: false })
    } else if (scopedDepartmentIds.length) {
      q = supabase
        .from('transactions')
        .select(selectNoReceipt)
        .in('department_id', scopedDepartmentIds)
        .order('entry_date', { ascending: false })
    }
    ;({ data, error } = await q)
  }
  if (error) {
    if (currentIsAdmin) {
      ;({ data, error } = await supabase.from('transactions').select(TX_SELECT_BASIC).order('entry_date', { ascending: false }))
    } else if (scopedDepartmentIds.length) {
      ;({ data, error } = await supabase
        .from('transactions')
        .select(TX_SELECT_BASIC)
        .in('department_id', scopedDepartmentIds)
        .order('entry_date', { ascending: false }))
    }
  }
  if (error) throw error
  return normalizeTransactionRows(data ?? [])
}

export async function requestPasswordReset(email) {
  const normalized = normalizeEmail(email)
  const token = crypto.randomUUID().replaceAll('-', '')
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  let accountType = 'company'
  const { data: admin } = await supabase.from('admin_accounts').select('id').eq('email', normalized).limit(1)
  if (admin?.length) accountType = 'admin'
  else {
    const { data: cu } = await supabase.from('company_users').select('id').eq('email', normalized).limit(1)
    if (cu?.length) accountType = 'company_user'
  }
  const { error } = await supabase.from('password_reset_tokens').insert({
    email: normalized,
    account_type: accountType,
    token,
    expires_at: expires,
  })
  if (error) throw error
  return { token }
}

export function useExtendedFeatures({ authUser, setAuthUser, showToast, isAdmin, companyDepartmentIds, departments, refreshData, navigate }) {
  const [categories, setCategories] = useState([])
  const [stockAdjustments, setStockAdjustments] = useState([])
  const [recurringEntries, setRecurringEntries] = useState([])
  const [notifications, setNotifications] = useState([])
  const [companyUsers, setCompanyUsers] = useState([])
  const [departmentTargets, setDepartmentTargets] = useState([])
  const [budgetMonthKey, setBudgetMonthKey] = useState(() => new Date().toISOString().slice(0, 7))
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [txSearch, setTxSearch] = useState('')
  const [lastEntry, setLastEntry] = useState(null)
  const [companyUsersCompanyId, setCompanyUsersCompanyId] = useState(null)
  const [taxReportSettings, setTaxReportSettings] = useState(DEFAULT_TAX_REPORT_SETTINGS)
  const [taxReportSettingsSaving, setTaxReportSettingsSaving] = useState(false)

  const companyProfileId = authUser?.company_profile_id ?? authUser?.id

  useEffect(() => {
    if (!authUser?.id || !authUser?.role) {
      setNotifications([])
      return undefined
    }

    let cancelled = false

    async function loadNotifications() {
      const rows = await fetchNotificationsForUser(authUser)
      if (!cancelled) setNotifications(rows)
    }

    loadNotifications()
    const onFocus = () => loadNotifications()
    const interval = setInterval(loadNotifications, 60_000)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [authUser?.id, authUser?.role])

  const handleRequestPasswordReset = useCallback(async (email) => requestPasswordReset(email), [])

  const handleResetPassword = useCallback(async ({ token, password }) => {
    const { data: rows, error } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .limit(1)
    if (error) throw error
    const row = rows?.[0]
    if (!row || new Date(row.expires_at) < new Date()) {
      await recordActorSensitiveActivity({
        action: 'Password reset failed',
        eventType: 'password_reset',
        actor: { email: row?.email ?? 'unknown', role: 'unknown' },
        entityType: 'password_reset_token',
        success: false,
        device: getDeviceInfo(),
        extra: 'Invalid or expired token',
        notifyTitle: 'Password reset failed',
      })
      throw new Error('Invalid or expired token.')
    }

    const actorRole =
      row.account_type === 'admin'
        ? 'admin'
        : row.account_type === 'company_user'
          ? 'company_user'
          : 'company'

    try {
      const hash = await hashPassword(password)
      if (row.account_type === 'admin') {
        await supabase.from('admin_accounts').update({ password: hash }).eq('email', row.email)
      } else if (row.account_type === 'company_user') {
        await supabase.from('company_users').update({ password: hash }).eq('email', row.email)
      } else {
        await supabase.from('company_profiles').update({ password: hash }).eq('email', row.email)
      }
      await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id)
      await recordActorSensitiveActivity({
        action: 'Password reset',
        eventType: 'password_reset',
        actor: { email: row.email, role: actorRole },
        entityType: row.account_type,
        success: true,
        device: getDeviceInfo(),
        extra: 'Token-based password reset completed',
        notifyTitle: 'Password reset',
      })
    } catch (e) {
      await recordActorSensitiveActivity({
        action: 'Password reset failed',
        eventType: 'password_reset',
        actor: { email: row.email, role: actorRole },
        entityType: row.account_type,
        success: false,
        device: getDeviceInfo(),
        extra: e?.message ?? 'Reset failed',
        notifyTitle: 'Password reset failed',
      })
      throw e
    }
  }, [])

  const handleImpersonate = useCallback(
    async (company) => {
      let dept = (departments ?? []).find((d) => d.company_profile_id === company.id)
      if (!dept) {
        try {
          dept = await ensureLinkedDepartment(company)
        } catch (e) {
          showToast('error', e?.message ?? 'Could not link department account.')
          return
        }
      }
      sessionStorage.setItem(IMPERSONATOR_KEY, JSON.stringify(authUser))
      setAuthUser({
        id: dept.id,
        role: 'department',
        email: dept.email ?? company.email,
        department_id: dept.id,
        name: dept.name,
        full_name: dept.full_name ?? company.full_name,
        phone: dept.phone ?? company.phone,
        address: dept.address ?? company.address,
        impersonatingFrom: true,
      })
      showToast('success', `Viewing as ${dept.email ?? company.email}`)
      navigate?.('/dashboard')
    },
    [authUser, setAuthUser, showToast, departments, navigate],
  )

  const handleExitImpersonation = useCallback(() => {
    const raw = sessionStorage.getItem(IMPERSONATOR_KEY)
    sessionStorage.removeItem(IMPERSONATOR_KEY)
    if (raw) setAuthUser(JSON.parse(raw))
  }, [setAuthUser])

  const handleMarkNotificationRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
      if (error) throw error
    } catch {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)))
    }
  }, [])

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (!authUser?.id || !authUser?.role) return

    setNotifications((prev) => {
      if (!prev.some((n) => !n.is_read)) return prev
      return prev.map((n) => ({ ...n, is_read: true }))
    })

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', authUser.id)
        .eq('user_role', authUser.role)
        .eq('is_read', false)
      if (error) throw error
    } catch {
      await refreshData?.()
    }
  }, [authUser, refreshData])

  const handleClearAllNotifications = useCallback(async () => {
    if (!authUser?.id || !authUser?.role) return
    let previous = []
    setNotifications((prev) => {
      previous = prev
      return []
    })

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', authUser.id)
        .eq('user_role', authUser.role)
      if (error) throw error
      showToast?.('success', 'Notifications cleared.')
    } catch {
      setNotifications(previous)
      showToast?.('error', 'Could not clear notifications.')
    }
  }, [authUser, showToast])

  const handleBulkImport = useCallback(
    async (rows) => {
      const deptByName = new Map((departments ?? []).map((d) => [d.name.toLowerCase(), d.id]))
      let count = 0
      for (const row of rows) {
        const deptId = row.department_name ? deptByName.get(row.department_name.toLowerCase()) : companyDepartmentIds[0]
        if (!deptId || !isEntryType(row.type) || !row.category || !Number.isFinite(row.amount)) continue
        await supabase.from('transactions').insert({
          id: crypto.randomUUID(),
          department_id: deptId,
          type: row.type,
          category: row.category,
          description: row.description || null,
          amount: String(row.amount),
          entry_date: row.entry_date || todayISO(),
          status: isAdmin ? 'approved' : 'pending',
          created_at: new Date().toISOString(),
        })
        count += 1
      }
      await refreshData()
      showToast('success', `Imported ${count} transactions.`)
    },
    [departments, companyDepartmentIds, isAdmin, refreshData, showToast],
  )

  const handleApproveTransaction = useCallback(
    async (id) => {
      await supabase.from('transactions').update({ status: 'approved' }).eq('id', id)
      await logAudit({ actor: authUser, action: 'approve', entityType: 'transaction', entityId: id })
      await refreshData()
      showToast('success', 'Transaction approved.')
    },
    [authUser, refreshData, showToast],
  )

  const handleRejectTransaction = useCallback(
    async (id) => {
      await supabase.from('transactions').update({ status: 'rejected' }).eq('id', id)
      await logAudit({ actor: authUser, action: 'reject', entityType: 'transaction', entityId: id })
      await refreshData()
      showToast('success', 'Transaction rejected.')
    },
    [authUser, refreshData, showToast],
  )

  const handleCreateRecurring = useCallback(
    async (payload) => {
      await supabase.from('recurring_entries').insert({ ...payload, amount: String(payload.amount) })
      await refreshData()
      showToast('success', 'Recurring entry saved.')
    },
    [refreshData, showToast],
  )

  const handleDeleteRecurring = useCallback(
    async (id, password) => {
      const device = getDeviceInfo()
      const actor = authUser
      const attemptMsg = buildSensitiveMessage({
        action: 'Delete recurring entry attempt',
        actorEmail: actor?.email,
        deviceLabel: device.label,
      })
      await recordSensitiveActivity({
        eventType: 'delete_attempt',
        actor,
        entityType: 'recurring',
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
        await supabase.from('recurring_entries').delete().eq('id', id)
        const successMsg = buildSensitiveMessage({
          action: 'Recurring entry deleted',
          actorEmail: actor?.email,
          deviceLabel: device.label,
        })
        await recordSensitiveActivity({
          eventType: 'delete_success',
          actor,
          entityType: 'recurring',
          entityId: id,
          success: true,
          message: successMsg,
          device,
          notifyTitle: 'Delete success',
          notifyBody: successMsg,
        })
        await refreshData()
      } catch (e) {
        const failMsg = buildSensitiveMessage({
          action: 'Failed delete recurring entry',
          actorEmail: actor?.email,
          deviceLabel: device.label,
          extra: e?.message ?? 'Unknown error',
        })
        await recordSensitiveActivity({
          eventType: 'delete_failed',
          actor,
          entityType: 'recurring',
          entityId: id,
          success: false,
          message: failMsg,
          device,
          notifyTitle: 'Delete failed',
          notifyBody: failMsg,
        })
        throw e
      }
    },
    [authUser, refreshData],
  )

  const handlePostRecurringDue = useCallback(async () => {
    const monthKey = new Date().toISOString().slice(0, 7)
    const day = new Date().getDate()
    let posted = 0
    for (const r of recurringEntries) {
      if (r.last_posted_month === monthKey) continue
      if (day < r.day_of_month) continue
      await supabase.from('transactions').insert({
        id: crypto.randomUUID(),
        department_id: r.department_id,
        type: r.type,
        category: r.category,
        description: r.description || `Recurring: ${r.category}`,
        amount: String(r.amount),
        entry_date: todayISO(),
        status: 'approved',
        created_at: new Date().toISOString(),
      })
      await supabase.from('recurring_entries').update({ last_posted_month: monthKey }).eq('id', r.id)
      posted += 1
    }
    await refreshData()
    showToast('success', posted ? `Posted ${posted} recurring entries.` : 'No recurring entries due.')
  }, [recurringEntries, refreshData, showToast])

  const reloadCategories = useCallback(async () => {
    if (!supabase) return
    const { data: cats, error: catsError } = await supabase
      .from('categories')
      .select('id,name,entry_type,is_active')
      .order('name')
    if (!catsError) setCategories((cats ?? []).filter((c) => c.is_active !== false))
  }, [])

  const reloadStockAdjustments = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('pnl_stock_adjustments')
      .select('id,department_id,period_from,period_to,opening_stock,closing_stock,notes,updated_at,created_by,updated_by')
      .order('period_from', { ascending: false })
    if (error) {
      if (!isMissingSchemaError(error)) console.warn('pnl_stock_adjustments load:', error.message)
      setStockAdjustments([])
      return
    }
    let rows = data ?? []
    // Dept isolation (app-layer): non-admins only see their department + company-wide (null).
    if (!isAdmin) {
      const ownDept = authUser?.department_id ?? null
      rows = rows.filter((row) => {
        const rowDept = row.department_id ?? null
        return rowDept === null || (ownDept && rowDept === ownDept)
      })
    }
    setStockAdjustments(rows)
  }, [authUser?.department_id, isAdmin])

  useEffect(() => {
    if (!authUser?.id) {
      setStockAdjustments([])
      return
    }
    reloadStockAdjustments()
  }, [authUser?.id, reloadStockAdjustments])

  const handleCreateCategory = useCallback(
    async ({ name, entry_type }) => {
      if (!supabase) throw new Error('Supabase is not configured.')
      const trimmed = String(name ?? '').trim()
      if (!trimmed) throw new Error('Category name is required.')
      const normalizedType = String(entry_type ?? '').trim().toLowerCase()
      if (!isEntryType(normalizedType)) {
        throw new Error('Category must be for sale, purchase, expense, or other.')
      }

      const { data: existingRows, error: existingError } = await supabase
        .from('categories')
        .select('id,name,is_active')
        .eq('entry_type', normalizedType)
      if (existingError) throw new Error(formatSupabaseError(existingError))

      const sameName = (existingRows ?? []).filter(
        (row) => String(row.name ?? '').trim().toLowerCase() === trimmed.toLowerCase(),
      )
      const active = sameName.find((row) => row.is_active !== false)
      const inactive = sameName.find((row) => row.is_active === false)

      if (active) throw new Error('That category already exists for this entry type.')

      if (inactive) {
        const { error } = await supabase
          .from('categories')
          .update({ is_active: true, name: trimmed })
          .eq('id', inactive.id)
        if (error) throw new Error(formatSupabaseError(error))
      } else {
        const payload = {
          id: crypto.randomUUID(),
          name: trimmed,
          entry_type: normalizedType,
          is_active: true,
          created_at: new Date().toISOString(),
        }
        const { error } = await supabase.from('categories').insert(payload)
        if (error) throw new Error(formatSupabaseError(error))
      }

      await reloadCategories()
      try {
        await refreshData()
      } catch (refreshErr) {
        console.warn('refresh after category create:', refreshErr)
      }
      showToast('success', 'Category added.')
    },
    [refreshData, showToast, reloadCategories],
  )

  const handleUpdateCategory = useCallback(
    async ({ id, name }) => {
      if (!supabase) throw new Error('Supabase is not configured.')
      const trimmed = String(name ?? '').trim()
      if (!trimmed) throw new Error('Category name is required.')
      const { error } = await supabase.from('categories').update({ name: trimmed }).eq('id', id)
      if (error) throw new Error(formatSupabaseError(error))
      await reloadCategories()
      await refreshData()
      showToast('success', 'Category updated.')
    },
    [refreshData, showToast, reloadCategories],
  )

  const handleSaveStockAdjustment = useCallback(
    async ({
      departmentId = null,
      periodFrom,
      periodTo,
      openingStock,
      closingStock,
      notes = null,
      password,
    }) => {
      if (!supabase) throw new Error('Supabase is not configured.')
      if (!isAdmin || authUser?.role !== 'admin') {
        throw new Error('Only admins can save stock adjustments.')
      }
      if (!password) throw new Error('Login password is required to save stock adjustments.')
      if (!periodFrom || !periodTo) throw new Error('Period from and to dates are required.')
      const open = Number(openingStock)
      const close = Number(closingStock)
      if (!Number.isFinite(open) || open < 0 || !Number.isFinite(close) || close < 0) {
        throw new Error('Opening and closing stock must be non-negative numbers.')
      }

      const device = getDeviceInfo()
      const actor = authUser
      const deptLabel = departmentId
        ? (departments ?? []).find((d) => d.id === departmentId)?.name || departmentId
        : 'All departments'
      const periodLabel = `${periodFrom} → ${periodTo}`

      // Direct table writes are revoked for anon; upsert goes through SECURITY DEFINER RPC
      // which re-checks admin_accounts password (actor id = admin_accounts.id, not auth.users).
      const { data: saved, error } = await supabase.rpc('upsert_pnl_stock_adjustment', {
        p_admin_id: authUser.id,
        p_password: password,
        p_department_id: departmentId || null,
        p_period_from: periodFrom,
        p_period_to: periodTo,
        p_opening_stock: open,
        p_closing_stock: close,
        p_notes: notes,
      })

      if (error) {
        const msg = formatSupabaseError(error)
        if (isMissingSchemaError(error) || /upsert_pnl_stock_adjustment|Could not find the function/i.test(msg)) {
          await recordActorSensitiveActivity({
            action: 'Stock adjustment save failed',
            eventType: 'stock_adjustment_failed',
            actor,
            entityType: 'pnl_stock_adjustment',
            success: false,
            device,
            extra: 'Migration missing — run supabase/add_pnl_mapping.sql',
            notifyTitle: 'Stock adjustment failed',
          })
          throw new Error('Stock save RPC missing. Run supabase/add_pnl_mapping.sql in Supabase SQL Editor.')
        }
        await recordActorSensitiveActivity({
          action: 'Stock adjustment save failed',
          eventType: 'stock_adjustment_failed',
          actor,
          entityType: 'pnl_stock_adjustment',
          success: false,
          device,
          extra: `${deptLabel}; ${periodLabel}; ${msg}`,
          notifyTitle: 'Stock adjustment failed',
        })
        throw new Error(msg)
      }

      const entityId = saved?.id ?? (Array.isArray(saved) ? saved[0]?.id : null) ?? null
      await recordActorSensitiveActivity({
        action: 'Stock adjustment saved',
        eventType: 'stock_adjustment',
        actor,
        entityType: 'pnl_stock_adjustment',
        entityId,
        success: true,
        device,
        extra: `${deptLabel}; ${periodLabel}; open ${open}; close ${close}`,
        notifyTitle: 'Stock adjustment saved',
      })

      await reloadStockAdjustments()
      showToast('success', 'Opening/closing stock saved for this period.')
    },
    [authUser, departments, isAdmin, reloadStockAdjustments, showToast],
  )

  const handleDeleteCategory = useCallback(
    async (id, password) => {
      if (!supabase) throw new Error('Supabase is not configured.')
      if (!id) throw new Error('Category id is required.')
      if (!password) throw new Error('Login password is required to delete.')
      await verifyAuthUserPassword(authUser, password)
      // Soft-delete: hard delete removes the row, then ensureDefaultCategories()
      // on refresh re-inserts built-in defaults (Rent, Materials, etc.).
      const { data, error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', id)
        .select('id')
      if (error) throw new Error(formatSupabaseError(error))
      if (!data?.length) throw new Error('Category not found or could not be deleted.')
      await reloadCategories()
      try {
        await refreshData()
      } catch (refreshErr) {
        console.warn('refresh after category delete:', refreshErr)
      }
      showToast('success', 'Category deleted.')
    },
    [authUser, refreshData, showToast, reloadCategories],
  )

  const handleCreateCompanyUser = useCallback(
    async ({ company_profile_id, email, password, role, department_id }) => {
      const hash = await hashPassword(password)
      await supabase.from('company_users').insert({
        company_profile_id,
        email: normalizeEmail(email),
        password: hash,
        role,
        department_id: department_id || null,
      })
      await refreshData()
      showToast('success', 'Team member added.')
    },
    [refreshData, showToast],
  )

  const handleDeleteCompanyUser = useCallback(
    async (id, password) => {
      if (!password) throw new Error('Login password is required to delete.')
      await verifyAuthUserPassword(authUser, password)
      await supabase.from('company_users').delete().eq('id', id)
      await refreshData()
      showToast('success', 'Team member removed.')
    },
    [authUser, refreshData, showToast],
  )

  const handleSaveAdminNotes = useCallback(
    async (companyId, admin_notes) => {
      await safeSaveAdminNotes(companyId, admin_notes)
      await refreshData()
      showToast('success', 'Admin notes saved.')
    },
    [refreshData, showToast],
  )

  const handleSaveTarget = useCallback(
    async (departmentId, revenueTarget, monthKey) => {
      await supabase
        .from('department_targets')
        .upsert({ department_id: departmentId, month_key: monthKey, revenue_target: String(revenueTarget) }, { onConflict: 'department_id,month_key' })
      await refreshData()
      showToast('success', 'Revenue target saved.')
    },
    [refreshData, showToast],
  )

  const handleSaveTaxReportSettings = useCallback(
    async (settings) => {
      const normalized = normalizeTaxSettings(settings)
      setTaxReportSettingsSaving(true)
      try {
        const payload = {
          assessment_year_start: normalized.assessment_year_start,
          tax_free_allowance: normalized.tax_free_allowance,
          tax_rate_percent: normalized.tax_rate_percent,
          tax_paid: normalized.tax_paid,
          currency_label: normalized.currency_label,
          partners: normalized.partners,
          disallowable_patterns: normalized.disallowable_patterns,
          manual_overrides: normalized.manual_overrides,
          updated_at: new Date().toISOString(),
        }

        const { data: existing, error: loadError } = await supabase
          .from('tax_report_settings')
          .select('id')
          .order('updated_at', { ascending: false })
          .limit(1)

        if (!loadError && existing?.length) {
          const { error } = await supabase.from('tax_report_settings').update(payload).eq('id', existing[0].id)
          if (error) throw error
        } else if (!loadError) {
          const { error } = await supabase.from('tax_report_settings').insert(payload)
          if (error) throw error
        } else {
          saveTaxSettingsToStorage(normalized)
        }

        setTaxReportSettings(normalized)
        saveTaxSettingsToStorage(normalized)
        showToast('success', 'Tax report settings saved.')
      } catch (e) {
        saveTaxSettingsToStorage(normalized)
        setTaxReportSettings(normalized)
        showToast('success', 'Tax report settings saved locally.')
      } finally {
        setTaxReportSettingsSaving(false)
      }
    },
    [showToast],
  )

  const handleDuplicateLastEntry = useCallback(() => {
    if (lastEntry) setLastEntry({ ...lastEntry })
    showToast('success', 'Last entry loaded — adjust and save.')
  }, [lastEntry, showToast])

  const wrapCreateEntry = useCallback(
    (baseHandler) =>
      async (payload) => {
        const status = isAdmin ? 'approved' : payload.status ?? 'pending'
        await baseHandler({ ...payload, status })
        setLastEntry(payload)
      },
    [isAdmin],
  )

  return {
    categories,
    stockAdjustments,
    recurringEntries,
    notifications,
    companyUsers,
    departmentTargets,
    budgetMonthKey,
    setBudgetMonthKey,
    bulkImportOpen,
    setBulkImportOpen,
    txSearch,
    setTxSearch,
    lastEntry,
    setLastEntry,
    companyUsersCompanyId,
    setCompanyUsersCompanyId,
    setCategories,
    setRecurringEntries,
    setNotifications,
    setCompanyUsers,
    setDepartmentTargets,
    handleRequestPasswordReset,
    handleResetPassword,
    handleImpersonate,
    handleExitImpersonation,
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    handleClearAllNotifications,
    handleBulkImport,
    handleApproveTransaction,
    handleRejectTransaction,
    handleCreateRecurring,
    handleDeleteRecurring,
    handlePostRecurringDue,
    reloadCategories,
    reloadStockAdjustments,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleSaveStockAdjustment,
    handleCreateCompanyUser,
    handleDeleteCompanyUser,
    handleSaveAdminNotes,
    handleSaveTarget,
    handleSaveTaxReportSettings,
    handleDuplicateLastEntry,
    wrapCreateEntry,
    companyRequiresApproval: !isAdmin,
    taxReportSettings,
    taxReportSettingsSaving,
  }
}

export async function tryLoginCompanyUser(normalized, password, upgradePasswordIfNeeded) {
  const { data: rows, error } = await supabase
    .from('company_users')
    .select('id,email,password,role,department_id,company_profile_id,is_active,avatar_url')
    .eq('email', normalized)
    .limit(1)
  if (error || !rows?.length) return null
  const u = rows[0]
  if (!(await verifyPassword(password, u.password))) return null
  await upgradePasswordIfNeeded(password, u.password, 'company_users', u.id)
  if (u.is_active === false) throw new Error('Account is inactive. Contact admin.')
  return {
    id: u.id,
    role: 'company_user',
    email: u.email,
    company_profile_id: u.company_profile_id,
    sub_role: u.role,
    department_id: u.department_id,
    avatar_url: u.avatar_url,
  }
}
