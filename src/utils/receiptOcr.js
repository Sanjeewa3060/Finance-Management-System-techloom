import { todayISO } from './dates.js'
import { isEntryType } from './entryTypes.js'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const PDF_TYPE = 'application/pdf'
const MAX_BYTES = 8 * 1024 * 1024

const TYPE_KEYWORDS = [
  { type: 'sale', words: ['invoice', 'sales receipt', 'sold', 'sale', 'payment received', 'tax invoice'] },
  { type: 'purchase', words: ['purchase', 'po #', 'procurement', 'supplier invoice', 'bought'] },
  { type: 'expense', words: ['expense', 'bill', 'utility', 'rent', 'fuel', 'parking', 'restaurant', 'pharmacy', 'taxi', 'uber', 'grab', 'cafe', 'hotel'] },
]

const CATEGORY_HINTS = [
  { match: /\brent\b/i, name: 'Rent', entry_type: 'expense' },
  { match: /\b(fuel|petrol|diesel|gas station)\b/i, name: 'Fuel', entry_type: 'expense' },
  { match: /\b(electric|water|utility|utilities|ceb|leco)\b/i, name: 'Utilities', entry_type: 'expense' },
  { match: /\b(insurance)\b/i, name: 'Insurance', entry_type: 'expense' },
  { match: /\b(travel|taxi|uber|grab|flight|airline)\b/i, name: 'Travel', entry_type: 'expense' },
  { match: /\b(office|stationery|supplies)\b/i, name: 'Office Supplies', entry_type: 'expense' },
  { match: /\b(repair|maintenance|service)\b/i, name: 'Repairs & Maintenance', entry_type: 'expense' },
  { match: /\b(wage|salary|payroll)\b/i, name: 'Wages & Salaries', entry_type: 'expense' },
  { match: /\b(material|hardware|cement|steel)\b/i, name: 'Materials', entry_type: 'purchase' },
  { match: /\b(subcontractor|contractor)\b/i, name: 'Subcontractor', entry_type: 'purchase' },
]

export function isReceiptImage(file) {
  return Boolean(file && IMAGE_TYPES.has(file.type))
}

export function isReceiptPdf(file) {
  return Boolean(file && (file.type === PDF_TYPE || /\.pdf$/i.test(file.name || '')))
}

export function validateReceiptFile(file) {
  if (!file) throw new Error('Choose a receipt image or PDF.')
  if (!isReceiptImage(file) && !isReceiptPdf(file)) {
    throw new Error('Use a JPG, PNG, WebP, GIF, or PDF file.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('File must be 8 MB or smaller.')
  }
}

function parseLooseNumber(raw) {
  let s = String(raw).replace(/[^\d.,]/g, '')
  if (!s) return null
  // European 1.234,56 → 1234.56
  if (/\.\d{3},\d{2}$/.test(s) || /^\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/,\d{3}\.\d{2}$/.test(s) || /^\d{1,3}(,\d{3})+\.\d{2}$/.test(s)) {
    s = s.replace(/,/g, '')
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function extractAmount(text) {
  const candidates = []
  const re =
    /(?:(?:lkr|rs\.?|usd|gbp|€|£|\$)\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2}|\d{2,})(?:\s*(?:lkr|rs\.?))?/gi
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseLooseNumber(m[1])
    if (n != null && n < 1e9) candidates.push(n)
  }
  if (!candidates.length) return null
  // Prefer amounts that look like money (have cents) when available
  const withCents = candidates.filter((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 && String(n).includes('.'))
  const pool = withCents.length ? withCents : candidates
  return Math.max(...pool)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toISODate(y, m, d) {
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const iso = `${year}-${pad2(month)}-${pad2(day)}`
  const dt = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return null
  return iso
}

function extractEntryDate(text) {
  const today = todayISO()
  // YYYY-MM-DD
  let m = text.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/)
  if (m) {
    const iso = toISODate(m[1], m[2], m[3])
    if (iso && iso <= today) return iso
  }
  // DD/MM/YYYY or DD-MM-YYYY (prefer day-first for LK)
  m = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    // If first number > 12, must be DD/MM
    if (d > 12) {
      const iso = toISODate(m[3], mo, d)
      if (iso && iso <= today) return iso
    } else if (mo > 12) {
      const iso = toISODate(m[3], d, mo)
      if (iso && iso <= today) return iso
    } else {
      // Ambiguous: try DD/MM first (Sri Lanka)
      const iso = toISODate(m[3], mo, d)
      if (iso && iso <= today) return iso
    }
  }
  return today
}

function extractDescription(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2 && !/^[\d\W]+$/.test(l))
  if (!lines.length) return ''
  const pick = lines.slice(0, 2).join(' · ')
  return pick.slice(0, 160)
}

function extractType(text) {
  const lower = String(text || '').toLowerCase()
  for (const row of TYPE_KEYWORDS) {
    if (row.words.some((w) => lower.includes(w))) return row.type
  }
  return 'expense'
}

function extractCategory(text, type, libraryCategories = []) {
  const lower = String(text || '').toLowerCase()
  const lib = (libraryCategories || []).filter((c) => !c.entry_type || c.entry_type === type || c.entry_type === 'all')
  for (const c of lib) {
    const name = String(c.name || '').trim()
    if (name.length >= 3 && lower.includes(name.toLowerCase())) return name
  }
  for (const hint of CATEGORY_HINTS) {
    if (hint.entry_type === type && hint.match.test(text)) return hint.name
  }
  return ''
}

/**
 * Parse raw Tesseract text into form fields.
 * @returns {{ amount: number|null, entry_date: string, description: string, type: string, category: string, confidenceNotes: string[] }}
 */
export function parseReceiptText(rawText, { libraryCategories = [] } = {}) {
  const text = String(rawText || '').replace(/\u00a0/g, ' ')
  const type = extractType(text)
  const amount = extractAmount(text)
  const entry_date = extractEntryDate(text)
  const description = extractDescription(text)
  const category = extractCategory(text, type, libraryCategories)
  const confidenceNotes = []
  if (amount == null) confidenceNotes.push('Could not detect amount — enter it manually.')
  if (!description) confidenceNotes.push('Could not detect vendor — add a description.')
  if (!category) confidenceNotes.push('Pick a category that matches this bill.')
  return {
    amount,
    entry_date,
    description,
    type: isEntryType(type) ? type : 'expense',
    category,
    confidenceNotes,
  }
}

/**
 * Run client-side OCR with tesseract.js (dynamic import keeps initial bundle smaller).
 */
export async function ocrReceiptImage(file, { onProgress } = {}) {
  validateReceiptFile(file)
  if (!isReceiptImage(file)) {
    throw new Error('OCR works on images only. PDF was attached without scanning.')
  }
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (typeof onProgress === 'function' && m?.status === 'recognizing text') {
        onProgress(Number(m.progress) || 0)
      }
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return {
      text: data?.text || '',
      confidence: data?.confidence ?? null,
    }
  } finally {
    await worker.terminate()
  }
}
