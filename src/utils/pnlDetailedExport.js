import { jsPDF } from 'jspdf'
import { formatMoney } from './money.js'
import { APP_GREEN, APP_RED } from './themeColors.js'
import {
  drawPdfReportFooter,
  PDF_REPORT_FOOTER_RESERVE_MM,
  reportFooterCss,
  reportFooterHtml,
} from './reportFooter.js'

/** Light report chrome — clean gray bar for header. */
const CHROME_BG = [241, 245, 249] // #f1f5f9 slate-100
const CHROME_BG_CSS = '#f1f5f9'
const CHROME_LINE = '#94a3b8' // slate-400 — clear header divider
const CHROME_LINE_RGB = [148, 163, 184]
const DEFAULT_DETAILED_TITLE = 'Detailed Profit & Loss report'

/** Hex → [r,g,b] for jsPDF. */
function hexRgb(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return [5, 150, 105]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const BRAND = hexRgb(APP_GREEN)
const BRAND_DARK = [4, 120, 87] // #047857
const INK = [15, 23, 42] // slate-900
const MUTED = [100, 116, 139] // slate-500
const RULE = [226, 232, 240] // slate-200
const ACCENT_LINE = [16, 185, 129] // #10b981
const LOSS = hexRgb(APP_RED)

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function money(n) {
  return formatMoney(n)
}

/** Kaionex-themed print styles — matches overview report branding. */
const DETAILED_PRINT_STYLES = `
  * { box-sizing: border-box; }
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    margin: 0;
    padding: 0;
    color: #0f172a;
    background: #fff;
    font-size: 11pt;
  }
  .report-header {
    background: ${CHROME_BG_CSS};
    color: #0f172a;
    border-bottom: 1px solid ${CHROME_LINE};
    padding: 18px 20px;
    margin-bottom: 16px;
    border-radius: 0 0 8px 8px;
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
    margin: 0 0 6px;
    font-size: 18px;
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
    font-size: 10px;
    color: #334155;
    line-height: 1.45;
    text-align: right;
  }
  .report-meta-period { min-width: 0; text-align: right; }
  .content { padding: 0 20px 0; }
  table.pnl {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2px;
  }
  table.pnl td {
    padding: 3px 6px;
    vertical-align: top;
    border: none;
    color: #0f172a;
  }
  table.pnl td.amt {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    width: 28%;
  }
  tr.header td {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 10pt;
    letter-spacing: 0.04em;
    color: #047857;
    padding-top: 12px;
    padding-bottom: 3px;
    border-bottom: 2px solid #10b981;
  }
  tr.header.empty td {
    padding-top: 8px;
  }
  tr.item td.label { padding-left: 16px; }
  tr.total td {
    font-weight: 600;
    border-top: 1px solid #cbd5e1;
    padding-top: 5px;
  }
  tr.total.empty td {
    padding-top: 2px;
    font-weight: 600;
  }
  tr.result td {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11.5pt;
    color: #047857;
    border-top: 2px solid ${APP_GREEN};
    border-bottom: 3px double ${APP_GREEN};
    padding-top: 8px;
    padding-bottom: 6px;
  }
  tr.result.loss td { color: ${APP_RED}; border-top-color: ${APP_RED}; border-bottom-color: ${APP_RED}; }
  ${reportFooterCss()}
  @media print {
    body { padding: 0; background: #fff; }
    .report-header,
    tr.header td,
    tr.result td,
    .footer {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

function formatSignedAmount(amount) {
  return money(amount)
}

function lineIsEmptySection(lines, index) {
  const line = lines[index]
  if (!line || line.kind !== 'header') return false
  const next = lines[index + 1]
  return next?.kind === 'total'
}

export function buildDetailedPnlHtml({
  title,
  filtersLabel,
  lines,
  generatedAt = new Date(),
}) {
  const list = lines ?? []
  const rows = list
    .map((line, index) => {
      if (line.kind === 'header') {
        const empty = lineIsEmptySection(list, index) ? ' empty' : ''
        return `<tr class="header${empty}"><td colspan="2">${escapeHtml(line.label)}</td></tr>`
      }
      const amt =
        line.amount === null || line.amount === undefined
          ? ''
          : escapeHtml(formatSignedAmount(line.amount))
      const emptyTotal =
        line.kind === 'total' && list[index - 1]?.kind === 'header' ? ' empty' : ''
      const loss =
        line.kind === 'result' && Number(line.amount) < 0 ? ' loss' : ''
      return `<tr class="${escapeHtml(line.kind)}${emptyTotal}${loss}">
        <td class="label">${escapeHtml(line.label)}</td>
        <td class="amt">${amt}</td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title || DEFAULT_DETAILED_TITLE)}</title>
  <style>${DETAILED_PRINT_STYLES}</style>
</head>
<body>
  <header class="report-header">
    <div class="report-header-text">
      <h1 class="report-title">${escapeHtml(title || DEFAULT_DETAILED_TITLE)}</h1>
      <div class="report-meta">
        <span class="report-meta-period">${escapeHtml(filtersLabel || '')}</span>
      </div>
    </div>
  </header>
  <div class="content">
    <table class="pnl">
      <tbody>${rows}</tbody>
    </table>
    ${reportFooterHtml({ generatedAt })}
  </div>
</body>
</html>`
}

export function printDetailedPnl(options) {
  const html = buildDetailedPnlHtml(options)
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

/** A4 Detailed P&L PDF — same statement structure as print. */
export async function downloadDetailedPnlPdf(
  { title, filtersLabel, lines, generatedAt = new Date() } = {},
  filename,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 14
  const contentW = pageW - marginX * 2
  const amtColW = 42
  const labelRight = pageW - marginX - amtColW - 2
  const list = lines ?? []
  const rightX = pageW - marginX

  const footerBarH = PDF_REPORT_FOOTER_RESERVE_MM
  let y = 0

  const drawReportHeader = () => {
    const heading = String(title || DEFAULT_DETAILED_TITLE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    const headingLines = doc.splitTextToSize(heading, contentW)
    const titleY = 12
    const titleLineH = 5.2
    const titleBlockH = Math.max(titleLineH, headingLines.length * titleLineH)
    const metaY0 = titleY + titleBlockH + 1.5
    const periodText = filtersLabel ? String(filtersLabel) : ''
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const periodLines = periodText ? doc.splitTextToSize(periodText, contentW) : []
    const headerBottomPad = 6
    const headerH = Math.max(
      28,
      metaY0 + (periodLines.length ? periodLines.length * 4.2 : 0) + headerBottomPad,
    )

    doc.setFillColor(...CHROME_BG)
    doc.rect(0, 0, pageW, headerH, 'F')
    doc.setDrawColor(...CHROME_LINE_RGB)
    doc.setLineWidth(0.45)
    doc.line(0, headerH, pageW, headerH)

    // Title + period only, right-aligned (branding lives in the footer)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(headingLines, rightX, titleY, { align: 'right' })

    if (periodLines.length) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(51, 65, 85) // slate-700 — period only (Generated is in footer)
      doc.text(periodLines, rightX, metaY0, { align: 'right' })
    }

    y = headerH + 8
  }

  const ensureSpace = (needed = 8) => {
    if (y + needed <= pageH - footerBarH) return
    doc.addPage()
    drawReportHeader()
  }

  const drawHRule = (rgb, thickness = 0.35) => {
    doc.setDrawColor(...rgb)
    doc.setLineWidth(thickness)
    doc.line(marginX, y, pageW - marginX, y)
  }

  drawReportHeader()

  for (let index = 0; index < list.length; index += 1) {
    const line = list[index]
    const kind = line.kind
    const emptySection = lineIsEmptySection(list, index)
    const emptyTotal = kind === 'total' && list[index - 1]?.kind === 'header'
    const amtText =
      line.amount === null || line.amount === undefined
        ? ''
        : formatSignedAmount(line.amount)
    const isLossResult = kind === 'result' && Number(line.amount) < 0

    if (kind === 'header') {
      ensureSpace(emptySection ? 10 : 12)
      y += emptySection ? 2 : 3
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...BRAND_DARK)
      doc.text(String(line.label || '').toUpperCase(), marginX, y)
      y += 1.8
      drawHRule(ACCENT_LINE, 0.55)
      y += 4
      continue
    }

    if (kind === 'result') {
      ensureSpace(14)
      y += 2
      drawHRule(isLossResult ? LOSS : BRAND, 0.7)
      y += 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...(isLossResult ? LOSS : BRAND_DARK))
      doc.text(String(line.label || '').toUpperCase(), marginX, y, {
        maxWidth: labelRight - marginX,
      })
      if (amtText) {
        doc.text(amtText, pageW - marginX, y, { align: 'right' })
      }
      y += 2.2
      drawHRule(isLossResult ? LOSS : BRAND, 0.7)
      y += 0.9
      drawHRule(isLossResult ? LOSS : BRAND, 0.3)
      y += 6
      continue
    }

    // item / total
    ensureSpace(emptyTotal ? 6 : 8)
    if (kind === 'total') {
      drawHRule(RULE, 0.35)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
    }
    doc.setTextColor(...INK)

    const labelX = kind === 'item' ? marginX + 5 : marginX
    const label = String(line.label || '')
    const wrapped = doc.splitTextToSize(label, labelRight - labelX)
    doc.text(wrapped, labelX, y)
    if (amtText) {
      doc.text(amtText, pageW - marginX, y, { align: 'right' })
    }
    y += Math.max(4.5, wrapped.length * 4.2)
  }

  // Thin rule + three-column footer on each page (brand | page | generated)
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p)
    drawPdfReportFooter(doc, {
      page: p,
      pageCount,
      generatedAt,
      marginX,
    })
  }

  const name =
    filename || `detailed-pnl_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(name)
}
