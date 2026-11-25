/**
 * Seed default sale, purchase, expense, and other categories.
 * Run: npm run seed:categories
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_CATEGORIES, ensureDefaultCategories } from '../src/utils/defaultCategories.js'

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

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key)

const { count: beforeCount, error: countError } = await supabase
  .from('categories')
  .select('*', { count: 'exact', head: true })
if (countError) {
  console.error('Failed to read categories:', countError.message)
  process.exit(1)
}

console.log(`Categories before: ${beforeCount ?? 0}`)

const seeded = await ensureDefaultCategories(supabase)
if (!seeded && (beforeCount ?? 0) >= DEFAULT_CATEGORIES.length) {
  console.log('All default categories already exist.')
} else if (!seeded) {
  console.warn('No new categories inserted.')
  console.warn('Run supabase/fix_categories_grants.sql in the Supabase SQL Editor, then retry.')
}

const { count: afterCount, error: afterError } = await supabase
  .from('categories')
  .select('*', { count: 'exact', head: true })
if (afterError) {
  console.error('Failed to count categories after seed:', afterError.message)
  process.exit(1)
}

console.log(`Categories after: ${afterCount ?? 0}`)
process.exit((afterCount ?? 0) > 0 ? 0 : 1)
