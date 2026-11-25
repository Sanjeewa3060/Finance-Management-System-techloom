import { createClient } from '@supabase/supabase-js'

function cleanEnv(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .trim()
}

const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'Missing Supabase env vars. Copy .env.example to .env, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server (npm run dev).'
  : null

export const supabase =
  supabaseConfigError ? null : createClient(supabaseUrl, supabaseAnonKey)

/** Lightweight ping used on app startup to verify REST API reachability. */
export async function checkSupabaseConnection(client = supabase, { retries = 3 } = {}) {
  if (!client) {
    return { ok: false, error: supabaseConfigError ?? 'Supabase client not initialized.' }
  }

  let lastError = 'Connection check failed.'
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const { error } = await client.from('departments').select('id', { head: true, count: 'exact' })
      if (!error) return { ok: true }
      lastError = error.message
      if (!String(error.message).includes('Failed to fetch')) break
    } catch (e) {
      lastError = String(e?.message ?? e)
      if (!lastError.includes('Failed to fetch') && !lastError.includes('NetworkError')) {
        return { ok: false, error: lastError }
      }
    }
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 800))
    }
  }

  if (lastError.includes('Failed to fetch') || lastError.includes('NetworkError')) {
    return {
      ok: false,
      error:
        'Cannot reach Supabase. Confirm VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, restart the dev server (npm run dev), then refresh the page.',
    }
  }
  return { ok: false, error: lastError }
}

export const supabaseUrlValue = supabaseUrl
export const supabaseAnonKeyValue = supabaseAnonKey

export const supabaseDebugInfo = {
  urlHost: (() => {
    try {
      return supabaseUrl ? new URL(supabaseUrl).host : ''
    } catch {
      return ''
    }
  })(),
  anonKeyLoaded: Boolean(supabaseAnonKey && String(supabaseAnonKey).length > 20),
}

