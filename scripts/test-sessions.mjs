/**
 * Active Sessions — live Supabase integration test (audit_logs fallback when user_sessions missing).
 * Run: npm run test:sessions
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SESSION_ENTITY_TYPE = 'user_session'

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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

let passed = 0
let failed = 0

function assert(ok, label, detail = '') {
  if (ok) {
    passed++
    console.log(`PASS: ${label}${detail ? ` (${detail})` : ''}`)
  } else {
    failed++
    console.log(`FAIL: ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const { data: admins } = await supabase.from('admin_accounts').select('id,email').limit(1)
const user = admins?.[0] ? { id: admins[0].id, role: 'admin', email: admins[0].email } : null
if (!user) {
  console.error('No admin account found')
  process.exit(1)
}

const userSessionsProbe = await supabase.from('user_sessions').select('id').limit(1)
const usingAudit = !!userSessionsProbe.error
console.log(usingAudit ? 'Mode: audit_logs fallback\n' : 'Mode: user_sessions table\n')

const sessionId = crypto.randomUUID()
const otherId = crypto.randomUUID()
const now = new Date().toISOString()

if (usingAudit) {
  const ins = await supabase.from('audit_logs').insert({
    actor_role: user.role,
    actor_id: user.id,
    actor_email: user.email,
    action: 'session_active',
    entity_type: SESSION_ENTITY_TYPE,
    entity_id: sessionId,
    details: {
      session_id: sessionId,
      device_label: 'Chrome on Windows',
      device_user_agent: 'test-agent',
      started_at: now,
      last_active_at: now,
      revoked_at: null,
    },
  })
  if (ins.error?.message?.includes('row-level security')) {
    console.log('\nBlocked by audit_logs RLS. Run in Supabase SQL Editor:')
    console.log('  supabase/pending_migrations.sql')
    console.log('Or add SUPABASE_DB_PASSWORD to .env and run: npm run migrate:db\n')
  }
  assert(!ins.error, 'insert session to audit_logs', ins.error?.message)

  const list = await supabase
    .from('audit_logs')
    .select('entity_id,actor_id,details,created_at')
    .eq('entity_type', SESSION_ENTITY_TYPE)
    .eq('actor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(24)
  const activeRows = (list.data ?? []).filter((row) => !row.details?.revoked_at)
  assert(!list.error && activeRows.length >= 1, 'fetch sessions from audit_logs', `rows=${activeRows.length}`)

  await supabase.from('audit_logs').insert({
    actor_role: user.role,
    actor_id: user.id,
    actor_email: user.email,
    action: 'session_active',
    entity_type: SESSION_ENTITY_TYPE,
    entity_id: otherId,
    details: {
      session_id: otherId,
      device_label: 'Edge on Windows',
      device_user_agent: 'test-agent-2',
      started_at: now,
      last_active_at: now,
      revoked_at: null,
    },
  })

  const { data: otherRow } = await supabase
    .from('audit_logs')
    .select('id,details')
    .eq('entity_type', SESSION_ENTITY_TYPE)
    .eq('entity_id', otherId)
    .maybeSingle()

  assert(!!otherRow, 'second session stored for multi-device test')

  if (otherRow) {
    const revoked = await supabase
      .from('audit_logs')
      .update({ details: { ...otherRow.details, revoked_at: now } })
      .eq('id', otherRow.id)
    assert(!revoked.error, 'revoke remote session in audit_logs', revoked.error?.message)
  }

  await supabase.from('audit_logs').delete().eq('entity_id', sessionId)
  await supabase.from('audit_logs').delete().eq('entity_id', otherId)
} else {
  const ins = await supabase.from('user_sessions').insert({
    id: sessionId,
    user_role: user.role,
    user_id: user.id,
    device_label: 'Chrome on Windows',
    device_user_agent: 'test-agent',
    started_at: now,
    last_active_at: now,
  })
  assert(!ins.error, 'insert session to user_sessions', ins.error?.message)

  const list = await supabase
    .from('user_sessions')
    .select('id,device_label')
    .eq('user_id', user.id)
    .is('revoked_at', null)
  assert(!list.error && (list.data?.length ?? 0) >= 1, 'fetch sessions from user_sessions')

  await supabase.from('user_sessions').delete().eq('id', sessionId)
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
