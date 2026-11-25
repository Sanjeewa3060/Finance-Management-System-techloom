export const ENTRY_TYPES = [
  { id: 'sale', label: 'Sale' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'expense', label: 'Expense' },
  { id: 'other', label: 'Other' },
]

export const ENTRY_TYPE_IDS = ENTRY_TYPES.map((t) => t.id)

export const ENTRY_TYPE_SET = new Set(ENTRY_TYPE_IDS)

export const TYPE_LABELS = Object.fromEntries(ENTRY_TYPES.map((t) => [t.id, t.label]))

export const OTHER_DIRECTIONS = {
  profit: { id: 'profit', label: '+', signLabel: 'Profit' },
  expense: { id: 'expense', label: '-', signLabel: 'Expense' },
}

export const OTHER_DIRECTION_IDS = Object.keys(OTHER_DIRECTIONS)

export function normalizeEntryType(value) {
  const t = String(value ?? '').trim().toLowerCase()
  return ENTRY_TYPE_SET.has(t) ? t : ''
}

export function isEntryType(value) {
  return ENTRY_TYPE_SET.has(String(value ?? '').trim().toLowerCase())
}

export function normalizeOtherDirection(value) {
  const d = String(value ?? '').trim().toLowerCase()
  return d === 'profit' || d === 'expense' ? d : ''
}

/** Resolve other_direction for a transaction; defaults to expense for legacy rows. */
export function resolveOtherDirection(tx) {
  if (normalizeEntryType(tx?.type) !== 'other') return null
  const fromColumn = normalizeOtherDirection(tx?.other_direction)
  if (fromColumn) return fromColumn
  const ref = String(tx?.invoice_ref ?? '')
  const m = ref.match(/^__OD:(profit|expense)__$/)
  if (m) return normalizeOtherDirection(m[1])
  return 'expense'
}

export function isOtherProfit(tx) {
  return normalizeEntryType(tx?.type) === 'other' && resolveOtherDirection(tx) === 'profit'
}

export function isOtherExpense(tx) {
  return normalizeEntryType(tx?.type) === 'other' && resolveOtherDirection(tx) === 'expense'
}

export function isRevenueType(type) {
  return normalizeEntryType(type) === 'sale'
}

export function isCostType(type) {
  const t = normalizeEntryType(type)
  return t === 'purchase' || t === 'expense' || t === 'other'
}

/** Whether a transaction counts toward budget spend (costs). */
export function countsAsBudgetSpend(tx) {
  const t = normalizeEntryType(tx?.type)
  if (t === 'sale') return false
  if (t === 'purchase' || t === 'expense') return true
  if (t === 'other') return isOtherExpense(tx)
  return false
}

export function createEmptyBucket() {
  return { revenue: 0, otherIncome: 0, purchases: 0, expenses: 0 }
}

/** Apply a single transaction amount into revenue / otherIncome / purchases / expenses buckets. */
export function applyTransactionToBucket(bucket, tx, amount) {
  const t = normalizeEntryType(tx?.type)
  if (t === 'sale') bucket.revenue += amount
  else if (t === 'purchase') bucket.purchases += amount
  else if (t === 'expense') bucket.expenses += amount
  else if (t === 'other') {
    if (resolveOtherDirection(tx) === 'profit') bucket.otherIncome += amount
    else bucket.expenses += amount
  }
}

export function finalizeBucket(bucket) {
  const costs = bucket.purchases + bucket.expenses
  const grossIncome = bucket.revenue + bucket.otherIncome
  const netProfit = grossIncome - costs
  const profitMargin = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0
  return { ...bucket, costs, grossIncome, netProfit, profitMargin }
}

export const ENTRY_TYPE_GREEN = 'text-emerald-600 dark:text-emerald-500'
export const ENTRY_TYPE_RED = 'text-theme-red'

/** True for sale and other (+); false for purchase, expense, and other (-). */
export function entryTypeIsIncome(type, otherDirection = null) {
  const t = normalizeEntryType(type)
  if (t === 'sale') return true
  if (t === 'purchase' || t === 'expense') return false
  if (t === 'other') return resolveOtherDirection({ type: 'other', other_direction: otherDirection }) === 'profit'
  return false
}

export function entryTypeSelectedButtonClass(type, otherDirection = null) {
  return entryTypeIsIncome(type, otherDirection) ? 'theme-btn-primary' : 'theme-btn-danger'
}

export function entryTypeIdleButtonClass(type, otherDirection = null) {
  return entryTypeIsIncome(type, otherDirection)
    ? `theme-btn-secondary ${ENTRY_TYPE_GREEN}`
    : `theme-btn-secondary ${ENTRY_TYPE_RED}`
}

/** CSS class suffix for printed/HTML type cells (sale, purchase, expense, other-profit, other-expense). */
export function transactionTypeCssClass(tx) {
  const t = normalizeEntryType(tx?.type)
  if (t === 'sale') return 'type-sale'
  if (t === 'purchase') return 'type-purchase'
  if (t === 'expense') return 'type-expense'
  if (t === 'other') return isOtherProfit(tx) ? 'type-other-profit' : 'type-other-expense'
  return 'type-unknown'
}

export function formatTransactionTypeLabel(tx) {
  const t = normalizeEntryType(tx?.type)
  if (t === 'other') {
    const dir = resolveOtherDirection(tx)
    return dir === 'profit' ? 'Other (+)' : 'Other (-)'
  }
  return TYPE_LABELS[t] ?? t
}

export function transactionTypeToneClass(tx) {
  const t = normalizeEntryType(tx?.type)
  if (t === 'sale') return ENTRY_TYPE_GREEN
  if (t === 'purchase' || t === 'expense') return ENTRY_TYPE_RED
  if (t === 'other') {
    return isOtherProfit(tx) ? ENTRY_TYPE_GREEN : ENTRY_TYPE_RED
  }
  return 'text-slate-700 dark:text-slate-200'
}

export function typeToneClass(type) {
  const t = normalizeEntryType(type)
  if (t === 'sale') return ENTRY_TYPE_GREEN
  if (t === 'purchase' || t === 'expense') return ENTRY_TYPE_RED
  if (t === 'other') return 'text-slate-600 dark:text-slate-400'
  return 'text-slate-700 dark:text-slate-200'
}
