/**
 * Map Amazon Textract HTTP failures to FMS error codes.
 * Textract often returns AccessDenied / credential errors as HTTP 400 —
 * never treat every 400 as an unreadable image.
 *
 * Safe to import from Node unit tests (pure, no Deno/AWS SDKs).
 */

/**
 * @param {number} status
 * @param {string} [rawType] AWS __type or Code (may be namespaced)
 * @returns {'aws_config_missing'|'unreadable_bill'|'too_large'|'rate_limited'|'textract_unavailable'|'unsupported_file'}
 */
export function classifyTextractHttpError(status, rawType = '') {
  const type = String(rawType || '')
    .replace(/^.*#/, '')
    .replace(/^com\.amazonaws\.textract\./, '')
    .trim()

  if (
    /AccessDenied/i.test(type) ||
    /UnrecognizedClient/i.test(type) ||
    /InvalidSignature/i.test(type) ||
    /IncompleteSignature/i.test(type) ||
    /InvalidClientTokenId/i.test(type) ||
    /AuthFailure/i.test(type) ||
    /ExpiredToken/i.test(type) ||
    /SubscriptionRequired/i.test(type)
  ) {
    return 'aws_config_missing'
  }

  if (/DocumentTooLarge/i.test(type)) return 'too_large'
  if (/ProvisionedThroughputExceeded|Throttling/i.test(type)) return 'rate_limited'

  if (
    /UnsupportedDocument/i.test(type) ||
    /BadDocument/i.test(type)
  ) {
    return 'unreadable_bill'
  }

  // InvalidParameter often means our request shape is wrong (not the photo).
  if (/InvalidParameter/i.test(type)) return 'textract_unavailable'

  if (status >= 500) return 'textract_unavailable'
  if (status === 403) return 'aws_config_missing'
  if (status === 429) return 'rate_limited'
  if (status === 400 || status === 422) {
    // Unknown 400 without a type: prefer unavailable over blaming image quality.
    return type ? 'unreadable_bill' : 'textract_unavailable'
  }

  return 'textract_unavailable'
}

/**
 * Extract AWS error type from a JSON error body without logging message text.
 * @param {unknown} body
 * @returns {string}
 */
export function extractAwsErrorType(body) {
  if (!body || typeof body !== 'object') return ''
  const o = /** @type {Record<string, unknown>} */ (body)
  const raw = o.__type ?? o.Code ?? o.code ?? ''
  return String(raw || '')
}

/**
 * Safe diagnostic counts from a successful AnalyzeExpense body (no field text).
 * @param {unknown} data
 */
export function textractDiagCounts(data) {
  const docs = Array.isArray(/** @type {{ ExpenseDocuments?: unknown }} */ (data)?.ExpenseDocuments)
    ? /** @type {unknown[]} */ (/** @type {{ ExpenseDocuments: unknown[] }} */ (data).ExpenseDocuments)
    : []
  let summaryFields = 0
  let lineItemGroups = 0
  let lineItems = 0
  for (const doc of docs) {
    const d = /** @type {{ SummaryFields?: unknown[]; LineItemGroups?: { LineItems?: unknown[] }[] }} */ (doc)
    summaryFields += Array.isArray(d?.SummaryFields) ? d.SummaryFields.length : 0
    const groups = Array.isArray(d?.LineItemGroups) ? d.LineItemGroups : []
    lineItemGroups += groups.length
    for (const g of groups) {
      lineItems += Array.isArray(g?.LineItems) ? g.LineItems.length : 0
    }
  }
  return {
    expenseDocuments: docs.length,
    summaryFields,
    lineItemGroups,
    lineItems,
  }
}

/** JPEG / PNG magic-byte check (does not decode the image). */
export function sniffImageKind(bytes) {
  if (!bytes || bytes.byteLength < 4) return 'unknown'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  return 'unknown'
}
