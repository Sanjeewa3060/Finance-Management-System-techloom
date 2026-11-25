import { supabase } from '../lib/supabase.js'
import { hashPassword } from '../utils/password.js'
import { safeUpdateLastLogin } from '../utils/safeQuery.js'

const flights = new Map()

function randomUnusableSecret() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `asgardeo-unusable.${hex}`
}

function toAuthUser(row) {
  return {
    id: row.id,
    role: 'admin',
    email: row.email,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    authProvider: 'asgardeo',
  }
}

const STAFF_LOGINS = [
  ['company_profiles', 'company'],
  ['departments', 'department'],
  ['company_users', 'staff'],
]

async function staffLoginLabel(email) {
  const checks = await Promise.all(STAFF_LOGINS.map(async ([table, label]) => {
    const result = await supabase.from(table).select('id').eq('email', email).limit(1)
    if (result.error) throw new Error(result.error.message)
    return result.data?.[0] ? label : ''
  }))
  return checks.find(Boolean) ?? ''
}

async function linkOnce(email) {
  if (!supabase) throw new Error('Database is not configured.')
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized.includes('@')) throw new Error('Asgardeo did not return an email address.')

  const staffLabel = await staffLoginLabel(normalized)
  if (staffLabel) {
    throw new Error(
      `This email already belongs to a ${staffLabel} login. Use the password form. Asgardeo does not take over that account.`,
    )
  }

  const existing = await supabase
    .from('admin_accounts')
    .select('id,email,avatar_url,created_at')
    .eq('email', normalized)
    .limit(1)

  if (existing.error) throw new Error(existing.error.message)
  if (existing.data?.[0]) {
    await safeUpdateLastLogin('admin_accounts', existing.data[0].id)
    return toAuthUser(existing.data[0])
  }

  const password = await hashPassword(randomUnusableSecret())
  const inserted = await supabase
    .from('admin_accounts')
    .insert({ email: normalized, password })
    .select('id,email,avatar_url,created_at')
    .single()

  if (inserted.error) {
    const again = await supabase
      .from('admin_accounts')
      .select('id,email,avatar_url,created_at')
      .eq('email', normalized)
      .limit(1)
    if (again.data?.[0]) return toAuthUser(again.data[0])
    throw new Error(inserted.error.message)
  }

  await safeUpdateLastLogin('admin_accounts', inserted.data.id)
  return toAuthUser(inserted.data)
}

export function linkAsgardeoCustomer(email) {
  const key = String(email ?? '').trim().toLowerCase()
  if (!flights.has(key)) {
    const promise = linkOnce(key).finally(() => flights.delete(key))
    flights.set(key, promise)
  }
  return flights.get(key)
}
