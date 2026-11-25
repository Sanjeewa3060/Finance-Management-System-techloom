import React, { useCallback, useEffect, useState } from 'react'
import { DatabaseBackup, Download, RefreshCw } from 'lucide-react'
import CompleteBackup from './CompleteBackup.jsx'

export default function SecurityBackups({ onBackup, onList, onDownload, onDownloadLocalOnly }) {
  const [backups, setBackups] = useState([])
  const [busy, setBusy] = useState('loading')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [retention, setRetention] = useState(90)
  const [alsoDownload, setAlsoDownload] = useState(false)
  const [storage, setStorage] = useState(null)

  const refresh = useCallback(async () => {
    const result = await onList()
    setBackups(result.backups || [])
    setRetention(result.retentionDays || 90)
    setStorage(result.storage || { configured: true })
    setError('')
  }, [onList])

  useEffect(() => {
    let active = true
    onList()
      .then((result) => {
        if (!active) return
        setBackups(result.backups || [])
        setRetention(result.retentionDays || 90)
        setStorage(result.storage || { configured: true })
        setError('')
      })
      .catch((err) => {
        if (!active) return
        const missing = err?.code === 'MISSING_BACKUP_TABLE'
        setStorage({
          configured: false,
          reason: missing ? 'missing_table' : 'error',
          message: err.message || 'Could not load backups.',
          setupSql: 'supabase/system_backups.sql',
        })
        setBackups([])
        setError(err.message || 'Could not load backups.')
      })
      .finally(() => {
        if (active) setBusy('')
      })
    return () => {
      active = false
    }
  }, [onList])

  async function run(action, task) {
    setBusy(action)
    setError('')
    setMessage('')
    try {
      await task()
    } catch (err) {
      setError(err.message || 'Backup operation failed.')
      if (err?.code === 'MISSING_BACKUP_TABLE') {
        setStorage({
          configured: false,
          reason: 'missing_table',
          message: err.message,
          setupSql: 'supabase/system_backups.sql',
        })
      }
    } finally {
      setBusy('')
    }
  }

  const configured = storage?.configured === true
  const lastAutomatic = backups.find((backup) => backup.trigger === 'cron' || backup.trigger === 'auto')

  return (
    <section className="border-t border-slate-700/60 pt-6" aria-labelledby="security-backups-title">
      <h3 id="security-backups-title" className="flex items-center gap-2 text-base font-semibold text-slate-100">
        <DatabaseBackup size={20} /> Data backup
      </h3>

      {configured ? (
        <>
          <p className="mt-2 text-sm text-slate-400">
            Server storage is configured. Snapshots are saved in Supabase (`public.system_backups`) and retained for{' '}
            {retention} days.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Daily schedule: midnight Sri Lanka time (Asia/Colombo) via Vercel Cron (`/api/cron-backup`). The job runs on
            the server even when this app is closed. Opening Profile as admin also creates today&apos;s snapshot if it is
            still missing.
          </p>
        </>
      ) : (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <p className="font-medium">Server backup storage is not configured yet.</p>
          <p className="mt-1 text-amber-100/90">
            {storage?.message ||
              'Run supabase/system_backups.sql in the Supabase SQL Editor (or npm run migrate:db), then click Refresh history.'}
          </p>
          <p className="mt-2 text-xs text-amber-100/80">
            Until that SQL is applied, automatic daily backups cannot persist and &quot;Backup now&quot; cannot save on the
            server.
          </p>
        </div>
      )}

      <p className="mt-2 text-xs text-slate-400">
        Last automatic backup:{' '}
        {lastAutomatic ? new Date(lastAutomatic.createdAt).toLocaleString() : 'No automatic backup recorded yet.'}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Snapshots contain application records. Uploaded receipt and avatar files are not included.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-400">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-emerald-400">
          {message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="rounded border-slate-600 bg-slate-900"
            checked={alsoDownload}
            onChange={(e) => setAlsoDownload(e.target.checked)}
            disabled={Boolean(busy) || !configured}
          />
          Also download JSON
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy) || !configured}
          className="theme-btn-primary"
          onClick={() =>
            run('backup', async () => {
              const result = await onBackup({ download: alsoDownload })
              setMessage(
                result?.stored
                  ? alsoDownload
                    ? `Backup saved on the server and downloaded (${result.filename}).`
                    : `Backup saved on the server (${result.filename || result.id}).`
                  : 'Backup did not save on the server.',
              )
              await refresh()
            })
          }
        >
          <DatabaseBackup size={16} />
          {busy === 'backup' ? 'Backing up…' : 'Backup now'}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          className="theme-btn-secondary"
          onClick={() => run('loading', refresh)}
        >
          <RefreshCw size={16} />
          Refresh history
        </button>
        {!configured && typeof onDownloadLocalOnly === 'function' ? (
          <button
            type="button"
            disabled={Boolean(busy)}
            className="theme-btn-secondary"
            onClick={() =>
              run('local', async () => {
                const result = await onDownloadLocalOnly()
                setMessage(
                  `Downloaded a local copy only (${result.filename}). Configure server storage to keep automatic backups.`,
                )
              })
            }
          >
            <Download size={16} />
            {busy === 'local' ? 'Downloading…' : 'Download local only'}
          </button>
        ) : null}
      </div>

      <div className="mt-4" aria-busy={Boolean(busy)}>
        <CompleteBackup />
        {busy === 'loading' ? (
          <p role="status" className="text-sm text-slate-400">
            Loading backups…
          </p>
        ) : !configured ? (
          <p className="text-sm text-slate-400">
            No server history yet — apply <code className="text-slate-300">{storage?.setupSql || 'supabase/system_backups.sql'}</code> first.
          </p>
        ) : !backups.length ? (
          <p className="text-sm text-slate-400">
            No saved backups found. Click &quot;Backup now&quot; to create the first server snapshot.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {backups.map((backup) => (
              <li
                key={backup.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/60 p-3"
              >
                <div>
                  <p className="text-sm text-slate-100">{new Date(backup.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">
                    {backup.trigger === 'manual' ? 'Manual' : backup.trigger === 'cron' ? 'Cron' : 'Automatic'} ·{' '}
                    {backup.rowCount} records
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  className="theme-btn-secondary"
                  aria-label={`Download backup from ${backup.createdAt}`}
                  onClick={() => run(backup.id, () => onDownload(backup.id))}
                >
                  <Download size={16} />
                  {busy === backup.id ? 'Downloading…' : 'Download'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
