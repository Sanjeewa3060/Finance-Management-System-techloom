import { supabase } from '../lib/supabase.js'
import { formatSupabaseError } from './supabaseErrors.js'

function departmentNameFromEmail(email) {
  const local = String(email ?? '').split('@')[0]?.trim()
  return (local || 'Department').slice(0, 80)
}

/** Create the 1:1 departments row for a company_profiles account. */
export async function createLinkedDepartment({ profileId, email, passwordHash, deletePasswordHash, name, isActive = true, profile = null }) {
  if (!supabase) throw new Error('Database not configured.')
  const deptName = String(name ?? '').trim() || departmentNameFromEmail(email)
  const insert = {
    id: crypto.randomUUID(),
    name: deptName.slice(0, 80),
    color: '#10b981',
    company_profile_id: profileId,
    email,
    password: passwordHash,
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    address: profile?.address ?? null,
    is_active: isActive,
  }
  if (deletePasswordHash) insert.delete_password = deletePasswordHash
  const { data, error } = await supabase
    .from('departments')
    .insert(insert)
    .select('id,name,email,full_name,phone,address,is_active')
    .single()
  if (error) throw new Error(formatSupabaseError(error))
  return data
}

/** Ensure a company profile has a linked department; returns the department row. */
export async function ensureLinkedDepartment(profile) {
  if (!supabase) throw new Error('Database not configured.')
  const { data: existing, error: findErr } = await supabase
    .from('departments')
    .select('id,name,email,full_name,phone,address,is_active')
    .eq('company_profile_id', profile.id)
    .limit(1)
  if (findErr) throw new Error(formatSupabaseError(findErr))
  if (existing?.length) return existing[0]

  let passwordHash = profile.password
  if (!passwordHash) {
    const { data: row, error } = await supabase.from('company_profiles').select('password').eq('id', profile.id).single()
    if (error) throw new Error(formatSupabaseError(error))
    passwordHash = row.password
  }

  const isActive = profile.is_active !== false && !profile.deleted_at
  return createLinkedDepartment({
    profileId: profile.id,
    email: profile.email,
    passwordHash,
    name: profile.department_name ?? profile.full_name,
    isActive,
    profile,
  })
}

/** Keep linked department rows in sync with company_profiles lifecycle changes. */
export async function syncLinkedDepartments(profileId, patch) {
  if (!supabase || !profileId || !Object.keys(patch).length) return
  const { error } = await supabase.from('departments').update(patch).eq('company_profile_id', profileId)
  if (error && !String(error.message).includes('does not exist')) {
    throw new Error(formatSupabaseError(error))
  }
}
