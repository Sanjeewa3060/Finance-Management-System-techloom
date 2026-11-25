import { formatTaxAmount } from './taxComputation.js'

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export const TAX_REPORT_PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Calibri, 'Segoe UI', sans-serif;
    margin: 0;
    padding: 24px 32px;
    color: #000;
    background: #fff;
    font-size: 13px;
    line-height: 1.35;
  }
  .tax-doc { max-width: 920px; margin: 0 auto; }
  .tax-yoa {
    font-weight: 700;
    text-decoration: underline;
    margin: 0 0 8px;
    font-size: 14px;
  }
  .tax-title {
    font-weight: 700;
    margin: 0 0 4px;
    font-size: 14px;
  }
  .tax-currency-note {
    margin: 0 0 20px;
    font-size: 13px;
  }
  .tax-computation { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  .tax-computation td { vertical-align: top; padding: 2px 0; }
  .tax-computation .col-label { width: 55%; padding-right: 16px; }
  .tax-computation .col-detail {
    width: 22%;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    padding-right: 8px;
  }
  .tax-computation .col-main {
    width: 23%;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .tax-computation .section-head { font-weight: 700; padding-top: 8px; }
  .tax-computation .sub-item .col-label { padding-left: 24px; }
  .tax-computation .detail-underline .col-detail {
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
  }
  .tax-computation .emphasis-row .col-label { font-weight: 700; }
  .tax-computation .main-line .col-main {
    border-top: 1px solid #000;
    padding-top: 4px;
    font-weight: 700;
  }
  .tax-computation .final-main .col-main {
    border-top: 1px solid #000;
    border-bottom: 3px double #000;
    padding-top: 4px;
    padding-bottom: 2px;
    font-weight: 700;
  }
  .tax-computation .balance-row .col-label { font-weight: 700; }
  .tax-computation .balance-row .col-main {
    border-top: 1px solid #000;
    border-bottom: 3px double #000;
    padding-top: 4px;
    padding-bottom: 2px;
    font-weight: 700;
  }
  .tax-computation .deduction .col-label { text-decoration: underline; }
  .tax-apportion-title {
    font-weight: 700;
    margin: 0 0 8px;
    font-size: 13px;
  }
  .tax-apportion {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .tax-apportion th,
  .tax-apportion td {
    border: 1px solid #000;
    padding: 4px 8px;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }
  .tax-apportion th {
    font-weight: 700;
    background: #fff;
    text-decoration: underline;
  }
  .tax-apportion th.center { text-align: center; }
  .tax-apportion .num { text-align: right; white-space: nowrap; }
  .tax-apportion .totals-row td {
    font-weight: 700;
    border-top: 1px solid #000;
    border-bottom: 3px double #000;
  }
  .tax-document-preview {
    overflow-x: auto;
    padding: 16px;
    border-radius: 0.75rem;
  }
  @media print {
    body { padding: 12mm 15mm; }
    @page { size: A4 portrait; margin: 12mm 15mm; }
  }
`

export function buildTaxReportHtml(report) {
  const { settings, disallowableLines, apportionment } = report
  const currencyNote = `(All amounts are stated in ${escapeHtml(settings.currency_label)})`
  const headerLine = report.periodLabel
    ? `PERIOD: ${escapeHtml(report.periodLabel)}`
    : `YEAR OF ASSESSMENT: ${escapeHtml(report.range?.label ?? '')}`

  const activeDisallowLines = (disallowableLines ?? []).filter((line) => line.amount > 0)
  const showDisallowable = activeDisallowLines.length > 0 || report.disallowableTotal > 0

  const disallowRows = activeDisallowLines
    .map(
      (line, index) => `
    <tr class="sub-item${index === activeDisallowLines.length - 1 ? ' detail-underline' : ''}">
      <td class="col-label">${escapeHtml(line.label)}</td>
      <td class="col-detail">${formatTaxAmount(line.amount)}</td>
      <td class="col-main"></td>
    </tr>`,
    )
    .join('')

  const disallowableBlock = showDisallowable
    ? `
        <tr>
          <td class="col-label section-head" colspan="3">Add: Disallowable expenses</td>
        </tr>
        ${disallowRows}
        <tr class="main-line">
          <td class="col-label"></td>
          <td class="col-detail"></td>
          <td class="col-main">${formatTaxAmount(report.disallowableTotal)}</td>
        </tr>`
    : ''

  const taxFreeRow =
    report.taxFreeAllowance > 0
      ? `
        <tr class="deduction">
          <td class="col-label">Less: Partnership tax free allowance</td>
          <td class="col-detail"></td>
          <td class="col-main">${formatTaxAmount(report.taxFreeAllowance, { parenthesesForNegative: true })}</td>
        </tr>`
      : ''

  const taxPaidRow =
    report.taxPaid > 0
      ? `
        <tr class="deduction">
          <td class="col-label">Less: Tax paid</td>
          <td class="col-detail"></td>
          <td class="col-main">${formatTaxAmount(report.taxPaid, { parenthesesForNegative: true })}</td>
        </tr>`
      : ''

  const apportionSection =
    apportionment?.rows?.length > 0
      ? `
    <p class="tax-apportion-title">Apportionment of divisible income &amp; partnership tax</p>
    <table class="tax-apportion">
      <thead>
        <tr>
          <th rowspan="2">Name</th>
          <th rowspan="2">Share</th>
          <th colspan="3" class="center">Divisible income</th>
          <th rowspan="2" class="num">Partnership tax</th>
        </tr>
        <tr>
          <th class="num">1st Period</th>
          <th class="num">2nd Period</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${apportionment.rows
          .map(
            (row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.share)}</td>
          <td class="num">${formatTaxAmount(row.firstPeriod)}</td>
          <td class="num">${formatTaxAmount(row.secondPeriod)}</td>
          <td class="num">${formatTaxAmount(row.total)}</td>
          <td class="num">${formatTaxAmount(row.partnershipTax)}</td>
        </tr>`,
          )
          .join('')}
        <tr class="totals-row">
          <td colspan="2"></td>
          <td class="num">${formatTaxAmount(apportionment.totals.firstPeriod)}</td>
          <td class="num">${formatTaxAmount(apportionment.totals.secondPeriod)}</td>
          <td class="num">${formatTaxAmount(apportionment.totals.divisibleIncome)}</td>
          <td class="num">${formatTaxAmount(apportionment.totals.partnershipTax)}</td>
        </tr>
      </tbody>
    </table>`
      : ''

  return `
  <div class="tax-doc">
    <p class="tax-yoa">${headerLine}</p>
    <p class="tax-title">INCOME TAX COMPUTATION</p>
    <p class="tax-currency-note">${currencyNote}</p>

    <table class="tax-computation">
      <tbody>
        <tr>
          <td class="col-label">Net income for the year</td>
          <td class="col-detail"></td>
          <td class="col-main">${formatTaxAmount(report.netIncome)}</td>
        </tr>
        ${disallowableBlock}
        <tr class="emphasis-row main-line">
          <td class="col-label">DIVISIBLE INCOME</td>
          <td class="col-detail"></td>
          <td class="col-main">${formatTaxAmount(report.divisibleIncome)}</td>
        </tr>
        ${taxFreeRow}
        <tr class="emphasis-row final-main">
          <td class="col-label">TAXABLE INCOME</td>
          <td class="col-detail"></td>
          <td class="col-main">${formatTaxAmount(report.taxableIncome)}</td>
        </tr>
        <tr>
          <td class="col-label">Partnership tax payable @ ${escapeHtml(String(report.taxRatePercent))}%</td>
          <td class="col-detail"></td>
          <td class="col-main">${formatTaxAmount(report.partnershipTax)}</td>
        </tr>
        ${taxPaidRow}
        <tr class="balance-row">
          <td class="col-label">Balance tax payable</td>
          <td class="col-detail"></td>
          <td class="col-main">${formatTaxAmount(report.balanceTaxPayable)}</td>
        </tr>
      </tbody>
    </table>

    ${apportionSection}
  </div>`
}

export function exportTaxComputationReport(report) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Income Tax Computation ${escapeHtml(report.periodLabel ?? report.range?.label ?? '')}</title>
  <style>${TAX_REPORT_PRINT_STYLES}</style>
</head>
<body>
  ${buildTaxReportHtml(report)}
</body>
</html>`

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
