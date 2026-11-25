/**
 * Frontend feature flags (UI only — no AWS / Edge secrets).
 * Unset or any value other than "true" → OFF.
 */

/** Amazon Textract Analyze Bill UI (Analyze Bill button, review, Apply). */
export const ENABLE_BILL_OCR =
  String(import.meta.env.VITE_ENABLE_BILL_OCR ?? '').toLowerCase() === 'true'
