import React, { useRef, useState } from 'react'
import { FileImage, Loader2, ScanLine, Upload, X } from 'lucide-react'
import { ENABLE_BILL_OCR } from '../config/features.js'
import AppIcon from './AppIcon.jsx'
import BillScanReview from './BillScanReview.jsx'
import { analyzeBill } from '../utils/analyzeBill.js'
import { BILL_SCAN_TYPES, validateBillScanFile } from '../utils/billScanValidation.js'
import { isReceiptImage, validateReceiptFile } from '../utils/receiptOcr.js'
import { uploadReceipt } from '../utils/receiptUpload.js'

function canAnalyzeBill(file) {
  return Boolean(file && BILL_SCAN_TYPES.has(file.type))
}

/**
 * Receipt / bill attach (proof) + optional Textract scan via Edge Function.
 * Upload always preserves proof. Analyze UI is gated by VITE_ENABLE_BILL_OCR
 * (default OFF). When enabled, Analyze runs only after an explicit [Analyze Bill]
 * click for JPEG/PNG. OCR never auto-fills until Apply, and never sets Entry Type.
 */
export default function ReceiptScanField({
  disabled = false,
  userId = 'anon',
  authUser = null,
  departmentId = null,
  onExtracted,
  onCleared,
  onScanApplied,
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [status, setStatus] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [scanFields, setScanFields] = useState(null)
  const [attachedMeta, setAttachedMeta] = useState(null)

  // Feature flag default OFF — proof upload stays; Analyze Bill / review stay dormant.
  const scanEnabled = ENABLE_BILL_OCR && Boolean(authUser && onScanApplied)
  const analyzable = scanEnabled && canAnalyzeBill(pendingFile)
  const working = busy || analyzing

  function clearPreview({ notify = true } = {}) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setFileName('')
    setError('')
    setStatus('')
    setPendingFile(null)
    setScanFields(null)
    setAttachedMeta(null)
    if (inputRef.current) inputRef.current.value = ''
    if (notify) onCleared?.()
  }

  async function processFile(file) {
    if (!file || disabled || working) return
    setError('')
    setStatus('')
    setScanFields(null)

    try {
      validateReceiptFile(file)
    } catch (e) {
      setError(e?.message || 'Invalid file.')
      return
    }

    clearPreview({ notify: false })
    setFileName(file.name)
    setPendingFile(file)
    if (isReceiptImage(file)) {
      setPreviewUrl(URL.createObjectURL(file))
    }

    setBusy(true)
    try {
      setStatus('Uploading receipt…')
      const uploaded = await uploadReceipt(file, { userId })
      const meta = {
        receipt_url: uploaded.publicUrl,
        attachment_path: uploaded.path,
      }
      setAttachedMeta(meta)

      const jpegPng = canAnalyzeBill(file)
      setStatus(
        scanEnabled && jpegPng
          ? 'Receipt attached as proof. Click Analyze Bill to extract fields.'
          : scanEnabled
            ? 'Receipt attached as proof. Bill analysis is available for JPEG/PNG only.'
            : 'Receipt attached as proof.',
      )
      onExtracted?.({
        receipt_url: uploaded.publicUrl,
        attachment_path: uploaded.path,
        raw_ocr_data: {
          fileName: file.name,
          contentType: file.type,
          attachedAt: new Date().toISOString(),
          mode: 'attach',
          analyzable: scanEnabled && jpegPng,
        },
      })
    } catch (e) {
      setError(e?.message || 'Failed to attach receipt.')
      setStatus('')
      setPendingFile(null)
      setAttachedMeta(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleAnalyzeBill() {
    if (!pendingFile || !analyzable || disabled || working) return
    setError('')
    setScanFields(null)

    try {
      validateBillScanFile(pendingFile)
    } catch (e) {
      setError(e?.message || 'Invalid file for analysis.')
      return
    }

    setAnalyzing(true)
    setStatus('Analyzing…')
    try {
      const { fields, source } = await analyzeBill(pendingFile, { authUser, departmentId })
      setScanFields(fields)
      setStatus('Review the extracted fields below, then Apply to Entry.')
      onExtracted?.({
        receipt_url: attachedMeta?.receipt_url ?? null,
        attachment_path: attachedMeta?.attachment_path ?? null,
        raw_ocr_data: {
          fileName: pendingFile.name,
          contentType: pendingFile.type,
          attachedAt: new Date().toISOString(),
          mode: 'scan',
          source,
          pendingReview: true,
        },
      })
    } catch (e) {
      setError(e?.message || 'Failed to analyze bill.')
      setStatus(
        attachedMeta
          ? 'Receipt proof is still attached. You can retry Analyze Bill or enter fields manually.'
          : '',
      )
      setScanFields(null)
    } finally {
      setAnalyzing(false)
    }
  }

  function handleApplyReview(reviewed) {
    if (!pendingFile && !attachedMeta) return
    onScanApplied?.(reviewed, {
      receipt_url: attachedMeta?.receipt_url ?? null,
      attachment_path: attachedMeta?.attachment_path ?? null,
      fileName: fileName || pendingFile?.name || null,
      contentType: pendingFile?.type || null,
    })
    setScanFields(null)
    setStatus('Scanned fields applied — pick Entry Type, then save.')
  }

  return (
    <section className="rounded-xl border border-slate-600/40 bg-slate-900/40 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Attach receipt / bill</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {scanEnabled
              ? 'Upload keeps a proof copy with this entry. For JPEG/PNG, use Analyze Bill to extract fields for review — nothing is applied until you confirm.'
              : 'Upload an image or PDF to keep as proof with this entry.'}
          </p>
        </div>
        {fileName ? (
          <button
            type="button"
            onClick={clearPreview}
            disabled={working || disabled}
            className="theme-btn-secondary h-9 w-9 shrink-0 px-0"
            aria-label="Clear receipt"
            title="Clear"
          >
            <AppIcon icon={X} size="sm" />
          </button>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer?.files?.[0]
          if (file) processFile(file)
        }}
        onClick={() => !working && !disabled && inputRef.current?.click()}
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition ${
          dragOver
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-slate-600/70 bg-slate-950/40 hover:border-emerald-500/50'
        } ${working || disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <AppIcon
          icon={busy ? Loader2 : Upload}
          size="lg"
          className={busy ? 'animate-spin text-emerald-400' : 'text-slate-400'}
        />
        <div className="text-sm text-slate-200">
          {busy ? status || 'Uploading…' : 'Drag & drop receipt here, or click to browse'}
        </div>
        <div className="text-xs text-slate-500">JPG, PNG, WebP, GIF, or PDF · max 8 MB</div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="hidden"
        disabled={disabled || working}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) processFile(file)
        }}
      />

      {previewUrl || fileName ? (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-950/50 p-2">
          {previewUrl ? (
            <img src={previewUrl} alt="Receipt preview" className="h-14 w-14 rounded object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded bg-slate-800 text-slate-400">
              <AppIcon icon={FileImage} size="lg" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-slate-200">{fileName}</div>
            {status ? <div className="text-xs text-slate-400">{status}</div> : null}
          </div>
        </div>
      ) : null}

      {scanEnabled && attachedMeta && pendingFile && !scanFields ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {analyzable ? (
            <button
              type="button"
              onClick={handleAnalyzeBill}
              disabled={disabled || working}
              className="theme-btn-primary text-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <AppIcon
                  icon={analyzing ? Loader2 : ScanLine}
                  size="sm"
                  className={analyzing ? 'animate-spin' : ''}
                />
                {analyzing ? 'Analyzing…' : 'Analyze Bill'}
              </span>
            </button>
          ) : (
            <p className="text-xs text-slate-400">
              Bill analysis is JPEG/PNG only. This file is kept as proof — enter fields manually.
            </p>
          )}
        </div>
      ) : null}

      {scanFields ? (
        <BillScanReview
          fields={scanFields}
          disabled={disabled || working}
          onApply={handleApplyReview}
          onCancel={() => {
            setScanFields(null)
            setStatus('Scan discarded. Receipt proof is still attached.')
          }}
        />
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">
          {error}
        </div>
      ) : null}
    </section>
  )
}
