/**
 * Supabase Edge Function: analyze-bill
 * Browser → FMS → this function → Amazon Textract AnalyzeExpense → normalized JSON.
 * Does NOT create transactions. AWS credentials stay in Supabase secrets only.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { normalizeAnalyzeExpense } from './normalize.js'
import {
  classifyTextractHttpError,
  extractAwsErrorType,
  sniffImageKind,
  textractDiagCounts,
} from './awsErrors.js'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png'])
const MAX_BYTES = 4.5 * 1024 * 1024
const TEXTRACT_TIMEOUT_MS = 25_000
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const RATE_LIMIT_MAX = 8

type ApiErrorCode =
  | 'unsupported_file'
  | 'too_large'
  | 'missing_file'
  | 'unauthorized'
  | 'textract_unavailable'
  | 'aws_config_missing'
  | 'unreadable_bill'
  | 'no_useful_fields'
  | 'network_failure'
  | 'rate_limited'
  | 'forbidden_department'
  | 'bad_request'

const FRIENDLY: Record<ApiErrorCode, string> = {
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

const rateBuckets = new Map<string, number[]>()

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-fms-session-id, x-fms-user-id, x-fms-user-role, x-fms-department-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function err(code: ApiErrorCode, status = 400) {
  return json(status, { ok: false, error: { code, message: FRIENDLY[code] } })
}

function statusForCode(code: ApiErrorCode): number {
  switch (code) {
    case 'unauthorized':
      return 401
    case 'forbidden_department':
      return 403
    case 'rate_limited':
      return 429
    case 'aws_config_missing':
      return 503
    case 'no_useful_fields':
    case 'unreadable_bill':
      return 422
    case 'network_failure':
    case 'textract_unavailable':
      return 502
    case 'missing_file':
    case 'unsupported_file':
    case 'too_large':
    case 'bad_request':
    default:
      return 400
  }
}

function checkRateLimit(userKey: string): boolean {
  const now = Date.now()
  const prev = rateBuckets.get(userKey) ?? []
  const recent = prev.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(userKey, recent)
    return false
  }
  recent.push(now)
  rateBuckets.set(userKey, recent)
  return true
}

function header(req: Request, name: string): string {
  return String(req.headers.get(name) ?? '').trim()
}

async function validateSession(
  admin: ReturnType<typeof createClient>,
  sessionId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  if (!sessionId || !userId || !userRole) return false

  const { data, error } = await admin
    .from('user_sessions')
    .select('id,user_id,user_role,revoked_at')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    // Schema missing / unreachable — do not open the door; require a valid session row.
    console.error('analyze-bill session lookup failed')
    return false
  }
  if (!data) return false
  if (data.revoked_at) return false
  if (data.user_id !== userId || data.user_role !== userRole) return false
  return true
}

async function assertDepartmentAccess(
  admin: ReturnType<typeof createClient>,
  userId: string,
  userRole: string,
  departmentId: string,
): Promise<boolean> {
  if (!departmentId) return true

  if (userRole === 'admin') return true

  if (userRole === 'department') {
    return departmentId === userId
  }

  if (userRole === 'company') {
    const { data } = await admin
      .from('departments')
      .select('id')
      .eq('id', departmentId)
      .eq('company_profile_id', userId)
      .maybeSingle()
    return Boolean(data)
  }

  if (userRole === 'company_user') {
    const { data: cu } = await admin
      .from('company_users')
      .select('id,company_profile_id,department_id,role')
      .eq('id', userId)
      .maybeSingle()
    if (!cu) return false
    if (cu.role === 'manager' && cu.department_id) {
      return departmentId === cu.department_id
    }
    const { data: dept } = await admin
      .from('departments')
      .select('id')
      .eq('id', departmentId)
      .eq('company_profile_id', cu.company_profile_id)
      .maybeSingle()
    return Boolean(dept)
  }

  return false
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function callAnalyzeExpense(
  imageBytes: Uint8Array,
): Promise<{ ok: true; data: unknown } | { ok: false; code: ApiErrorCode }> {
  // Secrets read by NAME only — never log values.
  const accessKey = Deno.env.get('AWS_ACCESS_KEY_ID')?.trim()
  const secretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')?.trim()
  const region = (Deno.env.get('AWS_REGION') || 'eu-west-1').trim()

  if (!accessKey || !secretKey) {
    console.error('analyze-bill aws secrets missing by name')
    return { ok: false, code: 'aws_config_missing' }
  }

  const aws = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    region,
    service: 'textract',
  })

  const endpoint = `https://textract.${region}.amazonaws.com/`
  const body = JSON.stringify({
    Document: { Bytes: bytesToBase64(imageBytes) },
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TEXTRACT_TIMEOUT_MS)

  try {
    const res = await aws.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'Textract.AnalyzeExpense',
      },
      body,
      signal: controller.signal,
    })

    if (!res.ok) {
      let awsType = ''
      try {
        const errBody = await res.json()
        awsType = extractAwsErrorType(errBody)
      } catch {
        awsType = ''
      }
      // Log status + error type name only — never body text / keys / receipt content.
      console.error(
        'analyze-bill textract http',
        JSON.stringify({
          status: res.status,
          awsErrorType: awsType || null,
          region,
          bytes: imageBytes.byteLength,
        }),
      )
      const code = classifyTextractHttpError(res.status, awsType) as ApiErrorCode
      return { ok: false, code }
    }

    const data = await res.json()
    const counts = textractDiagCounts(data)
    console.log(
      'analyze-bill textract ok',
      JSON.stringify({ region, bytes: imageBytes.byteLength, ...counts }),
    )
    return { ok: true, data }
  } catch (e) {
    const name = String((e as Error)?.name ?? '')
    const msg = String((e as Error)?.message ?? e)
    if (name === 'AbortError' || /abort/i.test(msg)) {
      return { ok: false, code: 'textract_unavailable' }
    }
    if (/fetch|network|dns|connect/i.test(msg)) {
      return { ok: false, code: 'network_failure' }
    }
    console.error('analyze-bill textract call failed')
    return { ok: false, code: 'textract_unavailable' }
  } finally {
    clearTimeout(timer)
  }
}

function validateImageBytes(bytes: Uint8Array, mime: string): ApiErrorCode | null {
  if (bytes.byteLength > MAX_BYTES) return 'too_large'
  if (bytes.byteLength < 32) return 'unreadable_bill'
  const kind = sniffImageKind(bytes)
  if (kind === 'unknown') return 'unreadable_bill'
  if (mime === 'image/jpeg' && kind !== 'jpeg') return 'unreadable_bill'
  if (mime === 'image/png' && kind !== 'png') return 'unreadable_bill'
  return null
}

async function analyzeBytes(bytes: Uint8Array, mime: string): Promise<Response> {
  const byteErr = validateImageBytes(bytes, mime)
  if (byteErr) return err(byteErr, statusForCode(byteErr))

  console.log(
    'analyze-bill image',
    JSON.stringify({ mime, bytes: bytes.byteLength, kind: sniffImageKind(bytes) }),
  )

  const textract = await callAnalyzeExpense(bytes)
  if (!textract.ok) return err(textract.code, statusForCode(textract.code))

  const normalized = normalizeAnalyzeExpense(textract.data)
  if (!normalized.hasUsefulFields) {
    const counts = textractDiagCounts(textract.data)
    console.error('analyze-bill normalize no useful fields', JSON.stringify(counts))
    return err('no_useful_fields', statusForCode('no_useful_fields'))
  }

  const { hasUsefulFields: _ignored, ...fields } = normalized
  return json(200, {
    ok: true,
    fields,
    source: 'amazon_textract_analyze_expense',
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return err('bad_request', 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    if (!supabaseUrl || !serviceKey) {
      return err('aws_config_missing', 503)
    }

    const sessionId = header(req, 'x-fms-session-id')
    const userId = header(req, 'x-fms-user-id')
    const userRole = header(req, 'x-fms-user-role')
    const departmentId = header(req, 'x-fms-department-id')

    if (!sessionId || !userId || !userRole) {
      return err('unauthorized', 401)
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const sessionOk = await validateSession(admin, sessionId, userId, userRole)
    if (!sessionOk) {
      return err('unauthorized', 401)
    }

    if (departmentId) {
      const deptOk = await assertDepartmentAccess(admin, userId, userRole, departmentId)
      if (!deptOk) return err('forbidden_department', 403)
    }

    const rateKey = `${userRole}:${userId}`
    if (!checkRateLimit(rateKey)) {
      return err('rate_limited', 429)
    }

    const contentType = header(req, 'content-type').toLowerCase()

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const entry = form.get('file') ?? form.get('image') ?? form.get('bill')
      if (!(entry instanceof File)) return err('missing_file')

      const mime = (entry.type || '').toLowerCase()
      if (!ALLOWED_TYPES.has(mime)) return err('unsupported_file')
      if (entry.size > MAX_BYTES) return err('too_large')

      // Binary path: File.arrayBuffer → Uint8Array (not text / not double-base64).
      const bytes = new Uint8Array(await entry.arrayBuffer())
      return await analyzeBytes(bytes, mime)
    }

    if (contentType.includes('application/json')) {
      const payload = await req.json()
      const b64 = payload?.imageBase64 ?? payload?.bytesBase64
      const mime = String(payload?.contentType ?? 'image/jpeg').toLowerCase()
      if (!b64) return err('missing_file')
      if (!ALLOWED_TYPES.has(mime)) return err('unsupported_file')
      const bin = Uint8Array.from(atob(String(b64)), (c) => c.charCodeAt(0))
      return await analyzeBytes(bin, mime)
    }

    return err('bad_request')
  } catch (e) {
    const msg = String((e as Error)?.message ?? e)
    if (/network|fetch|Failed to fetch/i.test(msg)) return err('network_failure', 502)
    console.error('analyze-bill unexpected error')
    return err('textract_unavailable', 500)
  }
})
