import React, { useMemo, useState } from 'react'
import { transactionTypeToneClass } from '../utils/entryTypes.js'

function fmt(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v ?? '—'
  return d.toLocaleString()
}

function eventLabel(type) {
  const map = {
    login_success: 'Login success',
    login_failed: 'Login failed',
    delete_attempt: 'Delete attempt',
    delete_success: 'Delete success',
    delete_failed: 'Delete failed',
    password_change: 'Password change',
    password_reset: 'Password reset',
    profile_update: 'Profile update',
    report_export: 'Report export',
    entry_create: 'Entry created',
    entry_update: 'Entry updated',
    stock_adjustment: 'Stock adjustment',
    stock_adjustment_failed: 'Stock adjustment failed',
  }
  return map[type] ?? type
}

const RED_EVENT_TYPES = new Set(['login_failed', 'password_change', 'password_reset'])

function isRedSensitiveEvent(row) {
  const type = row?.event_type ?? ''
  if (row?.success === false) return true
  if (RED_EVENT_TYPES.has(type)) return true
  if (type.startsWith('delete_')) return true
  return false
}

function sensitiveEventToneClass(row) {
  return isRedSensitiveEvent(row)
    ? `${transactionTypeToneClass({ type: 'expense' })} sensitive-event-cost-tone`
    : transactionTypeToneClass({ type: 'sale' })
}

export default function SensitiveEventsLog({
  events = [],
  loading = false,
  error = null,
}) {
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return events
    return events.filter((row) => row.event_type === typeFilter)
  }, [events, typeFilter])

  const types = useMemo(
    () => [...new Set((events ?? []).map((e) => e.event_type))].sort(),
    [events],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">Sensitive Events Log</h2>
        <p className="theme-hint mt-1 text-sm">
          Login activity, password and profile changes, delete attempts, and report exports. Entries cannot be deleted
          manually and auto-remove after 30 days.
        </p>
      </div>

      {error ? (
        <div className="theme-alert-error mt-4 rounded-lg p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="theme-input mt-0 w-auto py-2"
        >
          <option value="all">All event types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {eventLabel(t)}
            </option>
          ))}
        </select>
      </div>

      <div className="theme-table-wrap mt-4 overflow-x-auto">
        <table className="min-w-[960px] w-full border-separate border-spacing-0 text-sm">
          <thead className="theme-table-head">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Date / Time</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="theme-table-cell-muted px-4 py-8 text-center">
                  Loading sensitive events…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="theme-table-cell-muted px-4 py-8 text-center">
                  No sensitive events yet.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="theme-table-row">
                  <td className="theme-table-cell-muted whitespace-nowrap px-4 py-3">{fmt(row.created_at)}</td>
                  <td className="theme-table-cell px-4 py-3">{row.actor_email ?? '—'}</td>
                  <td className="theme-table-cell-muted px-4 py-3">{row.actor_role ?? '—'}</td>
                  <td className={`px-4 py-3 text-sm ${sensitiveEventToneClass(row)}`}>{eventLabel(row.event_type)}</td>
                  <td className="theme-table-cell-muted px-4 py-3">{row.device_label ?? '—'}</td>
                  <td className={`max-w-md px-4 py-3 text-xs ${sensitiveEventToneClass(row)}`}>{row.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="theme-hint mt-4 text-xs">Entries auto-remove after 30 days. This log cannot be edited or deleted from the app.</p>
    </div>
  )
}
