import { todayISO } from './dates.js'

export const ENTRY_DATE_LOCK_STORAGE_KEY = 'kaionex_entry_date_lock_v1'

export function isLockExpired(sessionDay) {
  if (!sessionDay) return true
  return sessionDay !== todayISO()
}

export function loadEntryDateLock() {
  try {
    const raw = localStorage.getItem(ENTRY_DATE_LOCK_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.locked || !parsed?.entryDate || !parsed?.sessionDay) return null
    return {
      locked: true,
      entryDate: String(parsed.entryDate),
      sessionDay: String(parsed.sessionDay),
    }
  } catch {
    return null
  }
}

export function saveEntryDateLock({ entryDate, sessionDay }) {
  localStorage.setItem(
    ENTRY_DATE_LOCK_STORAGE_KEY,
    JSON.stringify({
      locked: true,
      entryDate: String(entryDate),
      sessionDay: String(sessionDay),
    }),
  )
}

export function clearEntryDateLock() {
  localStorage.removeItem(ENTRY_DATE_LOCK_STORAGE_KEY)
}

/** Returns valid stored lock for today's session, or null (and clears stale storage). */
export function resolveEntryDateLock() {
  const stored = loadEntryDateLock()
  if (!stored) return null
  if (isLockExpired(stored.sessionDay)) {
    clearEntryDateLock()
    return null
  }
  return stored
}
