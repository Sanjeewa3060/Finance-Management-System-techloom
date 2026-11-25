import { toNumber } from './calculations.js'
import { applyTransactionToBucket, createEmptyBucket, finalizeBucket } from './entryTypes.js'

function aggregateTransactions(txs) {
  const bucket = createEmptyBucket()
  let entries = 0
  for (const tx of txs) {
    applyTransactionToBucket(bucket, tx, toNumber(tx.amount))
    entries += 1
  }
  return { entries, ...finalizeBucket(bucket) }
}

/** Per-company totals for admin comparison (all companies under this admin). */
export function computeCompanyAggregates(companyProfiles, departments, transactions) {
  const companyById = new Map((companyProfiles ?? []).map((c) => [c.id, c]))
  const deptByCompany = new Map()

  for (const d of departments ?? []) {
    const key = d.company_profile_id ?? 'unassigned'
    if (!deptByCompany.has(key)) deptByCompany.set(key, [])
    deptByCompany.get(key).push(d)
  }

  const txByDept = new Map()
  for (const tx of transactions ?? []) {
    if (!txByDept.has(tx.department_id)) txByDept.set(tx.department_id, [])
    txByDept.get(tx.department_id).push(tx)
  }

  const rows = Array.from(deptByCompany.entries()).map(([companyId, depts]) => {
    const company = companyById.get(companyId)
    const allTxs = depts.flatMap((dept) => txByDept.get(dept.id) ?? [])
    const agg = aggregateTransactions(allTxs)

    return {
      company_id: companyId,
      company_name: company?.email ?? 'Unassigned',
      company_label: (company?.full_name?.trim() || company?.email) ?? 'Unassigned',
      is_active: company?.is_active !== false,
      departments: depts.length,
      department_names: depts.map((d) => d.name),
      ...agg,
    }
  })

  return rows.sort((a, b) => b.netProfit - a.netProfit)
}

/** Each department is its own branch — one row per department for admin comparison. */
export function computeBranchAggregates(departments, transactions) {
  const txByDept = new Map()
  for (const tx of transactions ?? []) {
    if (!txByDept.has(tx.department_id)) txByDept.set(tx.department_id, [])
    txByDept.get(tx.department_id).push(tx)
  }

  const rows = (departments ?? []).map((dept) => {
    const txs = txByDept.get(dept.id) ?? []
    const agg = aggregateTransactions(txs)

    return {
      company_id: dept.id,
      company_name: dept.email || dept.name,
      company_label: dept.name,
      email: dept.email,
      is_active: dept.is_active !== false,
      departments: 1,
      department_names: [dept.name],
      ...agg,
    }
  })

  return rows.sort((a, b) => b.netProfit - a.netProfit)
}

export function enrichCompanyComparison(aggregates) {
  const list = aggregates ?? []
  const totalRevenue = list.reduce((s, c) => s + c.revenue, 0)
  const totalProfit = list.reduce((s, c) => s + c.netProfit, 0)
  const avgProfit = list.length ? totalProfit / list.length : 0
  const maxRevenue = Math.max(...list.map((c) => c.revenue), 1)

  return list.map((c, index) => ({
    ...c,
    rank: index + 1,
    revenueShare: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
    revenueBarPct: (c.revenue / maxRevenue) * 100,
    vsAvgProfit: c.netProfit - avgProfit,
    chartName: c.company_name.length > 18 ? `${c.company_name.slice(0, 16)}…` : c.company_name,
  }))
}

export function getCompanyDepartmentIds(departments, companyId) {
  return new Set(
    (departments ?? [])
      .filter((d) => d.company_profile_id === companyId || d.company_profile_id == null)
      .map((d) => d.id),
  )
}

export function departmentsForCompany(departments, companyId) {
  return (departments ?? []).filter((d) => d.company_profile_id === companyId || d.company_profile_id == null)
}

export function filterTransactionsForCompany(transactions, departments, companyId) {
  const deptIds = getCompanyDepartmentIds(departments, companyId)
  return (transactions ?? []).filter((t) => deptIds.has(t.department_id))
}

export function filterTransactionsForBranch(transactions, departmentId) {
  return (transactions ?? []).filter((t) => t.department_id === departmentId)
}
