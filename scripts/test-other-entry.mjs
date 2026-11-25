/**
 * Automated tests for Other (+/-) entry type — logic + live Supabase round-trip.
 * Run: node scripts/test-other-entry.mjs
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { computeTotals } from '../src/utils/calculations.js'
import {
  formatTransactionTypeLabel,
  isOtherExpense,
  isOtherProfit,
  resolveOtherDirection,
} from '../src/utils/entryTypes.js'
import {
  encodeOtherDirectionFallback,
  insertTransaction,
  normalizeTransactionRow,
  readOtherDirection,
} from '../src/utils/transactionOtherDirection.js'

function loadEnv() {
  const text = readFileSync('.env', 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
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

console.log('\n=== 1) Unit tests (totals & labels) ===\n')

const txProfit = { type: 'other', other_direction: 'profit', amount: 100, category: 'Misc' }
const txExpense = { type: 'other', other_direction: 'expense', amount: 50, category: 'Adj' }
const txSale = { type: 'sale', amount: 200, category: 'Sale' }

const totals = computeTotals([txSale, txProfit, txExpense])
assert(totals.revenue === 200, 'Sales revenue = 200')
assert(totals.otherIncome === 100, 'Other income (+) = 100')
assert(totals.expenses === 50, 'Expenses (Other -) = 50')
assert(totals.netProfit === 250, 'Net profit = 200 + 100 - 50 = 250')

assert(formatTransactionTypeLabel(txProfit) === 'Other (+)', 'Label Other (+)')
assert(formatTransactionTypeLabel(txExpense) === 'Other (-)', 'Label Other (-)')
assert(isOtherProfit(txProfit), 'isOtherProfit true for +')
assert(isOtherExpense(txExpense), 'isOtherExpense true for -')

const fallbackTx = {
  type: 'other',
  invoice_ref: encodeOtherDirectionFallback('profit'),
  amount: 75,
}
const normalized = normalizeTransactionRow(fallbackTx)
assert(normalized.other_direction === 'profit', 'Fallback invoice_ref decodes to profit')
assert(readOtherDirection(fallbackTx) === 'profit', 'readOtherDirection from invoice_ref')

console.log('\n=== 2) Live Supabase round-trip ===\n')

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.log('  SKIP: No .env credentials — logic tests only.')
} else {
  const supabase = createClient(url, key)

  const { data: depts, error: deptErr } = await supabase.from('departments').select('id').limit(1)
  if (deptErr || !depts?.length) {
    console.log(`  SKIP: No department available (${deptErr?.message ?? 'empty'})`)
  } else {
    const deptId = depts[0].id
    const today = new Date().toISOString().slice(0, 10)
    const testIds = []

    for (const [dir, amount] of [
      ['profit', 11.11],
      ['expense', 22.22],
    ]) {
      const { data, error } = await insertTransaction(supabase, {
        department_id: deptId,
        type: 'other',
        other_direction: dir,
        category: 'Miscellaneous',
        description: `AUTO_TEST_OTHER_${dir}`,
        amount,
        entry_date: today,
        status: 'approved',
        currency: 'GBP',
        exchange_rate: 1,
        vat_rate: 0,
        payment_method: 'cash',
      })

      if (error) {
        assert(false, `Insert Other ${dir}`, error.message)
      } else {
        testIds.push(data.id)
        assert(true, `Insert Other ${dir} saved (id ${data.id.slice(0, 8)}…)`)

        const { data: row, error: readErr } = await supabase
          .from('transactions')
          .select('id,type,other_direction,invoice_ref,amount,description,category,entry_date')
          .eq('id', data.id)
          .single()

        if (readErr) {
          assert(false, `Read back Other ${dir}`, readErr.message)
        } else {
          const norm = normalizeTransactionRow(row)
          assert(resolveOtherDirection(norm) === dir, `Read direction for ${dir}`, `got ${resolveOtherDirection(norm)}`)
          assert(
            formatTransactionTypeLabel(norm) === (dir === 'profit' ? 'Other (+)' : 'Other (-)'),
            `Display label for ${dir}`,
          )
        }
      }
    }

    const { data: recent, error: listErr } = await supabase
      .from('transactions')
      .select('id,type,other_direction,invoice_ref,amount,description,entry_date,category')
      .eq('department_id', deptId)
      .like('description', 'AUTO_TEST_OTHER_%')

    if (listErr) {
      assert(false, 'List test transactions', listErr.message)
    } else {
      const normalized = (recent ?? []).map(normalizeTransactionRow)
      const listTotals = computeTotals(normalized)
      assert(normalized.some(isOtherProfit), 'Listed rows include Other (+)')
      assert(normalized.some(isOtherExpense), 'Listed rows include Other (-)')
      assert(listTotals.otherIncome >= 11.11, 'Report otherIncome includes + entry')
      assert(listTotals.expenses >= 22.22, 'Report expenses includes - entry')
    }

    if (testIds.length) {
      const { error: delErr } = await supabase.from('transactions').delete().in('id', testIds)
      assert(!delErr, 'Cleanup test rows', delErr?.message ?? '')
    }
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
