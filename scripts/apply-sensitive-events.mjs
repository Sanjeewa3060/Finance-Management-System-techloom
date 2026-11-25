import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SENSITIVE_EVENT_SELECT =
  'id,event_type,actor_email,actor_role,actor_id,entity_type,entity_id,success,device_label,device_user_agent,message,created_at,expires_at'

function loadEnv() {
  try {
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
  } catch {
    return {}
  }
}

function isMissingSchemaError(message) {
  const msg = String(message ?? '')
  return (
    msg.includes('schema cache') ||
    msg.includes('Could not find the table') ||
    (msg.includes('does not exist') && (msg.includes('relation') || msg.includes('column')))
  )
}

function resolveDbUrl(env) {
  if (env.SUPABASE_DB_URL) return env.SUPABASE_DB_URL
  if (env.DATABASE_URL) return env.DATABASE_URL
  const password = env.SUPABASE_DB_PASSWORD
  const url = env.VITE_SUPABASE_URL
  if (!password || !url) return null
  try {
    const ref = new URL(url).hostname.split('.')[0]
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`
  } catch {
    return null
  }
}

async function verifySensitiveEventsApi(supabase) {
  const minimal = await supabase.from('sensitive_events').select('id').limit(1)
  if (minimal.error) {
    return { ok: false, stage: 'select-id', error: minimal.error.message }
  }

  const full = await supabase
    .from('sensitive_events')
    .select(SENSITIVE_EVENT_SELECT)
    .order('created_at', { ascending: false })
    .limit(300)

  if (full.error) {
    return { ok: false, stage: 'full-select', error: full.error.message }
  }

  return { ok: true, count: full.data?.length ?? 0 }
}

async function applySqlWithPg(dbUrl, sqlText) {
  let pg
  try {
    pg = await import('pg')
  } catch {
    return { ok: false, error: 'Install pg: npm install pg --save-dev' }
  }

  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const statements = sqlText
      .split(';')
      .map((s) => s.replace(/--[^\n]*/g, '').trim())
      .filter(Boolean)

    for (const statement of statements) {
      await client.query(`${statement};`)
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error.message }
  } finally {
    await client.end().catch(() => {})
  }
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
const dbUrl = resolveDbUrl(env)
const sqlPath = 'supabase/sensitive_events.sql'
const sqlText = readFileSync(sqlPath, 'utf8')

console.log('\n=== Sensitive Events Log — database setup ===\n')

if (!url || !key) {
  console.log('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key)
let result = await verifySensitiveEventsApi(supabase)

if (!result.ok && dbUrl && isMissingSchemaError(result.error)) {
  console.log('Creating public.sensitive_events via database connection…\n')
  const applied = await applySqlWithPg(dbUrl, sqlText)
  if (!applied.ok) {
    console.log(`Auto-apply failed: ${applied.error}\n`)
  } else {
    console.log('SQL applied. Waiting for PostgREST schema reload…')
    await new Promise((r) => setTimeout(r, 3000))
    result = await verifySensitiveEventsApi(supabase)
  }
}

if (result.ok) {
  console.log(`OK: public.sensitive_events is ready (${result.count} row(s)).`)
  console.log('Refresh the app — the Sensitive Events Log should work with no warnings.\n')
  process.exit(0)
}

console.log(`NOT READY (${result.stage}): ${result.error}\n`)

if (!dbUrl) {
  console.log('To auto-create the table, add your database password to .env:')
  console.log('  SUPABASE_DB_PASSWORD=your-database-password')
  console.log('(Supabase → Project Settings → Database → Database password)\n')
  console.log('Then run: npm run migrate:sensitive-events\n')
}

console.log('Or paste this SQL in Supabase Dashboard → SQL Editor:\n')
console.log('--- copy from here ---')
console.log(sqlText)
console.log('--- copy to here ---\n')
console.log(`Project: ${url}\n`)
process.exit(1)
