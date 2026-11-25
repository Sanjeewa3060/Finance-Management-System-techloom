import bcrypt from 'bcryptjs'

const ROUNDS = 10

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), ROUNDS)
}

export async function verifyPassword(plain, stored) {
  const value = String(stored ?? '')
  if (value.startsWith('$2')) {
    return bcrypt.compare(String(plain), value)
  }
  // Legacy plain-text password: allow login once, caller should re-hash.
  return value === String(plain)
}

export function isPasswordHashed(stored) {
  return String(stored ?? '').startsWith('$2')
}
