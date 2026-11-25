import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  FileText,
  Info,
  LayoutGrid,
  MoreHorizontal,
  Percent,
  ShoppingCart,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import AppIcon from './AppIcon.jsx'
import EntryReceipt from './EntryReceipt.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { getChartTheme } from '../utils/chartTheme.js'
import {
  computeTotals,
  computeDepartmentAggregates,
  computeMonthlyTrends,
  getBudgetSpendStatus,
  toNumber,
} from '../utils/calculations.js'
import { filterTransactions, getDatePresetRange } from '../utils/filters.js'
import { computeTopCategories } from '../utils/reports.js'
import { ENTRY_TYPES, formatTransactionTypeLabel, transactionTypeToneClass } from '../utils/entryTypes.js'
import { formatMoney, chartMoneyTick } from '../utils/money.js'
import { hasReceipt } from '../utils/receiptDisplay.js'
import { APP_RED } from '../utils/themeColors.js'

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', APP_RED, '#8b5cf6', '#06b6d4', '#84cc16', '#eab308']
const RECENT_PREVIEW_LIMIT = 5
const RECENT_EXPANDED_LIMIT = 15

function formatDisplayDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey.length < 7) return monthKey ?? '—'
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

function endOfMonthISO(now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const end = new Date(y, m + 1, 0)
  const mm = String(end.getMonth() + 1).padStart(2, '0')
  const dd = String(end.getDate()).padStart(2, '0')
  return `${end.getFullYear()}-${mm}-${dd}`
}

function shiftMonthRange(fromDate, toDate, months) {
  if (!fromDate || !toDate) return { fromDate: '', toDate: '' }
  const [fy, fm, fd] = fromDate.split('-').map(Number)
  const [ty, tm, td] = toDate.split('-').map(Number)
  const from = new Date(fy, fm - 1 + months, fd)
  const to = new Date(ty, tm - 1 + months, td)
  const fmt = (date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  return { fromDate: fmt(from), toDate: fmt(to) }
}

function getPreviousComparableRange(datePreset, fromDate, toDate) {
  if (datePreset === 'this_month') return getDatePresetRange('last_month')
  if (datePreset === 'last_month') return shiftMonthRange(fromDate, toDate, -1)
  if (datePreset === 'today') return getDatePresetRange('yesterday')
  if (datePreset === 'custom' && fromDate && toDate) {
    const start = new Date(fromDate)
    const end = new Date(toDate)
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1)
    const prevEnd = new Date(start)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - (days - 1))
    const fmt = (date) => {
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    return { fromDate: fmt(prevStart), toDate: fmt(prevEnd) }
  }
  return { fromDate: '', toDate: '' }
}

function percentChange(current, previous) {
  const cur = toNumber(current)
  const prev = toNumber(previous)
  if (prev === 0 && cur === 0) return null
  if (prev === 0) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

function periodCompareLabel(datePreset) {
  if (datePreset === 'this_month' || datePreset === 'last_month') return 'vs previous month'
  if (datePreset === 'today') return 'vs yesterday'
  return 'vs previous period'
}

function TrendHint({ change, label, invertColors = false }) {
  if (change == null || !Number.isFinite(change)) {
    return <div className="text-[11px] text-slate-500">— No previous data</div>
  }
  const up = change > 0
  const down = change < 0
  // Costs (invertColors): up = bad (red). Profit/revenue: up = good (green), down = bad (red).
  let tone = 'text-slate-400'
  if (invertColors) {
    tone = up ? 'text-rose-400' : down ? 'text-emerald-400' : 'text-slate-400'
  } else {
    tone = up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-slate-400'
  }
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <div className={`flex items-center gap-0.5 text-[11px] font-medium ${tone}`}>
      <AppIcon icon={Icon} size="sm" className="h-3.5 w-3.5" />
      <span>
        {Math.abs(change).toFixed(1)}% {label}
      </span>
    </div>
  )
}

function KpiCard({ icon: Icon, iconTone, label, value, valueTone, sublabel, footer }) {
  const iconWrap =
    iconTone === 'green'
      ? 'bg-emerald-500/15 text-emerald-400'
      : iconTone === 'blue'
        ? 'bg-blue-500/15 text-blue-400'
        : iconTone === 'red'
          ? 'bg-rose-500/15 text-rose-400'
          : iconTone === 'orange'
            ? 'bg-amber-500/15 text-amber-400'
            : iconTone === 'purple'
              ? 'bg-violet-500/15 text-violet-400'
              : 'bg-slate-500/15 text-slate-300'

  return (
    <div className="glass flex min-h-[7.25rem] flex-col rounded-xl border border-slate-700/50 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-slate-400">{label}</div>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconWrap}`}>
          <AppIcon icon={Icon} size="sm" />
        </span>
      </div>
      <div
        className={`mt-2 text-lg font-bold tracking-tight tabular-nums sm:text-xl ${
          valueTone === 'bad' ? 'text-rose-400' : valueTone === 'good' ? 'text-emerald-400' : 'text-slate-50'
        }`}
      >
        {value}
      </div>
      {sublabel ? <div className="mt-0.5 text-[11px] text-slate-500">{sublabel}</div> : null}
      <div className="mt-auto pt-2">{footer}</div>
    </div>
  )
}

function DonutCenter({ total }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
      <div className="text-sm font-semibold tabular-nums text-slate-100 sm:text-base">{formatMoney(total)}</div>
      <div className="text-[10px] text-slate-400 sm:text-xs">Total Expenses</div>
    </div>
  )
}

export default function Overview({
  transactions = [],
  departments = [],
  budgetByDepartment: budgetByDepartmentProp = {},
  recurringEntries = [],
}) {
  const [departmentId, setDepartmentId] = useState('all')
  const [type, setType] = useState('all')
  const [datePreset, setDatePreset] = useState('this_month')
  const [fromDate, setFromDate] = useState(() => getDatePresetRange('this_month').fromDate)
  const [toDate, setToDate] = useState(() => endOfMonthISO())
  const [trendMonths, setTrendMonths] = useState(3)
  const [recentExpanded, setRecentExpanded] = useState(false)
  const { theme } = useTheme()
  const chartTheme = useMemo(() => getChartTheme(theme), [theme])

  useEffect(() => {
    setRecentExpanded(false)
  }, [departmentId, type, datePreset, fromDate, toDate])

  const presetRange = useMemo(() => {
    if (datePreset === 'all') return { fromDate: '', toDate: '' }
    if (datePreset === 'custom') return { fromDate, toDate }
    if (datePreset === 'this_month') {
      const range = getDatePresetRange('this_month')
      return { fromDate: range.fromDate, toDate: endOfMonthISO() }
    }
    return getDatePresetRange(datePreset)
  }, [datePreset, fromDate, toDate])

  const displayRangeLabel = useMemo(() => {
    if (!presetRange.fromDate && !presetRange.toDate) return 'All time'
    const from = formatDisplayDate(presetRange.fromDate)
    const to = formatDisplayDate(presetRange.toDate)
    if (from && to) return `${from} - ${to}`
    return from || to || ''
  }, [presetRange])

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(transactions, {
        departmentId,
        type,
        fromDate: presetRange.fromDate,
        toDate: presetRange.toDate,
      }),
    [transactions, departmentId, type, presetRange],
  )

  const previousRange = useMemo(
    () => getPreviousComparableRange(datePreset, presetRange.fromDate, presetRange.toDate),
    [datePreset, presetRange],
  )

  const previousTransactions = useMemo(() => {
    if (!previousRange.fromDate && !previousRange.toDate) return []
    return filterTransactions(transactions, {
      departmentId,
      type,
      fromDate: previousRange.fromDate,
      toDate: previousRange.toDate,
    })
  }, [transactions, departmentId, type, previousRange])

  const baseTotals = useMemo(() => computeTotals(filteredTransactions), [filteredTransactions])
  const previousTotals = useMemo(() => computeTotals(previousTransactions), [previousTransactions])
  const departmentAggregates = useMemo(
    () => computeDepartmentAggregates(departments, filteredTransactions),
    [departments, filteredTransactions],
  )
  const monthlyTrendsAll = useMemo(() => computeMonthlyTrends(transactions), [transactions])
  const monthlyTrends = useMemo(() => {
    const sorted = [...monthlyTrendsAll].sort((a, b) => a.month.localeCompare(b.month))
    const n = Number(trendMonths) || 3
    // Ensure last N calendar months appear even if empty
    const now = new Date()
    const keys = []
    for (let i = n - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      keys.push(key)
    }
    const byMonth = new Map(sorted.map((r) => [r.month, r]))
    return keys.map((month) => {
      const row = byMonth.get(month)
      return {
        month,
        label: formatMonthLabel(month),
        revenue: row?.revenue ?? 0,
        costs: row?.costs ?? 0,
        netProfit: row?.netProfit ?? 0,
      }
    })
  }, [monthlyTrendsAll, trendMonths])

  const topCategories = useMemo(() => {
    const cats = computeTopCategories(filteredTransactions, 6)
    const total = cats.reduce((s, c) => s + c.amount, 0)
    return cats.map((c) => ({
      ...c,
      pct: total > 0 ? (c.amount / total) * 100 : 0,
    }))
  }, [filteredTransactions])

  const expenseTotal = useMemo(
    () => topCategories.reduce((s, c) => s + c.amount, 0),
    [topCategories],
  )

  const deptById = useMemo(() => new Map((departments ?? []).map((d) => [d.id, d])), [departments])

  const budgetRows = useMemo(() => {
    return departmentAggregates.map((agg) => {
      const budget = Number(budgetByDepartmentProp?.[agg.department_id] ?? 0)
      const status = getBudgetSpendStatus(agg.costs, budget)
      return { ...agg, budget, status }
    })
  }, [departmentAggregates, budgetByDepartmentProp])

  const budgetsSet = useMemo(() => budgetRows.filter((r) => r.budget > 0), [budgetRows])
  const overBudgetCount = useMemo(
    () => budgetsSet.filter((r) => r.status.level === 'critical').length,
    [budgetsSet],
  )
  const warningBudgetCount = useMemo(
    () => budgetsSet.filter((r) => r.status.level === 'warning').length,
    [budgetsSet],
  )

  const pendingCount = useMemo(
    () => (transactions ?? []).filter((t) => (t.status ?? 'approved') === 'pending').length,
    [transactions],
  )

  const recurringDueCount = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7)
    const day = new Date().getDate()
    return (recurringEntries ?? []).filter(
      (r) => r.last_posted_month !== monthKey && day >= Number(r.day_of_month ?? 1),
    ).length
  }, [recurringEntries])

  const missingReceiptsCount = useMemo(
    () =>
      (filteredTransactions ?? []).filter((t) => {
        const isCost = t.type === 'expense' || t.type === 'purchase'
        return isCost && !hasReceipt(t)
      }).length,
    [filteredTransactions],
  )

  const recentTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const dateCmp = String(b.entry_date ?? '').localeCompare(String(a.entry_date ?? ''))
      if (dateCmp !== 0) return dateCmp
      return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    })
  }, [filteredTransactions])

  const recentLimit = recentExpanded ? RECENT_EXPANDED_LIMIT : RECENT_PREVIEW_LIMIT
  const visibleRecent = recentTransactions.slice(0, recentLimit)
  const canExpandRecent = recentTransactions.length > RECENT_PREVIEW_LIMIT
  const hasMoreBeyondExpanded = recentTransactions.length > RECENT_EXPANDED_LIMIT

  const compareLabel = periodCompareLabel(datePreset)
  const revenueChange = percentChange(baseTotals.revenue, previousTotals.revenue)
  const purchasesChange = percentChange(baseTotals.purchases, previousTotals.purchases)
  const expensesChange = percentChange(baseTotals.expenses, previousTotals.expenses)
  const netProfitChange = percentChange(baseTotals.netProfit, previousTotals.netProfit)
  const marginChange = percentChange(baseTotals.profitMargin, previousTotals.profitMargin)

  function handlePresetChange(value) {
    setDatePreset(value)
    if (value === 'this_month') {
      const range = getDatePresetRange('this_month')
      setFromDate(range.fromDate)
      setToDate(endOfMonthISO())
      return
    }
    if (value !== 'custom' && value !== 'all') {
      const range = getDatePresetRange(value)
      setFromDate(range.fromDate)
      setToDate(range.toDate)
    }
    if (value === 'all') {
      setFromDate('')
      setToDate('')
    }
  }

  const attentionItems = [
    {
      key: 'warn80',
      label: 'Budgets over 80%',
      count: warningBudgetCount,
      tone: 'orange',
      to: '/dashboard/departments',
    },
    {
      key: 'crit100',
      label: 'Budgets over 100%',
      count: overBudgetCount,
      tone: 'red',
      to: '/dashboard/departments',
    },
    {
      key: 'pending',
      label: 'Pending transactions',
      count: pendingCount,
      tone: 'amber',
      to: '/dashboard/transactions',
    },
    {
      key: 'recurring',
      label: 'Recurring entries due',
      count: recurringDueCount,
      tone: 'amber',
      to: '/dashboard/recurring',
    },
    {
      key: 'receipts',
      label: 'Entries missing receipts',
      count: missingReceiptsCount,
      tone: 'amber',
      to: '/dashboard/transactions',
    },
  ]

  return (
    <div className="overview-ipad-fit mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:py-5">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Overview</h2>
            <p className="mt-1 text-sm text-slate-400">
              Sales, purchases, expenses, and profitability across departments.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap items-end gap-2 sm:justify-end">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="theme-input mt-1 block min-w-[8.5rem] text-sm"
                >
                  <option value="all">All</option>
                  {(departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="theme-input mt-1 block min-w-[7.5rem] text-sm"
                >
                  <option value="all">All</option>
                  {ENTRY_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Period</label>
                <select
                  value={datePreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="theme-input mt-1 block min-w-[8.5rem] text-sm"
                >
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="this_year">This Year</option>
                  <option value="today">Today</option>
                  <option value="all">All time</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>
              {datePreset === 'custom' ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">From</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="theme-input mt-1 block text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">To</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="theme-input mt-1 block text-sm"
                    />
                  </div>
                </>
              ) : null}
            </div>
            {datePreset !== 'custom' ? (
              <span className="text-sm tabular-nums text-slate-400 sm:text-right">{displayRangeLabel}</span>
            ) : null}
          </div>
        </div>

        {/* KPI row */}
        <div className="summary-cards-grid grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            icon={LayoutGrid}
            iconTone="green"
            label="Total Revenue"
            value={formatMoney(baseTotals.revenue)}
            sublabel="Sales only"
            footer={<TrendHint change={revenueChange} label={compareLabel} />}
          />
          <KpiCard
            icon={ShoppingCart}
            iconTone="blue"
            label="Purchases"
            value={formatMoney(baseTotals.purchases)}
            footer={<TrendHint change={purchasesChange} label={compareLabel} invertColors />}
          />
          <KpiCard
            icon={FileText}
            iconTone="red"
            label="Total Expenses"
            value={formatMoney(baseTotals.expenses)}
            footer={<TrendHint change={expensesChange} label={compareLabel} invertColors />}
          />
          <KpiCard
            icon={TrendingUp}
            iconTone="green"
            label="Net Profit"
            value={formatMoney(baseTotals.netProfit)}
            valueTone={baseTotals.netProfit >= 0 ? 'good' : 'bad'}
            footer={<TrendHint change={netProfitChange} label={compareLabel} />}
          />
          <KpiCard
            icon={Percent}
            iconTone="purple"
            label="Profit Margin"
            value={`${baseTotals.profitMargin.toFixed(1)}%`}
            footer={
              marginChange == null ? (
                <div className="text-[11px] text-slate-500">No previous data</div>
              ) : (
                <TrendHint change={marginChange} label={compareLabel} />
              )
            }
          />
          <KpiCard
            icon={Target}
            iconTone="orange"
            label="Budget Status"
            value={`${overBudgetCount} / ${budgetsSet.length}`}
            sublabel={budgetsSet.length === 0 ? 'Over budget' : overBudgetCount > 0 ? 'Over budget' : 'On track'}
            footer={
              <div className="text-[11px] text-slate-500">
                {budgetsSet.length === 0 ? 'No budgets set' : `${budgetsSet.length} department budget${budgetsSet.length === 1 ? '' : 's'}`}
              </div>
            }
          />
        </div>

        {/* Charts row */}
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="glass rounded-xl border border-slate-700/50 p-4 xl:col-span-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">Revenue, Costs & Net Profit Trend</div>
                <div className="text-xs text-slate-400">Monthly trend for selected period</div>
              </div>
              <select
                value={trendMonths}
                onChange={(e) => setTrendMonths(Number(e.target.value))}
                className="theme-input text-xs"
              >
                <option value={3}>Last 3 months</option>
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
              </select>
            </div>
            <div className="chart-panel mt-3 h-[260px] w-full sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="4 4" stroke={chartTheme.grid} />
                  <XAxis dataKey="label" tick={{ fill: chartTheme.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartTheme.tick, fontSize: 11 }} tickFormatter={chartMoneyTick} width={56} />
                  <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => formatMoney(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="costs" name="Costs" stroke={APP_RED} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-xl border border-slate-700/50 p-4 xl:col-span-4">
            <div>
              <div className="text-sm font-semibold text-slate-100">Expense Breakdown</div>
              <div className="text-xs text-slate-400">By category · current filter</div>
            </div>
            {topCategories.length === 0 ? (
              <div className="mt-8 flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-500">
                <AppIcon icon={Info} size="md" className="text-slate-500" />
                No expense data for this period.
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative mx-auto h-[200px] w-full max-w-[220px] shrink-0 sm:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topCategories}
                        dataKey="amount"
                        nameKey="category"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={2}
                        stroke="none"
                      >
                        {topCategories.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <DonutCenter total={expenseTotal} />
                </div>
                <ul className="min-w-0 flex-1 space-y-2">
                  {topCategories.map((c, i) => (
                    <li key={c.category} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="truncate text-slate-300" title={c.category}>
                          {c.category}
                        </span>
                      </div>
                      <span className="shrink-0 tabular-nums text-slate-400">{c.pct.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="glass flex flex-col rounded-xl border border-slate-700/50 p-4 xl:col-span-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">Budget vs Actual</div>
                <div className="text-xs text-slate-400">Department spend tracking</div>
              </div>
              <select
                aria-label="Budget vs Actual period"
                value={datePreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="theme-input min-w-[8.5rem] text-xs"
              >
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
                <option value="today">Today</option>
                <option value="all">All time</option>
                <option value="custom">Custom range</option>
              </select>
            </div>
            {budgetsSet.length === 0 ? (
              <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-3 px-2 py-6 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-slate-400">
                  <AppIcon icon={Info} size="md" />
                </span>
                <p className="max-w-[16rem] text-sm text-slate-400">
                  No department budgets set. Set department budgets to track spending and get alerts when approaching
                  limits.
                </p>
                <Link to="/dashboard/departments" className="theme-btn-secondary mt-1 inline-flex items-center gap-2">
                  Manage Budgets
                </Link>
              </div>
            ) : (
              <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                {budgetsSet.map((row) => {
                  const pct = Math.min(100, Math.round((row.status.ratio || 0) * 100))
                  const barColor =
                    row.status.level === 'critical'
                      ? 'bg-rose-500'
                      : row.status.level === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  return (
                    <div key={row.department_id}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-slate-300">{row.department_name}</span>
                        <span className="shrink-0 tabular-nums text-slate-500">
                          {formatMoney(row.costs)} / {formatMoney(row.budget)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <Link
                  to="/dashboard/departments"
                  className="theme-btn-secondary mt-2 inline-flex w-full items-center justify-center gap-2"
                >
                  Manage Budgets
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Department Performance + Attention Required */}
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="glass rounded-xl border border-slate-700/50 p-4 lg:col-span-8">
            <div>
              <div className="text-sm font-semibold text-slate-100">Department Performance</div>
              <div className="text-xs text-slate-400">Revenue, costs, spend vs budget</div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[720px] w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="theme-table-head px-3 py-2 font-medium">Department</th>
                    <th className="theme-table-head px-3 py-2 font-medium">Revenue</th>
                    <th className="theme-table-head px-3 py-2 font-medium">Costs</th>
                    <th className="theme-table-head px-3 py-2 font-medium">Net Profit</th>
                    <th className="theme-table-head px-3 py-2 font-medium">Margin</th>
                    <th className="theme-table-head px-3 py-2 font-medium">Budget</th>
                    <th className="theme-table-head px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                        No departments/transactions yet.
                      </td>
                    </tr>
                  ) : (
                    budgetRows.map((agg) => (
                      <tr key={agg.department_id} className="border-t border-slate-800/60">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: agg.department_color }}
                            />
                            <div className="truncate text-sm font-medium text-slate-100">{agg.department_name}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-200">{formatMoney(agg.revenue)}</td>
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-300">{formatMoney(agg.costs)}</td>
                        <td className="px-3 py-3 text-sm tabular-nums">
                          <span className={agg.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {formatMoney(agg.netProfit)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-200">
                          {agg.profitMargin.toFixed(1)}%
                        </td>
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-200">
                          {agg.budget > 0 ? formatMoney(agg.budget) : '—'}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-md border px-2 py-1 text-xs ${agg.status.className}`}
                          >
                            {agg.status.label}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded-xl border border-slate-700/50 p-4 lg:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">Attention Required</div>
              <Link
                to="/dashboard/transactions"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                View all
                <AppIcon icon={ArrowRight} size="sm" className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-slate-800/70">
              {attentionItems.map((item) => {
                const toneWrap =
                  item.tone === 'red'
                    ? 'bg-rose-500/15 text-rose-400'
                    : item.tone === 'orange'
                      ? 'bg-orange-500/15 text-orange-400'
                      : 'bg-amber-500/15 text-amber-400'
                return (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      className="flex items-center gap-3 px-1 py-3 transition hover:bg-slate-800/30"
                    >
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneWrap}`}
                      >
                        <AppIcon icon={AlertTriangle} size="sm" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-slate-200">{item.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-300">{item.count}</span>
                      <AppIcon icon={ChevronRight} size="sm" className="text-slate-500" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="glass rounded-xl border border-slate-700/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-100">Recent Transactions</div>
              <div className="text-xs text-slate-400">
                {recentExpanded
                  ? `Showing ${visibleRecent.length} of ${recentTransactions.length} (current filter)`
                  : `Latest ${Math.min(RECENT_PREVIEW_LIMIT, recentTransactions.length) || RECENT_PREVIEW_LIMIT} transactions (current filter)`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {!recentExpanded && canExpandRecent ? (
                <button
                  type="button"
                  onClick={() => setRecentExpanded(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                >
                  View all
                  <AppIcon icon={ArrowRight} size="sm" className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {recentExpanded ? (
                <>
                  <button
                    type="button"
                    onClick={() => setRecentExpanded(false)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-300 hover:underline"
                  >
                    Show less
                  </button>
                  <Link
                    to="/dashboard/transactions"
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                  >
                    More
                    <AppIcon icon={ArrowRight} size="sm" className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : null}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="theme-table-head px-3 py-2 font-medium">Date</th>
                  <th className="theme-table-head px-3 py-2 font-medium">Description</th>
                  <th className="theme-table-head px-3 py-2 font-medium">Category</th>
                  <th className="theme-table-head px-3 py-2 font-medium">Type</th>
                  <th className="theme-table-head px-3 py-2 font-medium">Department</th>
                  <th className="theme-table-head px-3 py-2 font-medium">Amount</th>
                  <th className="theme-table-head px-3 py-2 font-medium">Status</th>
                  <th className="theme-table-head px-3 py-2 font-medium">Receipt</th>
                  <th className="theme-table-head px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleRecent.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">
                      No transactions for the current filter.
                    </td>
                  </tr>
                ) : (
                  visibleRecent.map((t) => {
                    const dept = deptById.get(t.department_id)
                    const status = t.status ?? 'approved'
                    const statusClass =
                      status === 'approved'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : status === 'pending'
                          ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
                          : 'bg-slate-700/40 text-slate-300 border-slate-600/40'
                    return (
                      <tr key={t.id} className="border-t border-slate-800/60">
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-300">{t.entry_date}</td>
                        <td className="max-w-[12rem] truncate px-3 py-3 text-sm text-slate-200" title={t.description || ''}>
                          {t.description || '—'}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-300">{t.category || '—'}</td>
                        <td className={`px-3 py-3 text-sm ${transactionTypeToneClass(t)}`}>
                          {formatTransactionTypeLabel(t)}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-300">{dept?.name ?? 'Unknown'}</td>
                        <td className="px-3 py-3 text-sm font-medium tabular-nums text-slate-100">
                          {formatMoney(t.amount)}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${statusClass}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <EntryReceipt transaction={t} size="xs" />
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            to="/dashboard/transactions"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
                            title="Open transactions"
                          >
                            <AppIcon icon={MoreHorizontal} size="sm" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {recentExpanded && hasMoreBeyondExpanded ? (
            <p className="mt-3 text-right text-xs text-slate-500">
              Showing {RECENT_EXPANDED_LIMIT} of {recentTransactions.length}. Use More for every transaction.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
