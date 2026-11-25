import { normalizeEntryType, normalizeOtherDirection } from './entryTypes.js'

const OD_INVOICE_RE = /^__OD:(profit|expense)__$/

export function isOtherDirectionSchemaError(error) {
  const msg = String(error?.message ?? error ?? '')
  return (
    msg.includes('other_direction') &&
    (msg.includes('schema cache') || msg.includes('Could not find') || msg.includes('does not exist'))
  )
}

/** Hidden invoice_ref marker when other_direction column is not available. */
export function encodeOtherDirectionFallback(direction) {
  const d = normalizeOtherDirection(direction) || 'expense'
  return `__OD:${d}__`
}

export function decodeOtherDirectionFromInvoiceRef(invoiceRef) {
  const m = String(invoiceRef ?? '').match(OD_INVOICE_RE)
  return m ? normalizeOtherDirection(m[1]) : ''
}

/** Read profit/expense for Other entries from column or invoice_ref fallback. */
export function readOtherDirection(tx) {
  if (normalizeEntryType(tx?.type) !== 'other') return null
  return normalizeOtherDirection(tx?.other_direction) || decodeOtherDirectionFromInvoiceRef(tx?.invoice_ref) || 'expense'
}

/** Ensure other_direction is set on in-memory rows after fetch. */
export function normalizeTransactionRow(tx) {
  if (!tx || normalizeEntryType(tx.type) !== 'other') return tx
  return { ...tx, other_direction: readOtherDirection(tx) }
}

export function normalizeTransactionRows(rows) {
  return (rows ?? []).map(normalizeTransactionRow)
}

/** Build insert/update payload; omit other_direction when useColumn is false. */
export function buildTransactionPayload(fields, { useOtherDirectionColumn = true, forUpdate = false } = {}) {
  const direction = normalizeOtherDirection(fields.other_direction) || 'expense'
  const type = fields.type

  const base = forUpdate
    ? {
        department_id: fields.department_id,
        type,
        category: fields.category,
        description: fields.description,
        amount: typeof fields.amount === 'number' ? String(fields.amount) : fields.amount,
        entry_date: fields.entry_date,
        payment_method: fields.payment_method,
        ...(fields.attachment_path !== undefined ? { attachment_path: fields.attachment_path } : {}),
        ...(fields.receipt_url !== undefined ? { receipt_url: fields.receipt_url } : {}),
        ...(fields.raw_ocr_data !== undefined ? { raw_ocr_data: fields.raw_ocr_data } : {}),
      }
    : {
        id: fields.id || crypto.randomUUID(),
        department_id: fields.department_id,
        type,
        category: fields.category,
        description: fields.description,
        amount: typeof fields.amount === 'number' ? String(fields.amount) : fields.amount,
        entry_date: fields.entry_date,
        status: fields.status,
        currency: fields.currency,
        exchange_rate: fields.exchange_rate,
        vat_rate: fields.vat_rate,
        attachment_path: fields.attachment_path,
        receipt_url: fields.receipt_url ?? null,
        raw_ocr_data: fields.raw_ocr_data ?? null,
        due_date: fields.due_date,
        payment_method: fields.payment_method,
        created_at: fields.created_at || new Date().toISOString(),
      }

  if (normalizeEntryType(type) !== 'other') {
    if (forUpdate) return base
    const row = { ...base, invoice_ref: fields.invoice_ref ?? null }
    if (useOtherDirectionColumn) row.other_direction = null
    return row
  }

  if (useOtherDirectionColumn) {
    return {
      ...base,
      other_direction: direction,
      invoice_ref: fields.invoice_ref ?? null,
    }
  }

  return {
    ...base,
    invoice_ref: fields.invoice_ref ?? encodeOtherDirectionFallback(direction),
  }
}

export function isReceiptSchemaError(error) {
  const msg = String(error?.message ?? error ?? '')
  return (
    (msg.includes('receipt_url') || msg.includes('raw_ocr_data')) &&
    (msg.includes('schema cache') || msg.includes('Could not find') || msg.includes('does not exist') || msg.includes('column'))
  )
}

export async function insertTransaction(supabase, fields) {
  let payload = buildTransactionPayload(fields, { useOtherDirectionColumn: true, forUpdate: false })
  let result = await supabase.from('transactions').insert(payload).select('id').single()

  if (result.error && isOtherDirectionSchemaError(result.error)) {
    payload = buildTransactionPayload(fields, { useOtherDirectionColumn: false, forUpdate: false })
    result = await supabase.from('transactions').insert(payload).select('id').single()
  }

  if (result.error && isReceiptSchemaError(result.error)) {
    const hadBill = Boolean(fields.receipt_url || fields.raw_ocr_data || fields.attachment_path)
    if (hadBill) {
      return {
        data: null,
        error: {
          message:
            'Cannot save the bill image: receipt columns are missing. Run supabase/receipts.sql in the Techloom SQL Editor (project nhmtytoryyaxgsigtwox), then try again.',
        },
      }
    }
    const { receipt_url, raw_ocr_data, ...withoutReceipt } = payload
    result = await supabase.from('transactions').insert(withoutReceipt).select('id').single()
  }

  return result
}

export async function updateTransaction(supabase, id, fields, { applyScope } = {}) {
  let payload = buildTransactionPayload(fields, { useOtherDirectionColumn: true, forUpdate: true })
  let query = supabase.from('transactions').update(payload).eq('id', id)
  if (applyScope) query = applyScope(query)

  let result = await query

  if (result.error && isOtherDirectionSchemaError(result.error)) {
    payload = buildTransactionPayload(fields, { useOtherDirectionColumn: false, forUpdate: true })
    query = supabase.from('transactions').update(payload).eq('id', id)
    if (applyScope) query = applyScope(query)
    result = await query
  }

  if (result.error && isReceiptSchemaError(result.error)) {
    const hadBill = Boolean(fields.receipt_url || fields.raw_ocr_data || fields.attachment_path)
    if (hadBill) {
      return {
        data: null,
        error: {
          message:
            'Cannot save the bill image: receipt columns are missing. Run supabase/receipts.sql in the Techloom SQL Editor, then try again.',
        },
      }
    }
    const { receipt_url, raw_ocr_data, ...withoutReceipt } = payload
    query = supabase.from('transactions').update(withoutReceipt).eq('id', id)
    if (applyScope) query = applyScope(query)
    result = await query
  }

  return result
}

export function resolvedOtherDirectionForAudit(fields) {
  if (normalizeEntryType(fields?.type) !== 'other') return null
  return normalizeOtherDirection(fields?.other_direction) || 'expense'
}
