/**
 * Sensitive Events Log — live Supabase integration test.
 * Run: npm run test:sensitive-events
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SENSITIVE_EVENT_SELECT =
  'id,event_type,actor_email,actor_role,actor_id,entity_type,entity_id,success,device_label,device_user_agent,message,created_at,expires_at'

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

const supabase = createClient(url, key)
console.log('URL host:', new URL(url).host)
console.log('')

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

const { data: admins, error: adminErr } = await supabase.from('admin_accounts').select('id,email').limit(1)
assert(!adminErr && admins?.[0], 'admin account available for probe', adminErr?.message)

const admin = admins?.[0]
if (!admin) {
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`)
  process.exit(1)
}

const probe = await supabase.from('sensitive_events').select('id').limit(1)
assert(!probe.error, 'sensitive_events table reachable', probe.error?.message)

const colProbe = await supabase.from('sensitive_events').select(SENSITIVE_EVENT_SELECT).limit(1)
assert(!colProbe.error, 'sensitive_events full column select', colProbe.error?.message)

const notifCol = await supabase.from('notifications').select('id,is_sensitive').limit(1)
assert(!notifCol.error, 'notifications.is_sensitive column', notifCol.error?.message)

const eventId = crypto.randomUUID()
const testMessage = `Integration test probe ${Date.now()}`
const insertPayload = {
  id: eventId,
  event_type: 'login_success',
  actor_email: admin.email,
  actor_role: 'admin',
  actor_id: admin.id,
  entity_type: 'test_probe',
  entity_id: null,
  success: true,
  device_label: 'Test Runner',
  device_user_agent: 'test-sensitive-events.mjs',
  message: testMessage,
}

const insert = await supabase.from('sensitive_events').insert(insertPayload)
if (insert.error?.message?.includes('row-level security')) {
  console.log('\nBlocked by RLS. Run this in Supabase SQL Editor:')
  console.log('  supabase/fix_security_tables_grants.sql')
  console.log('Or run full: supabase/pending_migrations.sql')
  console.log('Or: npm run migrate:db (with SUPABASE_DB_PASSWORD in .env)\n')
}
assert(!insert.error, 'insert sensitive event', insert.error?.message)

const fetchOne = await supabase
  .from('sensitive_events')
  .select(SENSITIVE_EVENT_SELECT)
  .eq('id', eventId)
  .maybeSingle()
assert(!fetchOne.error && fetchOne.data?.message === testMessage, 'fetch inserted event by id')

const list = await supabase
  .from('sensitive_events')
  .select(SENSITIVE_EVENT_SELECT)
  .order('created_at', { ascending: false })
  .limit(10)
assert(!list.error && (list.data?.length ?? 0) >= 1, 'list recent sensitive events', `rows=${list.data?.length ?? 0}`)

const notifInsert = await supabase
  .from('notifications')
  .insert({
    user_role: 'admin',
    user_id: admin.id,
    title: 'Sensitive event test',
    body: testMessage,
    is_sensitive: true,
    is_read: false,
  })
  .select('id,is_sensitive')
  .single()

if (notifInsert.error && String(notifInsert.error.message).includes('is_sensitive')) {
  assert(false, 'insert sensitive notification', notifInsert.error.message)
} else {
  assert(!notifInsert.error && notifInsert.data?.is_sensitive === true, 'insert sensitive notification')
  if (notifInsert.data?.id) {
    await supabase.from('notifications').delete().eq('id', notifInsert.data.id)
  }
}

const del = await supabase.from('sensitive_events').delete().eq('id', eventId)
assert(!del.error, 'delete probe event (cleanup)', del.error?.message)

const gone = await supabase.from('sensitive_events').select('id').eq('id', eventId).maybeSingle()
assert(!gone.error && !gone.data, 'probe event removed after cleanup')

console.log('\n=== New event type probes ===\n')

const newEventTypes = [
  { event_type: 'password_change', message: `Probe password_change ${Date.now()}` },
  { event_type: 'password_reset', message: `Probe password_reset ${Date.now()}` },
  { event_type: 'profile_update', message: `Probe profile_update ${Date.now()}` },
  { event_type: 'report_export', message: `Probe report_export ${Date.now()}` },
]

const probeIds = []

for (const probeType of newEventTypes) {
  const probeId = crypto.randomUUID()
  probeIds.push(probeId)
  const insertType = await supabase.from('sensitive_events').insert({
    id: probeId,
    event_type: probeType.event_type,
    actor_email: admin.email,
    actor_role: 'admin',
    actor_id: admin.id,
    entity_type: 'test_probe',
    success: true,
    device_label: 'Test Runner',
    device_user_agent: 'test-sensitive-events.mjs',
    message: probeType.message,
  })
  assert(!insertType.error, `insert ${probeType.event_type}`, insertType.error?.message)

  const fetchType = await supabase
    .from('sensitive_events')
    .select('event_type,message')
    .eq('id', probeId)
    .maybeSingle()
  assert(
    !fetchType.error && fetchType.data?.event_type === probeType.event_type,
    `fetch ${probeType.event_type}`,
  )

  const notifType = await supabase
    .from('notifications')
    .insert({
      user_role: 'admin',
      user_id: admin.id,
      title: `Sensitive: ${probeType.event_type}`,
      body: probeType.message,
      is_sensitive: true,
      is_read: false,
    })
    .select('id,is_sensitive')
    .single()
  assert(!notifType.error && notifType.data?.is_sensitive === true, `notification for ${probeType.event_type}`)
  if (notifType.data?.id) {
    await supabase.from('notifications').delete().eq('id', notifType.data.id)
  }
}

if (probeIds.length) {
  await supabase.from('sensitive_events').delete().in('id', probeIds)
  assert(true, 'cleanup new event type probes')
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
