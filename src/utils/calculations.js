import { applyTransactionToBucket, createEmptyBucket, finalizeBucket } from './entryTypes.js'

export function toNumber(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function computeTotals(transactions) {
  const bucket = createEmptyBucket()

  for (const tx of transactions) {
    applyTransactionToBucket(bucket, tx, toNumber(tx.amount))
  }

  return finalizeBucket(bucket)
}

export function computeDepartmentAggregates(departments, transactions) {
  const byDept = new Map()
  for (const d of departments) {
    byDept.set(d.id, {
      department_id: d.id,
      department_name: d.name,
      department_color: d.color,
      entries: 0,
      ...createEmptyBucket(),
      costs: 0,
      grossIncome: 0,
      netProfit: 0,
      profitMargin: 0,
    })
  }

  for (const tx of transactions) {
    const agg = byDept.get(tx.department_id)
    if (!agg) continue
    agg.entries += 1
    applyTransactionToBucket(agg, tx, toNumber(tx.amount))
  }

  for (const agg of byDept.values()) {
    const finalized = finalizeBucket(agg)
    agg.revenue = finalized.revenue
    agg.otherIncome = finalized.otherIncome
    agg.purchases = finalized.purchases
    agg.expenses = finalized.expenses
    agg.costs = finalized.costs
    agg.grossIncome = finalized.grossIncome
    agg.netProfit = finalized.netProfit
    agg.profitMargin = finalized.profitMargin
  }

  return Array.from(byDept.values()).sort((a, b) => b.revenue - a.revenue)
}

export function computeDailyAggregates(transactions) {
  const byDate = new Map()

  for (const tx of transactions ?? []) {
    const date = tx.entry_date
    if (!date) continue
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        entries: 0,
        ...createEmptyBucket(),
        costs: 0,
        grossIncome: 0,
        netProfit: 0,
      })
    }
    const agg = byDate.get(date)
    agg.entries += 1
    applyTransactionToBucket(agg, tx, toNumber(tx.amount))
  }

  for (const agg of byDate.values()) {
    const finalized = finalizeBucket(agg)
    agg.revenue = finalized.revenue
    agg.otherIncome = finalized.otherIncome
    agg.purchases = finalized.purchases
    agg.expenses = finalized.expenses
    agg.costs = finalized.costs
    agg.grossIncome = finalized.grossIncome
    agg.netProfit = finalized.netProfit
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function computeMonthlyTrends(transactions) {
  const byMonth = new Map()

  for (const tx of transactions ?? []) {
    if (!tx.entry_date) continue
    const month = String(tx.entry_date).slice(0, 7)
    if (!byMonth.has(month)) {
      byMonth.set(month, {
        month,
        ...createEmptyBucket(),
        costs: 0,
        grossIncome: 0,
        netProfit: 0,
      })
    }
    const bucket = byMonth.get(month)
    applyTransactionToBucket(bucket, tx, toNumber(tx.amount))
  }

  const rows = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month))
  for (const row of rows) {
    const finalized = finalizeBucket(row)
    row.revenue = finalized.revenue
    row.otherIncome = finalized.otherIncome
    row.purchases = finalized.purchases
    row.expenses = finalized.expenses
    row.costs = finalized.costs
    row.grossIncome = finalized.grossIncome
    row.netProfit = finalized.netProfit
  }
  return rows
}

/** Spend (costs) vs monthly budget — alerts at 80% and 100%. */
export function getBudgetSpendStatus(costs, budget) {
  const spend = toNumber(costs)
  const cap = toNumber(budget)
  if (cap <= 0) {
    return { label: 'No budget', level: 'none', className: 'text-slate-300 border-slate-700 bg-slate-800/40', ratio: 0 }
  }
  const ratio = spend / cap
  if (ratio >= 1) {
    return { label: 'Over budget', level: 'critical', className: 'text-rose-200 border-rose-500/40 bg-rose-500/10', ratio }
  }
  if (ratio >= 0.8) {
    return { label: '80%+ used', level: 'warning', className: 'text-amber-200 border-amber-500/40 bg-amber-500/10', ratio }
  }
  return { label: 'On track', level: 'ok', className: 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10', ratio }
}
