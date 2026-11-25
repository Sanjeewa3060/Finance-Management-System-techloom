import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react'
import PageShell from './PageShell.jsx'
import AppIcon from './AppIcon.jsx'
import {
  addDaysISO,
  countEntriesOnDate,
  formatDayHeading,
  formatDisplayDate,
  formatEntryDateTime,
  formatEntryTime,
  getEntryDateList,
  groupTransactionsByDate,
  todayISO,
} from '../utils/dates.js'
import { filterTransactionsForCompany } from '../utils/companyAnalytics.js'
import { formatMoney } from '../utils/money.js'
import { PAYMENT_LABELS } from '../utils/constants.js'
import ConfirmPasswordModal from './ConfirmPasswordModal.jsx'
import EntryReceipt from './EntryReceipt.jsx'
import { formatTransactionTypeLabel, isOtherExpense, isOtherProfit, transactionTypeToneClass, ENTRY_TYPES } from '../utils/entryTypes.js'
import { toNumber } from '../utils/calculations.js'

function escapeCsv(value) {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

function typeTone(tx) {
  return transactionTypeToneClass(tx)
}

function sumItemsByType(items, type) {
  return items.filter((t) => t.type === type).reduce((acc, t) => acc + toNumber(t.amount), 0)
}

function DayTotals({ items }) {
  const sales = sumItemsByType(items, 'sale')
  const otherIncome = items
    .filter((t) => isOtherProfit(t))
    .reduce((acc, t) => acc + toNumber(t.amount), 0)
  const costs =
    sumItemsByType(items, 'expense') +
    sumItemsByType(items, 'purchase') +
    items.filter((t) => isOtherExpense(t)).reduce((acc, t) => acc + toNumber(t.amount), 0)
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <span className="text-emerald-700 dark:text-emerald-400">
        <span className="font-medium">Sales</span> {formatMoney(sales)}
      </span>
      {otherIncome > 0 ? (
        <span className="text-emerald-700 dark:text-emerald-400">
          <span className="font-medium">Other income</span> {formatMoney(otherIncome)}
        </span>
      ) : null}
      <span className="text-rose-700 dark:text-rose-400">
        <span className="font-medium">Costs</span> {formatMoney(costs)}
      </span>
      <span className="text-slate-600 dark:text-slate-400">
        <span className="font-medium">Entries</span> {items.length}
      </span>
    </div>
  )
}

export default function Transactions({
  transactions,
  departments,
  loading = false,
  error = null,
  onDeleteTransaction,
  onEditTransaction,
  isAdmin = false,
  requiresDeletePassword = false,
  onVerifyDeletePassword,
  hideDepartmentField = false,
  onOpenBulkImport,
  onOpenAddEntry,
  onViewDateChange,
  searchQuery = '',
  onSearchChange,
  adminCompanyFilterId = null,
  companyProfiles = [],
  onLogReportExport,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [departmentId, setDepartmentId] = useState('all')
  const [type, setType] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAllDates, setShowAllDates] = useState(false)
  const [pickNewDate, setPickNewDate] = useState(todayISO())
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [pendingEditTransaction, setPendingEditTransaction] = useState(null)
  const pickDateInputRef = useRef(null)
  const canShowActions = true

  const dateFromUrl = searchParams.get('date')
  const companyFromUrl = searchParams.get('company') || adminCompanyFilterId
  const branchFromUrl = searchParams.get('department') || searchParams.get('branch')
  const [selectedDate, setSelectedDate] = useState(dateFromUrl || todayISO())
  const [companyFilter, setCompanyFilter] = useState(companyFromUrl || 'all')

  React.useEffect(() => {
    if (companyFromUrl) setCompanyFilter(companyFromUrl)
  }, [companyFromUrl])

  React.useEffect(() => {
    if (branchFromUrl) setDepartmentId(branchFromUrl)
  }, [branchFromUrl])

  useEffect(() => {
    if (dateFromUrl && dateFromUrl !== selectedDate) {
      setSelectedDate(dateFromUrl)
    }
  }, [dateFromUrl, selectedDate])

  useEffect(() => {
    onViewDateChange?.(selectedDate)
  }, [selectedDate, onViewDateChange])

  function selectDate(iso) {
    setSelectedDate(iso)
    setShowAllDates(false)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('date', iso)
      return next
    })
  }

  const deptById = useMemo(() => {
    const m = new Map()
    for (const d of departments) m.set(d.id, d)
    return m
  }, [departments])

  const companyLabel = useMemo(() => {
    if (companyFilter === 'all') return null
    const c = companyProfiles.find((p) => p.id === companyFilter)
    return c?.email ?? 'Department'
  }, [companyFilter, companyProfiles])

  const baseFiltered = useMemo(() => {
    let list = transactions ?? []
    if (companyFilter && companyFilter !== 'all') {
      list = filterTransactionsForCompany(list, departments, companyFilter)
    }
    const q = searchQuery.trim().toLowerCase()
    return list.filter((t) => {
      if (departmentId !== 'all' && t.department_id !== departmentId) return false
      if (type !== 'all' && t.type !== type) return false
      if (statusFilter !== 'all' && (t.status ?? 'approved') !== statusFilter) return false
      if (q) {
        const hay = `${t.category} ${t.description ?? ''} ${t.amount} ${t.invoice_ref ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [transactions, departments, companyFilter, departmentId, type, statusFilter, searchQuery])

  const dateList = useMemo(() => getEntryDateList(baseFiltered), [baseFiltered])

  const entriesForSelectedDay = useMemo(
    () =>
      baseFiltered
        .filter((t) => t.entry_date === selectedDate)
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))),
    [baseFiltered, selectedDate],
  )

  const groupedAll = useMemo(() => groupTransactionsByDate(baseFiltered), [baseFiltered])

  const selectedIndex = dateList.indexOf(selectedDate)

  function handleExportCsv() {
    const rows = (showAllDates ? baseFiltered : entriesForSelectedDay).map((t) => {
      const d = deptById.get(t.department_id)
      return [
        t.entry_date,
        formatEntryTime(t.created_at),
        d?.name ?? 'Unknown',
        formatTransactionTypeLabel(t),
        t.category,
        t.description ?? '',
        Number(t.amount ?? 0).toFixed(2),
      ]
    })
    const headers = ['Date', 'Time added', 'Department', 'Type', 'Category', 'Description', 'Amount']
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `entries_${showAllDates ? 'all' : selectedDate}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    onLogReportExport?.(
      `Transactions CSV export — ${showAllDates ? 'all dates' : selectedDate}`,
    )
  }

  const cellPad = 'px-1.5 py-1.5 sm:px-2'
  const headCell = `${cellPad} text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400`

  function renderRow(t, showDateColumn = false) {
    const d = deptById.get(t.department_id)
    const deptName = d?.name ?? 'Unknown'
    const typeLabel = formatTransactionTypeLabel(t)
    const category = t.category || '—'
    const description = t.description || '—'
    const payment = PAYMENT_LABELS[t.payment_method] ?? t.payment_method ?? 'Cash'
    const status = t.status ?? 'approved'
    return (
      <tr key={t.id} className="border-t border-slate-200/80 dark:border-slate-800/60 hover:bg-emerald-500/5">
        {showDateColumn ? (
          <td className={`${cellPad} text-xs tabular-nums text-slate-600 dark:text-slate-300`}>
            <span className="block truncate" title={t.entry_date}>{t.entry_date}</span>
          </td>
        ) : null}
        {!hideDepartmentField ? (
          <td className={cellPad}>
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d?.color ?? '#94a3b8' }} />
              <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100" title={deptName}>
                {deptName}
              </span>
            </div>
          </td>
        ) : null}
        <td className={`${cellPad} text-xs ${typeTone(t)}`}>
          <span className="block truncate" title={typeLabel}>{typeLabel}</span>
        </td>
        <td
          className={`${cellPad} text-xs tabular-nums text-slate-600 dark:text-slate-300`}
          title={formatEntryDateTime(t.created_at)}
        >
          {formatEntryTime(t.created_at)}
        </td>
        <td className={`${cellPad} text-xs text-slate-700 dark:text-slate-200`}>
          <span className="block truncate" title={category}>{category}</span>
        </td>
        <td className={`${cellPad} text-xs text-slate-500 dark:text-slate-400`}>
          <span className="block truncate" title={description}>{description}</span>
        </td>
        <td className={`${cellPad} w-10`}>
          <EntryReceipt transaction={t} size="xs" />
        </td>
        <td className={`${cellPad} text-xs capitalize text-slate-600 dark:text-slate-300`}>
          <span className="block truncate" title={payment}>{payment}</span>
        </td>
        <td className={`${cellPad} text-xs font-semibold tabular-nums ${typeTone(t)}`}>
          <span className="block truncate" title={formatMoney(t.amount)}>{formatMoney(t.amount)}</span>
        </td>
        <td className={`${cellPad} whitespace-nowrap text-[11px] capitalize text-slate-500`} title={status}>
          {status}
        </td>
        {canShowActions ? (
          <td className={`${cellPad} whitespace-nowrap`}>
            <div className="inline-grid grid-cols-2 gap-1 align-middle">
              <button
                type="button"
                onClick={() => {
                  if (requiresDeletePassword) {
                    setPendingEditTransaction(t)
                  } else {
                    onEditTransaction?.(t)
                  }
                }}
                className="theme-btn-secondary theme-btn-table"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setPendingDeleteId(t.id)}
                className="theme-btn-danger theme-btn-table"
              >
                Delete
              </button>
            </div>
          </td>
        ) : null}
      </tr>
    )
  }

  const tableColGroup = (
    <colgroup>
      {!hideDepartmentField ? <col style={{ width: '13%' }} /> : null}
      <col style={{ width: '8%' }} />
      <col style={{ width: '5%' }} />
      <col style={{ width: hideDepartmentField ? '12%' : '11%' }} />
      <col style={{ width: hideDepartmentField ? '24%' : '16%' }} />
      <col style={{ width: '4.5rem' }} />
      <col style={{ width: '7%' }} />
      <col style={{ width: '9%' }} />
      <col style={{ width: '5.5rem' }} />
      {canShowActions ? <col style={{ width: '8.5rem' }} /> : null}
    </colgroup>
  )

  const tableHead = (
    <thead>
      <tr className="text-left">
        {!hideDepartmentField ? <th className={headCell}>Department</th> : null}
        <th className={headCell}>Type</th>
        <th className={headCell}>Time</th>
        <th className={headCell}>Category</th>
        <th className={headCell}>Description</th>
        <th className={headCell}>Bill</th>
        <th className={headCell}>Payment</th>
        <th className={headCell}>Amount</th>
        <th className={`${headCell} whitespace-nowrap`}>Status</th>
        {canShowActions ? <th className={`${headCell} whitespace-nowrap`}>Actions</th> : null}
      </tr>
    </thead>
  )

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Transactions</h2>
          <p className="mt-1 hidden text-sm text-slate-600 lg:block dark:text-slate-400">
            Pick a date to view that day&apos;s transaction details. Add new entries below the list for the selected day.
          </p>
          {companyLabel ? (
            <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Showing only: {companyLabel}{' '}
              <Link to="/dashboard/departments?tab=analytics" className="underline">
                Change department
              </Link>
            </p>
          ) : null}
        </div>
        <div className="theme-btn-toolbar">
          <button type="button" onClick={onOpenBulkImport} className="theme-btn-secondary">
            Import CSV
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={(showAllDates ? baseFiltered : entriesForSelectedDay).length === 0}
            className="theme-btn-secondary disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {companyProfiles.length > 0 ? (
        <div className="glass mt-4 rounded-xl p-4">
          <label className="text-xs font-medium text-slate-500">Filter by department (admin)</label>
          <select
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value)
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (e.target.value === 'all') next.delete('company')
                else next.set('company', e.target.value)
                return next
              })
            }}
            className="theme-input mt-1 max-w-md text-sm"
          >
            <option value="all">All departments</option>
            {companyProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.email}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="glass finance-scroll mt-3 flex gap-2 overflow-x-auto rounded-xl p-2 xl:hidden">
        {dateList.map((iso) => {
          const count = countEntriesOnDate(baseFiltered, iso)
          const active = !showAllDates && selectedDate === iso
          return (
            <button
              key={`strip-${iso}`}
              type="button"
              onClick={() => selectDate(iso)}
              className={`theme-btn-chip shrink-0 text-left ${
                active ? 'bg-emerald-500 text-white shadow-sm' : 'theme-btn-secondary'
              }`}
            >
              <div className="text-xs font-semibold whitespace-nowrap">{formatDayHeading(iso)}</div>
              <div className={`text-[10px] ${active ? 'text-emerald-50' : 'text-slate-500'}`}>
                {count} entr{count === 1 ? 'y' : 'ies'}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-[200px_1fr]">
        {/* Date picker column — desktop */}
        <aside className="glass hidden flex-col rounded-xl p-3 xl:flex xl:max-h-[calc(100dvh-11rem)] xl:overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-700/50">
            <AppIcon icon={Calendar} size="sm" className="text-emerald-600" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Dates</span>
          </div>
          <div className="finance-scroll mt-2 flex-1 space-y-1 overflow-y-auto pr-1">
            {dateList.map((iso) => {
              const count = countEntriesOnDate(baseFiltered, iso)
              const active = !showAllDates && selectedDate === iso
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDate(iso)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                    active ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-700 hover:bg-emerald-500/10 dark:text-slate-300'
                  }`}
                >
                  <div className="text-sm font-medium">{formatDayHeading(iso)}</div>
                  <div className={`text-xs ${active ? 'text-emerald-50' : 'text-slate-500'}`}>
                    {count} entr{count === 1 ? 'y' : 'ies'}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-700/50">
            <label className="text-xs font-medium text-slate-500">Open another day</label>
            <div className="date-picker-wrap mt-1">
              <input
                ref={pickDateInputRef}
                type="date"
                max={todayISO()}
                value={pickNewDate}
                onChange={(e) => setPickNewDate(e.target.value)}
                className="theme-input date-picker-input pr-12 text-sm"
                aria-label="Pick a date"
              />
              <button
                type="button"
                className="date-picker-btn"
                onClick={() => {
                  const el = pickDateInputRef.current
                  if (el?.showPicker) el.showPicker()
                  else el?.click()
                }}
                aria-label="Open calendar"
                title="Open calendar"
              >
                <AppIcon icon={Calendar} size="sm" className="text-white" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => selectDate(pickNewDate)}
              className="theme-btn-secondary mt-2 w-full rounded-lg px-2 py-2 text-xs font-medium"
            >
              Go to date
            </button>
          </div>
        </aside>

        {/* Main day panel */}
        <div className="ipad-viewport-panel min-w-0">
          {!showAllDates ? (
            <>
              <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-emerald-500/20">
                <div className="shrink-0 border-b border-slate-200/80 p-3 sm:p-4 dark:border-slate-700/50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Selected day
                      </p>
                      <h3 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl dark:text-slate-100">{formatDayHeading(selectedDate)}</h3>
                      <p className="text-xs text-slate-600 sm:text-sm dark:text-slate-400">{formatDisplayDate(selectedDate)}</p>
                      <div className="mt-2">
                        <DayTotals items={entriesForSelectedDay} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => selectedIndex < dateList.length - 1 && selectDate(dateList[selectedIndex + 1])}
                        disabled={selectedIndex < 0 || selectedIndex >= dateList.length - 1}
                        className="theme-btn-secondary px-3 disabled:opacity-40"
                        title="Older day"
                      >
                        <AppIcon icon={ChevronLeft} size="sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => selectedIndex > 0 && selectDate(dateList[selectedIndex - 1])}
                        disabled={selectedIndex <= 0}
                        className="theme-btn-secondary px-3 disabled:opacity-40"
                        title="Newer day"
                      >
                        <AppIcon icon={ChevronRight} size="sm" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-b border-slate-200/80 p-3 dark:border-slate-700/50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <input
                      value={searchQuery}
                      onChange={(e) => onSearchChange?.(e.target.value)}
                      placeholder="Search this day…"
                      className="theme-input !mt-0 min-w-[200px] flex-1"
                    />
                    {!hideDepartmentField ? (
                      <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="theme-input !mt-0 w-auto text-sm" disabled={loading}>
                        <option value="all">All departments</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <select value={type} onChange={(e) => setType(e.target.value)} className="theme-input !mt-0 w-auto text-sm" disabled={loading}>
                      <option value="all">All types</option>
                      {ENTRY_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAllDates(true)}
                      className="theme-btn-secondary !mt-0 w-full sm:w-auto"
                    >
                      View all dates
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="border-b border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:border-slate-700/50 dark:text-rose-200">
                    {error}
                  </div>
                ) : null}

                <div className="ipad-viewport-panel__scroll min-w-0 overflow-x-auto xl:overflow-x-hidden">
                  {loading ? (
                    <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
                  ) : (
                    <table className="w-full min-w-[700px] table-fixed xl:min-w-0">
                      {tableColGroup}
                      {tableHead}
                      <tbody>
                        {entriesForSelectedDay.length === 0 ? (
                          <tr>
                            <td
                              colSpan={hideDepartmentField ? 9 : 10}
                              className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-400"
                            >
                              No entries on {formatDisplayDate(selectedDate)} yet.
                            </td>
                          </tr>
                        ) : (
                          entriesForSelectedDay.map((t) => renderRow(t))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="shrink-0 border-t border-slate-200/80 p-3 dark:border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => onOpenAddEntry?.(selectedDate)}
                    className="theme-btn-primary theme-btn-primary--block w-full sm:w-auto"
                  >
                    <AppIcon icon={PlusCircle} size="sm" className="text-white" />
                    Add entry
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">All dates ({baseFiltered.length} entries)</p>
                <button type="button" onClick={() => setShowAllDates(false)} className="text-sm font-medium text-emerald-600 hover:underline">
                  Back to day view
                </button>
              </div>
              <div className="mt-4 space-y-4">
                {groupedAll.map(([date, items]) => (
                  <section key={date} className="glass overflow-hidden rounded-xl">
                    <button
                      type="button"
                      onClick={() => selectDate(date)}
                      className="flex w-full flex-col gap-2 border-b border-slate-200/80 px-4 py-4 text-left hover:bg-emerald-500/5 dark:border-slate-700/50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{formatDayHeading(date)}</h3>
                        <p className="text-xs text-slate-500">{formatDisplayDate(date)} · click to open this day only</p>
                        <div className="mt-2">
                          <DayTotals items={items} />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-emerald-600">Open day →</span>
                    </button>
                    <div className="min-w-0 overflow-x-auto xl:overflow-x-hidden">
                      <table className="w-full min-w-[700px] table-fixed xl:min-w-0">
                        {tableColGroup}
                        {tableHead}
                        <tbody>{items.map((t) => renderRow(t))}</tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmPasswordModal
        open={!!pendingDeleteId}
        title="Delete entry"
        message={
          isAdmin
            ? 'Enter your login password to permanently delete this entry. This cannot be undone.'
            : 'Enter the delete password set by your admin. This cannot be undone.'
        }
        passwordLabel={isAdmin ? 'Login password' : 'Delete password'}
        confirmLabel="Delete entry"
        onConfirm={async (password) => {
          await onDeleteTransaction?.(pendingDeleteId, password)
        }}
        onClose={() => setPendingDeleteId(null)}
      />

      <ConfirmPasswordModal
        open={!!pendingEditTransaction}
        title="Edit entry"
        message="Enter the delete password set by your admin to edit this entry."
        passwordLabel="Delete password"
        confirmLabel="Continue to edit"
        onConfirm={async (password) => {
          await onVerifyDeletePassword?.(password)
          onEditTransaction?.(pendingEditTransaction, { verified: true })
        }}
        onClose={() => setPendingEditTransaction(null)}
      />
    </PageShell>
  )
}
