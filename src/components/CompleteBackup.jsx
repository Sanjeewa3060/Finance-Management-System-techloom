import React, { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'

export default function CompleteBackup() {
  const [expanded, setExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [download, setDownload] = useState('')
  const controller = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  const worker = String(import.meta.env.VITE_BACKUP_WORKER_URL || '').replace(/\/$/, '')

  async function start(event) {
    event.preventDefault()
    if (busy) return
    controller.current?.abort()
    controller.current = new AbortController()
    const signal = controller.current.signal
    setBusy(true); setError(''); setDownload(''); setStatus('Verifying administrator…')
    try {
      if (!worker || new URL(worker).protocol !== 'https:') throw new Error('Complete backup is not configured. Ask your administrator to connect the backup worker.')
      const response = await fetch(`${worker}/jobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }), signal, credentials: 'omit',
      })
      setPassword('')
      const job = await response.json()
      if (!response.ok) throw new Error(job.error || 'Could not start backup.')
      const deadline = Date.now() + 30 * 60 * 1000
      while (Date.now() < deadline) {
        const progress = await fetch(`${worker}/jobs/${job.id}`, {
          headers: { Authorization: `Bearer ${job.token}` }, signal, credentials: 'omit', cache: 'no-store',
        })
        const result = await progress.json()
        if (!progress.ok || result.state === 'failed') throw new Error(result.error || 'Backup failed. No complete archive was produced.')
        setStatus(result.message)
        if (result.state === 'ready') {
          setDownload(`${worker}/jobs/${job.id}/download?token=${encodeURIComponent(job.token)}`)
          return
        }
        await new Promise((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
          const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 2000)
          signal.addEventListener('abort', abort, { once: true })
        })
      }
      throw new Error('Backup exceeded the waiting limit. Contact your administrator to inspect the worker.')
    } catch (err) {
      if (err.name !== 'AbortError') { setError(err.message); setStatus('') }
    } finally { setPassword(''); setBusy(false) }
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-700 p-4">
      <button type="button" className="theme-btn-primary" disabled={busy} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <Download size={16} /> Download complete backup
      </button>
      <p className="mt-2 text-xs text-slate-400">Save a ZIP with a database dump, uploaded receipts/photos, storage metadata and Techloom source. Keep it private. Project settings and external files must be saved separately.</p>
      {expanded && (
        <form onSubmit={start} className="mt-4 space-y-3">
          {!worker && <p role="status" className="text-sm text-amber-400">The complete-backup server needs to be configured before this download is available.</p>}
          <p className="text-sm text-slate-400">Use the backup administrator credentials configured for this export service. Avoid editing records or uploading files until the export finishes.</p>
          <label className="block text-sm text-slate-300">Admin email<input required type="email" autoComplete="username" className="theme-input mt-1" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
          <label className="block text-sm text-slate-300">Backup access password<input required type="password" autoComplete="current-password" className="theme-input mt-1" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
          <button type="submit" className="theme-btn-secondary" disabled={busy || !worker}>{busy ? 'Preparing backup…' : 'Prepare ZIP backup'}</button>
        </form>
      )}
      {status && <p role="status" className="mt-3 text-sm text-emerald-400">{status}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
      {download && <a className="theme-btn-primary mt-3 inline-flex" href={download} referrerPolicy="no-referrer">Download ZIP (available for one hour)</a>}
    </div>
  )
}
