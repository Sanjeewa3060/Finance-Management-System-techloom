import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Trash2 } from 'lucide-react'
import PageShell from './PageShell.jsx'
import AppIcon from './AppIcon.jsx'
import { formatMoney } from '../utils/money.js'
import { useConfirmWithPassword } from '../hooks/useConfirmWithPassword.jsx'

function StatBlock({ label, value, tone = 'theme-table-cell' }) {
  return (
    <div className="theme-stat-panel">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  )
}

function BudgetFields({ budget, target, targetPct, onSaveBudget, onSaveTarget, departmentId, budgetMonthKey }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-xs font-medium text-slate-400">Monthly budget</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          defaultValue={budget.toFixed(2)}
          onBlur={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v) || v < 0) return
            onSaveBudget?.(departmentId, v)
          }}
          className="theme-input mt-1 min-h-[44px] w-full text-base sm:text-sm"
          placeholder="0.00"
          aria-label="Monthly budget"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-400">Revenue target</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          defaultValue={target.toFixed(2)}
          onBlur={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v) || v < 0) return
            onSaveTarget?.(departmentId, v, budgetMonthKey)
          }}
          className="theme-input mt-1 min-h-[44px] w-full text-base sm:text-sm"
          placeholder="0.00"
          aria-label="Revenue target"
        />
        {target > 0 ? (
          <span className="mt-1 block text-xs text-slate-500">KPI progress: {targetPct.toFixed(0)}%</span>
        ) : null}
      </label>
    </div>
  )
}

function CompactBudgetInput({ value, onSave, label, departmentName }) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      defaultValue={value.toFixed(2)}
      onBlur={(e) => {
        const v = Number(e.target.value)
        if (!Number.isFinite(v) || v < 0) return
        onSave(v)
      }}
      className="theme-input w-full px-2 py-1 text-xs tabular-nums"
      placeholder="0"
      aria-label={`${label} for ${departmentName}`}
      title={label}
    />
  )
}

function DepartmentCard({
  department: d,
  agg,
  budget,
  target,
  targetPct,
  isAdmin,
  canDeleteDepartment,
  loading,
  budgetMonthKey,
  onSaveBudget,
  onSaveTarget,
  onRequestDelete,
}) {
  const netProfit = agg?.netProfit ?? 0
  const netTone = netProfit >= 0 ? 'theme-money-positive' : 'theme-money-negative'

  return (
    <article className="glass rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-slate-700/80"
            style={{ backgroundColor: d.color }}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-100">
              {d.name}
              {d.is_active === false ? (
                <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200">
                  Deactivated
                </span>
              ) : null}
            </h3>
            {isAdmin && d.email ? (
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-400">
                <AppIcon icon={Mail} size="sm" className="shrink-0 text-slate-500" />
                <span className="truncate">{d.email}</span>
              </p>
            ) : null}
          </div>
        </div>
        <span className="theme-badge shrink-0 rounded-full px-2.5 py-0.5 text-xs">
          {agg?.entries ?? 0} entries
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatBlock label="Revenue" value={formatMoney(agg?.revenue ?? 0)} tone="text-emerald-600 dark:text-emerald-500" />
        <StatBlock label="Other income" value={formatMoney(agg?.otherIncome ?? 0)} tone="text-emerald-600 dark:text-emerald-500" />
        <StatBlock label="Purchases" value={formatMoney(agg?.purchases ?? 0)} tone="text-rose-600 dark:text-rose-500" />
        <StatBlock label="Expenses" value={formatMoney(agg?.expenses ?? 0)} tone="text-rose-600 dark:text-rose-500" />
        <StatBlock label="Net profit" value={formatMoney(netProfit)} tone={netTone} />
        <StatBlock label="Margin" value={`${(agg?.profitMargin ?? 0).toFixed(1)}%`} tone={netTone} />
      </dl>

      <div className="mt-4 border-t border-slate-800/60 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Budget & targets</p>
        <BudgetFields
          budget={budget}
          target={target}
          targetPct={targetPct}
          departmentId={d.id}
          budgetMonthKey={budgetMonthKey}
          onSaveBudget={onSaveBudget}
          onSaveTarget={onSaveTarget}
        />
      </div>

      {canDeleteDepartment ? (
        <button
          type="button"
          onClick={() => onRequestDelete?.(d)}
          disabled={loading}
          className="theme-btn-danger theme-btn-primary--block mt-4 sm:w-auto"
        >
          <AppIcon icon={Trash2} size="sm" />
          Delete department
        </button>
      ) : (
        <p className="mt-4 text-xs text-slate-500">Managed by admin</p>
      )}
    </article>
  )
}

function DepartmentTableRow({
  department: d,
  agg,
  budget,
  target,
  canDeleteDepartment,
  loading,
  budgetMonthKey,
  onSaveBudget,
  onSaveTarget,
  onRequestDelete,
}) {
  const netProfit = agg?.netProfit ?? 0
  const margin = agg?.profitMargin ?? 0
  const netTone = netProfit >= 0 ? 'theme-money-positive' : 'theme-money-negative'

  return (
    <tr className="theme-table-row">
      <td className="px-2 py-1.5" title={d.email || undefined}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
          <span className="theme-table-cell truncate text-xs font-medium">{d.name}</span>
          {d.is_active === false ? (
            <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
              Off
            </span>
          ) : null}
        </div>
      </td>
      <td className="theme-table-cell px-2 py-1.5 text-right text-xs tabular-nums">
        {formatMoney(agg?.revenue ?? 0)}
      </td>
      <td className="theme-table-cell-muted px-2 py-1.5 text-right text-xs tabular-nums">
        {formatMoney(agg?.purchases ?? 0)}
      </td>
      <td className="theme-table-cell-muted px-2 py-1.5 text-right text-xs tabular-nums">
        {formatMoney(agg?.expenses ?? 0)}
      </td>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums">
        <span className={netTone}>{formatMoney(netProfit)}</span>
        <span className={`ml-1 text-[10px] ${netTone}`}>({margin.toFixed(0)}%)</span>
      </td>
      <td className="theme-table-cell-muted px-2 py-1.5 text-center text-xs tabular-nums">{agg?.entries ?? 0}</td>
      <td className="px-1 py-1">
        <CompactBudgetInput
          value={budget}
          label="Budget"
          departmentName={d.name}
          onSave={(v) => onSaveBudget?.(d.id, v)}
        />
      </td>
      <td className="px-1 py-1">
        <CompactBudgetInput
          value={target}
          label="Revenue target"
          departmentName={d.name}
          onSave={(v) => onSaveTarget?.(d.id, v, budgetMonthKey)}
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        {canDeleteDepartment ? (
          <button
            type="button"
            onClick={() => onRequestDelete?.(d)}
            disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
            aria-label={`Delete ${d.name}`}
            title="Delete department"
          >
            <AppIcon icon={Trash2} size="sm" />
          </button>
        ) : null}
      </td>
    </tr>
  )
}

export default function Departments({
  departments,
  departmentAggregates,
  budgetByDepartment = {},
  budgetMonthKey = '',
  onBudgetMonthChange,
  departmentTargets = [],
  onSaveTarget,
  loading = false,
  error = null,
  isAdmin = false,
  canDeleteDepartment = false,
  onDeleteDepartment,
  onSaveBudget,
  authUser,
}) {
  const { confirmWithPassword, passwordConfirmModal } = useConfirmWithPassword(authUser)

  const aggById = useMemo(() => {
    const m = new Map()
    for (const agg of departmentAggregates ?? []) m.set(agg.department_id, agg)
    return m
  }, [departmentAggregates])

  const rows = useMemo(
    () =>
      (departments ?? []).map((d) => {
        const agg = aggById.get(d.id)
        const budget = Number(budgetByDepartment?.[d.id] ?? 0)
        const target = Number(
          departmentTargets.find((t) => t.department_id === d.id && t.month_key === budgetMonthKey)?.revenue_target ?? 0,
        )
        const revenue = agg?.revenue ?? 0
        const targetPct = target > 0 ? Math.min(100, (revenue / target) * 100) : 0
        return { d, agg, budget, target, targetPct }
      }),
    [departments, aggById, budgetByDepartment, departmentTargets, budgetMonthKey],
  )

  async function handleRequestDelete(department) {
    const password = await confirmWithPassword({
      title: 'Delete department',
      message: `Enter your login password to permanently delete “${department.name}” and all related transactions.`,
      confirmLabel: 'Delete department',
    })
    if (!password) return
    try {
      await onDeleteDepartment?.(department.id, password)
    } catch {
      // Page error / toast handled by delete handler
    }
  }

  return (
    <PageShell className="max-w-none px-2 py-3 sm:px-3 lg:py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-slate-100 lg:text-lg">
            Departments
            {!loading && departments.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-slate-500">· {departments.length} total</span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 lg:hidden">Each department has its own login and data.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-slate-400">Budget month</span>
          <input
            type="month"
            value={budgetMonthKey}
            onChange={(e) => onBudgetMonthChange?.(e.target.value)}
            className="theme-input min-h-[36px] w-[9.5rem] py-1 text-sm"
          />
        </label>
      </div>

      {error ? (
        <div className="theme-alert-error mt-3 rounded-lg p-3 text-sm">{error}</div>
      ) : null}

      {loading ? (
        <div className="glass mt-4 rounded-xl p-8 text-center text-sm text-slate-400">Loading departments…</div>
      ) : departments.length === 0 ? (
        <div className="glass mt-4 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-400">No departments yet.</p>
          {isAdmin ? (
            <Link
              to="/dashboard/departments?tab=profiles"
              className="mt-3 inline-block text-sm font-medium text-emerald-400 hover:underline"
            >
              Create one under Department Profiles →
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-4 lg:hidden">
            {rows.map(({ d, agg, budget, target, targetPct }) => (
              <DepartmentCard
                key={d.id}
                department={d}
                agg={agg}
                budget={budget}
                target={target}
                targetPct={targetPct}
                isAdmin={isAdmin}
                canDeleteDepartment={canDeleteDepartment}
                loading={loading}
                budgetMonthKey={budgetMonthKey}
                onSaveBudget={onSaveBudget}
                onSaveTarget={onSaveTarget}
                onRequestDelete={handleRequestDelete}
              />
            ))}
          </div>

          <div className="mt-3 hidden lg:block">
            <div className="theme-table-wrap">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                </colgroup>
                <thead className="theme-table-head">
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 text-left font-medium">Department</th>
                    <th className="px-2 py-2 text-right font-medium">Revenue</th>
                    <th className="px-2 py-2 text-right font-medium">Purchases</th>
                    <th className="px-2 py-2 text-right font-medium">Expenses</th>
                    <th className="px-2 py-2 text-right font-medium">Net · Margin</th>
                    <th className="px-2 py-2 text-center font-medium">#</th>
                    <th className="px-1 py-2 text-center font-medium">Budget</th>
                    <th className="px-1 py-2 text-center font-medium">Target</th>
                    <th className="px-2 py-2 text-center font-medium" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ d, agg, budget, target }) => (
                    <DepartmentTableRow
                      key={d.id}
                      department={d}
                      agg={agg}
                      budget={budget}
                      target={target}
                      canDeleteDepartment={canDeleteDepartment}
                      loading={loading}
                      budgetMonthKey={budgetMonthKey}
                      onSaveBudget={onSaveBudget}
                      onSaveTarget={onSaveTarget}
                      onRequestDelete={handleRequestDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin ? (
              <p className="theme-hint mt-2 text-[11px]">Hover a department name to see login email.</p>
            ) : null}
          </div>
        </>
      )}
      {passwordConfirmModal}
    </PageShell>
  )
}
