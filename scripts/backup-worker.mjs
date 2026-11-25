// Run on a private persistent Node host with pg_dump, behind HTTPS.
import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { ZipArchive } from 'archiver'
import bcrypt from 'bcryptjs'

export function tokensEqual(actual, expected) {
  const a = Buffer.from(actual || ''), b = Buffer.from(expected || '')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function zipExportFolder(directory, file) {
  const zip = new ZipArchive({ zlib: { level: 6 } })
  const completion = pipeline(zip, createWriteStream(file, { mode: 0o600 }))
  zip.on('warning', error => zip.destroy(error))
  zip.directory(directory, 'techloom-backup')
  await Promise.all([completion, zip.finalize()])
}

export function createBackupHandler({ origin, verifyAdmin, createArchive, jobs = new Map(), now = Date.now }) {
  const attempts = new Map()
  let starting = false
  const send = (res, code, value) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const requestOrigin = req.headers.origin
    if (requestOrigin && requestOrigin !== origin) return send(res, 403, { error: 'Origin not allowed.' })
    if (requestOrigin === origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
    const url = new URL(req.url, 'http://worker')
    try {
      if (url.pathname === '/jobs' && req.method === 'POST') {
        // Require the configured app origin for credential-bearing requests.
        if (requestOrigin !== origin) return send(res, 403, { error: 'Origin required.' })
        for (const [key, entry] of attempts) if (entry.until < now()) attempts.delete(key)
        const ip = req.socket.remoteAddress || 'unknown' // Do not trust spoofable forwarding headers.
        const limit = attempts.get(ip) || { count: 0, until: now() + 15 * 60 * 1000 }
        if (++limit.count > 5) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' })
        attempts.set(ip, limit)
        let body = ''
        for await (const chunk of req) {
          body += chunk
          if (Buffer.byteLength(body) > 4096) return send(res, 413, { error: 'Request too large.' })
        }
        let credentials
        try { credentials = JSON.parse(body) } catch { return send(res, 400, { error: 'Invalid request.' }) }
        if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string' || credentials.password.length > 256 || credentials.email.length > 320) return send(res, 400, { error: 'Invalid credentials.' })
        if (!await verifyAdmin(credentials.email.trim().toLowerCase(), credentials.password)) return send(res, 401, { error: 'Admin credentials were not accepted.' })
        if (starting || [...jobs.values()].some(job => job.state === 'running')) return send(res, 409, { error: 'A backup is already running. Try again after it finishes.' })
        if (jobs.size >= 3) return send(res, 429, { error: 'Export storage is busy. Try again after existing downloads expire.' })
        starting = true
        const id = randomBytes(16).toString('hex'), token = randomBytes(32).toString('hex')
        const job = { id, token, state: 'running', message: 'Exporting database and uploaded files…', expires: now() + 60 * 60 * 1000 }
        jobs.set(id, job)
        starting = false
        Promise.resolve().then(() => createArchive(job)).then(file => {
          Object.assign(job, { file, state: 'ready', message: 'Backup ZIP is ready. Download and verify it before pausing the old project.', expires: now() + 60 * 60 * 1000 })
        }).catch(() => { Object.assign(job, { state: 'failed', message: 'Backup failed. Check worker configuration and retry; no complete archive was produced.' }) })
        return send(res, 202, { id, token })
      }
      const match = url.pathname.match(/^\/jobs\/([a-f0-9]{32})(\/download)?$/)
      if (match && req.method === 'GET') {
        const job = jobs.get(match[1])
        const token = match[2] ? url.searchParams.get('token') : String(req.headers.authorization || '').replace(/^Bearer /, '')
        if (!job || job.expires < now() || !tokensEqual(token, job.token)) return send(res, 404, { error: 'Backup link is invalid or expired.' })
        if (!match[2]) return send(res, 200, { state: job.state, message: job.message, error: job.state === 'failed' ? job.message : undefined })
        if (job.state !== 'ready') return send(res, 409, { error: 'Backup is not ready.' })
        const info = await stat(job.file)
        res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': info.size,
          'Content-Disposition': 'attachment; filename="techloom-complete-backup.zip"' })
        return await pipeline(createReadStream(job.file), res)
      }
      return send(res, 404, { error: 'Not found.' })
    } catch {
      // Never send credentials, database errors, signed URLs, or child stderr to the client.
      if (!res.headersSent) send(res, 500, { error: 'Backup service could not complete the request.' })
      else res.destroy()
    }
  }
}

async function main() {
  for (const key of ['BACKUP_ALLOWED_ORIGIN', 'BACKUP_DATABASE_URL', 'BACKUP_SUPABASE_URL', 'BACKUP_PROJECT_REF', 'BACKUP_SERVICE_ROLE_KEY', 'BACKUP_ADMIN_EMAIL', 'BACKUP_ADMIN_PASSWORD_HASH']) {
    if (!process.env[key]) throw new Error(`Missing ${key}`)
  }
  const origin = new URL(process.env.BACKUP_ALLOWED_ORIGIN)
  if (origin.protocol !== 'https:') throw new Error('BACKUP_ALLOWED_ORIGIN must use HTTPS.')
  const db = new URL(process.env.BACKUP_DATABASE_URL)
  const ref = process.env.BACKUP_PROJECT_REF
  if (db.hostname !== `db.${ref}.supabase.co` && decodeURIComponent(db.username) !== `postgres.${ref}`) throw new Error('Database connection must match BACKUP_PROJECT_REF.')
  if (new URL(process.env.BACKUP_SUPABASE_URL).hostname !== `${ref}.supabase.co`) throw new Error('Supabase URL does not match project reference.')
  if (!/^\$2[aby]\$/.test(process.env.BACKUP_ADMIN_PASSWORD_HASH)) throw new Error('Configure a bcrypt backup-access password hash.')
  const jobs = new Map()
  const root = await mkdtemp(join(tmpdir(), 'fms-worker-'))
  const repo = fileURLToPath(new URL('../', import.meta.url))
  const handler = createBackupHandler({ origin: origin.origin, jobs,
    verifyAdmin: async (email, password) => {
      // Independent worker credentials: never trust the browser's role or writable app tables.
      const validPassword = await bcrypt.compare(password, process.env.BACKUP_ADMIN_PASSWORD_HASH)
      return email === process.env.BACKUP_ADMIN_EMAIL.trim().toLowerCase() && validPassword
    },
    createArchive: async job => {
      const directory = join(root, job.id)
      job.directory = directory
      await mkdir(directory, { mode: 0o700 })
      const archiveFolder = join(directory, 'export')
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['scripts/export-project-archive.mjs', archiveFolder], { cwd: repo, env: process.env, stdio: 'ignore', timeout: 25 * 60 * 1000 })
        child.on('error', reject)
        child.on('exit', code => code === 0 ? resolve() : reject(new Error('Export failed')))
      })
      const manifest = JSON.parse(await readFile(join(archiveFolder, 'manifest.json'), 'utf8'))
      if (!manifest.complete || manifest.projectRef !== ref) throw new Error('Incomplete or wrong-project export')
      job.message = 'Packing verified export into ZIP…'
      const file = join(directory, 'backup.zip')
      await zipExportFolder(archiveFolder, file)
      return file
    },
  })
  const cleanup = setInterval(async () => {
    for (const [id, job] of jobs) {
      if (job.state !== 'running' && job.expires < Date.now()) {
        jobs.delete(id)
        if (job.directory) await rm(job.directory, { recursive: true, force: true }).catch(() => {})
      }
    }
  }, 60_000)
  cleanup.unref()
  http.createServer(handler).listen(Number(process.env.BACKUP_WORKER_PORT || 8787), '127.0.0.1', () => console.log('Backup worker listening on loopback. Configure your HTTPS reverse proxy.'))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Backup worker could not start. Check required environment variables and project configuration.'); process.exitCode = 1 })
}
