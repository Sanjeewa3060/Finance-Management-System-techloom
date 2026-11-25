/**
 * Detailed Profit & Loss — management statement from transaction Entry Type.
 *
 * DESIGN DECISION (2026):
 * Admins no longer manually map categories via pnl_group. Detailed P&L classifies
 * every valid reportable transaction by its Entry Type (transactions.type):
 *   sale     → Revenue / Sales
 *   purchase → Cost of Sales (purchases)
 *   expense  → Operating Expenses
 *   other    → Other Income
 *
 * We deliberately do NOT split Operating Expenses into Administration /
 * Selling & Distribution / Finance & Others without a future reliable
 * classification source. Inferring from category names is not allowed.
 * Category rows under each section are dynamic aggregates of transaction.category.
 *
 * pnl_group / pnl_order columns may still exist in the DB for backward
 * compatibility; Detailed P&L does not read or depend on them.
 *
 * Formulas:
 *   Revenue            = Σ valid sale
 *   Cost of Sales      = Σ valid purchase  (purchases only; no opening/closing stock)
 *   Gross profit       = Revenue − Cost of Sales
 *   Operating Expenses = Σ valid expense
 *   Other Income       = Σ valid other
 *   Net profit         = Gross profit + Other Income − Operating Expenses
 *
 * Inclusion (period / department / status / auth / currency) is owned by the
 * caller (Reports scoping). This module does not invent extra exclusion rules.
 */

import { toNumber } from './calculations.js'
import { normalizeEntryType } from './entryTypes.js'

/** Statement sections driven by Entry Type (not category pnl_group). */
export const PNL_SECTIONS = [
  { id: 'sales', label: 'Revenue', statementLabel: 'Revenue', entryType: 'sale' },
  { id: 'purchases', label: 'Cost of Sales', statementLabel: 'Cost of Sales', entryType: 'purchase' },
  {
    id: 'operating_expenses',
    label: 'Operating Expenses',
    statementLabel: 'Operating Expenses',
    entryType: 'expense',
  },
  { id: 'other_income', label: 'Other Income', statementLabel: 'Other Income', entryType: 'other' },
]

export const PNL_SECTION_IDS = PNL_SECTIONS.map((s) => s.id)

/** Map Entry Type → Detailed P&L section id. */
export const ENTRY_TYPE_TO_PNL_SECTION = Object.freeze({
  sale: 'sales',
  purchase: 'purchases',
  expense: 'operating_expenses',
  other: 'other_income',
})

export function pnlSectionForEntryType(entryType) {
  const t = normalizeEntryType(entryType)
  return ENTRY_TYPE_TO_PNL_SECTION[t] ?? null
}

/** Optional lookup: `${entryType}:${lowerName}` → category row (id/name only). */
export function buildCategoryLookup(categories) {
  const byKey = new Map()
  for (const c of categories ?? []) {
    if (c.is_active === false) continue
    const type = normalizeEntryType(c.entry_type)
    const name = String(c.name ?? '').trim().toLowerCase()
    if (!type || !name) continue
    byKey.set(`${type}:${name}`, c)
  }
  return byKey
}

function emptySectionBuckets() {
  return {
    sales: [],
    purchases: [],
    operating_expenses: [],
    other_income: [],
  }
}

/**
 * Compute Detailed P&L from scoped transactions.
 * Classifies by Entry Type; aggregates dynamically by category name.
 * `categories` is optional enrichment for category ids — not required for inclusion.
 * COGS = sum of purchase transactions only (no opening/closing stock).
 */
export function computeDetailedPnl({ transactions, categories } = {}) {
  const lookup = buildCategoryLookup(categories)
  const amountBySectionCat = new Map()

  for (const tx of transactions ?? []) {
    const amount = toNumber(tx.amount)
    const type = normalizeEntryType(tx.type)
    const sectionId = pnlSectionForEntryType(type)
    if (!sectionId) continue

    const name = String(tx.category ?? '').trim() || 'Uncategorised'
    const key = `${type}:${name.toLowerCase()}`
    const cat = lookup.get(key)
    const catKey = `${sectionId}::${cat?.id ?? name.toLowerCase()}`

    if (!amountBySectionCat.has(catKey)) {
      amountBySectionCat.set(catKey, {
        categoryId: cat?.id ?? null,
        categoryName: cat?.name ?? name,
        sectionId,
        amount: 0,
        entries: 0,
      })
    }
    const bucket = amountBySectionCat.get(catKey)
    bucket.amount += amount
    bucket.entries += 1
  }

  const groups = emptySectionBuckets()
  for (const row of amountBySectionCat.values()) {
    groups[row.sectionId].push(row)
  }
  for (const id of PNL_SECTION_IDS) {
    groups[id].sort((a, b) => String(a.categoryName).localeCompare(String(b.categoryName)))
  }

  const sumRows = (rows) => rows.reduce((s, r) => s + r.amount, 0)

  const salesTotal = sumRows(groups.sales)
  const purchasesTotal = sumRows(groups.purchases)
  const otherIncomeTotal = sumRows(groups.other_income)
  const operatingExpensesTotal = sumRows(groups.operating_expenses)
  const expenseTotal = operatingExpensesTotal

  const cogsTotal = purchasesTotal
  const grossProfit = salesTotal - cogsTotal
  const netProfit = grossProfit + otherIncomeTotal - operatingExpensesTotal
  const grossIncome = salesTotal + otherIncomeTotal
  const profitMargin = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0

  const lines = []
  const pushHeader = (label) => lines.push({ kind: 'header', label, amount: null })
  const pushItem = (label, amount, meta = {}) => lines.push({ kind: 'item', label, amount, ...meta })
  const pushTotal = (label, amount, meta = {}) => lines.push({ kind: 'total', label, amount, ...meta })
  const pushResult = (label, amount, meta = {}) => lines.push({ kind: 'result', label, amount, ...meta })

  pushHeader('Revenue')
  for (const row of groups.sales) {
    pushItem(row.categoryName, row.amount, {
      sectionId: 'sales',
      categoryId: row.categoryId,
      entries: row.entries,
    })
  }
  pushTotal('Total Revenue', salesTotal, { sectionId: 'sales' })

  pushHeader('Cost of Sales')
  for (const row of groups.purchases) {
    pushItem(row.categoryName, row.amount, {
      sectionId: 'purchases',
      categoryId: row.categoryId,
      entries: row.entries,
    })
  }
  pushTotal('Total Cost of Sales', cogsTotal, { sectionId: 'purchases' })

  pushResult('GROSS PROFIT / (LOSS)', grossProfit, { key: 'grossProfit' })

  pushHeader('Operating Expenses')
  for (const row of groups.operating_expenses) {
    pushItem(row.categoryName, row.amount, {
      sectionId: 'operating_expenses',
      categoryId: row.categoryId,
      entries: row.entries,
    })
  }
  pushTotal('Total Operating Expenses', operatingExpensesTotal, {
    sectionId: 'operating_expenses',
    key: 'operatingExpenses',
  })

  pushHeader('Other Income')
  for (const row of groups.other_income) {
    pushItem(row.categoryName, row.amount, {
      sectionId: 'other_income',
      categoryId: row.categoryId,
      entries: row.entries,
    })
  }
  pushTotal('Total Other Income', otherIncomeTotal, { sectionId: 'other_income' })

  pushResult('NET PROFIT / (LOSS) BEFORE TAX', netProfit, { key: 'netProfit' })

  return {
    groups,
    lines,
    totals: {
      salesTotal,
      revenueTotal: salesTotal,
      purchasesTotal,
      cogsTotal,
      grossProfit,
      otherIncomeTotal,
      operatingExpensesTotal,
      expenseTotal,
      netProfit,
      profitMargin,
    },
  }
}
