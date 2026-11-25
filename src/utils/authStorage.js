export const AUTH_SESSION_KEY = 'kaionex_session_v1'
export const AUTH_REMEMBER_KEY = 'kaionex_session_remember_v1'
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000

function isValidUser(user) {
  return user?.id && user?.role && user?.email
}

export function loadStoredAuthUser() {
  try {
    const rememberRaw = localStorage.getItem(AUTH_REMEMBER_KEY)
    if (rememberRaw) {
      const parsed = JSON.parse(rememberRaw)
      if (parsed?.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem(AUTH_REMEMBER_KEY)
      } else if (isValidUser(parsed?.user)) {
        return parsed.user
      }
    }
  } catch {
    localStorage.removeItem(AUTH_REMEMBER_KEY)
  }

  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isValidUser(parsed)) return parsed
    }
  } catch {
    sessionStorage.removeItem(AUTH_SESSION_KEY)
  }

  return null
}

export function persistAuthUser(user, rememberMe = false) {
  clearAuthStorage()
  if (!isValidUser(user)) return
  if (rememberMe) {
    localStorage.setItem(
      AUTH_REMEMBER_KEY,
      JSON.stringify({ user, expiresAt: Date.now() + REMEMBER_MS }),
    )
  } else {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user))
  }
}

export function syncAuthUser(user) {
  if (!isValidUser(user)) return
  try {
    const rememberRaw = localStorage.getItem(AUTH_REMEMBER_KEY)
    if (rememberRaw) {
      const parsed = JSON.parse(rememberRaw)
      if (parsed?.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem(AUTH_REMEMBER_KEY)
        sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user))
        return
      }
      localStorage.setItem(
        AUTH_REMEMBER_KEY,
        JSON.stringify({ ...parsed, user, expiresAt: parsed.expiresAt ?? Date.now() + REMEMBER_MS }),
      )
      return
    }
  } catch {
    localStorage.removeItem(AUTH_REMEMBER_KEY)
  }
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user))
}

export function clearAuthStorage() {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY)
    localStorage.removeItem(AUTH_REMEMBER_KEY)
  } catch {
    /* ignore */
  }
}

export function usesRememberedSession() {
  try {
    return !!localStorage.getItem(AUTH_REMEMBER_KEY)
  } catch {
    return false
  }
}
