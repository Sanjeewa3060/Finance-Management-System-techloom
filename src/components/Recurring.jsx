import React, { useState } from 'react'
import { formatMoney } from '../utils/money.js'
import { ENTRY_TYPES } from '../utils/entryTypes.js'
import { useConfirmWithPassword } from '../hooks/useConfirmWithPassword.jsx'

export default function Recurring({ entries, departments, onCreate, onDelete, onPostDue, loading, authUser }) {
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '')
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState('Rent')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const { confirmWithPassword, passwordConfirmModal } = useConfirmWithPassword(authUser)

  async function handleCreate(e) {
    e.preventDefault()
    await onCreate?.({ department_id: departmentId, type, category, amount: Number(amount), day_of_month: dayOfMonth })
    setAmount('')
  }

  async function handleDelete(id, label) {
    const password = await confirmWithPassword({
      title: 'Delete recurring entry',
      message: `Enter your login password to permanently delete${label ? ` “${label}”` : ' this recurring entry'}.`,
      confirmLabel: 'Delete recurring',
    })
    if (!password) return
    await onDelete?.(id, password)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Recurring entries</h2>
          <p className="theme-hint mt-1 text-sm">Auto-post monthly on the chosen day.</p>
        </div>
        <button type="button" onClick={onPostDue} className="theme-btn-primary theme-btn-primary--block">
          Post due this month
        </button>
      </div>

      <form onSubmit={handleCreate} className="glass mt-4 grid gap-3 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-5">
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="theme-input mt-0 py-2">
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="theme-input mt-0 py-2">
          {ENTRY_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="theme-input mt-0 py-2" />
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="theme-input mt-0 py-2" />
        <input
          type="number"
          min={1}
          max={28}
          value={dayOfMonth}
          onChange={(e) => setDayOfMonth(Number(e.target.value))}
          className="theme-input mt-0 py-2"
        />
        <button type="submit" className="theme-btn-primary theme-btn-primary--block sm:col-span-2 lg:col-span-5">
          Add recurring
        </button>
      </form>

      <div className="theme-table-wrap mt-4 overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="theme-table-head">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">Dept</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="theme-table-cell-muted p-6 text-center">
                  Loading...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="theme-table-cell-muted p-6 text-center">
                  No recurring entries yet.
                </td>
              </tr>
            ) : (
              entries.map((r) => {
                const d = departments.find((x) => x.id === r.department_id)
                return (
                  <tr key={r.id} className="theme-table-row">
                    <td className="theme-table-cell px-3 py-3">{d?.name}</td>
                    <td className="theme-table-cell-muted px-3 py-3">{r.type}</td>
                    <td className="theme-table-cell px-3 py-3">{r.category}</td>
                    <td className="theme-table-cell px-3 py-3 tabular-nums">{formatMoney(r.amount)}</td>
                    <td className="theme-table-cell-muted px-3 py-3">{r.day_of_month}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id, r.category)}
                        className="theme-money-negative text-xs hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {passwordConfirmModal}
    </div>
  )
}
