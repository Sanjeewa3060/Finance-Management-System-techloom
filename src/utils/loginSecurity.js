import { supabase } from '../lib/supabase.js'

const MAX_ATTEMPTS = 8
const WINDOW_MS = 15 * 60 * 1000

export async function recordLoginAttempt(email) {
  if (!supabase) return
  try {
    await supabase.from('login_attempts').insert({ email: String(email).toLowerCase() })
  } catch {
    /* table optional */
  }
}

export async function isLoginBlocked(email) {
  if (!supabase) return false
  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const { count, error } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('email', String(email).toLowerCase())
      .gte('attempted_at', since)
    if (error) return false
    return (count ?? 0) >= MAX_ATTEMPTS
  } catch {
    return false
  }
}

export async function clearLoginAttempts(email) {
  if (!supabase) return
  try {
    await supabase.from('login_attempts').delete().eq('email', String(email).toLowerCase())
  } catch {
    /* optional */
  }
}
