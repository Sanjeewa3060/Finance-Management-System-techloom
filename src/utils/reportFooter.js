/** Shared Kaionex / Techloom report footer — matches PDF mock layout. */

export const REPORT_FOOTER_BRAND = 'KAIONEX FMS Powered by Techloom.ai'

/** Medium gray used for footer rule + text (#6c757d). */
export const REPORT_FOOTER_GRAY = '#6c757d'
export const REPORT_FOOTER_GRAY_RGB = [108, 117, 125]
export const REPORT_FOOTER_RULE_RGB = [180, 186, 192]

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * e.g. "Generated 21 Oct 2026, 2:02 pm"
 * Day unpadded, hour unpadded, lowercase am/pm, comma after year.
 */
export function formatReportGeneratedAt(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return 'Generated —'
  const day = d.getDate()
  const month = MONTHS_SHORT[d.getMonth()]
  const year = d.getFullYear()
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12
  if (hours === 0) hours = 12
  return `Generated ${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`
}

export function formatReportPageLabel(page, pageCount) {
  return `Page ${page} of ${pageCount}`
}

/** CSS for the three-column report footer (HTML print / download). */
export function reportFooterCss() {
  return `
  .footer {
    margin: 22px 0 0;
    padding: 10px 0 12px;
    background: transparent;
    border-top: 1px solid #b4bac0;
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 9pt;
    font-weight: 400;
    color: ${REPORT_FOOTER_GRAY};
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    column-gap: 12px;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .footer-brand {
    text-align: left;
    justify-self: start;
  }
  .footer-page {
    text-align: center;
    justify-self: center;
    white-space: nowrap;
  }
  .footer-generated {
    text-align: right;
    justify-self: end;
    white-space: nowrap;
  }
  @media print {
    .footer {
      margin: 18px 0 0;
      padding: 8px 0 10px;
    }
  }
`
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * Three-column footer markup.
 * @param {{ generatedAt?: Date, pageLabel?: string }} [options]
 * pageLabel: when known (e.g. PDF), pass "Page N of M"; HTML print may omit.
 */
export function reportFooterHtml({ generatedAt = new Date(), pageLabel = '' } = {}) {
  return `<div class="footer">
      <span class="footer-brand">${escapeHtml(REPORT_FOOTER_BRAND)}</span>
      <span class="footer-page">${escapeHtml(pageLabel)}</span>
      <span class="footer-generated">${escapeHtml(formatReportGeneratedAt(generatedAt))}</span>
    </div>`
}

/**
 * Draw the thin rule + three-column footer on the current jsPDF page.
 * Reserve ~16mm at the bottom of each page for this footer.
 */
export function drawPdfReportFooter(doc, {
  page,
  pageCount,
  generatedAt = new Date(),
  marginX = 14,
} = {}) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const lineY = pageH - 14
  const textY = pageH - 8

  doc.setDrawColor(...REPORT_FOOTER_RULE_RGB)
  doc.setLineWidth(0.25)
  doc.line(marginX, lineY, pageW - marginX, lineY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...REPORT_FOOTER_GRAY_RGB)

  doc.text(REPORT_FOOTER_BRAND, marginX, textY, { align: 'left' })
  doc.text(formatReportPageLabel(page, pageCount), pageW / 2, textY, { align: 'center' })
  doc.text(formatReportGeneratedAt(generatedAt), pageW - marginX, textY, { align: 'right' })
}

/** Vertical space (mm) to keep clear above the PDF page bottom for the footer. */
export const PDF_REPORT_FOOTER_RESERVE_MM = 16
