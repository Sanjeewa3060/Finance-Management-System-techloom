import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const MIGRATION_FILES = [
  'supabase/complete_database_setup.sql',
]

const POOLER_REGIONS = [
  'us-east-1',
  'us-west-1',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
  'ap-south-1',
  'sa-east-1',
]

function loadEnv() {
  try {
    const text = readFileSync('.env', 'utf8')
    const env = {}
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
    return env
  } catch {
    return {}
  }
}

function resolveDbUrls(env, cliPassword) {
  if (env.SUPABASE_DB_URL) return [env.SUPABASE_DB_URL]
  if (env.DATABASE_URL) return [env.DATABASE_URL]

  const password = cliPassword || env.SUPABASE_DB_PASSWORD
  const url = env.VITE_SUPABASE_URL
  if (!password || !url) return []

  try {
    const ref = new URL(url.trim()).hostname.split('.')[0]
    const enc = encodeURIComponent(password)
    const urls = [`postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`]

    const regions = env.SUPABASE_DB_REGION
      ? [env.SUPABASE_DB_REGION]
      : POOLER_REGIONS

    for (const region of regions) {
      const regionHost = region.startsWith('aws-') ? region : `aws-${region}`
      urls.push(
        `postgresql://postgres.${ref}:${enc}@${regionHost}.pooler.supabase.com:5432/postgres`,
        `postgresql://postgres.${ref}:${enc}@${regionHost}.pooler.supabase.com:6543/postgres`,
        `postgresql://postgres.${ref}:${enc}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
        `postgresql://postgres.${ref}:${enc}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
      )
    }

    urls.push(`postgresql://postgres:${enc}@db.${ref}.supabase.co:6543/postgres`)

    return [...new Set(urls)]
  } catch {
    return []
  }
}

async function connectPgClient(dbUrls) {
  const pg = await import('pg')
  let lastError = 'No database URLs configured.'

  for (const dbUrl of dbUrls) {
    const client = new pg.default.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12_000,
    })
    try {
      await client.connect()
      return { client, dbUrl }
    } catch (error) {
      lastError = error.message
      await client.end().catch(() => {})
      if (String(error.message).includes('password authentication failed')) {
        throw new Error(error.message)
      }
    }
  }

  throw new Error(lastError)
}

async function applySqlWithPg(dbUrls, sqlText) {
  let client
  let usedUrl
  try {
    const connected = await connectPgClient(dbUrls)
    client = connected.client
    usedUrl = connected.dbUrl
    await client.query(sqlText)
    return { ok: true, dbUrl: usedUrl }
  } catch (error) {
    return { ok: false, error: error.message, dbUrl: usedUrl }
  } finally {
    await client?.end().catch(() => {})
  }
}

async function verify(supabase) {
  const checks = []

  const sensitive = await supabase.from('sensitive_events').select('id,event_type,message').limit(1)
  checks.push({
    name: 'sensitive_events',
    ok: !sensitive.error,
    error: sensitive.error?.message,
  })

  const otherDir = await supabase.from('transactions').select('other_direction').limit(1)
  checks.push({
    name: 'transactions.other_direction',
    ok: !otherDir.error,
    error: otherDir.error?.message,
  })

  const userSessions = await supabase.from('user_sessions').select('id').limit(1)
  checks.push({
    name: 'user_sessions',
    ok: !userSessions.error,
    error: userSessions.error?.message,
  })

  const probeId = '00000000-0000-0000-0000-000000000099'
  const auditInsert = await supabase.from('audit_logs').insert({
    actor_role: 'admin',
    actor_id: probeId,
    action: 'migration_probe',
    entity_type: 'migration_probe',
    details: { probe: true },
  })
  if (!auditInsert.error) {
    await supabase.from('audit_logs').delete().eq('entity_type', 'migration_probe').eq('actor_id', probeId)
  }
  checks.push({
    name: 'audit_logs write (sessions fallback)',
    ok: !auditInsert.error,
    error: auditInsert.error?.message,
  })

  const probeEmail = `probe-${Date.now()}@migration.test`
  const profileInsert = await supabase
    .from('company_profiles')
    .insert({ email: probeEmail, password: 'probe' })
    .select('id')
    .single()
  if (!profileInsert.error && profileInsert.data?.id) {
    await supabase.from('company_profiles').delete().eq('id', profileInsert.data.id)
  }
  checks.push({
    name: 'company_profiles write',
    ok: !profileInsert.error,
    error: profileInsert.error?.message,
  })

  const { data: probeDept } = await supabase.from('departments').select('id').limit(1).maybeSingle()
  if (probeDept?.id) {
    const otherInsert = await supabase
      .from('transactions')
      .insert({
        department_id: probeDept.id,
        type: 'other',
        other_direction: 'profit',
        category: 'migration_probe',
        amount: 1,
        entry_date: new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single()
    if (!otherInsert.error && otherInsert.data?.id) {
      await supabase.from('transactions').delete().eq('id', otherInsert.data.id)
    }
    checks.push({
      name: 'transactions.type other',
      ok: !otherInsert.error,
      error: otherInsert.error?.message,
    })
  } else {
    checks.push({
      name: 'transactions.type other',
      ok: false,
      error: 'No department row available for probe insert',
    })
  }

  return checks
}

const cliPassword = process.argv.find((a) => a.startsWith('--password='))?.slice('--password='.length)
const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
const dbUrls = resolveDbUrls(env, cliPassword)

console.log('\n=== Apply pending Supabase migrations ===\n')

if (!url || !key) {
  console.log('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key)
let checks = await verify(supabase)
const needsMigration = checks.some((c) => !c.ok)

if (!needsMigration) {
  console.log('All pending migrations already applied:\n')
  for (const c of checks) console.log(`  OK: ${c.name}`)
  console.log('\nRun: npm run test:db\n')
  process.exit(0)
}

console.log('Pending issues:')
for (const c of checks) {
  console.log(`  ${c.ok ? 'OK' : 'MISSING'}: ${c.name}${c.error ? ` — ${c.error}` : ''}`)
}
console.log('')

if (!dbUrls.length) {
  console.log('Add your database password to .env:')
  console.log('  SUPABASE_DB_PASSWORD=your-database-password')
  console.log('(Supabase → Project Settings → Database → Database password)\n')
  console.log('Then run: npm run migrate:db\n')
  console.log('Or paste SQL in Supabase SQL Editor:')
  for (const file of MIGRATION_FILES) console.log(`  - ${file}`)
  console.log('')
  process.exit(1)
}

console.log('Applying migrations via database connection…\n')
let connectedHost = ''
for (const file of MIGRATION_FILES) {
  const sql = readFileSync(file, 'utf8')
  console.log(`→ ${file}`)
  const result = await applySqlWithPg(dbUrls, sql)
  if (!result.ok) {
    console.log(`  FAILED: ${result.error}`)
    if (String(result.error).includes('password authentication failed')) {
      console.log('\nPassword rejected. In Supabase Dashboard:')
      console.log('  Project Settings → Database → Reset database password')
      console.log('Then update SUPABASE_DB_PASSWORD in .env and re-run npm run migrate:db\n')
    }
    process.exit(1)
  }
  connectedHost = result.dbUrl ?? connectedHost
  console.log('  OK')
}
if (connectedHost) {
  console.log(`\nConnected via: ${connectedHost.replace(/:[^:@/]+@/, ':***@')}`)
}

console.log('\nWaiting for PostgREST schema reload…')
await new Promise((r) => setTimeout(r, 3000))

checks = await verify(supabase)
console.log('\nVerification:')
let failed = 0
for (const c of checks) {
  if (c.ok) console.log(`  OK: ${c.name}`)
  else {
    failed++
    console.log(`  FAIL: ${c.name} — ${c.error}`)
  }
}

if (failed) {
  console.log('\nRun in SQL Editor: NOTIFY pgrst, \'reload schema\'; then re-run npm run migrate:db\n')
  process.exit(1)
}

console.log('\nDone. Run: npm run test:db\n')
process.exit(0)
