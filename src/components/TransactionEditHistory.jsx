import React, { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import {
  FIELD_LABELS,
  fetchTransactionEditHistory,
  formatHistoryValue,
} from '../utils/transactionEditHistory.js'

function fmtWhen(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v ?? '—'
  return d.toLocaleString()
}

function resolveDeptName(departmentId, departments) {
  if (!departmentId) return null
  return departments?.find((d) => d.id === departmentId)?.name ?? null
}

function ChangeRow({ field, oldValue, newValue, departments }) {
  const label = FIELD_LABELS[field] ?? field
  const oldLabel = formatHistoryValue(field, oldValue, {
    departmentName: field === 'department_id' ? resolveDeptName(oldValue, departments) : null,
  })
  const newLabel = formatHistoryValue(field, newValue, {
    departmentName: field === 'department_id' ? resolveDeptName(newValue, departments) : null,
  })

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
      <span className="font-medium text-slate-300">{label}</span>
      <span className="text-slate-500 line-through">{oldLabel}</span>
      <span className="text-slate-500">→</span>
      <span className="text-slate-200">{newLabel}</span>
    </div>
  )
}

/**
 * Inline edit-history list for a single transaction (used inside Edit Transaction modal).
 */
export default function TransactionEditHistory({
  transactionId,
  departments = [],
  refreshKey = 0,
  compact = false,
}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!transactionId) {
      setRows([])
      setError(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const result = await fetchTransactionEditHistory(transactionId)
      if (cancelled) return
      setRows(result.data ?? [])
      setError(result.error)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [transactionId, refreshKey])

  return (
    <div className={compact ? '' : 'mt-2'}>
      <div className="mb-2 flex items-center gap-2">
        <History className="h-4 w-4 text-slate-400" aria-hidden />
        <h3 className="text-sm font-medium text-slate-200">Edit history</h3>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 break-words">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="theme-hint text-xs">Loading history…</p>
      ) : !error && rows.length === 0 ? (
        <div className="space-y-1">
          <p className="theme-hint text-xs">No edits recorded yet for this transaction.</p>
          <p className="theme-hint text-[11px]">
            If you just saved a change and expected it here, run{' '}
            <code className="text-slate-400">supabase/fix_transaction_edit_history_rls.sql</code> on
            the Supabase project this app uses (check <code className="text-slate-400">VITE_SUPABASE_URL</code>
            ), then edit again. Techloom and other deploys may use different projects.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2.5"
            >
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-xs text-slate-300">
                  {row.actor_email ?? '—'}
                  {row.actor_role ? (
                    <span className="ml-1.5 text-slate-500">({row.actor_role})</span>
                  ) : null}
                </div>
                <div className="text-[11px] text-slate-500">{fmtWhen(row.created_at)}</div>
              </div>
              <div className="space-y-1">
                {(row.changed_fields ?? Object.keys(row.old_values ?? {})).map((field) => (
                  <ChangeRow
                    key={field}
                    field={field}
                    oldValue={row.old_values?.[field]}
                    newValue={row.new_values?.[field]}
                    departments={departments}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
