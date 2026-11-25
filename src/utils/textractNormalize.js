/**
 * Normalize Amazon Textract AnalyzeExpense JSON into a stable FMS shape.
 * Keep in sync with supabase/functions/analyze-bill/normalize.js
 */

const SUMMARY_MAP = {
  VENDOR_NAME: 'vendor',
  NAME: 'vendor',
  INVOICE_RECEIPT_ID: 'invoiceNumber',
  INVOICE_RECEIPT_DATE: 'date',
  ORDER_DATE: 'date',
  DELIVERY_DATE: 'date',
  SUBTOTAL: 'subtotal',
  TAX: 'tax',
  TOTAL_TAX: 'tax',
  TAX_PAYER_ID: null,
  TOTAL: 'total',
  AMOUNT_PAID: 'total',
  GRAND_TOTAL: 'total',
}

const LINE_MAP = {
  ITEM: 'description',
  PRODUCT_CODE: 'description',
  QUANTITY: 'quantity',
  UNIT_PRICE: 'unitPrice',
  PRICE: 'amount',
  EXPENSE_ROW: null,
}

export const LOW_CONFIDENCE_THRESHOLD = 70

export function emptyField() {
  return { value: null, confidence: null }
}

function asConfidence(n) {
  if (n == null || Number.isNaN(Number(n))) return null
  return Math.round(Number(n) * 100) / 100
}

function parseMoney(raw) {
  if (raw == null || raw === '') return null
  let s = String(raw).trim()
  if (!s) return null
  s = s.replace(/[^\d.,\-]/g, '')
  if (!s || s === '-' || s === '.' || s === ',') return null
  if (/\.\d{3},\d{2}$/.test(s) || /^\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/,\d{3}\.\d{2}$/.test(s) || /^\d{1,3}(,\d{3})+\.\d{2}$/.test(s)) {
    s = s.replace(/,/g, '')
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseQuantity(raw) {
  if (raw == null || raw === '') return null
  const n = Number(String(raw).replace(/[^\d.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Best-effort ISO date from Textract date strings. */
export function parseExpenseDate(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  let m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
  if (m) {
    const iso = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
    if (!Number.isNaN(Date.parse(`${iso}T00:00:00`))) return iso
  }

  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = m[3]
    let day = d
    let month = mo
    if (d > 12 && mo <= 12) {
      day = d
      month = mo
    } else if (mo > 12 && d <= 12) {
      day = mo
      month = d
    } else {
      day = d
      month = mo
    }
    const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (!Number.isNaN(Date.parse(`${iso}T00:00:00`))) return iso
  }

  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    const dt = new Date(t)
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
  }
  return s.slice(0, 40)
}

function fieldFromSummary(summaryField, kind) {
  const valueDet = summaryField?.ValueDetection ?? {}
  const typeConf = summaryField?.Type?.Confidence
  const conf = asConfidence(valueDet.Confidence ?? typeConf)
  const raw = valueDet.Text ?? null
  if (raw == null || String(raw).trim() === '') {
    return emptyField()
  }

  if (kind === 'vendor' || kind === 'invoiceNumber') {
    return { value: String(raw).trim().slice(0, 200), confidence: conf }
  }
  if (kind === 'date') {
    return { value: parseExpenseDate(raw), confidence: conf }
  }
  return { value: parseMoney(raw), confidence: conf }
}

function pickBetter(current, next) {
  if (!next || next.value == null) return current
  if (!current || current.value == null) return next
  const c = current.confidence ?? 0
  const n = next.confidence ?? 0
  return n >= c ? next : current
}

function summarizeLineItem(fields) {
  const out = {
    description: null,
    quantity: null,
    unitPrice: null,
    amount: null,
    confidence: null,
  }
  const confs = []
  for (const f of fields ?? []) {
    const type = String(f?.Type?.Text ?? '').toUpperCase()
    const key = LINE_MAP[type]
    if (!key) continue
    const text = f?.ValueDetection?.Text
    const conf = asConfidence(f?.ValueDetection?.Confidence ?? f?.Type?.Confidence)
    if (conf != null) confs.push(conf)
    if (key === 'description') {
      const v = text != null ? String(text).trim().slice(0, 200) : null
      if (v) out.description = out.description ? `${out.description} ${v}`.trim().slice(0, 200) : v
    } else if (key === 'quantity') {
      out.quantity = parseQuantity(text)
    } else if (key === 'unitPrice' || key === 'amount') {
      out[key] = parseMoney(text)
    }
  }
  out.confidence = confs.length ? Math.round((confs.reduce((a, b) => a + b, 0) / confs.length) * 100) / 100 : null
  if (
    out.description == null &&
    out.quantity == null &&
    out.unitPrice == null &&
    out.amount == null
  ) {
    return null
  }
  return out
}

/**
 * @param {unknown} textractResponse AnalyzeExpense response body
 */
export function normalizeAnalyzeExpense(textractResponse) {
  const result = {
    vendor: emptyField(),
    invoiceNumber: emptyField(),
    date: emptyField(),
    subtotal: emptyField(),
    tax: emptyField(),
    total: emptyField(),
    lineItems: [],
  }

  if (!textractResponse || typeof textractResponse !== 'object') {
    return { ...result, hasUsefulFields: false }
  }

  const docs = Array.isArray(textractResponse.ExpenseDocuments)
    ? textractResponse.ExpenseDocuments
    : []

  for (const doc of docs) {
    for (const sf of doc?.SummaryFields ?? []) {
      const type = String(sf?.Type?.Text ?? '').toUpperCase()
      const mapped = SUMMARY_MAP[type]
      if (!mapped) continue
      result[mapped] = pickBetter(result[mapped], fieldFromSummary(sf, mapped))
    }

    for (const group of doc?.LineItemGroups ?? []) {
      for (const line of group?.LineItems ?? []) {
        const item = summarizeLineItem(line?.LineItemExpenseFields)
        if (item) result.lineItems.push(item)
      }
    }
  }

  // Missing vendor / invoice / tax / line items is OK — TOTAL or DATE alone is useful.
  // Only report no useful fields when the response is genuinely empty of mapped values.
  const hasUsefulFields = Boolean(
    result.vendor.value != null ||
      result.invoiceNumber.value != null ||
      result.date.value != null ||
      result.subtotal.value != null ||
      result.tax.value != null ||
      result.total.value != null ||
      result.lineItems.length > 0,
  )

  return { ...result, hasUsefulFields }
}

export function isLowConfidence(field, threshold = LOW_CONFIDENCE_THRESHOLD) {
  if (!field || field.value == null) return false
  if (field.confidence == null) return true
  return field.confidence < threshold
}

/** Map normalized OCR into Add Entry form patches (never sets entry type). */
export function mapNormalizedToEntryFields(normalized) {
  const patch = {}
  const warnings = []

  const vendor = normalized?.vendor?.value ? String(normalized.vendor.value).trim() : ''
  const invoice = normalized?.invoiceNumber?.value
    ? String(normalized.invoiceNumber.value).trim()
    : ''

  // Description: vendor and/or invoice only when present and non-empty (safe, truncated).
  if (vendor && invoice) {
    patch.description = `${vendor} · Inv ${invoice}`.slice(0, 160)
    if (isLowConfidence(normalized.vendor) || isLowConfidence(normalized.invoiceNumber)) {
      warnings.push('description')
    }
  } else if (vendor) {
    patch.description = vendor.slice(0, 160)
    if (isLowConfidence(normalized.vendor)) warnings.push('vendor')
  } else if (invoice) {
    patch.description = `Invoice ${invoice}`.slice(0, 160)
    if (isLowConfidence(normalized.invoiceNumber)) warnings.push('invoiceNumber')
  }

  if (normalized?.total?.value != null && Number(normalized.total.value) > 0) {
    patch.amount = String(normalized.total.value)
    if (isLowConfidence(normalized.total)) warnings.push('total')
  } else if (normalized?.subtotal?.value != null && Number(normalized.subtotal.value) > 0) {
    patch.amount = String(normalized.subtotal.value)
    if (isLowConfidence(normalized.subtotal)) warnings.push('subtotal')
  }
  if (normalized?.date?.value && /^\d{4}-\d{2}-\d{2}$/.test(String(normalized.date.value))) {
    patch.entry_date = String(normalized.date.value)
    if (isLowConfidence(normalized.date)) warnings.push('date')
  }

  return { patch, warnings }
}
