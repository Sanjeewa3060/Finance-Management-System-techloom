import { supabase } from '../lib/supabase.js'
import { getDeviceInfo } from './deviceInfo.js'
import { isMissingSchemaError, isRlsPolicyError } from './safeQuery.js'

const SESSIONS_KEY = 'kaionex_device_sessions'
const CURRENT_SESSION_KEY = 'kaionex_session_id'
const SESSION_ENTITY_TYPE = 'user_session'
const SESSION_ACTION = 'session_active'

function mapUserSessionRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    deviceLabel: row.device_label ?? 'Unknown device',
    userAgent: row.device_user_agent ?? '',
    startedAt: row.started_at,
    lastActiveAt: row.last_active_at,
  }
}

function mapAuditSessionRow(row) {
  const details = row.details ?? {}
  return {
    id: row.entity_id ?? details.session_id,
    userId: row.actor_id,
    deviceLabel: details.device_label ?? 'Unknown device',
    userAgent: details.device_user_agent ?? '',
    startedAt: details.started_at ?? row.created_at,
    lastActiveAt: details.last_active_at ?? row.created_at,
    revokedAt: details.revoked_at ?? null,
  }
}

function readLocalSessions(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}')
    return all[userId] ?? []
  } catch {
    return []
  }
}

function writeLocalSessions(userId, list) {
  try {
    const all = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}')
    all[userId] = list.slice(0, 12)
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export function getCurrentSessionId() {
  try {
    return sessionStorage.getItem(CURRENT_SESSION_KEY)
  } catch {
    return null
  }
}

function setCurrentSessionId(sessionId) {
  try {
    sessionStorage.setItem(CURRENT_SESSION_KEY, sessionId)
  } catch {
    /* ignore */
  }
}

function clearCurrentSessionId() {
  try {
    sessionStorage.removeItem(CURRENT_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

async function fetchUserSessionRow(sessionId) {
  if (!supabase || !sessionId) return null
  const { data, error } = await supabase
    .from('user_sessions')
    .select('id,revoked_at,user_role,user_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return null
    return null
  }
  return data ? { source: 'user_sessions', ...data } : null
}

async function fetchAuditSessionRow(sessionId) {
  if (!supabase || !sessionId) return null
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id,entity_id,actor_role,actor_id,details,created_at')
    .eq('entity_type', SESSION_ENTITY_TYPE)
    .eq('entity_id', sessionId)
    .maybeSingle()
  if (error || !data) return null
  return { source: 'audit_logs', mapped: mapAuditSessionRow(data), raw: data }
}

async function fetchSessionRow(sessionId) {
  const primary = await fetchUserSessionRow(sessionId)
  if (primary) return primary
  return fetchAuditSessionRow(sessionId)
}

async function insertAuditSession(user, sessionId, device, now) {
  if (!supabase) return false
  const { error } = await supabase.from('audit_logs').insert({
    actor_role: user.role,
    actor_id: user.id,
    actor_email: user.email ?? null,
    action: SESSION_ACTION,
    entity_type: SESSION_ENTITY_TYPE,
    entity_id: sessionId,
    details: {
      session_id: sessionId,
      device_label: device.label,
      device_user_agent: device.userAgent,
      started_at: now,
      last_active_at: now,
      revoked_at: null,
    },
  })
  return !error
}

async function updateAuditSessionDetails(sessionId, patch) {
  if (!supabase || !sessionId) return false
  const audit = await fetchAuditSessionRow(sessionId)
  if (!audit?.raw) return false
  const details = { ...(audit.raw.details ?? {}), ...patch }
  const { error } = await supabase
    .from('audit_logs')
    .update({ details })
    .eq('id', audit.raw.id)
  return !error
}

async function fetchSessionsFromAudit(user) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('audit_logs')
    .select('entity_id,actor_id,details,created_at')
    .eq('entity_type', SESSION_ENTITY_TYPE)
    .eq('actor_role', user.role)
    .eq('actor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(24)

  if (error) return []

  return (data ?? [])
    .map((row) => mapAuditSessionRow({ ...row, actor_id: user.id }))
    .filter((row) => row.id && !row.revokedAt)
    .slice(0, 12)
}

/** Returns false when this browser session was revoked remotely. */
export async function ensureSessionValid(user) {
  if (!user?.id || !user?.role) return true
  const sessionId = getCurrentSessionId()
  if (!sessionId) return true

  const row = await fetchSessionRow(sessionId)
  if (!row) return true

  if (row.source === 'user_sessions') {
    if (row.revoked_at) return false
    if (row.user_role !== user.role || row.user_id !== user.id) return false
    return true
  }

  if (row.source === 'audit_logs') {
    if (row.mapped.revokedAt) return false
    if (row.raw.actor_role !== user.role || row.raw.actor_id !== user.id) return false
    return true
  }

  return true
}

/** Register or reuse the current browser session (no duplicate on refresh). */
export async function registerSession(user) {
  if (!user?.id || !user?.role) return null

  const device = getDeviceInfo()
  const now = new Date().toISOString()
  let sessionId = getCurrentSessionId()

  if (sessionId) {
    const valid = await ensureSessionValid(user)
    if (valid) {
      const row = await fetchSessionRow(sessionId)
      if (row) {
        await touchSession(user)
        return sessionId
      }
    }
  }

  sessionId = crypto.randomUUID()
  setCurrentSessionId(sessionId)

  let storedInDb = false
  if (supabase) {
    const { error } = await supabase.from('user_sessions').insert({
      id: sessionId,
      user_role: user.role,
      user_id: user.id,
      device_label: device.label,
      device_user_agent: device.userAgent,
      started_at: now,
      last_active_at: now,
    })
    if (!error) {
      storedInDb = true
    } else if (isMissingSchemaError(error) || isRlsPolicyError(error)) {
      storedInDb = await insertAuditSession(user, sessionId, device, now)
    } else {
      console.warn('user_sessions insert:', error.message)
    }
  }

  const localEntry = {
    id: sessionId,
    userId: user.id,
    deviceLabel: device.label,
    userAgent: device.userAgent,
    startedAt: now,
    lastActiveAt: now,
  }
  const list = readLocalSessions(user.id).filter((s) => s.id !== sessionId)
  writeLocalSessions(user.id, [localEntry, ...list])

  if (!storedInDb && !supabase) {
    /* local only */
  }

  return sessionId
}

export async function fetchSessions(user) {
  if (!user?.id || !user?.role) return []

  if (supabase) {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('id,user_id,device_label,device_user_agent,started_at,last_active_at')
      .eq('user_role', user.role)
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('last_active_at', { ascending: false })
      .limit(12)

    if (!error && data?.length) {
      const mapped = data.map(mapUserSessionRow)
      writeLocalSessions(user.id, mapped)
      return mapped
    }

    if (!error || isMissingSchemaError(error)) {
      const auditRows = await fetchSessionsFromAudit(user)
      if (auditRows.length) {
        writeLocalSessions(user.id, auditRows)
        return auditRows
      }
    } else {
      console.warn('user_sessions fetch:', error.message)
    }
  }

  return readLocalSessions(user.id).map((s) => ({
    id: s.id,
    userId: s.userId ?? user.id,
    deviceLabel: s.deviceLabel ?? 'Unknown device',
    userAgent: s.userAgent ?? '',
    startedAt: s.startedAt ?? s.started_at,
    lastActiveAt: s.lastActiveAt ?? s.last_active_at,
  }))
}

export async function touchSession(user) {
  if (!user?.id || !user?.role) return
  const sessionId = getCurrentSessionId()
  if (!sessionId) return

  const now = new Date().toISOString()

  if (supabase) {
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_active_at: now })
      .eq('id', sessionId)
      .is('revoked_at', null)

    if (error && (isMissingSchemaError(error) || isRlsPolicyError(error))) {
      await updateAuditSessionDetails(sessionId, { last_active_at: now })
    } else if (error) {
      console.warn('user_sessions touch:', error.message)
    }
  }

  const list = readLocalSessions(user.id).map((s) =>
    s.id === sessionId ? { ...s, lastActiveAt: now } : s,
  )
  writeLocalSessions(user.id, list)
}

/** Revoke a session. Returns true if the current browser session was revoked. */
export async function revokeSession(user, sessionId) {
  if (!user?.id || !sessionId) return false
  const now = new Date().toISOString()
  let revokedInDb = false

  if (supabase) {
    const { error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: now })
      .eq('id', sessionId)
      .eq('user_role', user.role)
      .eq('user_id', user.id)

    if (!error) {
      revokedInDb = true
    } else if (isMissingSchemaError(error) || isRlsPolicyError(error)) {
      revokedInDb = await updateAuditSessionDetails(sessionId, { revoked_at: now })
    } else {
      console.warn('user_sessions revoke:', error.message)
    }
  }

  writeLocalSessions(
    user.id,
    readLocalSessions(user.id).filter((s) => s.id !== sessionId),
  )

  const isCurrent = sessionId === getCurrentSessionId()
  if (isCurrent) clearCurrentSessionId()
  return isCurrent
}

export async function revokeCurrentSession(user) {
  const sessionId = getCurrentSessionId()
  if (!sessionId || !user?.id) {
    clearCurrentSessionId()
    return
  }
  await revokeSession(user, sessionId)
}

/** @deprecated Use fetchSessions(user) */
export function getSessions(userId) {
  return readLocalSessions(userId)
}

/** @deprecated Use revokeSession(user, sessionId) */
export function removeSession(userId, sessionId) {
  writeLocalSessions(
    userId,
    readLocalSessions(userId).filter((s) => s.id !== sessionId),
  )
}
