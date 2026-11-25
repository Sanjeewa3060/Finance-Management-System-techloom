// Read-only archival export. Credentials are read from the process environment only.
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const required = ['BACKUP_DATABASE_URL', 'BACKUP_SUPABASE_URL', 'BACKUP_SERVICE_ROLE_KEY', 'BACKUP_PROJECT_REF']
const missing = required.filter((key) => !process.env[key])
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}. See scripts/PROJECT-ARCHIVE.md.`)
  process.exit(1)
}
const projectRef = process.env.BACKUP_PROJECT_REF
const url = new URL(process.env.BACKUP_SUPABASE_URL)
if (url.protocol !== 'https:' || url.hostname !== `${projectRef}.supabase.co`) {
  throw new Error('Project reference must match the Supabase URL. No export performed.')
}
const dumpBin = process.env.PG_DUMP_PATH || 'pg_dump'
if (spawnSync(dumpBin, ['--version']).status !== 0) throw new Error('Install PostgreSQL client tools or set PG_DUMP_PATH before exporting.')
const source = spawnSync('git', ['rev-parse', '--verify', 'origin/techloom^{commit}'], { encoding: 'utf8' })
if (source.status !== 0) throw new Error('Fetch origin/techloom before exporting.')
const sourceCommit = source.stdout.trim()
const output = resolve(process.argv[2] || join(process.env.TEMP || '.', `fms-archive-${Date.now()}`))
await mkdir(output, { recursive: false })
const manifest = { format: 'fms-project-archive', version: 1, complete: false, projectRef,
  sourceCommit, startedAt: new Date().toISOString(), files: [], limitations: [
    'Project dashboard settings, API keys, SMTP/OAuth configuration, Edge Function secrets and deployed Edge Function code are not included.',
    'Browser-only settings and externally hosted files are not included.',
    'Pause application writes during export for database/storage consistency.',
    'Restore into a new Supabase project requires selective schema restoration and rewriting old storage URLs; do not blindly restore managed schemas.',
  ] }
const saveManifest = () => writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2))
await saveManifest()
const db = new pg.Client({ connectionString: process.env.BACKUP_DATABASE_URL })
const storage = createClient(url.href, process.env.BACKUP_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function record(file) {
  const bytes = await readFile(join(output, file))
  manifest.files.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}
try {
  await db.connect()
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  const { rows: [snapshot] } = await db.query('SELECT pg_export_snapshot() AS id')
  const conn = new URL(process.env.BACKUP_DATABASE_URL)
  const dumpEnv = { ...process.env, PGHOST: conn.hostname, PGPORT: conn.port || '5432',
    PGUSER: decodeURIComponent(conn.username), PGPASSWORD: decodeURIComponent(conn.password),
    PGDATABASE: decodeURIComponent(conn.pathname.slice(1)) }
  if (conn.searchParams.has('sslmode')) dumpEnv.PGSSLMODE = conn.searchParams.get('sslmode')
  const dump = spawnSync(dumpBin, ['--format=custom', '--no-owner', '--no-acl',
    '--snapshot', snapshot.id, '--file', join(output, 'database.dump')], { env: dumpEnv })
  if (dump.status !== 0) throw new Error('Database export failed. Check database credentials, permissions and pg_dump version. Partial archive retained.')
  await record('database.dump')
  const { rows: buckets } = await db.query('SELECT * FROM storage.buckets ORDER BY id')
  const { rows: objects } = await db.query('SELECT * FROM storage.objects ORDER BY bucket_id, name')
  await writeFile(join(output, 'storage-buckets.json'), JSON.stringify(buckets, null, 2))
  await record('storage-buckets.json')
  await mkdir(join(output, 'storage'))
  const index = []
  for (const object of objects) {
    const { data, error } = await storage.storage.from(object.bucket_id).download(object.name)
    if (error) throw new Error('A storage file could not be downloaded. Archive is incomplete; source remains unchanged.')
    const file = `storage/${String(index.length + 1).padStart(8, '0')}.bin`
    const bytes = Buffer.from(await data.arrayBuffer())
    if (object.metadata?.size != null && Number(object.metadata.size) !== bytes.length) throw new Error('Storage file size changed during export. Retry with application writes paused.')
    await writeFile(join(output, file), bytes)
    index.push({ ...object, archiveFile: file })
    await record(file)
    console.log(`Saved storage file ${index.length} of ${objects.length}`)
  }
  await writeFile(join(output, 'storage-index.json'), JSON.stringify(index, null, 2))
  await record('storage-index.json')
  await db.query('COMMIT')
  const archive = spawnSync('git', ['archive', '--format=zip', '--output', join(output, 'techloom-source.zip'), sourceCommit])
  if (archive.status !== 0) throw new Error('Source archive failed.')
  await record('techloom-source.zip')
  manifest.complete = true
  manifest.storageObjectCount = objects.length
  manifest.finishedAt = new Date().toISOString()
  await saveManifest()
  console.log(`Archive saved to ${output}. Review manifest limitations before pausing the old project.`)
} catch (error) {
  manifest.failure = error.message.includes('password') ? 'Export failed; check connection configuration.' : error.message
  await saveManifest()
  console.error('Export incomplete. Partial files retained. The source project was not modified.')
  process.exitCode = 1
} finally {
  await db.end().catch(() => {})
}
