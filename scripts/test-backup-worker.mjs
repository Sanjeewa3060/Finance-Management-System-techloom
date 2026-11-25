import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createBackupHandler, zipExportFolder } from './backup-worker.mjs'

const origin = 'https://fms.example.com'
async function fixture(t, createArchive, options = {}) {
  const jobs = new Map()
  const server = http.createServer(createBackupHandler({ origin, jobs,
    verifyAdmin: async (email, password) => email === 'admin@example.com' && password === 'test-only-password',
    createArchive, ...options,
  }))
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const base = `http://127.0.0.1:${server.address().port}`
  const start = (password = 'test-only-password') => fetch(`${base}/jobs`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password }) })
  return { jobs, base, start }
}

test('requires credentials, rejects foreign origin and throttles repeated guesses', async t => {
  let exports = 0
  const { base, start } = await fixture(t, async () => { exports++; return '' })
  assert.equal((await fetch(`${base}/jobs`, { method: 'POST', headers: { Origin: 'https://other.example' } })).status, 403)
  for (let n = 0; n < 5; n++) assert.equal((await start('incorrect')).status, 401)
  assert.equal((await start()).status, 429)
  assert.equal(exports, 0)
})

test('exports ZIP, protects status and download, and expires download links', async t => {
  const root = await mkdtemp(join(tmpdir(), 'backup-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const folder = join(root, 'export'); await mkdir(folder)
  await writeFile(join(folder, 'manifest.json'), '{"complete":true}')
  await writeFile(join(folder, 'photo.bin'), Buffer.from([0, 1, 2, 255]))
  const file = join(root, 'backup.zip'); await zipExportFolder(folder, file)
  let now = Date.now()
  const { base, start, jobs } = await fixture(t, async () => file, { now: () => now })
  const response = await start(); assert.equal(response.status, 202)
  const job = await response.json()
  assert.equal((await fetch(`${base}/jobs/${job.id}`)).status, 404)
  const status = await fetch(`${base}/jobs/${job.id}`, { headers: { Authorization: `Bearer ${job.token}` } })
  assert.equal((await status.json()).state, 'ready')
  const download = await fetch(`${base}/jobs/${job.id}/download?token=${job.token}`)
  assert.equal(download.status, 200)
  assert.equal(download.headers.get('content-type'), 'application/zip')
  const bytes = Buffer.from(await download.arrayBuffer())
  assert.deepEqual(bytes, await readFile(file)); assert.equal(bytes.subarray(0, 2).toString(), 'PK')
  assert.ok(bytes.includes(Buffer.from('photo.bin')))
  now = jobs.get(job.id).expires + 1
  assert.equal((await fetch(`${base}/jobs/${job.id}/download?token=${job.token}`)).status, 404)
})

test('failed exports cannot be downloaded and do not expose internal errors', async t => {
  const { base, start } = await fixture(t, async () => { throw new Error('secret database credential') })
  const job = await (await start()).json()
  const status = await (await fetch(`${base}/jobs/${job.id}`, { headers: { Authorization: `Bearer ${job.token}` } })).json()
  assert.equal(status.state, 'failed'); assert.ok(!JSON.stringify(status).includes('secret database'))
  assert.equal((await fetch(`${base}/jobs/${job.id}/download?token=${job.token}`)).status, 409)
})

test('only one export runs at a time', async t => {
  let finish
  const { start } = await fixture(t, () => new Promise(resolve => { finish = resolve }))
  assert.equal((await start()).status, 202)
  assert.equal((await start()).status, 409)
  finish('test.zip')
})
