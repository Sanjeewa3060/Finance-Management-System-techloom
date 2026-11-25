export const TX_SELECT =
  'id,department_id,type,other_direction,category,description,amount,entry_date,created_at,currency,exchange_rate,vat_rate,status,attachment_path,receipt_url,raw_ocr_data,due_date,invoice_ref,payment_method'

/** Same as TX_SELECT but without other_direction — used when DB migration not yet applied. */
export const TX_SELECT_NO_OTHER_DIR =
  'id,department_id,type,category,description,amount,entry_date,created_at,currency,exchange_rate,vat_rate,status,attachment_path,due_date,invoice_ref,payment_method'

export const TX_SELECT_BASIC =
  'id,department_id,type,category,description,amount,entry_date,created_at'

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'credit', label: 'Credit' },
]

export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map((m) => m.id)

export const PAYMENT_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label]))
