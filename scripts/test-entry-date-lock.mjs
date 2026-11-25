/**
 * Unit tests for entry date lock helpers.
 * Run: node scripts/test-entry-date-lock.mjs
 */
import {
  clearEntryDateLock,
  isLockExpired,
  resolveEntryDateLock,
  saveEntryDateLock,
} from '../src/utils/entryDateLock.js'
import { todayISO, yesterdayISO } from '../src/utils/dates.js'

const memoryStorage = new Map()
globalThis.localStorage = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, value),
  removeItem: (key) => memoryStorage.delete(key),
}

let passed = 0
let failed = 0

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  PASS: ${label}`)
    passed += 1
  } else {
    console.log(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`)
    failed += 1
  }
}

console.log('\n=== Entry date lock tests ===\n')

memoryStorage.clear()
const today = todayISO()
const yesterday = yesterdayISO()

assert(isLockExpired(today) === false, 'Same-day session not expired')
assert(isLockExpired(yesterday) === true, 'Previous day session expired')

saveEntryDateLock({ entryDate: yesterday, sessionDay: today })
const resolved = resolveEntryDateLock()
assert(resolved?.entryDate === yesterday, 'Restores locked entry date', resolved?.entryDate)
assert(resolved?.sessionDay === today, 'Restores session day')

clearEntryDateLock()
assert(resolveEntryDateLock() === null, 'Clears expired storage')

saveEntryDateLock({ entryDate: yesterday, sessionDay: yesterday })
assert(resolveEntryDateLock() === null, 'Stale lock from prior day cleared on resolve')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
