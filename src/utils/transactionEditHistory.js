import { supabase } from '../lib/supabase.js'
import { isMissingSchemaError, isRlsPolicyError } from './safeQuery.js'
import { readOtherDirection } from './transactionOtherDirection.js'
import { normalizeEntryType } from './entryTypes.js'

/** Fields compared and stored on each edit. */
export const TRANSACTION_EDIT_TRACKED_FIELDS = [
  'department_id',
  'type',
  'other_direction',
  'category',
  'description',
  'amount',
  'entry_date',
  'payment_method',
  'has_receipt',
]

export const FIELD_LABELS = {
  department_id: 'Department',
  type: 'Type',
  other_direction: 'Other direction',
  category: 'Category',
  description: 'Description',
  amount: 'Amount',
  entry_date: 'Date',
  payment_method: 'Payment method',
  has_receipt: 'Receipt',
}

/** Actionable setup guidance — always pair with the raw Supabase error. */
export const SETUP_HINT =
  'Run supabase/fix_transaction_edit_history_rls.sql (or transaction_edit_history.sql) on the SAME Supabase project this app uses (check VITE_SUPABASE_URL / Vercel env for this deploy) — RLS must be disabled and anon + authenticated need INSERT/SELECT.'

/** Build a diagnosable string from a PostgREST/Supabase error object. */
export function formatHistorySupabaseError(error) {
  if (!error) return null
  const parts = []
  if (error.code) parts.push(`code=${error.code}`)
  if (error.message) parts.push(String(error.message))
  if (error.details) parts.push(`details: ${error.details}`)
  if (error.hint) parts.push(`hint: ${error.hint}`)
  const raw = parts.length ? parts.join(' | ') : String(error)
  if (isMissingSchemaError(error) || isRlsPolicyError(error)) {
    return `${raw} — ${SETUP_HINT}`
  }
  return raw
}

function normalizeAmount(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toFixed(2)
}

function normalizeText(value) {
  if (value == null) return null
  const s = String(value).trim()
  return s.length ? s : null
}

function hasReceipt(row) {
  return Boolean(row?.receipt_url || row?.attachment_path || row?.raw_ocr_data)
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? ''),
  )
}

/** Snapshot of tracked fields from a transaction row or update payload. */
export function snapshotTransactionFields(row) {
  if (!row) return {}
  const type = normalizeEntryType(row.type) || row.type || null
  // description is the free-text "name"/note field on the edit form
  const description = normalizeText(row.description ?? row.name)
  return {
    department_id: row.department_id ?? null,
    type,
    other_direction: type === 'other' ? readOtherDirection(row) || row.other_direction || 'expense' : null,
    category: normalizeText(row.category),
    description,
    amount: normalizeAmount(row.amount),
    entry_date: row.entry_date ?? null,
    payment_method: row.payment_method ?? null,
    has_receipt: hasReceipt(row),
  }
}

function valuesEqual(a, b) {
  if (a === b) return true
  if (a == null && b == null) return true
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b)
  return String(a ?? '') === String(b ?? '')
}

/**
 * Diff old vs new snapshots.
 * @returns {{ changedFields: string[], oldValues: object, newValues: object } | null}
 */
export function diffTransactionSnapshots(before, after) {
  const oldSnap = snapshotTransactionFields(before)
  const newSnap = snapshotTransactionFields(after)
  const changedFields = []
  const oldValues = {}
  const newValues = {}

  for (const field of TRANSACTION_EDIT_TRACKED_FIELDS) {
    const prev = oldSnap[field]
    const next = newSnap[field]
    if (!valuesEqual(prev, next)) {
      changedFields.push(field)
      oldValues[field] = prev
      newValues[field] = next
    }
  }

  if (changedFields.length === 0) return null
  return { changedFields, oldValues, newValues }
}

/**
 * Persist a field-level edit. Returns { error, skipped, missingTable, rlsBlocked, supabaseError }.
 * Callers MUST surface `error` — silent skip caused empty History with a successful save toast.
 */
export async function recordTransactionEdit({
  transactionId,
  actor,
  before,
  after,
}) {
  if (!supabase || !transactionId) return { error: null, skipped: true }

  const diff = diffTransactionSnapshots(before, after)
  if (!diff) return { error: null, skipped: true }

  const actorId = isUuid(actor?.id) ? actor.id : null

  try {
    const { error } = await supabase.from('transaction_edit_history').insert({
      transaction_id: transactionId,
      actor_role: actor?.role ?? null,
      actor_id: actorId,
      actor_email: actor?.email ?? null,
      changed_fields: diff.changedFields,
      old_values: diff.oldValues,
      new_values: diff.newValues,
    })

    if (error) {
      const message = formatHistorySupabaseError(error)
      console.warn('Failed to record transaction edit history:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return {
        error: message,
        skipped: false,
        missingTable: isMissingSchemaError(error),
        rlsBlocked: isRlsPolicyError(error),
        supabaseError: {
          code: error.code ?? null,
          message: error.message ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
        },
      }
    }
    return { error: null, skipped: false }
  } catch (e) {
    const message = formatHistorySupabaseError(e) || e?.message || String(e)
    console.warn('Failed to record transaction edit history:', e)
    return {
      error: message,
      skipped: false,
      supabaseError: {
        code: e?.code ?? null,
        message: e?.message ?? String(e),
        details: e?.details ?? null,
        hint: e?.hint ?? null,
      },
    }
  }
}

export async function fetchTransactionEditHistory(transactionId, { limit = 50 } = {}) {
  if (!supabase || !transactionId) {
    return { data: [], error: null, missingTable: false }
  }

  try {
    const { data, error } = await supabase
      .from('transaction_edit_history')
      .select(
        'id, transaction_id, actor_role, actor_id, actor_email, changed_fields, old_values, new_values, created_at',
      )
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      const message = formatHistorySupabaseError(error)
      return {
        data: [],
        error: message,
        missingTable: isMissingSchemaError(error),
        rlsBlocked: isRlsPolicyError(error),
        supabaseError: {
          code: error.code ?? null,
          message: error.message ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
        },
      }
    }
    return { data: data ?? [], error: null, missingTable: false }
  } catch (e) {
    return {
      data: [],
      error: formatHistorySupabaseError(e) || e?.message || 'Failed to load edit history.',
      missingTable: false,
      supabaseError: {
        code: e?.code ?? null,
        message: e?.message ?? String(e),
        details: e?.details ?? null,
        hint: e?.hint ?? null,
      },
    }
  }
}

/** Human-readable value for history UI. */
export function formatHistoryValue(field, value, { departmentName } = {}) {
  if (value == null || value === '') return '—'
  if (field === 'has_receipt') return value ? 'Attached' : 'None'
  if (field === 'amount') {
    const n = Number(value)
    return Number.isFinite(n) ? `£${n.toFixed(2)}` : String(value)
  }
  if (field === 'department_id') return departmentName || String(value)
  if (field === 'payment_method') return String(value).replace(/_/g, ' ')
  return String(value)
}
