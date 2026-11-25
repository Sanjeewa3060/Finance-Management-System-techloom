/** Friendly error mapping for analyze-bill (pure — safe for Node unit tests). */

export const ANALYZE_BILL_FRIENDLY = {
  unsupported_file: 'Only JPEG and PNG images are supported for bill scanning.',
  too_large: 'That image is too large. Please use a file under 4.5 MB.',
  missing_file: 'Please choose a bill or receipt image to scan.',
  unauthorized: 'You must be signed in to scan bills.',
  textract_unavailable: 'Bill scanning is temporarily unavailable. Try again later.',
  aws_config_missing: 'Bill scanning is not configured yet. Contact your Techloom admin.',
  unreadable_bill: 'We could not read that bill. Try a clearer photo.',
  no_useful_fields: 'No usable fields were found on that bill. Enter the entry manually.',
  network_failure: 'Network error while scanning. Check your connection and try again.',
  rate_limited: 'Too many scan requests. Please wait a few minutes and try again.',
  forbidden_department: 'You do not have access to scan bills for that department.',
  bad_request: 'Invalid scan request.',
}

export function friendlyMessageForCode(code) {
  return ANALYZE_BILL_FRIENDLY[code] || ANALYZE_BILL_FRIENDLY.textract_unavailable
}

/**
 * Prefer Edge Function error.code → differentiated friendly text.
 * Never collapse auth / config / network into the "clearer photo" message.
 */
export function mapAnalyzeBillHttpError(payload, status) {
  const code = payload?.error?.code
  if (code && ANALYZE_BILL_FRIENDLY[code]) {
    const e = new Error(payload?.error?.message || ANALYZE_BILL_FRIENDLY[code])
    e.code = code
    e.status = status
    return e
  }
  if (payload?.error?.message) {
    const e = new Error(payload.error.message)
    e.code = code || 'textract_unavailable'
    e.status = status
    return e
  }
  if (status === 401) {
    return Object.assign(new Error(ANALYZE_BILL_FRIENDLY.unauthorized), { code: 'unauthorized' })
  }
  if (status === 403) {
    return Object.assign(new Error(ANALYZE_BILL_FRIENDLY.forbidden_department), {
      code: 'forbidden_department',
    })
  }
  if (status === 429) {
    return Object.assign(new Error(ANALYZE_BILL_FRIENDLY.rate_limited), { code: 'rate_limited' })
  }
  if (status === 503) {
    return Object.assign(new Error(ANALYZE_BILL_FRIENDLY.aws_config_missing), {
      code: 'aws_config_missing',
    })
  }
  if (status >= 500) {
    return Object.assign(new Error(ANALYZE_BILL_FRIENDLY.textract_unavailable), {
      code: 'textract_unavailable',
    })
  }
  return Object.assign(new Error(ANALYZE_BILL_FRIENDLY.network_failure), { code: 'network_failure' })
}
