import { supabase } from '../lib/supabase.js'
import { isReceiptImage, isReceiptPdf, validateReceiptFile } from './receiptOcr.js'

function fileExtension(file) {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'image/svg+xml') return 'svg'
  const fromName = String(file.name || '').split('.').pop()
  if (fromName && fromName.length <= 5) return fromName.toLowerCase()
  return file.type?.split('/')[1] || 'bin'
}

/**
 * Upload receipt to Supabase Storage bucket `receipts`.
 * @returns {{ path: string, publicUrl: string }}
 */
export async function uploadReceipt(file, { userId = 'anon' } = {}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  validateReceiptFile(file)
  const safeUser = String(userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'anon'
  const path = `${safeUser}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExtension(file)}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, {
    upsert: false,
    cacheControl: '3600',
    contentType: file.type || (isReceiptPdf(file) ? 'application/pdf' : 'application/octet-stream'),
  })
  if (error) {
    const msg = String(error.message || error)
    if (/bucket|not found|does not exist/i.test(msg)) {
      throw new Error(
        'The receipts storage bucket is missing. Run supabase/receipts.sql in the Supabase SQL Editor, then try again.',
      )
    }
    throw error
  }
  const { data } = supabase.storage.from('receipts').getPublicUrl(path)
  return {
    path,
    publicUrl: data.publicUrl,
    kind: isReceiptImage(file) ? 'image' : 'pdf',
  }
}
