import { supabaseAnonKeyValue, supabaseUrlValue } from '../lib/supabase.js'
import { getCurrentSessionId } from './sessions.js'
import {
  BILL_SCAN_MAX_BYTES,
  BILL_SCAN_TYPES,
  validateBillScanFile,
} from './billScanValidation.js'
import {
  ANALYZE_BILL_FRIENDLY,
  friendlyMessageForCode,
  mapAnalyzeBillHttpError,
} from './analyzeBillErrors.js'

export { BILL_SCAN_MAX_BYTES, BILL_SCAN_TYPES, validateBillScanFile }
export { friendlyMessageForCode, mapAnalyzeBillHttpError, ANALYZE_BILL_FRIENDLY }

/**
 * Call Supabase Edge Function analyze-bill (Amazon Textract AnalyzeExpense).
 * Never sends AWS credentials. Uses custom FMS session headers (not supabase.auth).
 *
 * @returns {{ fields: object, source: string }}
 */
export async function analyzeBill(file, { authUser, departmentId } = {}) {
  validateBillScanFile(file)

  if (!supabaseUrlValue || !supabaseAnonKeyValue) {
    const e = new Error('Database is not configured.')
    e.code = 'aws_config_missing'
    throw e
  }

  const userId = authUser?.id
  const userRole = authUser?.role
  const sessionId = getCurrentSessionId()

  if (!userId || !userRole || !sessionId) {
    const e = new Error(ANALYZE_BILL_FRIENDLY.unauthorized)
    e.code = 'unauthorized'
    throw e
  }

  const url = `${supabaseUrlValue.replace(/\/$/, '')}/functions/v1/analyze-bill`
  const form = new FormData()
  form.append('file', file, file.name || 'bill.jpg')

  const headers = {
    Authorization: `Bearer ${supabaseAnonKeyValue}`,
    apikey: supabaseAnonKeyValue,
    'x-fms-session-id': sessionId,
    'x-fms-user-id': String(userId),
    'x-fms-user-role': String(userRole),
  }
  if (departmentId) headers['x-fms-department-id'] = String(departmentId)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: form,
    })
  } catch {
    const e = new Error(ANALYZE_BILL_FRIENDLY.network_failure)
    e.code = 'network_failure'
    throw e
  }

  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok || !payload?.ok) {
    throw mapAnalyzeBillHttpError(payload, res.status)
  }

  return {
    fields: payload.fields,
    source: payload.source || 'amazon_textract_analyze_expense',
  }
}
