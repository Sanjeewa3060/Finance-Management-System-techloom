import React, { useMemo, useState } from 'react'

function fmt(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v ?? '-'
  return d.toLocaleString()
}

export default function AuditLog({ logs, loading, error }) {
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')

  const filtered = useMemo(() => {
    return (logs ?? []).filter((row) => {
      if (actionFilter !== 'all' && row.action !== actionFilter) return false
      if (entityFilter !== 'all' && row.entity_type !== entityFilter) return false
      return true
    })
  }, [logs, actionFilter, entityFilter])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">Audit Log</h2>
        <p className="theme-hint mt-1 text-sm">
          Admin actions on companies, departments, transactions, and budgets.
        </p>
      </div>

      {error ? (
        <div className="theme-alert-error mt-4 rounded-lg p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="theme-input mt-0 w-auto py-2"
        >
          <option value="all">All actions</option>
          {[...new Set((logs ?? []).map((l) => l.action))].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="theme-input mt-0 w-auto py-2"
        >
          <option value="all">All entities</option>
          {[...new Set((logs ?? []).map((l) => l.entity_type))].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="theme-table-wrap mt-4 overflow-x-auto">
        <table className="min-w-[900px] w-full border-separate border-spacing-0 text-sm">
          <thead className="theme-table-head">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="theme-table-cell-muted px-4 py-8 text-center">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="theme-table-cell-muted px-4 py-8 text-center">
                  No audit events yet. Run the audit_logs SQL migration in Supabase.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="theme-table-row">
                  <td className="theme-table-cell-muted px-4 py-3">{fmt(row.created_at)}</td>
                  <td className="theme-table-cell px-4 py-3">
                    <div>{row.actor_email ?? '—'}</div>
                    <div className="theme-table-cell-muted text-xs">{row.actor_role}</div>
                  </td>
                  <td className="theme-table-cell px-4 py-3">{row.action}</td>
                  <td className="theme-table-cell-muted px-4 py-3">
                    {row.entity_type}
                    {row.entity_id ? (
                      <div className="theme-hint max-w-[140px] truncate text-xs" title={row.entity_id}>
                        {row.entity_id}
                      </div>
                    ) : null}
                  </td>
                  <td className="theme-table-cell-muted max-w-[320px] px-4 py-3 text-xs">
                    {row.details ? JSON.stringify(row.details) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
