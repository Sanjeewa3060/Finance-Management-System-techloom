import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const text = readFileSync('.env', 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('FAIL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

console.log('URL host:', new URL(url).host)
console.log('Anon key loaded:', key.length > 20)

const supabase = createClient(url, key)
const tables = [
  'admin_accounts', 'company_profiles', 'departments', 'transactions',
  'department_budgets', 'audit_logs', 'sensitive_events', 'user_sessions', 'categories', 'notifications',
  'login_attempts', 'recurring_entries', 'company_users', 'department_targets',
  'password_reset_tokens',
]

let failures = 0
for (const table of tables) {
  const probe =
    table === 'sensitive_events' || table === 'user_sessions'
      ? await supabase.from(table).select('id').limit(1)
      : await supabase.from(table).select('*', { count: 'exact', head: true })
  const { error, count } = probe
  if (error) {
    failures++
    console.log(`${table}: ERROR — ${error.code ?? ''} ${error.message}`)
  } else {
    console.log(`${table}: OK${count != null ? ` (rows: ${count})` : ''}`)
  }
}

const deptCols = 'id,name,color,company_profile_id,email,full_name,phone,address,is_active,avatar_url,created_at'
const { error: deptColErr } = await supabase.from('departments').select(deptCols).limit(1)
console.log(deptColErr ? `departments columns: ERROR — ${deptColErr.message}` : 'departments columns: OK')

const txCols = 'id,department_id,type,category,description,amount,entry_date,status,currency,exchange_rate,vat_rate,payment_method,attachment_path,invoice_ref,due_date'
const { error: txColErr } = await supabase.from('transactions').select(txCols).limit(1)
console.log(txColErr ? `transactions columns: ERROR — ${txColErr.message}` : 'transactions columns: OK')

const profileCols = 'id,email,password,full_name,phone,address,is_active,admin_notes,deleted_at,avatar_url,last_login_at'
const { error: profileColErr } = await supabase.from('company_profiles').select(profileCols).limit(1)
console.log(profileColErr ? `company_profiles columns: ERROR — ${profileColErr.message}` : 'company_profiles columns: OK')

const { error: bucketErr } = await supabase.storage.from('avatars').list('', { limit: 1 })
console.log(bucketErr ? `avatars bucket: ERROR — ${bucketErr.message}` : 'avatars bucket: OK')

const txSelect = 'id,department_id,type,other_direction,category,description,amount,entry_date,status,currency,exchange_rate,vat_rate,payment_method,attachment_path,invoice_ref,due_date,created_at'
const { error: txSelectErr } = await supabase.from('transactions').select(txSelect).limit(1)
console.log(txSelectErr ? `TX_SELECT query: ERROR — ${txSelectErr.message}` : 'TX_SELECT query: OK')

const { error: sensitiveColErr } = await supabase
  .from('sensitive_events')
  .select('id,event_type,actor_email,message,created_at,expires_at')
  .limit(1)
console.log(
  sensitiveColErr
    ? `sensitive_events columns: ERROR — ${sensitiveColErr.message} (run npm run migrate:db)`
    : 'sensitive_events columns: OK',
)

const { error: userSessionsColErr } = await supabase
  .from('user_sessions')
  .select('id,user_role,user_id,device_label,last_active_at,revoked_at')
  .limit(1)
console.log(
  userSessionsColErr
    ? `user_sessions columns: FALLBACK — ${userSessionsColErr.message} (run npm run migrate:db or supabase/pending_migrations.sql)`
    : 'user_sessions columns: OK',
)

const { error: createdAtErr } = await supabase.from('transactions').select('created_at').limit(1)
console.log(
  createdAtErr
    ? `transactions.created_at: ERROR — ${createdAtErr.message} (run supabase/add_transaction_created_at.sql)`
    : 'transactions.created_at: OK',
)

const { error: otherDirErr } = await supabase.from('transactions').select('other_direction').limit(1)
console.log(otherDirErr ? `other_direction column: ERROR — ${otherDirErr.message}` : 'other_direction column: OK')

const adminProfileSelect = 'id,email,full_name,phone,address,is_active,deleted_at,created_at,admin_notes,last_login_at,delete_password,password'
const { error: adminProfileErr } = await supabase.from('company_profiles').select(adminProfileSelect).limit(1)
console.log(adminProfileErr ? `admin profile query: ERROR — ${adminProfileErr.message}` : 'admin profile query: OK')

process.exit(
  failures > 0 || deptColErr || txColErr || profileColErr || txSelectErr || createdAtErr || adminProfileErr || otherDirErr || sensitiveColErr
    ? 1
    : 0,
)
