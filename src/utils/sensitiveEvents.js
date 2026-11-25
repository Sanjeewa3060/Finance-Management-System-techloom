import { supabase } from '../lib/supabase.js'
import { getDeviceInfo } from './deviceInfo.js'
import { isMissingSchemaError, isRlsPolicyError } from './safeQuery.js'

const PURGE_THROTTLE_KEY = 'kaionex_sensitive_purge_at'
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000
const SENSITIVE_ENTITY_TYPE = 'sensitive_event'
const SENSITIVE_EVENT_SELECT =
  'id,event_type,actor_email,actor_role,actor_id,entity_type,entity_id,success,device_label,device_user_agent,message,created_at,expires_at'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatEventTime(date = new Date()) {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function buildSensitiveMessage({ action, actorEmail, deviceLabel, extra = '' }) {
  const who = actorEmail || 'Unknown user'
  const device = deviceLabel || 'Unknown device'
  const when = formatEventTime()
  const suffix = extra ? ` — ${extra}` : ''
  return `${action} — ${who} from ${device} at ${when}${suffix}`
}

function mapAuditRowToSensitiveEvent(row) {
  const details = row.details ?? {}
  return {
    id: row.id,
    event_type: row.action,
    actor_email: row.actor_email,
    actor_role: row.actor_role,
    actor_id: row.actor_id,
    entity_type: details.entity_type ?? null,
    entity_id: row.entity_id,
    success: !!details.success,
    device_label: details.device_label ?? null,
    device_user_agent: details.device_user_agent ?? null,
    message: details.message ?? '—',
    created_at: row.created_at,
    expires_at: null,
  }
}

async function querySensitiveEventsTable(client) {
  return client
    .from('sensitive_events')
    .select(SENSITIVE_EVENT_SELECT)
    .order('created_at', { ascending: false })
    .limit(300)
}

async function querySensitiveEventsAuditFallback(client) {
  return client
    .from('audit_logs')
    .select('id,actor_role,actor_id,actor_email,action,entity_type,entity_id,details,created_at')
    .eq('entity_type', SENSITIVE_ENTITY_TYPE)
    .order('created_at', { ascending: false })
    .limit(300)
}

/** Load sensitive events — retries schema cache once, falls back to audit_logs. */
export async function fetchSensitiveEvents(client = supabase) {
  if (!client) {
    return { data: [], error: null, usingFallback: false, setupRequired: true }
  }

  let result = await querySensitiveEventsTable(client)
  if (result.error && isMissingSchemaError(result.error)) {
    await sleep(1500)
    result = await querySensitiveEventsTable(client)
  }

  if (!result.error) {
    return {
      data: result.data ?? [],
      error: null,
      usingFallback: false,
      setupRequired: false,
    }
  }

  if (!isMissingSchemaError(result.error)) {
    return {
      data: [],
      error: result.error.message,
      usingFallback: false,
      setupRequired: false,
    }
  }

  const fallback = await querySensitiveEventsAuditFallback(client)
  if (fallback.error) {
    return {
      data: [],
      error: fallback.error.message,
      usingFallback: false,
      setupRequired: true,
    }
  }

  return {
    data: (fallback.data ?? []).map(mapAuditRowToSensitiveEvent),
    error: null,
    usingFallback: true,
    setupRequired: false,
  }
}

async function insertSensitiveEventRow(payload) {
  const { error } = await supabase.from('sensitive_events').insert(payload)
  if (!error) return true
  if (!isMissingSchemaError(error) && !isRlsPolicyError(error)) return false

  const { error: auditError } = await supabase.from('audit_logs').insert({
    actor_role: payload.actor_role ?? 'unknown',
    actor_id: payload.actor_id ?? null,
    actor_email: payload.actor_email ?? null,
    action: payload.event_type,
    entity_type: SENSITIVE_ENTITY_TYPE,
    entity_id: payload.entity_id ?? null,
    details: {
      message: payload.message,
      device_label: payload.device_label,
      device_user_agent: payload.device_user_agent,
      success: payload.success,
      entity_type: payload.entity_type,
    },
  })
  return !auditError
}

export async function logSensitiveEvent({
  eventType,
  actor = null,
  entityType = null,
  entityId = null,
  success = false,
  message,
  device = null,
}) {
  if (!supabase || !message) return
  const resolvedDevice = device ?? getDeviceInfo()
  try {
    await insertSensitiveEventRow({
      event_type: eventType,
      actor_email: actor?.email ?? null,
      actor_role: actor?.role ?? null,
      actor_id: actor?.id ?? null,
      entity_type: entityType,
      entity_id: entityId ?? null,
      success,
      device_label: resolvedDevice.label,
      device_user_agent: resolvedDevice.userAgent,
      message,
    })
  } catch {
    /* optional table */
  }
}

export async function notifyAdminsSensitiveEvent({ title, body }) {
  if (!supabase) return
  try {
    const { data: admins } = await supabase.from('admin_accounts').select('id,email')
    if (!admins?.length) return
    const withSensitive = admins.map((admin) => ({
      user_role: 'admin',
      user_id: admin.id,
      title,
      body,
      is_sensitive: true,
      is_read: false,
    }))
    let { error } = await supabase.from('notifications').insert(withSensitive)
    if (error && isMissingSchemaError(error)) {
      const plain = admins.map((admin) => ({
        user_role: 'admin',
        user_id: admin.id,
        title,
        body,
        is_read: false,
      }))
      await supabase.from('notifications').insert(plain)
    }
  } catch {
    /* optional */
  }
}

export async function recordSensitiveActivity({
  eventType,
  actor = null,
  entityType = null,
  entityId = null,
  success = false,
  message,
  device = null,
  notifyTitle,
  notifyBody,
}) {
  await logSensitiveEvent({ eventType, actor, entityType, entityId, success, message, device })
  await notifyAdminsSensitiveEvent({
    title: notifyTitle ?? 'Sensitive event',
    body: notifyBody ?? message,
  })
}

export async function recordActorSensitiveActivity({
  action,
  eventType,
  actor = null,
  entityType = null,
  entityId = null,
  success = false,
  device = null,
  extra = '',
  notifyTitle,
}) {
  const resolvedDevice = device ?? getDeviceInfo()
  const message = buildSensitiveMessage({
    action,
    actorEmail: actor?.email,
    deviceLabel: resolvedDevice.label,
    extra,
  })
  await recordSensitiveActivity({
    eventType,
    actor,
    entityType,
    entityId,
    success,
    message,
    device: resolvedDevice,
    notifyTitle: notifyTitle ?? action,
    notifyBody: message,
  })
}

export async function purgeExpiredSensitiveEvents() {
  if (!supabase) return
  const now = new Date().toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  try {
    const { error } = await supabase.from('sensitive_events').delete().lt('expires_at', now)
    if (!error || !isMissingSchemaError(error)) {
      /* table exists or non-schema error */
    }
    await supabase.from('notifications').delete().lt('created_at', thirtyDaysAgo)
  } catch {
    /* optional tables */
  }
}

export function maybePurgeExpiredSensitiveEvents() {
  if (typeof localStorage === 'undefined') return purgeExpiredSensitiveEvents()
  const last = Number(localStorage.getItem(PURGE_THROTTLE_KEY) || 0)
  if (Date.now() - last < PURGE_INTERVAL_MS) return Promise.resolve()
  localStorage.setItem(PURGE_THROTTLE_KEY, String(Date.now()))
  return purgeExpiredSensitiveEvents()
}
