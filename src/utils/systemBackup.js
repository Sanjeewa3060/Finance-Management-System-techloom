import { supabase } from '../lib/supabase.js'
import { isMissingSchemaError } from './safeQuery.js'
import { loadTaxSettingsFromStorage } from './taxComputation.js'

/** Operational tables included in an admin JSON backup (FMS / EMS-style snapshot). */
export const BACKUP_TABLES = [
  'company_profiles',
  'departments',
  'company_users',
  'categories',
  'pnl_stock_adjustments',
  'transactions',
  'recurring_entries',
  'department_budgets',
  'department_targets',
  'notifications',
  'audit_logs',
  'sensitive_events',
  'transaction_edit_history',
  'admin_accounts',
]

export const BACKUP_RETENTION_DAYS = 90
export const BACKUP_STORAGE_PLACE = 'Supabase table public.system_backups'
export const BACKUP_SETUP_SQL = 'supabase/system_backups.sql'
export const BACKUP_TIMEZONE = 'Asia/Colombo'
export const BACKUP_CRON_SCHEDULE = '30 18 * * *' // 00:00 Asia/Colombo on Vercel Cron

const PAGE_SIZE = 1000

/** Calendar date in Asia/Colombo (YYYY-MM-DD). */
export function sriLankaDateISO(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BACKUP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function isMissingBackupTableError(error) {
  if (!error) return false
  if (isMissingSchemaError(error)) return true
  const msg = String(error.message || error || '')
  return (
    /Could not find the table ['"]?public\.system_backups/i.test(msg) ||
    /relation ['"]?public\.system_backups['"]? does not exist/i.test(msg) ||
    (/system_backups/i.test(msg) && /does not exist|schema cache|Could not find/i.test(msg))
  )
}

function missingTableError() {
  const err = new Error(
    `Server backup storage is not set up yet. Run ${BACKUP_SETUP_SQL} in the Supabase SQL Editor (or npm run migrate:db), then refresh.`,
  )
  err.code = 'MISSING_BACKUP_TABLE'
  return err
}

async function fetchAllRows(table, client = supabase) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await client.from(table).select('*').range(from, from + PAGE_SIZE - 1)
    if (error) {
      if (isMissingSchemaError(error)) {
        return { skipped: true, reason: error.message, rows: [] }
      }
      throw new Error(`${table}: ${error.message}`)
    }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return { skipped: false, rows }
}

function sanitizeAdminAccounts(rows) {
  return (rows ?? []).map((row) => {
    const { password, ...rest } = row
    return {
      ...rest,
      password: password ? '[omitted — re-set after restore if needed]' : null,
    }
  })
}

export async function buildBackupPayload({ trigger = 'manual', client = supabase } = {}) {
  if (!client) throw new Error('Supabase is not configured.')

  const tables = {}
  const tableCounts = {}
  const skipped = {}

  for (const table of BACKUP_TABLES) {
    const result = await fetchAllRows(table, client)
    if (result.skipped) {
      skipped[table] = result.reason
      tables[table] = []
      tableCounts[table] = 0
      continue
    }
    const rows = table === 'admin_accounts' ? sanitizeAdminAccounts(result.rows) : result.rows
    tables[table] = rows
    tableCounts[table] = rows.length
  }

  const totalRows = Object.values(tableCounts).reduce((sum, n) => sum + n, 0)
  const backupDate = sriLankaDateISO()
  const exportedAt = new Date().toISOString()

  return {
    format: 'finance-management-system-backup',
    version: 1,
    exportedAt,
    backupDate,
    trigger,
    app: 'Finance Management System',
    note: 'JSON snapshot for archival. Admin account passwords are omitted.',
    tableCounts,
    rowCount: totalRows,
    skipped: Object.keys(skipped).length ? skipped : undefined,
    client: {
      tax_report_settings: typeof window !== 'undefined' ? loadTaxSettingsFromStorage() : null,
    },
    tables,
  }
}

function triggerDownload(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function pruneOldBackups(client = supabase) {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - BACKUP_RETENTION_DAYS)
  await client.from('system_backups').delete().lt('created_at', cutoff.toISOString())
}

/**
 * Probe whether server-side backup storage (system_backups table) is ready.
 */
export async function getBackupStorageStatus({ client = supabase } = {}) {
  if (!client) {
    return {
      configured: false,
      reason: 'supabase_not_configured',
      place: BACKUP_STORAGE_PLACE,
      retentionDays: BACKUP_RETENTION_DAYS,
      timezone: BACKUP_TIMEZONE,
      message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      setupSql: BACKUP_SETUP_SQL,
    }
  }

  const { error } = await client.from('system_backups').select('id', { head: true, count: 'exact' })
  if (error) {
    if (isMissingBackupTableError(error)) {
      return {
        configured: false,
        reason: 'missing_table',
        place: BACKUP_STORAGE_PLACE,
        retentionDays: BACKUP_RETENTION_DAYS,
        timezone: BACKUP_TIMEZONE,
        message: missingTableError().message,
        setupSql: BACKUP_SETUP_SQL,
      }
    }
    return {
      configured: false,
      reason: 'query_error',
      place: BACKUP_STORAGE_PLACE,
      retentionDays: BACKUP_RETENTION_DAYS,
      timezone: BACKUP_TIMEZONE,
      message: error.message || 'Could not verify backup storage.',
      setupSql: BACKUP_SETUP_SQL,
    }
  }

  return {
    configured: true,
    reason: 'ok',
    place: BACKUP_STORAGE_PLACE,
    retentionDays: BACKUP_RETENTION_DAYS,
    timezone: BACKUP_TIMEZONE,
    message: `Backups are saved on the server in ${BACKUP_STORAGE_PLACE}. Daily job: midnight ${BACKUP_TIMEZONE} via Vercel Cron (/api/cron-backup).`,
    setupSql: BACKUP_SETUP_SQL,
  }
}

/**
 * Save a snapshot into system_backups (and optionally download JSON).
 */
export async function saveSystemBackup({
  trigger = 'manual',
  createdBy = null,
  download = false,
  client = supabase,
} = {}) {
  if (!client) throw new Error('Supabase is not configured.')

  const payload = await buildBackupPayload({ trigger, client })
  const { data, error } = await client
    .from('system_backups')
    .insert({
      backup_date: payload.backupDate,
      trigger,
      row_count: payload.rowCount,
      payload,
      created_by: createdBy || null,
    })
    .select('id, backup_date, trigger, row_count, created_at')
    .single()

  if (error) {
    if (isMissingBackupTableError(error)) throw missingTableError()
    throw new Error(formatBackupError(error))
  }

  pruneOldBackups(client).catch(() => {})

  const filename = `fms-backup-${payload.backupDate}-${String(data.id).slice(0, 8)}.json`
  if (download) triggerDownload(payload, filename)

  return {
    id: data.id,
    backupDate: data.backup_date,
    trigger: data.trigger,
    rowCount: data.row_count,
    createdAt: data.created_at,
    filename,
    tableCounts: payload.tableCounts,
    stored: true,
    place: BACKUP_STORAGE_PLACE,
  }
}

function formatBackupError(error) {
  const msg = error?.message || String(error)
  if (/row-level security/i.test(msg) && /system_backups/i.test(msg)) {
    return (
      'Backup insert blocked by row-level security on system_backups. ' +
      'This app uses the anon key (not Supabase Auth). In Supabase SQL Editor run ' +
      'supabase/fix_system_backups_rls.sql (drops policies + disables RLS), then try Backup now again.'
    )
  }
  return msg
}

/**
 * Manual backup: always persists to server storage.
 * Set download=true to also save a local JSON copy.
 */
export async function createManualSystemBackup({ download = false, createdBy = null } = {}) {
  return saveSystemBackup({ trigger: 'manual', createdBy, download })
}

/**
 * @deprecated Prefer createManualSystemBackup({ download: true }).
 * Kept for callers that expect a download; still persists to server when configured.
 */
export async function downloadSystemBackup() {
  return createManualSystemBackup({ download: true })
}

/**
 * Local-only JSON download when server storage is unavailable (explicit escape hatch).
 */
export async function downloadLocalBackupOnly() {
  const payload = await buildBackupPayload({ trigger: 'manual' })
  const fileStamp = payload.exportedAt.replace(/[:.]/g, '-').slice(0, 19)
  const filename = `fms-backup-${fileStamp}.json`
  triggerDownload(payload, filename)
  return {
    filename,
    tableCounts: payload.tableCounts,
    rowCount: payload.rowCount,
    stored: false,
    place: null,
  }
}

export async function listSystemBackups({ limit = 60 } = {}) {
  const status = await getBackupStorageStatus()
  if (!status.configured) {
    if (status.reason === 'missing_table') {
      const err = missingTableError()
      throw err
    }
    throw new Error(status.message)
  }

  const { data, error } = await supabase
    .from('system_backups')
    .select('id, backup_date, trigger, row_count, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingBackupTableError(error)) throw missingTableError()
    throw new Error(error.message)
  }

  return {
    backups: (data ?? []).map((r) => ({
      id: r.id,
      backupDate: r.backup_date,
      trigger: r.trigger,
      rowCount: r.row_count,
      createdAt: r.created_at,
    })),
    retentionDays: BACKUP_RETENTION_DAYS,
    storage: status,
  }
}

export async function downloadStoredBackup(id) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from('system_backups').select('*').eq('id', id).maybeSingle()
  if (error) {
    if (isMissingBackupTableError(error)) throw missingTableError()
    throw new Error(error.message)
  }
  if (!data) throw new Error('Backup not found.')

  const payload = data.payload ?? {}
  const filename = `fms-backup-${data.backup_date}-${String(data.id).slice(0, 8)}.json`
  triggerDownload(payload, filename)
  return { filename, id: data.id, stored: true }
}

/**
 * If no backup exists for today's Sri Lanka date, create one (admin open / cron).
 * @returns {{ ran: boolean, backup?: object, reason?: string }}
 */
export async function ensureDailySystemBackup({ createdBy = null, trigger = 'auto' } = {}) {
  if (!supabase) return { ran: false, reason: 'not_configured' }

  const today = sriLankaDateISO()
  const { data: existing, error: listError } = await supabase
    .from('system_backups')
    .select('id')
    .eq('backup_date', today)
    .limit(1)

  if (listError) {
    if (isMissingBackupTableError(listError)) {
      return { ran: false, reason: 'missing_table' }
    }
    throw new Error(listError.message)
  }

  if ((existing ?? []).length > 0) {
    return { ran: false, reason: 'already_backed_up_today' }
  }

  const backup = await saveSystemBackup({ trigger, createdBy, download: false })
  return { ran: true, backup }
}
