import React, { useMemo, useState } from 'react'
import { Download, FileDown, Printer } from 'lucide-react'
import PageShell from './PageShell.jsx'
import AppIcon from './AppIcon.jsx'
import CompanyLogo from './CompanyLogo.jsx'
import ReportDateRangePicker from './ReportDateRangePicker.jsx'
import {
  computeTotals,
  computeDepartmentAggregates,
  computeDailyAggregates,
  computeMonthlyTrends,
} from '../utils/calculations.js'
import {
  filterTransactions,
  getDatePresetLabel,
  getDatePresetRange,
  normalizeDatePreset,
} from '../utils/filters.js'
import { computeBranchAggregates } from '../utils/companyAnalytics.js'
import { downloadOverviewReport, exportOverviewReport } from '../utils/reports.js'
import { computeDetailedPnl } from '../utils/pnlDetailed.js'
import { downloadDetailedPnlPdf, printDetailedPnl } from '../utils/pnlDetailedExport.js'
import { formatMoney } from '../utils/money.js'
import { formatDisplayDate, formatEntryTime } from '../utils/dates.js'

function isEmptySectionHeader(lines, index) {
  return lines[index]?.kind === 'header' && lines[index + 1]?.kind === 'total'
}

function deptLabel(dept) {
  return dept?.name?.trim() || dept?.email || 'Unnamed'
}

function buildReport({ transactions, departments, departmentId, fromDate, toDate }) {
  const scopedDepts =
    departmentId && departmentId !== 'all'
      ? (departments ?? []).filter((d) => d.id === departmentId)
      : (departments ?? [])

  const deptIds = new Set(scopedDepts.map((d) => d.id))
  const scopedTx = filterTransactions(transactions, {
    departmentId: 'all',
    type: 'all',
    fromDate,
    toDate,
  }).filter((t) => deptIds.has(t.department_id))

  return {
    totals: computeTotals(scopedTx),
    departmentAggregates: computeDepartmentAggregates(scopedDepts, scopedTx).filter((a) => a.entries > 0),
    dailyAggregates: computeDailyAggregates(scopedTx),
    transactions: scopedTx,
    departments: scopedDepts,
  }
}

function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey.length < 7) return monthKey ?? '—'
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

/** Earliest / latest entry_date in a transaction list (YYYY-MM-DD). */
function entryDateBounds(transactions) {
  let earliest = ''
  let latest = ''
  for (const t of transactions ?? []) {
    const d = t.entry_date
    if (!d) continue
    if (!earliest || d < earliest) earliest = d
    if (!latest || d > latest) latest = d
  }
  return { earliest, latest }
}

function formatPeriodRange(fromDate, toDate) {
  if (!fromDate && !toDate) return null
  if (fromDate && toDate && fromDate === toDate) return formatDisplayDate(fromDate)
  return `${fromDate ? formatDisplayDate(fromDate) : '…'} – ${toDate ? formatDisplayDate(toDate) : '…'}`
}

/** Preset name + date range, e.g. "Yesterday (…)" or "All time (earliest – latest)". */
function periodLabel(preset, fromDate, toDate, bounds = {}) {
  const effectiveFrom = fromDate || bounds.earliest || ''
  const effectiveTo = toDate || bounds.latest || ''
  const range = formatPeriodRange(effectiveFrom, effectiveTo)
  const presetName = getDatePresetLabel(preset)
  if (!presetName || preset === 'custom') return range || 'All time'
  if (!range) return presetName
  if (range === presetName) return presetName
  return `${presetName} (${range})`
}

function ReportTable({ title, columns, rows, emptyMessage = 'No data' }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 border-b-2 border-emerald-500 pb-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
        {title}
      </h3>
      <div className="overflow-x-auto rounded-lg shadow-sm">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="bg-emerald-600 text-white">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`border border-emerald-600 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide ${
                    col.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="border border-slate-200 px-2 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={index % 2 === 1 ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900/40'}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`border border-slate-200 px-2 py-1.5 text-slate-800 dark:border-slate-700 dark:text-slate-100 ${
                        col.align === 'right' ? 'text-right tabular-nums' : ''
                      } ${col.tone === 'revenue' ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''} ${
                        col.tone === 'costs' ? 'font-semibold text-rose-700 dark:text-rose-400' : ''
                      } ${col.tone === 'profit' ? `font-semibold ${row._profitTone ?? 'text-slate-800 dark:text-slate-100'}` : ''} ${
                        row[`${col.key}Class`] ?? ''
                      }`}
                    >
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SummaryCards({ totals }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Revenue (Sales)</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(totals.revenue)}</div>
      </div>
      <div className="rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Other income</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(totals.otherIncome ?? 0)}</div>
      </div>
      <div className="rounded-xl border border-slate-200 border-l-4 border-l-rose-500 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Costs</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-rose-700 dark:text-rose-400">{formatMoney(totals.costs)}</div>
      </div>
      <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Net profit</div>
        <div
          className={`mt-1 text-xl font-bold tabular-nums ${
            totals.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
          }`}
        >
          {formatMoney(totals.netProfit)}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Margin</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{totals.profitMargin.toFixed(1)}%</div>
      </div>
    </div>
  )
}

function DetailedPnlStatement({ lines }) {
  const list = lines ?? []
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="detailed-pnl-statement w-full min-w-[360px] border-collapse text-sm">
        <tbody>
          {list.map((line, index) => {
            const key = `${line.kind}-${line.label}-${index}`
            if (line.kind === 'header') {
              const empty = isEmptySectionHeader(list, index)
              return (
                <tr key={key} className="border-b border-slate-300 dark:border-slate-600">
                  <td
                    colSpan={2}
                    className={`px-3 text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 ${
                      empty ? 'pt-2 pb-0.5' : 'pt-3.5 pb-1'
                    }`}
                  >
                    {line.label}
                  </td>
                </tr>
              )
            }
            const amountLabel = formatMoney(line.amount)
            const emptyTotal = line.kind === 'total' && list[index - 1]?.kind === 'header'
            const rowClass =
              line.kind === 'result'
                ? 'border-t-2 border-b-[3px] border-double border-slate-800 font-bold dark:border-slate-200'
                : line.kind === 'total'
                  ? 'border-t border-slate-300 font-semibold dark:border-slate-600'
                  : ''
            return (
              <tr key={key} className={rowClass}>
                <td
                  className={`px-3 text-slate-800 dark:text-slate-100 ${
                    line.kind === 'item' ? 'pl-6 py-1' : emptyTotal ? 'py-0.5' : 'py-1.5'
                  } ${line.kind === 'result' ? 'uppercase tracking-wide' : ''} ${
                    line.kind === 'total' ? 'font-semibold' : ''
                  }`}
                >
                  {line.label}
                </td>
                <td
                  className={`px-3 text-right tabular-nums text-slate-800 dark:text-slate-100 ${
                    emptyTotal ? 'py-0.5' : 'py-1.5'
                  } ${
                    line.key === 'netProfit' || line.key === 'grossProfit'
                      ? Number(line.amount) >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                      : ''
                  }`}
                >
                  {amountLabel}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Reports({
  transactions,
  departments,
  isAdmin = false,
  branchAccounts = [],
  onLogReportExport,
  categories = [],
}) {
  const initial = getDatePresetRange('this_month')
  const [preset, setPreset] = useState('this_month')
  const [fromDate, setFromDate] = useState(initial.fromDate)
  const [toDate, setToDate] = useState(initial.toDate)
  const [departmentId, setDepartmentId] = useState('all')
  const [reportTab, setReportTab] = useState('summary')

  const deptList = branchAccounts.length > 0 ? branchAccounts : departments ?? []
  const deptById = useMemo(() => new Map(deptList.map((d) => [d.id, deptLabel(d)])), [deptList])
  const scopedDepartmentId = isAdmin ? departmentId : 'all'

  const report = useMemo(
    () =>
      buildReport({
        transactions,
        departments,
        departmentId: scopedDepartmentId,
        fromDate,
        toDate,
      }),
    [transactions, departments, scopedDepartmentId, fromDate, toDate],
  )

  const detailedPnl = useMemo(
    () =>
      computeDetailedPnl({
        transactions: report.transactions,
        categories,
      }),
    [report.transactions, categories],
  )

  const branchRows = useMemo(() => {
    if (!isAdmin || departmentId !== 'all') return []
    const scopedTx = filterTransactions(transactions, { departmentId: 'all', type: 'all', fromDate, toDate })
    return computeBranchAggregates(deptList, scopedTx).filter((r) => r.entries > 0)
  }, [isAdmin, departmentId, deptList, transactions, fromDate, toDate])

  const monthlyRows = useMemo(() => computeMonthlyTrends(report.transactions), [report.transactions])

  const filtersLabel = useMemo(() => {
    const bounds = entryDateBounds(report.transactions)
    const parts = [`Period: ${periodLabel(preset, fromDate, toDate, bounds)}`]
    if (isAdmin && departmentId !== 'all') {
      parts.unshift(`Department: ${deptLabel(deptList.find((d) => d.id === departmentId))}`)
    }
    return parts.join(' · ')
  }, [preset, isAdmin, departmentId, deptList, fromDate, toDate, report.transactions])

  const reportTitle = useMemo(() => {
    if (isAdmin && departmentId !== 'all') {
      return `P&L Report — ${deptLabel(deptList.find((d) => d.id === departmentId))}`
    }
    return 'P&L Report'
  }, [isAdmin, departmentId, deptList])

  const detailedTitle = useMemo(() => {
    if (isAdmin && departmentId !== 'all') {
      return `Detailed Profit & Loss report — ${deptLabel(deptList.find((d) => d.id === departmentId))}`
    }
    return 'Detailed Profit & Loss report'
  }, [isAdmin, departmentId, deptList])

  function getExportOptions() {
    return {
      title: reportTitle,
      totals: report.totals,
      departmentAggregates: report.departmentAggregates,
      dailyAggregates: report.dailyAggregates,
      monthlyAggregates: monthlyRows,
      companyAggregates: branchRows,
      transactions: report.transactions,
      departments: deptList,
      filtersLabel,
    }
  }

  function handleDownload() {
    if (reportTab === 'detailed') return
    const prefix = preset === 'this_week' || preset === 'last_week' ? 'weekly-report' : 'report'
    downloadOverviewReport(getExportOptions(), `${prefix}_${fromDate || 'start'}_${toDate || 'all-time'}.html`)
    onLogReportExport?.(`P&L download — ${filtersLabel}`)
  }

  function handlePrint() {
    if (reportTab === 'detailed') {
      printDetailedPnl({
        title: detailedTitle,
        filtersLabel,
        lines: detailedPnl.lines,
      })
      onLogReportExport?.(`Detailed P&L print — ${filtersLabel}`)
      return
    }
    exportOverviewReport(getExportOptions())
    onLogReportExport?.(`P&L print — ${filtersLabel}`)
  }

  async function handleDownloadPdf() {
    if (reportTab !== 'detailed') return
    await downloadDetailedPnlPdf(
      {
        title: detailedTitle,
        filtersLabel,
        lines: detailedPnl.lines,
      },
      `detailed-pnl_${fromDate || 'start'}_${toDate || 'all-time'}.pdf`,
    )
    onLogReportExport?.(`Detailed P&L PDF download — ${filtersLabel}`)
  }

  const downloadDisabled =
    reportTab === 'summary' ? report.transactions.length === 0 : report.transactions.length === 0 && !detailedPnl.lines.length
  const printDisabled = downloadDisabled

  const branchTableRows = branchRows.map((row) => ({
    id: row.company_id,
    department: row.company_label || row.company_name,
    entries: row.entries,
    revenue: formatMoney(row.revenue),
    costs: formatMoney(row.costs),
    netProfit: formatMoney(row.netProfit),
    _profitTone: row.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400',
  }))

  const monthlyTableRows = monthlyRows.map((row) => ({
    id: row.month,
    month: formatMonthLabel(row.month),
    revenue: formatMoney(row.revenue),
    costs: formatMoney(row.costs),
    netProfit: formatMoney(row.netProfit),
    _profitTone: row.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400',
  }))

  const dailyTableRows = report.dailyAggregates.map((row) => ({
    id: row.date,
    date: formatDisplayDate(row.date),
    entries: row.entries,
    revenue: formatMoney(row.revenue),
    costs: formatMoney(row.costs),
    netProfit: formatMoney(row.netProfit),
    _profitTone: row.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400',
  }))

  const transactionTableRows = [...report.transactions]
    .sort((a, b) => {
      const dateCmp = String(b.entry_date).localeCompare(String(a.entry_date))
      if (dateCmp !== 0) return dateCmp
      return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    })
    .map((t) => ({
      id: t.id,
      date: formatDisplayDate(t.entry_date),
      time: formatEntryTime(t.created_at),
      department: deptById.get(t.department_id) ?? 'Unknown',
      type: t.type,
      category: t.category,
      description: t.description || '—',
      amount: formatMoney(t.amount),
    }))

  return (
    <PageShell className="reports-ipad-fit">
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Reports</h2>
          <p className="mt-0.5 text-sm text-slate-400">{filtersLabel}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {isAdmin && deptList.length > 0 ? (
            <label className="w-full min-w-0 sm:w-48">
              <span className="sr-only">Department</span>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="theme-input text-sm"
              >
                <option value="all">All departments</option>
                {deptList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {deptLabel(d)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <ReportDateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            preset={preset}
            onApply={(range) => {
              const safePreset = normalizeDatePreset(range.preset)
              const safeRange = safePreset === range.preset
                ? range
                : { ...getDatePresetRange(safePreset), preset: safePreset }
              setFromDate(safeRange.fromDate)
              setToDate(safeRange.toDate)
              setPreset(safeRange.preset)
            }}
          />

        {reportTab === 'summary' ? (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadDisabled}
            className="theme-btn-primary theme-btn-primary--block"
          >
            <AppIcon icon={Download} size="sm" className="text-white" />
            Download
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadDisabled}
            className="theme-btn-primary theme-btn-primary--block"
          >
            <AppIcon icon={FileDown} size="sm" className="text-white" />
            Download PDF
          </button>
        )}
        <button
          type="button"
          onClick={handlePrint}
          disabled={printDisabled}
          className="theme-btn-primary theme-btn-primary--block"
        >
          <AppIcon icon={Printer} size="sm" className="text-white" />
          Print report
        </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Report type">
        <button
          type="button"
          role="tab"
          aria-selected={reportTab === 'summary'}
          onClick={() => setReportTab('summary')}
          className={
            reportTab === 'summary'
              ? 'theme-btn-primary px-4 text-sm'
              : 'theme-btn-secondary px-4 text-sm'
          }
        >
          Summary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={reportTab === 'detailed'}
          onClick={() => setReportTab('detailed')}
          className={
            reportTab === 'detailed'
              ? 'theme-btn-primary px-4 text-sm'
              : 'theme-btn-secondary px-4 text-sm'
          }
        >
          Detailed P&L
        </button>
      </div>

      {reportTab === 'summary' ? (
      <div className="reports-preview-panel mt-4 overflow-hidden rounded-xl border border-slate-200 bg-transparent dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-emerald-700 px-4 py-5 sm:px-6">
          <div className="min-w-0 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">Finance Management System</p>
            <h3 className="mt-1 text-lg font-bold sm:text-xl">{reportTitle}</h3>
            <p className="mt-1 text-xs text-emerald-100">{filtersLabel}</p>
          </div>
          <div className="rounded-xl bg-white px-4 py-2 shadow-md">
            <CompanyLogo size="nav" />
          </div>
        </div>

        <div className="p-4 sm:p-5">
        {report.transactions.length === 0 ? (
          <p className="text-sm text-slate-500">No entries in this period. Adjust the dates or department filter above.</p>
        ) : (
          <>
            <SummaryCards totals={report.totals} />

            {isAdmin && departmentId === 'all' && branchTableRows.length > 0 ? (
              <ReportTable
                title="By department"
                columns={[
                  { key: 'department', label: 'Department' },
                  { key: 'entries', label: 'Entries', align: 'right' },
                  { key: 'revenue', label: 'Revenue', align: 'right', tone: 'revenue' },
                  { key: 'costs', label: 'Costs', align: 'right', tone: 'costs' },
                  { key: 'netProfit', label: 'Net profit', align: 'right', tone: 'profit' },
                ]}
                rows={branchTableRows}
              />
            ) : null}

            {monthlyTableRows.length > 1 ? (
              <ReportTable
                title="By month"
                columns={[
                  { key: 'month', label: 'Month' },
                  { key: 'revenue', label: 'Revenue', align: 'right', tone: 'revenue' },
                  { key: 'costs', label: 'Costs', align: 'right', tone: 'costs' },
                  { key: 'netProfit', label: 'Net profit', align: 'right', tone: 'profit' },
                ]}
                rows={monthlyTableRows}
              />
            ) : null}

            {dailyTableRows.length > 0 ? (
              <ReportTable
                title="By day"
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'entries', label: 'Entries', align: 'right' },
                  { key: 'revenue', label: 'Revenue', align: 'right', tone: 'revenue' },
                  { key: 'costs', label: 'Costs', align: 'right', tone: 'costs' },
                  { key: 'netProfit', label: 'Net profit', align: 'right', tone: 'profit' },
                ]}
                rows={dailyTableRows}
              />
            ) : null}

            <ReportTable
              title="Transaction details"
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'time', label: 'Time' },
                { key: 'department', label: 'Department' },
                { key: 'type', label: 'Type' },
                { key: 'category', label: 'Category' },
                { key: 'description', label: 'Description' },
                { key: 'amount', label: 'Amount', align: 'right' },
              ]}
              rows={transactionTableRows}
              emptyMessage="No transactions in this period."
            />
          </>
        )}
        </div>
      </div>
      ) : (
      <div className="reports-preview-panel reports-detailed-pnl mt-4 overflow-hidden rounded-xl border border-slate-200 bg-transparent dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Finance Management System
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">{detailedTitle}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{filtersLabel}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-600 dark:bg-slate-950">
            <CompanyLogo size="nav" />
          </div>
        </div>

        <div className="p-4 pb-24 sm:p-5 sm:pb-24">
          {report.transactions.length === 0 &&
          detailedPnl.totals.salesTotal === 0 &&
          detailedPnl.totals.purchasesTotal === 0 &&
          detailedPnl.totals.operatingExpensesTotal === 0 &&
          detailedPnl.totals.otherIncomeTotal === 0 ? (
            <p className="text-sm text-slate-500">No entries in this period. Adjust the dates or department filter above.</p>
          ) : (
            <DetailedPnlStatement lines={detailedPnl.lines} />
          )}
        </div>
      </div>
      )}
    </PageShell>
  )
}
