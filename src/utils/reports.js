import { formatMoney } from './money.js'
import { formatEntryTime } from './dates.js'
import { formatTransactionTypeLabel, isOtherExpense, transactionTypeCssClass } from './entryTypes.js'
import { APP_RED, APP_GREEN } from './themeColors.js'
import { reportFooterCss, reportFooterHtml } from './reportFooter.js'

/** Light report chrome — clean gray bar for header. */
const CHROME_BG = '#f1f5f9' // slate-100
const CHROME_LINE = '#94a3b8' // slate-400 — clear header divider

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function money(n) {
  return formatMoney(n)
}

function profitClass(n) {
  return Number(n) >= 0 ? 'positive' : 'negative'
}

function tableSection(title, headHtml, bodyHtml, emptyColspan) {
  if (!bodyHtml) return ''
  return `
    <h2>${escapeHtml(title)}</h2>
    <table class="report-table">
      <thead><tr>${headHtml}</tr></thead>
      <tbody>${bodyHtml || `<tr><td colspan="${emptyColspan}" class="empty">No data</td></tr>`}</tbody>
    </table>`
}

function departmentRows(departmentAggregates) {
  return (departmentAggregates ?? [])
    .map(
      (d) => `<tr>
        <td>${escapeHtml(d.department_name)}</td>
        <td class="num">${d.entries ?? '—'}</td>
        <td class="num revenue">${money(d.revenue)}</td>
        <td class="num costs">${money(d.costs)}</td>
        <td class="num ${profitClass(d.netProfit)}">${money(d.netProfit)}</td>
        <td class="num">${d.profitMargin.toFixed(1)}%</td>
      </tr>`,
    )
    .join('')
}

function dailyRows(dailyAggregates) {
  return (dailyAggregates ?? [])
    .map(
      (d) => `<tr>
        <td>${escapeHtml(d.date)}</td>
        <td class="num">${d.entries}</td>
        <td class="num revenue">${money(d.revenue)}</td>
        <td class="num costs">${money(d.costs)}</td>
        <td class="num ${profitClass(d.netProfit)}">${money(d.netProfit)}</td>
      </tr>`,
    )
    .join('')
}

function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey.length < 7) return monthKey ?? '—'
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

function monthlyRows(monthlyAggregates) {
  return (monthlyAggregates ?? [])
    .map(
      (m) => `<tr>
        <td>${escapeHtml(formatMonthLabel(m.month))}</td>
        <td class="num revenue">${money(m.revenue)}</td>
        <td class="num costs">${money(m.costs)}</td>
        <td class="num ${profitClass(m.netProfit)}">${money(m.netProfit)}</td>
      </tr>`,
    )
    .join('')
}

function companyRows(companyAggregates) {
  return (companyAggregates ?? [])
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.company_label || c.company_name)}</td>
        <td class="num">${c.entries ?? '—'}</td>
        <td class="num revenue">${money(c.revenue)}</td>
        <td class="num costs">${money(c.costs)}</td>
        <td class="num ${profitClass(c.netProfit)}">${money(c.netProfit)}</td>
      </tr>`,
    )
    .join('')
}

function transactionRows(transactions, deptById) {
  return (transactions ?? [])
    .map(
      (t) => `<tr>
        <td>${escapeHtml(t.entry_date)}</td>
        <td>${escapeHtml(deptById.get(t.department_id) ?? 'Unknown')}</td>
        <td class="${transactionTypeCssClass(t)}">${escapeHtml(formatTransactionTypeLabel(t))}</td>
        <td>${escapeHtml(t.category)}</td>
        <td>${escapeHtml(t.description || '—')}</td>
        <td class="num">${money(t.amount)}</td>
      </tr>`,
    )
    .join('')
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    margin: 0;
    padding: 0;
    color: #0f172a;
    background: #f8fafc;
    font-size: 12px;
  }
  .report-header {
    background: ${CHROME_BG};
    color: #0f172a;
    border-bottom: 1px solid ${CHROME_LINE};
    padding: 24px 28px;
    margin-bottom: 24px;
    text-align: right;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-header-text {
    min-width: 0;
    width: 100%;
    text-align: right;
  }
  .report-title {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #0f172a;
    text-align: right;
  }
  .report-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    margin: 0;
    width: 100%;
    font-size: 11px;
    color: #334155;
    line-height: 1.45;
    text-align: right;
  }
  .report-meta-period { min-width: 0; text-align: right; }
  .content { padding: 0 28px 28px; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .summary-card {
    border-radius: 10px;
    padding: 14px 16px;
    background: #fff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
  .summary-card strong {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    margin-bottom: 6px;
  }
  .summary-card .value {
    font-size: 20px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .card-revenue { border-left: 5px solid #10b981; }
  .card-revenue .value { color: #059669; }
  .card-costs { border-left: 5px solid #f59e0b; }
  .card-costs .value { color: #d97706; }
  .card-profit { border-left: 5px solid #3b82f6; }
  .card-profit .value.positive { color: ${APP_GREEN}; }
  .card-profit .value.negative { color: ${APP_RED}; }
  .card-margin { border-left: 5px solid #8b5cf6; }
  .card-margin .value { color: #7c3aed; }
  h2 {
    margin: 22px 0 10px;
    font-size: 14px;
    font-weight: 700;
    color: #047857;
    padding-bottom: 6px;
    border-bottom: 2px solid #10b981;
  }
  .report-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
  .report-table th,
  .report-table td {
    border: 1px solid #e2e8f0;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  .report-table thead th {
    background: #059669;
    color: #fff;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-color: #059669;
  }
  .report-table tbody tr:nth-child(even) { background: #f1f5f9; }
  .report-table tbody td { color: #0f172a; background: #fff; }
  .report-table tbody tr:nth-child(even) td { background: #f8fafc; }
  .report-table .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .report-table .empty {
    text-align: center;
    color: #64748b;
  }
  .revenue { color: ${APP_GREEN}; font-weight: 600; }
  .costs { color: ${APP_RED}; font-weight: 600; }
  .positive { color: ${APP_GREEN}; font-weight: 700; }
  .negative { color: ${APP_RED}; font-weight: 700; }
  .type-sale { color: ${APP_GREEN}; font-weight: 600; text-transform: capitalize; }
  .type-purchase { color: ${APP_RED}; font-weight: 600; text-transform: capitalize; }
  .type-expense { color: ${APP_RED}; font-weight: 600; text-transform: capitalize; }
  .type-other-profit { color: ${APP_GREEN}; font-weight: 600; text-transform: capitalize; }
  .type-other-expense { color: ${APP_RED}; font-weight: 600; text-transform: capitalize; }
  .type-other { color: ${APP_RED}; font-weight: 600; text-transform: capitalize; }
  ${reportFooterCss()}
  @media print {
    body { background: #fff; }
    .report-header,
    .report-table thead th,
    .summary-card,
    .card-revenue,
    .card-costs,
    .card-profit,
    .card-margin,
    .report-table tbody tr:nth-child(even),
    .revenue,
    .costs,
    .positive,
    .negative,
    h2,
    .footer {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .content { padding: 0 12mm 0; }
  }
`

/** Builds the same full report for printing and downloading. */
export function buildOverviewReportHtml({
  title,
  totals,
  departmentAggregates,
  companyAggregates,
  dailyAggregates,
  monthlyAggregates,
  transactions,
  departments,
  filtersLabel,
}) {
  const deptById = new Map((departments ?? []).map((d) => [d.id, d.name?.trim() || d.email || 'Unknown']))

  const summaryCards = `
    <div class="summary-grid">
      <div class="summary-card card-revenue">
        <strong>Revenue (Sales)</strong>
        <div class="value">${money(totals.revenue)}</div>
      </div>
      <div class="summary-card card-revenue">
        <strong>Other income</strong>
        <div class="value">${money(totals.otherIncome ?? 0)}</div>
      </div>
      <div class="summary-card card-costs">
        <strong>Costs</strong>
        <div class="value">${money(totals.costs)}</div>
      </div>
      <div class="summary-card card-profit">
        <strong>Net profit</strong>
        <div class="value ${profitClass(totals.netProfit)}">${money(totals.netProfit)}</div>
      </div>
      <div class="summary-card card-margin">
        <strong>Margin</strong>
        <div class="value">${totals.profitMargin.toFixed(1)}%</div>
      </div>
    </div>`

  const companySection = companyAggregates?.length
    ? tableSection(
        'By department',
        '<th>Department</th><th>Entries</th><th>Revenue</th><th>Costs</th><th>Net profit</th>',
        companyRows(companyAggregates),
        5,
      )
    : ''

  const deptSection = departmentAggregates?.length
    ? tableSection(
        'Department breakdown',
        '<th>Department</th><th>Entries</th><th>Revenue</th><th>Costs</th><th>Net profit</th><th>Margin</th>',
        departmentRows(departmentAggregates),
        6,
      )
    : ''

  const monthlySection =
    (monthlyAggregates?.length ?? 0) > 1
      ? tableSection(
          'By month',
          '<th>Month</th><th>Revenue</th><th>Costs</th><th>Net profit</th>',
          monthlyRows(monthlyAggregates),
          4,
        )
      : ''

  const dailySection = dailyAggregates?.length
    ? tableSection(
        'By day',
        '<th>Date</th><th>Entries</th><th>Revenue</th><th>Costs</th><th>Net profit</th>',
        dailyRows(dailyAggregates),
        5,
      )
    : ''

  const txSection = transactions?.length
    ? tableSection(
        'Transaction details',
        '<th>Date</th><th>Department</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th>',
        transactionRows(transactions, deptById),
        6,
      )
    : ''

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)} — KAIONEX POS</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <header class="report-header">
    <div class="report-header-text">
      <h1 class="report-title">${escapeHtml(title)}</h1>
      <div class="report-meta">
        <span class="report-meta-period">${escapeHtml(filtersLabel || 'All data')}</span>
      </div>
    </div>
  </header>
  <div class="content">
    ${summaryCards}
    ${companySection}
    ${deptSection}
    ${monthlySection}
    ${dailySection}
    ${txSection}
    ${reportFooterHtml({ generatedAt: new Date() })}
  </div>
</body>
</html>`

  return html
}

export function downloadOverviewReport(options, filename = 'report.html') {
  const blob = new Blob([buildOverviewReportHtml(options)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens a colourful print-ready report in a new window. */
export function exportOverviewReport(options) {
  const html = buildOverviewReportHtml(options)
  const win = window.open('', '_blank')
  if (!win) {
    window.alert('Please allow pop-ups to print the report.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

export function exportTransactionsCsv(transactions, departments, filenamePrefix = 'transactions') {
  const deptById = new Map((departments ?? []).map((d) => [d.id, d.name]))
  const headers = ['Date', 'Time added', 'Department', 'Type', 'Category', 'Description', 'Amount']
  const rows = (transactions ?? []).map((t) => [
    t.entry_date,
    formatEntryTime(t.created_at),
    deptById.get(t.department_id) ?? 'Unknown',
    formatTransactionTypeLabel(t),
    t.category,
    t.description ?? '',
    Number(t.amount ?? 0).toFixed(2),
  ])
  const escapeCsv = (value) => {
    const s = String(value ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`
    return s
  }
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function computeTopCategories(transactions, limit = 8) {
  const byCat = new Map()
  for (const t of transactions ?? []) {
    const isCost =
      t.type === 'expense' ||
      t.type === 'purchase' ||
      (t.type === 'other' && isOtherExpense(t))
    if (!isCost) continue
    const key = t.category || 'Other'
    byCat.set(key, (byCat.get(key) ?? 0) + Number(t.amount ?? 0))
  }
  return Array.from(byCat.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}
