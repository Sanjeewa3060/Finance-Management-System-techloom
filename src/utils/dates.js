/** ISO date string YYYY-MM-DD in local timezone. */
export function todayISO() {
  const d = new Date()
  return toISODate(d)
}

export function yesterdayISO() {
  return addDaysISO(todayISO(), -1)
}

export function addDaysISO(iso, days) {
  const d = parseISODate(iso)
  if (!d) return todayISO()
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function parseISODate(iso) {
  if (!iso || typeof iso !== 'string') return null
  const [y, m, day] = iso.split('-').map(Number)
  if (!y || !m || !day) return null
  return new Date(y, m - 1, day)
}

export function toISODate(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** e.g. "Monday, 2 June 2026" */
export function formatDisplayDate(iso) {
  const d = parseISODate(iso)
  if (!d) return iso ?? ''
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** e.g. "Today", "Yesterday", or short date */
export function formatDayHeading(iso) {
  if (!iso) return 'Unknown date'
  if (iso === todayISO()) return 'Today'
  if (iso === yesterdayISO()) return 'Yesterday'
  const d = parseISODate(iso)
  if (!d) return iso
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function groupTransactionsByDate(transactions) {
  const map = new Map()
  for (const t of transactions ?? []) {
    const key = t.entry_date || 'unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(t)
  }
  return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
}

export function sumByType(items, type) {
  return items
    .filter((t) => t.type === type)
    .reduce((acc, t) => acc + Number(t.amount ?? 0), 0)
}

/** Unique entry dates (newest first), always includes today for quick add. */
export function getEntryDateList(transactions) {
  const set = new Set([todayISO()])
  for (const t of transactions ?? []) {
    if (t.entry_date) set.add(t.entry_date)
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}

export function countEntriesOnDate(transactions, iso) {
  return (transactions ?? []).filter((t) => t.entry_date === iso).length
}

function parseTimestamp(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Live navbar clock — include seconds when showSeconds is true. */
export function formatLiveClock(date, { showSeconds = true } = {}) {
  const d = date instanceof Date ? date : new Date()
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: false,
  })
}

/** Short date beside live clock, e.g. "Fri, 12 Jun 2026". */
export function formatLiveDate(date) {
  const d = date instanceof Date ? date : new Date()
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** Time when entry was saved, e.g. "14:32". */
export function formatEntryTime(isoOrTimestamp) {
  const d = parseTimestamp(isoOrTimestamp)
  if (!d) return '—'
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Full date+time for tooltips or fallbacks. */
export function formatEntryDateTime(isoOrTimestamp) {
  const d = parseTimestamp(isoOrTimestamp)
  if (!d) return '—'
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
