/** Presets removed from the UI; map to Year to date if still present in state. */
const REMOVED_DATE_PRESETS = new Set(['last_7_days', 'last_30_days', 'last_year'])

const DATE_PRESET_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  last_week: 'Last week',
  this_month: 'Month to date',
  last_month: 'Last month',
  this_year: 'Year to date',
  all: 'All time',
  custom: 'Custom',
}

export function normalizeDatePreset(preset) {
  if (REMOVED_DATE_PRESETS.has(preset)) return 'this_year'
  return preset
}

/** Human label for a date-range preset (matches ReportDateRangePicker). */
export function getDatePresetLabel(preset) {
  if (!preset) return null
  const resolved = normalizeDatePreset(preset)
  return DATE_PRESET_LABELS[resolved] ?? DATE_PRESET_LABELS[preset] ?? null
}

export function getDatePresetRange(preset, now = new Date()) {
  const resolved = normalizeDatePreset(preset)
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()

  const fmt = (date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  if (resolved === 'today') {
    const t = fmt(now)
    return { fromDate: t, toDate: t }
  }
  if (resolved === 'yesterday') {
    const yesterday = fmt(new Date(y, m, d - 1))
    return { fromDate: yesterday, toDate: yesterday }
  }
  if (resolved === 'this_week' || resolved === 'last_week') {
    const monday = d - ((now.getDay() + 6) % 7)
    const start = new Date(y, m, monday - (resolved === 'last_week' ? 7 : 0))
    const end = resolved === 'last_week' ? new Date(y, m, monday - 1) : now
    return { fromDate: fmt(start), toDate: fmt(end) }
  }
  if (resolved === 'this_month') {
    return { fromDate: fmt(new Date(y, m, 1)), toDate: fmt(now) }
  }
  if (resolved === 'last_month') {
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0)
    return { fromDate: fmt(start), toDate: fmt(end) }
  }
  if (resolved === 'this_year') {
    return { fromDate: fmt(new Date(y, 0, 1)), toDate: fmt(now) }
  }
  return { fromDate: '', toDate: '' }
}

export function filterTransactions(transactions, { departmentId = 'all', type = 'all', fromDate = '', toDate = '' } = {}) {
  return (transactions ?? []).filter((t) => {
    if (departmentId !== 'all' && t.department_id !== departmentId) return false
    if (type !== 'all' && t.type !== type) return false
    if (fromDate && t.entry_date < fromDate) return false
    if (toDate && t.entry_date > toDate) return false
    return true
  })
}
