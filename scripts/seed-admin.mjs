/**
 * Create or reset default admin login.
 * Run: node scripts/seed-admin.mjs
 * Reset password: node scripts/seed-admin.mjs --reset
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const DEFAULT_EMAIL = 'admin@kaionex.com'
const DEFAULT_PASSWORD = 'Admin123!'

function loadEnv() {
  const env = {}
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

const reset = process.argv.includes('--reset')
const env = loadEnv()
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

const { data: target, error: lookupError } = await supabase
  .from('admin_accounts')
  .select('id,email')
  .eq('email', DEFAULT_EMAIL)
  .maybeSingle()

if (lookupError) {
  console.error('Failed to read admin_accounts:', lookupError.message)
  process.exit(1)
}

if (target) {
  if (!reset) {
    console.log(`Admin already exists: ${target.email}`)
    console.log('Run with --reset to set password to the default below.')
    console.log(`\n  Email:    ${DEFAULT_EMAIL}`)
    console.log(`  Password: ${DEFAULT_PASSWORD} (only after --reset)`)
    process.exit(0)
  }
  const { error } = await supabase
    .from('admin_accounts')
    .update({ password: passwordHash })
    .eq('id', target.id)
  if (error) {
    console.error('Failed to reset password:', error.message)
    process.exit(1)
  }
  console.log(`Reset password for ${DEFAULT_EMAIL}`)
} else {
  const { error } = await supabase
    .from('admin_accounts')
    .insert({ email: DEFAULT_EMAIL, password: passwordHash })
  if (error) {
    console.error('Failed to create admin:', error.message)
    process.exit(1)
  }
  console.log(`Created admin ${DEFAULT_EMAIL}`)
}

console.log('\nLogin credentials:')
console.log(`  Email:    ${DEFAULT_EMAIL}`)
console.log(`  Password: ${DEFAULT_PASSWORD}`)
console.log('\nOpen /login and sign in with the credentials above.')
