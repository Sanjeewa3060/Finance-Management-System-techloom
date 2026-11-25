import { supabase } from '../lib/supabase.js'
import { ensureDefaultCategories } from './defaultCategories.js'
import { isMissingSchemaError } from './safeQuery.js'

const TABLES_TO_WIPE = [
  { table: 'transactions', column: 'entry_date', required: true },
  { table: 'recurring_entries', column: 'created_at', required: false },
  { table: 'department_budgets', column: 'created_at', required: false },
  { table: 'department_targets', column: 'revenue_target', required: false },
  { table: 'notifications', column: 'created_at', required: false },
  { table: 'audit_logs', column: 'created_at', required: false },
  { table: 'sensitive_events', column: 'created_at', required: false },
  { table: 'transaction_edit_history', column: 'created_at', required: false },
  { table: 'password_reset_tokens', column: 'created_at', required: false },
  { table: 'login_attempts', column: 'created_at', required: false },
  { table: 'company_users', column: 'created_at', required: false },
  { table: 'pnl_stock_adjustments', column: 'created_at', required: false },
  { table: 'categories', column: 'created_at', required: true },
  { table: 'departments', column: 'created_at', required: true },
  { table: 'company_profiles', column: 'created_at', required: true },
]

/** Delete all operational data. Keeps admin_accounts. */
export async function clearAllSystemData() {
  if (!supabase) throw new Error('Supabase is not configured.')

  async function wipe(table, column, required) {
    const { error } = await supabase.from(table).delete().gte(column, '1970-01-01')
    if (!error) return

    if (isMissingSchemaError(error)) {
      if (required) {
        throw new Error(
          `${table}: ${error.message} Run supabase/all_features.sql in Supabase SQL Editor, then try again.`,
        )
      }
      console.warn(`clearAllSystemData: skipped missing table ${table}`)
      return
    }

    throw new Error(`${table}: ${error.message}`)
  }

  for (const { table, column, required } of TABLES_TO_WIPE) {
    await wipe(table, column, required)
  }

  await ensureDefaultCategories(supabase)
}
