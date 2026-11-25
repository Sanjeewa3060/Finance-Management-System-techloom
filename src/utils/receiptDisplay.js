/** Public URL for a transaction's bill image / PDF. */
export function getReceiptUrl(tx) {
  const url = String(tx?.receipt_url ?? '').trim()
  return url || null
}

export function isPdfReceipt(tx) {
  const url = getReceiptUrl(tx) || ''
  const fileName = String(tx?.raw_ocr_data?.fileName ?? '')
  const contentType = String(tx?.raw_ocr_data?.contentType ?? '')
  return (
    contentType === 'application/pdf' ||
    /\.pdf($|\?)/i.test(url) ||
    /\.pdf$/i.test(fileName)
  )
}

export function hasReceipt(tx) {
  return Boolean(getReceiptUrl(tx))
}
