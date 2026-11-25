/**
 * Vercel Cron: daily FMS system backup → public.system_backups (JSONB + metadata).
 * Schedule: 18:30 UTC = 00:00 Asia/Colombo (see vercel.json).
 *
 * Prerequisite: run supabase/system_backups.sql (or npm run migrate:db) once.
 *
 * Env (Vercel project):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY
 *   CRON_SECRET (optional but recommended; Authorization: Bearer <secret>)
 */
import { createClient } from '@supabase/supabase-js'

const BACKUP_TABLES = [
  'company_profiles',
  'departments',
  'company_users',
  'categories',
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

const PAGE_SIZE = 1000
const RETENTION_DAYS = 90

function authorize(req) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  const auth = String(req.headers.authorization || '')
  if (secret) return auth === `Bearer ${secret}`
  if (req.headers['x-vercel-cron'] === '1') return true
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') return true
  return false
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    const err = new Error('Missing Supabase URL/key env vars for cron backup.')
    err.statusCode = 503
    throw err
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function sriLankaDateISO(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

async function fetchAllRows(supabase, table) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1)
    if (error) {
      if (/does not exist|schema cache|Could not find/i.test(error.message || '')) {
        return { skipped: true, rows: [] }
      }
      throw new Error(`${table}: ${error.message}`)
    }
    const batch = data || []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { skipped: false, rows }
}

function sanitizeAdminAccounts(rows) {
  return (rows || []).map((row) => {
    const { password, ...rest } = row
    return { ...rest, password: password ? '[omitted]' : null }
  })
}

async function runCronBackup() {
  const supabase = getSupabase()
  const backupDate = sriLankaDateISO()

  const { data: existing, error: lookupError } = await supabase
    .from('system_backups')
    .select('id')
    .eq('backup_date', backupDate)
    .limit(1)

  if (lookupError) throw new Error(`Could not check backup history: ${lookupError.message}`)

  if ((existing || []).length > 0) {
    return { skipped: true, backupDate, reason: 'already_backed_up_today' }
  }

  const tables = {}
  const tableCounts = {}
  for (const table of BACKUP_TABLES) {
    const result = await fetchAllRows(supabase, table)
    const rows = table === 'admin_accounts' ? sanitizeAdminAccounts(result.rows) : result.rows
    tables[table] = rows
    tableCounts[table] = rows.length
  }

  const rowCount = Object.values(tableCounts).reduce((s, n) => s + n, 0)
  const payload = {
    format: 'finance-management-system-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    backupDate,
    trigger: 'cron',
    app: 'Finance Management System',
    tableCounts,
    rowCount,
    tables,
  }

  const { data, error } = await supabase
    .from('system_backups')
    .insert({
      backup_date: backupDate,
      trigger: 'cron',
      row_count: rowCount,
      payload,
    })
    .select('id, backup_date, trigger, row_count, created_at')
    .single()

  if (error) {
    const err = new Error(
      /system_backups/i.test(error.message || '')
        ? 'Run supabase/system_backups.sql in Supabase SQL Editor.'
        : error.message,
    )
    err.statusCode = 501
    throw err
  }

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS)
  try {
    const { error: pruneError } = await supabase.from('system_backups').delete().lt('created_at', cutoff.toISOString())
    if (pruneError) console.warn('Backup retention cleanup failed:', pruneError.message)
  } catch (error) {
    console.warn('Backup retention cleanup failed:', error.message)
  }

  return { skipped: false, backup: data }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      return res.status(405).json({ error: 'Method not allowed' })
    }
    if (!authorize(req)) {
      return res.status(401).json({ error: 'Unauthorized cron request' })
    }
    const result = await runCronBackup()
    return res.status(200).json({
      ok: true,
      ...result,
      message: result.skipped
        ? `Backup already exists for ${result.backupDate}`
        : `Backed up ${result.backup?.row_count ?? 0} row(s) for ${result.backup?.backup_date}`,
    })
  } catch (error) {
    console.error('cron-backup', error)
    return res.status(error.statusCode || 500).json({ error: error.message || 'Backup failed' })
  }
}
