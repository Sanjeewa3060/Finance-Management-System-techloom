/** Shared bill-scan file rules (Edge Function mirrors these limits). */

export const BILL_SCAN_TYPES = new Set(['image/jpeg', 'image/png'])
export const BILL_SCAN_MAX_BYTES = 4.5 * 1024 * 1024

const FRIENDLY = {
  missing_file: 'Please choose a bill or receipt image to scan.',
  unsupported_file: 'Only JPEG and PNG images are supported for bill scanning.',
  too_large: 'That image is too large. Please use a file under 4.5 MB.',
}

export function validateBillScanFile(file) {
  if (!file) {
    const e = new Error(FRIENDLY.missing_file)
    e.code = 'missing_file'
    throw e
  }
  if (!BILL_SCAN_TYPES.has(file.type)) {
    const e = new Error(FRIENDLY.unsupported_file)
    e.code = 'unsupported_file'
    throw e
  }
  if (file.size > BILL_SCAN_MAX_BYTES) {
    const e = new Error(FRIENDLY.too_large)
    e.code = 'too_large'
    throw e
  }
}
