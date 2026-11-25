import { computeTotals, toNumber } from './calculations.js'
import { isOtherExpense, normalizeEntryType } from './entryTypes.js'

export const DEFAULT_PARTNERS = [
  { name: 'Mrs. S. V', shareNum: 1, shareDen: 3 },
  { name: 'Mr. S. P', shareNum: 1, shareDen: 3 },
  { name: 'Mr. S. P', shareNum: 1, shareDen: 3 },
]

export const DEFAULT_DISALLOWABLE_PATTERNS = [
  { label: 'E.T.F penalty', match: ['etf', 'e.t.f'] },
  { label: 'Charity', match: ['charity', 'donation'] },
  { label: 'Proportionate share of partners welfare', match: ['welfare', 'partners welfare'] },
  { label: 'Insurance (No. 151)', match: ['insurance', '151'] },
  { label: 'Insurance (No. 234)', match: ['insurance', '234'] },
  { label: 'Insurance arrears', match: ['insurance', 'arrears'] },
]

export const DEFAULT_TAX_REPORT_SETTINGS = {
  assessment_year_start: 2023,
  tax_free_allowance: 1000000,
  tax_rate_percent: 6,
  tax_paid: 0,
  currency_label: 'Sri Lankan Rupees',
  partners: DEFAULT_PARTNERS,
  disallowable_patterns: DEFAULT_DISALLOWABLE_PATTERNS,
  manual_overrides: {},
}

const TAX_SETTINGS_STORAGE_KEY = 'kaionex_tax_report_settings_v1'

export function loadTaxSettingsFromStorage() {
  try {
    const raw = localStorage.getItem(TAX_SETTINGS_STORAGE_KEY)
    if (!raw) return null
    return normalizeTaxSettings(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveTaxSettingsToStorage(settings) {
  localStorage.setItem(TAX_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeTaxSettings(settings)))
}

export function normalizeTaxSettings(raw) {
  const base = { ...DEFAULT_TAX_REPORT_SETTINGS, ...(raw ?? {}) }
  return {
    ...base,
    assessment_year_start: Number(base.assessment_year_start) || 2023,
    tax_free_allowance: Number(base.tax_free_allowance) ?? 1000000,
    tax_rate_percent: Number(base.tax_rate_percent) ?? 6,
    tax_paid: Number(base.tax_paid) ?? 0,
    currency_label: String(base.currency_label ?? 'Sri Lankan Rupees'),
    partners: Array.isArray(base.partners) && base.partners.length ? base.partners : DEFAULT_PARTNERS,
    disallowable_patterns:
      Array.isArray(base.disallowable_patterns) && base.disallowable_patterns.length
        ? base.disallowable_patterns
        : DEFAULT_DISALLOWABLE_PATTERNS,
    manual_overrides: base.manual_overrides && typeof base.manual_overrides === 'object' ? base.manual_overrides : {},
  }
}

export function getAssessmentYearRange(yoaStartYear) {
  const start = Number(yoaStartYear) || 2023
  const end = start + 1
  return {
    yoaStartYear: start,
    fromDate: `${start}-04-01`,
    toDate: `${end}-03-31`,
    label: `${start}/${end}`,
    firstPeriodEnd: `${start}-12-31`,
    secondPeriodStart: `${end}-01-01`,
  }
}

export function listAssessmentYearOptions(count = 8) {
  const current = new Date()
  const month = current.getMonth() + 1
  const year = current.getFullYear()
  const activeStart = month >= 4 ? year : year - 1
  return Array.from({ length: count }, (_, i) => activeStart - i)
}

export function isCostTransaction(tx) {
  const t = normalizeEntryType(tx?.type)
  if (t === 'purchase' || t === 'expense') return true
  if (t === 'other') return isOtherExpense(tx)
  return false
}

export function filterTransactionsForYOA(transactions, range, departmentId = 'all') {
  return (transactions ?? []).filter((t) => {
    if (departmentId !== 'all' && t.department_id !== departmentId) return false
    const d = String(t.entry_date ?? '')
    if (d < range.fromDate || d > range.toDate) return false
    return true
  })
}

export function splitAssessmentPeriods(transactions, range) {
  const firstPeriodTx = (transactions ?? []).filter(
    (t) => t.entry_date >= range.fromDate && t.entry_date <= range.firstPeriodEnd,
  )
  const secondPeriodTx = (transactions ?? []).filter(
    (t) => t.entry_date >= range.secondPeriodStart && t.entry_date <= range.toDate,
  )
  return { firstPeriodTx, secondPeriodTx }
}

function matchesPattern(tx, pattern) {
  const cat = String(tx.category ?? '').trim().toLowerCase()
  const desc = String(tx.description ?? '').trim().toLowerCase()
  const hay = `${cat} ${desc}`
  const terms = (pattern.match ?? []).map((m) => String(m).trim().toLowerCase()).filter(Boolean)
  if (terms.length === 0) return false
  return terms.some((term) => hay.includes(term))
}

export function computeDisallowableLines(transactions, patterns, manualOverrides = {}) {
  const costTx = (transactions ?? []).filter(isCostTransaction)
  const disallowableOverrides = manualOverrides.disallowable ?? {}

  const lines = (patterns ?? DEFAULT_DISALLOWABLE_PATTERNS).map((pattern) => {
    const label = pattern.label
    if (disallowableOverrides[label] != null && disallowableOverrides[label] !== '') {
      return { label, amount: toNumber(disallowableOverrides[label]) }
    }

    const usedTx = new Set()
    let amount = 0
    for (const tx of costTx) {
      if (usedTx.has(tx.id)) continue
      if (matchesPattern(tx, pattern)) {
        amount += toNumber(tx.amount)
        if (tx.id) usedTx.add(tx.id)
      }
    }
    return { label, amount }
  })

  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  return { lines, total }
}

export function partnerShareFraction(partner) {
  const num = Number(partner?.shareNum ?? 1)
  const den = Number(partner?.shareDen ?? 1)
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0
  return num / den
}

export function formatPartnerShare(partner) {
  return `${Number(partner.shareNum ?? 1)}/${Number(partner.shareDen ?? 1)}`
}

export function splitAmountByPartners(total, partners) {
  if (partners.length === 0) return []
  let allocated = 0
  return partners.map((partner, index) => {
    if (index === partners.length - 1) return total - allocated
    const frac = partnerShareFraction(partner)
    const amount = Math.round(total * frac)
    allocated += amount
    return amount
  })
}

export function apportionToPartners({
  partners,
  firstPeriodDivisible,
  secondPeriodDivisible,
  divisibleIncome,
  partnershipTax,
}) {
  const firstShares = splitAmountByPartners(firstPeriodDivisible, partners)
  const secondShares = splitAmountByPartners(secondPeriodDivisible, partners)
  const taxShares = splitAmountByPartners(partnershipTax, partners)

  const rows = partners.map((partner, index) => {
    const firstPeriod = firstShares[index]
    const secondPeriod = secondShares[index]
    return {
      name: partner.name,
      share: formatPartnerShare(partner),
      firstPeriod,
      secondPeriod,
      total: firstPeriod + secondPeriod,
      partnershipTax: taxShares[index],
    }
  })

  return {
    rows,
    totals: {
      firstPeriod: rows.reduce((s, r) => s + r.firstPeriod, 0),
      secondPeriod: rows.reduce((s, r) => s + r.secondPeriod, 0),
      divisibleIncome: rows.reduce((s, r) => s + r.total, 0),
      partnershipTax: rows.reduce((s, r) => s + r.partnershipTax, 0),
    },
  }
}

export function formatTaxAmount(value, { parenthesesForNegative = false } = {}) {
  const n = toNumber(value)
  const abs = Math.abs(Math.round(n))
  const formatted = abs.toLocaleString('en-US')
  if (n < 0 || (parenthesesForNegative && n > 0)) {
    return `(${formatted})`
  }
  return formatted
}

export function computeTaxReport({ transactions, settings, departmentId = 'all' }) {
  const normalizedSettings = normalizeTaxSettings(settings)
  const range = getAssessmentYearRange(normalizedSettings.assessment_year_start)
  const scoped = filterTransactionsForYOA(transactions, range, departmentId)
  const totals = computeTotals(scoped)
  const manualOverrides = normalizedSettings.manual_overrides ?? {}

  let netIncome = totals.netProfit
  if (manualOverrides.netIncome != null && manualOverrides.netIncome !== '') {
    netIncome = toNumber(manualOverrides.netIncome)
  }

  const { lines: disallowableLines, total: disallowableTotal } = computeDisallowableLines(
    scoped,
    normalizedSettings.disallowable_patterns,
    manualOverrides,
  )

  const divisibleIncome = netIncome + disallowableTotal
  const taxFreeAllowance = toNumber(normalizedSettings.tax_free_allowance)
  const taxableIncome = Math.max(0, divisibleIncome - taxFreeAllowance)
  const taxRate = toNumber(normalizedSettings.tax_rate_percent) / 100
  const partnershipTax = Math.round(taxableIncome * taxRate)
  const taxPaid = toNumber(normalizedSettings.tax_paid)
  const balanceTaxPayable = partnershipTax - taxPaid

  const { firstPeriodTx, secondPeriodTx } = splitAssessmentPeriods(scoped, range)
  const firstTotals = computeTotals(firstPeriodTx)
  const secondTotals = computeTotals(secondPeriodTx)

  let firstNet = firstTotals.netProfit
  let secondNet = secondTotals.netProfit
  if (manualOverrides.netIncome != null && manualOverrides.netIncome !== '' && divisibleIncome > 0) {
    const ratioFirst = (firstTotals.netProfit + computeDisallowableLines(firstPeriodTx, normalizedSettings.disallowable_patterns, manualOverrides).total) / divisibleIncome
    firstNet = netIncome * ratioFirst - computeDisallowableLines(firstPeriodTx, normalizedSettings.disallowable_patterns, manualOverrides).total
    secondNet = netIncome - firstNet
  }

  const firstDisallow = computeDisallowableLines(firstPeriodTx, normalizedSettings.disallowable_patterns, manualOverrides).total
  const secondDisallow = computeDisallowableLines(secondPeriodTx, normalizedSettings.disallowable_patterns, manualOverrides).total
  const firstPeriodDivisible = firstNet + firstDisallow
  const secondPeriodDivisible = secondNet + secondDisallow

  const apportionment = apportionToPartners({
    partners: normalizedSettings.partners,
    firstPeriodDivisible,
    secondPeriodDivisible,
    divisibleIncome,
    partnershipTax,
  })

  return {
    range,
    settings: normalizedSettings,
    transactionCount: scoped.length,
    netIncome,
    disallowableLines,
    disallowableTotal,
    divisibleIncome,
    taxFreeAllowance,
    taxableIncome,
    taxRatePercent: normalizedSettings.tax_rate_percent,
    partnershipTax,
    taxPaid,
    balanceTaxPayable,
    firstPeriodDivisible,
    secondPeriodDivisible,
    apportionment,
  }
}

function gcd(a, b) {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

function buildShareFraction(weight, totalWeight, count) {
  if (totalWeight <= 0 || count <= 0) return { shareNum: 1, shareDen: 1 }
  const scaled = Math.max(1, Math.round((weight / totalWeight) * 1000))
  const totalScaled = 1000
  const divisor = gcd(scaled, totalScaled)
  return { shareNum: scaled / divisor, shareDen: totalScaled / divisor }
}

function computeTopCostCategoryLines(transactions, limit = 6) {
  const byCategory = new Map()
  for (const tx of transactions ?? []) {
    if (!isCostTransaction(tx)) continue
    const label = String(tx.category ?? '').trim() || 'Other'
    byCategory.set(label, (byCategory.get(label) ?? 0) + toNumber(tx.amount))
  }
  return Array.from(byCategory.entries())
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

export function resolveDisallowableLinesForPrint(transactions, patterns, manualOverrides = {}) {
  const { lines, total } = computeDisallowableLines(transactions, patterns, manualOverrides)
  const nonZero = lines.filter((line) => line.amount > 0)
  if (nonZero.length > 0) return { lines: nonZero, total }
  const fallback = computeTopCostCategoryLines(transactions)
  const fallbackTotal = fallback.reduce((sum, line) => sum + line.amount, 0)
  return { lines: fallback, total: fallbackTotal }
}

export function splitPeriodByMidpoint(transactions, fromDate, toDate) {
  const scoped = transactions ?? []
  if (!fromDate || !toDate || fromDate === toDate) {
    return { firstPeriodTx: scoped, secondPeriodTx: [] }
  }
  const start = new Date(`${fromDate}T00:00:00`)
  const end = new Date(`${toDate}T00:00:00`)
  const midTime = start.getTime() + (end.getTime() - start.getTime()) / 2
  const mid = new Date(midTime)
  const midISO = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, '0')}-${String(mid.getDate()).padStart(2, '0')}`

  const firstPeriodTx = scoped.filter((t) => String(t.entry_date ?? '') <= midISO)
  const secondPeriodTx = scoped.filter((t) => String(t.entry_date ?? '') > midISO)
  return { firstPeriodTx, secondPeriodTx }
}

function computeDepartmentDivisible(departmentId, scopedTx, patterns, manualOverrides) {
  const deptTx = scopedTx.filter((t) => t.department_id === departmentId)
  const net = computeTotals(deptTx).netProfit
  const disallow = resolveDisallowableLinesForPrint(deptTx, patterns, manualOverrides).total
  return net + disallow
}

function buildPartnersFromDepartments(departmentAggregates, scopedTx, patterns, manualOverrides, departments) {
  const deptNameById = new Map((departments ?? []).map((d) => [d.id, d.name?.trim() || d.email || 'Department']))
  const source =
    departmentAggregates?.length > 0
      ? departmentAggregates
      : (departments ?? []).map((d) => ({ department_id: d.id, department_name: deptNameById.get(d.id) }))

  const weights = source.map((agg) => ({
    name: agg.department_name ?? deptNameById.get(agg.department_id) ?? 'Department',
    weight: computeDepartmentDivisible(agg.department_id, scopedTx, patterns, manualOverrides),
  }))

  if (weights.length === 0) {
    return [{ name: 'Total', shareNum: 1, shareDen: 1 }]
  }

  const totalWeight = weights.reduce((sum, row) => sum + Math.max(0, row.weight), 0)
  return weights.map((row) => ({
    name: row.name,
    ...buildShareFraction(Math.max(0, row.weight), totalWeight, weights.length),
  }))
}

export function computeTaxReportForPeriod({
  transactions = [],
  fromDate = '',
  toDate = '',
  departments = [],
  departmentAggregates = [],
  settings,
  periodLabel = '',
}) {
  const normalizedSettings = normalizeTaxSettings(settings)
  const scoped = transactions ?? []
  const manualOverrides = normalizedSettings.manual_overrides ?? {}
  const totals = computeTotals(scoped)

  let netIncome = totals.netProfit
  if (manualOverrides.netIncome != null && manualOverrides.netIncome !== '') {
    netIncome = toNumber(manualOverrides.netIncome)
  }

  const { lines: disallowableLines, total: disallowableTotal } = resolveDisallowableLinesForPrint(
    scoped,
    normalizedSettings.disallowable_patterns,
    manualOverrides,
  )

  const divisibleIncome = netIncome + disallowableTotal
  const taxFreeAllowance = toNumber(normalizedSettings.tax_free_allowance)
  const taxableIncome = Math.max(0, divisibleIncome - taxFreeAllowance)
  const taxRate = toNumber(normalizedSettings.tax_rate_percent) / 100
  const partnershipTax = Math.round(taxableIncome * taxRate)
  const taxPaid = toNumber(normalizedSettings.tax_paid)
  const balanceTaxPayable = partnershipTax - taxPaid

  const { firstPeriodTx, secondPeriodTx } = splitPeriodByMidpoint(scoped, fromDate, toDate)
  const firstDisallow = resolveDisallowableLinesForPrint(
    firstPeriodTx,
    normalizedSettings.disallowable_patterns,
    manualOverrides,
  ).total
  const secondDisallow = resolveDisallowableLinesForPrint(
    secondPeriodTx,
    normalizedSettings.disallowable_patterns,
    manualOverrides,
  ).total
  const firstPeriodDivisible = computeTotals(firstPeriodTx).netProfit + firstDisallow
  const secondPeriodDivisible = computeTotals(secondPeriodTx).netProfit + secondDisallow

  const partners = buildPartnersFromDepartments(
    departmentAggregates,
    scoped,
    normalizedSettings.disallowable_patterns,
    manualOverrides,
    departments,
  )

  const apportionment = apportionToPartners({
    partners,
    firstPeriodDivisible,
    secondPeriodDivisible,
    divisibleIncome,
    partnershipTax,
  })

  const range = {
    fromDate: fromDate || '',
    toDate: toDate || '',
    label: periodLabel || (fromDate && toDate ? `${fromDate} – ${toDate}` : 'All time'),
  }

  return {
    range,
    periodLabel: range.label,
    settings: normalizedSettings,
    transactionCount: scoped.length,
    netIncome,
    disallowableLines,
    disallowableTotal,
    divisibleIncome,
    taxFreeAllowance,
    taxableIncome,
    taxRatePercent: normalizedSettings.tax_rate_percent,
    partnershipTax,
    taxPaid,
    balanceTaxPayable,
    firstPeriodDivisible,
    secondPeriodDivisible,
    apportionment,
  }
}
