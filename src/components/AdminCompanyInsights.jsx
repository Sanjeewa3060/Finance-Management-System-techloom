import React, { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Building2, PlusCircle, TrendingUp } from 'lucide-react'
import PageShell from './PageShell.jsx'
import AppIcon from './AppIcon.jsx'
import SummaryCards from './SummaryCards.jsx'
import { computeTotals } from '../utils/calculations.js'
import {
  computeBranchAggregates,
  enrichCompanyComparison,
  filterTransactionsForBranch,
} from '../utils/companyAnalytics.js'
import { formatDayHeading, formatDisplayDate } from '../utils/dates.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { getChartTheme } from '../utils/chartTheme.js'
import { formatMoney, chartMoneyTick } from '../utils/money.js'
import { APP_RED } from '../utils/themeColors.js'

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', APP_RED]

export default function AdminCompanyInsights({ departments = [], transactions = [], loading = false, onOpenAddEntry }) {
  const { theme } = useTheme()
  const chartTheme = useMemo(() => getChartTheme(theme), [theme])
  const [searchParams, setSearchParams] = useSearchParams()
  const deptFromUrl = searchParams.get('department') || searchParams.get('branch')

  const aggregates = useMemo(
    () => computeBranchAggregates(departments, transactions),
    [departments, transactions],
  )

  const compared = useMemo(() => enrichCompanyComparison(aggregates), [aggregates])

  const realBranches = useMemo(() => compared.filter((b) => b.company_id), [compared])

  const [selectedBranchId, setSelectedBranchId] = useState(deptFromUrl || realBranches[0]?.company_id || '')

  React.useEffect(() => {
    if (deptFromUrl && deptFromUrl !== selectedBranchId) {
      setSelectedBranchId(deptFromUrl)
    }
  }, [deptFromUrl, selectedBranchId])

  function selectBranch(id) {
    setSelectedBranchId(id)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id) next.set('department', id)
      else next.delete('department')
      next.delete('branch')
      return next
    })
  }

  const selected = useMemo(
    () => realBranches.find((b) => b.company_id === selectedBranchId),
    [realBranches, selectedBranchId],
  )

  const branchTransactions = useMemo(() => {
    if (!selectedBranchId) return []
    return filterTransactionsForBranch(transactions, selectedBranchId)
  }, [transactions, selectedBranchId])

  const branchTotals = useMemo(() => computeTotals(branchTransactions), [branchTransactions])
  const sortedBranchTransactions = useMemo(
    () =>
      [...branchTransactions].sort((a, b) => {
        const dateCmp = String(b.entry_date).localeCompare(String(a.entry_date))
        if (dateCmp !== 0) return dateCmp
        return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
      }),
    [branchTransactions],
  )

  const comparisonChartData = realBranches.map((b) => ({
    name: b.chartName,
    revenue: b.revenue,
    costs: b.costs,
    netProfit: b.netProfit,
    company_id: b.company_id,
  }))

  const pieData = realBranches
    .filter((b) => b.revenue > 0)
    .map((b) => ({ name: b.chartName, value: b.revenue, company_id: b.company_id }))

  const portfolioTotals = useMemo(() => {
    const t = computeTotals(transactions)
    return { ...t, companies: realBranches.length }
  }, [transactions, realBranches.length])

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <AppIcon icon={Building2} size="lg" className="text-emerald-600" />
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Department analytics (admin)
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Compare every department. Select one to view its transaction details, then add entries below the list for that
            department.
          </p>
        </div>
        <Link to="/dashboard/departments" className="theme-btn-secondary">
          Manage departments
        </Link>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-sm text-slate-500">Loading department data…</p>
      ) : realBranches.length === 0 ? (
        <div className="glass mt-8 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-500">No departments yet. Create one under Department Profiles in the sidebar.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass rounded-xl p-4">
              <div className="text-xs font-medium uppercase text-slate-500">Departments</div>
              <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{realBranches.length}</div>
            </div>
            <div className="glass rounded-xl border-l-4 border-emerald-500 p-4">
              <div className="text-xs font-medium uppercase text-slate-500">Portfolio revenue</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatMoney(portfolioTotals.revenue)}
              </div>
            </div>
            <div className="glass rounded-xl border-l-4 border-rose-500 p-4">
              <div className="text-xs font-medium uppercase text-slate-500">Portfolio costs</div>
              <div className="mt-1 text-2xl font-bold text-rose-700 dark:text-rose-400">
                {formatMoney(portfolioTotals.costs)}
              </div>
            </div>
            <div className="glass rounded-xl border-l-4 border-blue-500 p-4">
              <div className="text-xs font-medium uppercase text-slate-500">Portfolio profit</div>
              <div
                className={`mt-1 text-2xl font-bold ${portfolioTotals.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}
              >
                {formatMoney(portfolioTotals.netProfit)}
              </div>
            </div>
          </div>

          <section className="mt-8">
            <div className="flex items-center gap-2">
              <AppIcon icon={TrendingUp} size="sm" className="text-emerald-600" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Compare all departments</h3>
            </div>
            <p className="mt-1 text-sm text-slate-500">Side-by-side performance — revenue, costs, and net profit.</p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="glass rounded-xl p-4">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Revenue &amp; costs by department</p>
                <div className="mt-3 h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChartData} margin={{ bottom: 60 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: chartTheme.tick, fontSize: 11 }}
                        angle={-25}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis tick={{ fill: chartTheme.tick }} tickFormatter={chartMoneyTick} />
                      <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => formatMoney(v)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="costs" name="Costs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="netProfit" name="Net profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Revenue share</p>
                <div className="mt-3 h-[300px] w-full">
                  {pieData.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-slate-500">No revenue data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={100}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatMoney(v)} contentStyle={chartTheme.tooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <div className="glass mt-4 overflow-x-auto rounded-xl">
              <table className="min-w-[900px] w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                    <th className="theme-table-head px-4 py-3">Rank</th>
                    <th className="theme-table-head px-4 py-3">Department</th>
                    <th className="theme-table-head px-4 py-3">Login</th>
                    <th className="theme-table-head px-4 py-3">Entries</th>
                    <th className="theme-table-head px-4 py-3">Revenue</th>
                    <th className="theme-table-head px-4 py-3">Costs</th>
                    <th className="theme-table-head px-4 py-3">Net profit</th>
                    <th className="theme-table-head px-4 py-3">Margin</th>
                    <th className="theme-table-head px-4 py-3">vs avg profit</th>
                    <th className="theme-table-head px-4 py-3">Share</th>
                    <th className="theme-table-head px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {realBranches.map((b) => (
                    <tr
                      key={b.company_id}
                      className={`border-t border-slate-200/80 dark:border-slate-800/60 ${
                        selectedBranchId === b.company_id ? 'bg-emerald-500/10' : 'hover:bg-slate-500/5'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300">#{b.rank}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => selectBranch(b.company_id)} className="text-left">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{b.company_label}</div>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{b.email || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{b.entries}</td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {formatMoney(b.revenue)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-400">
                        {formatMoney(b.costs)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-semibold ${b.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}
                      >
                        {formatMoney(b.netProfit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{b.profitMargin.toFixed(1)}%</td>
                      <td className={`px-4 py-3 text-sm ${b.vsAvgProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {b.vsAvgProfit >= 0 ? '+' : ''}
                        {formatMoney(b.vsAvgProfit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{b.revenueShare.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/transactions?department=${b.company_id}`}
                          className="text-xs font-medium text-emerald-600 hover:underline"
                        >
                          Transactions
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10 grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="glass rounded-xl p-3 lg:sticky lg:top-24">
              <p className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">Each department</p>
              <div className="finance-scroll max-h-[420px] space-y-1 overflow-y-auto">
                {realBranches.map((b) => {
                  const active = b.company_id === selectedBranchId
                  return (
                    <button
                      key={b.company_id}
                      type="button"
                      onClick={() => selectBranch(b.company_id)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                        active ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-500/10'
                      }`}
                    >
                      <div className="truncate text-sm font-medium">{b.company_label}</div>
                      <div className={`text-xs ${active ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {b.entries} entries · {formatMoney(b.netProfit)} profit
                      </div>
                    </button>
                  )
                })}
              </div>
            </aside>

            <div className="min-w-0">
              {selected ? (
                <div className="glass overflow-hidden rounded-xl border border-slate-700/50 dark:border-slate-700/50">
                  <div className="border-b border-slate-200/80 p-4 sm:p-5 dark:border-slate-700/50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Selected department
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{selected.company_label}</h3>
                    {selected.email ? <p className="text-sm text-slate-500">Login: {selected.email}</p> : null}
                    <div className="mt-4 w-full">
                      <SummaryCards totals={branchTotals} />
                    </div>
                    <div className="mt-4">
                      <Link
                        to={`/dashboard/transactions?department=${selected.company_id}`}
                        className="text-sm font-medium text-emerald-600 hover:underline"
                      >
                        Open in Transactions
                      </Link>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead className="theme-table-head">
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Description</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedBranchTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-400">
                              No transactions for this department yet.
                            </td>
                          </tr>
                        ) : (
                          sortedBranchTransactions.map((t) => (
                            <tr key={t.id} className="theme-table-row">
                              <td className="theme-table-cell-muted px-4 py-3">
                                <div className="font-medium text-slate-800 dark:text-slate-100">{formatDayHeading(t.entry_date)}</div>
                                <div className="text-xs text-slate-500">{formatDisplayDate(t.entry_date)}</div>
                              </td>
                              <td className="theme-table-cell-muted px-4 py-3 capitalize">{t.type}</td>
                              <td className="theme-table-cell px-4 py-3">{t.category}</td>
                              <td className="theme-table-cell-muted px-4 py-3">{t.description || '—'}</td>
                              <td className="theme-table-cell px-4 py-3 font-medium tabular-nums">{formatMoney(t.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-slate-200/80 p-4 dark:border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => onOpenAddEntry?.({ departmentId: selected.company_id })}
                      className="theme-btn-primary theme-btn-primary--block"
                    >
                      <AppIcon icon={PlusCircle} size="sm" className="text-white" />
                      Add entry
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select a department from the list.</p>
              )}
            </div>
          </section>
        </>
      )}
    </PageShell>
  )
}
