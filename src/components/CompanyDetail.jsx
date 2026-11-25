import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import SummaryCards from './SummaryCards.jsx'
import { computeDepartmentAggregates, computeTotals, getBudgetSpendStatus } from '../utils/calculations.js'
import { formatMoney, chartMoneyTick } from '../utils/money.js'

export default function CompanyDetail({
  companyProfiles,
  departments,
  transactions,
  departmentBudgets,
  loading,
  onSaveAdminNotes,
}) {
  const [notes, setNotes] = React.useState('')
  const { companyId } = useParams()

  const company = useMemo(
    () => (companyProfiles ?? []).find((c) => c.id === companyId),
    [companyProfiles, companyId],
  )

  React.useEffect(() => {
    setNotes(company?.admin_notes ?? '')
  }, [company?.admin_notes])

  const companyDepartments = useMemo(
    () => (departments ?? []).filter((d) => d.company_profile_id === companyId),
    [departments, companyId],
  )

  const deptIds = useMemo(() => new Set(companyDepartments.map((d) => d.id)), [companyDepartments])

  const companyTransactions = useMemo(
    () => (transactions ?? []).filter((t) => deptIds.has(t.department_id)),
    [transactions, deptIds],
  )

  const totals = useMemo(() => computeTotals(companyTransactions), [companyTransactions])
  const departmentAggregates = useMemo(
    () => computeDepartmentAggregates(companyDepartments, companyTransactions),
    [companyDepartments, companyTransactions],
  )

  const budgetByDepartment = useMemo(() => {
    const byDept = {}
    for (const b of departmentBudgets ?? []) {
      if (deptIds.has(b.department_id)) byDept[b.department_id] = Number(b.budget_amount ?? 0)
    }
    return byDept
  }, [departmentBudgets, deptIds])

  const chartData = departmentAggregates.map((agg) => ({
    department: agg.department_name,
    revenue: agg.revenue,
    costs: agg.costs,
    netProfit: agg.netProfit,
  }))

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-400">Loading department...</div>
    )
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-slate-400">Department not found.</p>
        <Link to="/dashboard/departments?tab=profiles" className="mt-3 inline-block text-sm text-emerald-400 hover:underline">
          Back to Department Profiles
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/dashboard/departments?tab=profiles" className="text-xs text-slate-400 hover:text-slate-200">
            ← Department Profiles
          </Link>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">{company.email}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {companyDepartments.length} department(s) · {companyTransactions.length} transaction(s)
          </p>
        </div>
        <span
          className={
            company.is_active === false
              ? 'rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200'
              : 'rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200'
          }
        >
          {company.is_active === false ? 'Inactive' : 'Active'}
        </span>
      </div>

      {onSaveAdminNotes ? (
        <div className="mt-4 glass rounded-xl p-4">
          <div className="text-sm font-semibold text-slate-100">Admin notes (internal)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          <button type="button" onClick={() => onSaveAdminNotes(companyId, notes)} className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">Save notes</button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="glass-soft rounded-xl p-4">
          <div className="text-xs text-slate-400">Full name</div>
          <div className="mt-1 text-sm text-slate-100">{company.full_name || '—'}</div>
        </div>
        <div className="glass-soft rounded-xl p-4">
          <div className="text-xs text-slate-400">Phone</div>
          <div className="mt-1 text-sm text-slate-100">{company.phone || '—'}</div>
        </div>
        <div className="glass-soft rounded-xl p-4">
          <div className="text-xs text-slate-400">Address</div>
          <div className="mt-1 text-sm text-slate-100">{company.address || '—'}</div>
        </div>
      </div>

      <div className="mt-6">
        <SummaryCards totals={{ ...totals, budgetByDepartment }} />
      </div>

      <div className="mt-4 glass rounded-xl p-4">
        <div className="text-sm font-semibold text-slate-100">Department performance</div>
        <div className="mt-3 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
              <XAxis dataKey="department" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8' }} tickFormatter={chartMoneyTick} />
              <Tooltip formatter={(value) => formatMoney(value)} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="costs" name="Costs" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="netProfit" name="Net Profit" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto glass rounded-xl p-4">
        <div className="text-sm font-semibold text-slate-100">Departments</div>
        <table className="mt-3 min-w-[720px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Revenue</th>
              <th className="px-3 py-2">Costs</th>
              <th className="px-3 py-2">Net profit</th>
              <th className="px-3 py-2">Budget</th>
              <th className="px-3 py-2">Spend alert</th>
            </tr>
          </thead>
          <tbody>
            {departmentAggregates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                  No departments for this account.
                </td>
              </tr>
            ) : (
              departmentAggregates.map((agg) => {
                const budget = budgetByDepartment[agg.department_id] ?? 0
                const status = getBudgetSpendStatus(agg.costs, budget)
                return (
                  <tr key={agg.department_id} className="border-t border-slate-800/60">
                    <td className="px-3 py-3 text-sm text-slate-100">{agg.department_name}</td>
                    <td className="px-3 py-3 text-sm text-slate-200">{formatMoney(agg.revenue)}</td>
                    <td className="px-3 py-3 text-sm text-slate-200">{formatMoney(agg.costs)}</td>
                    <td className={`px-3 py-3 text-sm ${agg.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatMoney(agg.netProfit)}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-200">{formatMoney(budget)}</td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 overflow-x-auto glass rounded-xl p-4">
        <div className="text-sm font-semibold text-slate-100">Recent transactions</div>
        <table className="mt-3 min-w-[760px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {companyTransactions.slice(0, 25).map((t) => {
              const dept = companyDepartments.find((d) => d.id === t.department_id)
              return (
                <tr key={t.id} className="border-t border-slate-800/60">
                  <td className="px-3 py-3 text-sm text-slate-300">{t.entry_date}</td>
                  <td className="px-3 py-3 text-sm text-slate-200">{dept?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-sm text-slate-200">{t.type}</td>
                  <td className="px-3 py-3 text-sm text-slate-200">{t.category}</td>
                  <td className="px-3 py-3 text-sm text-slate-100">{formatMoney(t.amount)}</td>
                </tr>
              )
            })}
            {companyTransactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                  No transactions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
