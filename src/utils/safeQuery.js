import { supabase } from '../lib/supabase.js'
import { verifyPassword } from './password.js'

/** True when Supabase/PostgREST reports a missing table or column. */
export function isMissingSchemaError(error) {
  const msg = String(error?.message ?? error ?? '')
  return (
    msg.includes('schema cache') ||
    msg.includes('Could not find the table') ||
    (msg.includes('does not exist') && (msg.includes('relation') || msg.includes('column')))
  )
}

/** True when row-level security blocks anon/authenticated access. */
export function isRlsPolicyError(error) {
  const msg = String(error?.message ?? error ?? '')
  return msg.includes('row-level security') || msg.includes('permission denied')
}

/** Run a Supabase query; on missing-column errors, run fallback if provided. */
export async function queryWithColumnFallback(primaryQuery, fallbackQuery) {
  const primary = await primaryQuery()
  if (!primary.error) return primary

  if (isMissingSchemaError(primary.error) && fallbackQuery) {
    return fallbackQuery()
  }
  return primary
}

export function sanitizeCompanyProfileForAdmin(row) {
  if (!row) return row
  const hasDeletePassword = !!row.delete_password
  const { delete_password, password, ...rest } = row
  return { ...rest, has_delete_password: hasDeletePassword }
}

export async function fetchCompanyProfilesForAdmin() {
  return queryWithColumnFallback(
    () =>
      supabase
        .from('company_profiles')
        .select('id,email,full_name,phone,address,is_active,deleted_at,created_at,admin_notes,last_login_at,delete_password,password')
        .order('created_at', { ascending: false }),
    () =>
      queryWithColumnFallback(
        () =>
          supabase
            .from('company_profiles')
            .select('id,email,full_name,phone,address,is_active,created_at,admin_notes,last_login_at,delete_password,password')
            .order('created_at', { ascending: false }),
        () =>
          queryWithColumnFallback(
            () =>
              supabase
                .from('company_profiles')
                .select('id,email,full_name,phone,address,is_active,created_at,password')
                .order('created_at', { ascending: false }),
            () =>
              supabase
                .from('company_profiles')
                .select('id,email,full_name,phone,address,created_at,password')
                .order('created_at', { ascending: false }),
          ),
      ),
  )
}

export async function safeUpdateLastLogin(table, id) {
  if (!supabase || !id) return
  const { error } = await supabase.from(table).update({ last_login_at: new Date().toISOString() }).eq('id', id)
  if (error && !String(error.message).includes('does not exist')) {
    console.warn('last_login_at update skipped:', error.message)
  }
}

export async function safeSaveAdminNotes(companyId, admin_notes) {
  if (!supabase) throw new Error('Database not configured.')
  const { error } = await supabase.from('company_profiles').update({ admin_notes }).eq('id', companyId)
  if (error?.message?.includes('admin_notes')) {
    throw new Error('Run supabase/all_features.sql in Supabase to enable admin notes.')
  }
  if (error) throw error
}

export function accountTableForUser(authUser) {
  if (!authUser) return null
  if (authUser.role === 'admin') return { table: 'admin_accounts', id: authUser.id }
  if (authUser.role === 'department') return { table: 'departments', id: authUser.department_id ?? authUser.id }
  if (authUser.role === 'company_user') return { table: 'company_users', id: authUser.id }
  if (authUser.role === 'company') return { table: 'company_profiles', id: authUser.id }
  return null
}

export async function verifyAuthUserPassword(authUser, password) {
  if (!supabase) throw new Error('Database not configured.')
  const target = accountTableForUser(authUser)
  if (!target) throw new Error('Not logged in.')

  const { data: row, error } = await supabase.from(target.table).select('password').eq('id', target.id).single()
  if (error) throw error
  if (!(await verifyPassword(password, row.password))) {
    throw new Error('Incorrect password.')
  }
}

export async function verifyDeleteTransactionPassword(authUser, password) {
  if (!supabase) throw new Error('Database not configured.')
  if (!authUser) throw new Error('Not logged in.')

  let table
  let id
  if (authUser.role === 'department') {
    table = 'departments'
    id = authUser.department_id ?? authUser.id
  } else if (authUser.role === 'company') {
    table = 'company_profiles'
    id = authUser.id
  } else if (authUser.role === 'company_user') {
    table = 'company_profiles'
    id = authUser.company_profile_id
  } else {
    throw new Error('Cannot delete entries for this account type.')
  }

  const { data: row, error } = await supabase.from(table).select('delete_password, password').eq('id', id).single()
  if (error) {
    if (String(error.message).includes('delete_password')) {
      throw new Error('Run supabase/delete_transaction_password.sql in Supabase to enable delete passwords.')
    }
    throw error
  }

  const stored = row.delete_password || row.password
  if (!stored) throw new Error('Delete password is not configured. Contact your admin.')
  if (!(await verifyPassword(password, stored))) {
    throw new Error('Incorrect delete password.')
  }
}
