/**
 * Seed demo transactions for Reports (monthly / yearly P&L testing).
 * Run: npm run seed:demo
 * Remove demo rows: npm run seed:demo -- --clean
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DEMO_TAG = '[DEMO]'

function loadEnv() {
  const env = {}
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

function isoDate(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function amount(min, max) {
  return String(Math.round((min + Math.random() * (max - min)) * 100) / 100)
}

function buildMonthEntries(departmentId, year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const templates = [
    { type: 'sale', category: 'Project Payment', description: `${DEMO_TAG} Client milestone`, min: 2500, max: 12000 },
    { type: 'sale', category: 'Service Income', description: `${DEMO_TAG} Consultation fee`, min: 400, max: 2200 },
    { type: 'purchase', category: 'Materials', description: `${DEMO_TAG} Site materials`, min: 800, max: 4500 },
    { type: 'expense', category: 'Fuel', description: `${DEMO_TAG} Vehicle fuel`, min: 120, max: 480 },
    { type: 'expense', category: 'Wages & Salaries', description: `${DEMO_TAG} Payroll`, min: 1800, max: 6500 },
    { type: 'other', category: 'Adjustment', description: `${DEMO_TAG} Other income`, min: 150, max: 900, other_direction: 'profit' },
    { type: 'other', category: 'Miscellaneous', description: `${DEMO_TAG} Other cost`, min: 80, max: 350, other_direction: 'expense' },
  ]

  const rows = []
  const count = 6 + Math.floor(Math.random() * 4)
  for (let i = 0; i < count; i += 1) {
    const t = pick(templates)
    const day = 1 + Math.floor(Math.random() * daysInMonth)
    const row = {
      department_id: departmentId,
      type: t.type,
      category: t.category,
      description: t.description,
      amount: amount(t.min, t.max),
      entry_date: isoDate(year, monthIndex, day),
      status: 'approved',
      payment_method: pick(['cash', 'bank', 'card']),
    }
    if (t.other_direction) row.other_direction = t.other_direction
    rows.push(row)
  }
  return rows
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
const cleanOnly = process.argv.includes('--clean')

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key)

if (cleanOnly) {
  const { data, error } = await supabase.from('transactions').select('id').ilike('description', `%${DEMO_TAG}%`)
  if (error) {
    console.error('Clean failed:', error.message)
    process.exit(1)
  }
  const ids = (data ?? []).map((r) => r.id)
  if (!ids.length) {
    console.log('No demo transactions to remove.')
    process.exit(0)
  }
  const { error: delErr } = await supabase.from('transactions').delete().in('id', ids)
  if (delErr) {
    console.error('Delete failed:', delErr.message)
    process.exit(1)
  }
  console.log(`Removed ${ids.length} demo transaction(s).`)
  process.exit(0)
}

const { data: departments, error: deptErr } = await supabase
  .from('departments')
  .select('id,name')
  .order('created_at', { ascending: true })
if (deptErr) {
  console.error('Failed to load departments:', deptErr.message)
  process.exit(1)
}
if (!departments?.length) {
  console.error('No departments found. Create a company/department first, then run: npm run seed:demo')
  process.exit(1)
}

const now = new Date()
const targetDepartments = departments.slice(0, Math.min(3, departments.length))
const allRows = []

for (let offset = 0; offset < 14; offset += 1) {
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const year = d.getFullYear()
  const monthIndex = d.getMonth()
  for (const dept of targetDepartments) {
    allRows.push(...buildMonthEntries(dept.id, year, monthIndex))
  }
}

console.log(`Inserting ${allRows.length} demo transactions across ${targetDepartments.length} department(s) (14 months)...`)

const chunkSize = 40
let inserted = 0
for (let i = 0; i < allRows.length; i += chunkSize) {
  const chunk = allRows.slice(i, i + chunkSize)
  const { error } = await supabase.from('transactions').insert(chunk)
  if (error) {
    console.error('Insert failed:', error.message)
    console.error('If RLS blocks inserts, run supabase/fix_core_table_grants.sql in Supabase SQL Editor.')
    process.exit(1)
  }
  inserted += chunk.length
}

console.log(`Done. Inserted ${inserted} demo transactions.`)
console.log('')
console.log('Next steps:')
console.log('  1. npm run dev')
console.log('  2. Log in as admin → Reports')
console.log('  3. Try presets: This month · Last month · This year · All time')
console.log('  4. Click Print report')
console.log('')
console.log('Remove demo data: npm run seed:demo -- --clean')
