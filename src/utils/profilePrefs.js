const PREFS_KEY = 'kaionex_prefs'
const META_KEY = 'kaionex_profile_meta'

const defaultPrefs = {
  emailNotifications: true,
  pushNotifications: true,
  twoFactorEnabled: false,
}

export function loadPrefs(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return { ...defaultPrefs, ...(all[userId] ?? {}) }
  } catch {
    return { ...defaultPrefs }
  }
}

export function savePrefs(userId, prefs) {
  try {
    const all = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    all[userId] = { ...defaultPrefs, ...(all[userId] ?? {}), ...prefs }
    localStorage.setItem(PREFS_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export function loadProfileMeta(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    return all[userId] ?? { full_name: '', phone: '', location: '', avatar_url: '' }
  } catch {
    return { full_name: '', phone: '', location: '', avatar_url: '' }
  }
}

export function saveProfileMeta(userId, meta) {
  try {
    const all = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    all[userId] = { ...all[userId], ...meta }
    localStorage.setItem(META_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}
