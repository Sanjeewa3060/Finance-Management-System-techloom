import React, { useEffect, useMemo, useState } from 'react'
import { isLowConfidence, LOW_CONFIDENCE_THRESHOLD } from '../utils/textractNormalize.js'

function FieldRow({ label, value, onChange, confidence, type = 'text', disabled }) {
  const low = isLowConfidence({ value, confidence })
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-300">{label}</label>
        {value != null && value !== '' ? (
          <span
            className={`text-[11px] ${low ? 'text-amber-300' : 'text-slate-500'}`}
            title={confidence != null ? `Confidence ${confidence}%` : 'Confidence unknown'}
          >
            {low ? 'Please verify' : confidence != null ? `${Math.round(confidence)}%` : ''}
          </span>
        ) : (
          <span className="text-[11px] text-slate-600">Not detected</span>
        )}
      </div>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`theme-input mt-1 text-sm ${low ? 'border-amber-500/50' : ''}`}
      />
    </div>
  )
}

/**
 * Editable review of Textract-normalized bill fields before applying to Add Entry.
 * Does not set Entry Type.
 */
export default function BillScanReview({
  fields,
  disabled = false,
  onApply,
  onCancel,
}) {
  const [vendor, setVendor] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [date, setDate] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [tax, setTax] = useState('')
  const [total, setTotal] = useState('')

  useEffect(() => {
    setVendor(fields?.vendor?.value ?? '')
    setInvoiceNumber(fields?.invoiceNumber?.value ?? '')
    setDate(fields?.date?.value ?? '')
    setSubtotal(fields?.subtotal?.value != null ? String(fields.subtotal.value) : '')
    setTax(fields?.tax?.value != null ? String(fields.tax.value) : '')
    setTotal(fields?.total?.value != null ? String(fields.total.value) : '')
  }, [fields])

  const lineItems = fields?.lineItems ?? []

  const hasLow = useMemo(() => {
    const keys = ['vendor', 'invoiceNumber', 'date', 'subtotal', 'tax', 'total']
    return keys.some((k) => isLowConfidence(fields?.[k]))
  }, [fields])

  function handleApply() {
    onApply?.({
      vendor: { value: vendor.trim() || null, confidence: fields?.vendor?.confidence ?? null },
      invoiceNumber: {
        value: invoiceNumber.trim() || null,
        confidence: fields?.invoiceNumber?.confidence ?? null,
      },
      date: { value: date.trim() || null, confidence: fields?.date?.confidence ?? null },
      subtotal: {
        value: subtotal === '' ? null : Number(subtotal),
        confidence: fields?.subtotal?.confidence ?? null,
      },
      tax: {
        value: tax === '' ? null : Number(tax),
        confidence: fields?.tax?.confidence ?? null,
      },
      total: {
        value: total === '' ? null : Number(total),
        confidence: fields?.total?.confidence ?? null,
      },
      lineItems,
    })
  }

  return (
    <section className="mt-3 rounded-xl border border-emerald-500/30 bg-slate-950/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Extracted Bill Details</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Correct any fields, then Apply to Entry. Entry type is never set automatically — pick it
            below.
          </p>
        </div>
        {hasLow ? (
          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
            Some fields need verification (under {LOW_CONFIDENCE_THRESHOLD}%)
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FieldRow
          label="Vendor"
          value={vendor}
          onChange={setVendor}
          confidence={fields?.vendor?.confidence}
          disabled={disabled}
        />
        <FieldRow
          label="Invoice #"
          value={invoiceNumber}
          onChange={setInvoiceNumber}
          confidence={fields?.invoiceNumber?.confidence}
          disabled={disabled}
        />
        <FieldRow
          label="Date"
          value={date}
          onChange={setDate}
          confidence={fields?.date?.confidence}
          type="date"
          disabled={disabled}
        />
        <FieldRow
          label="Total"
          value={total}
          onChange={setTotal}
          confidence={fields?.total?.confidence}
          type="number"
          disabled={disabled}
        />
        <FieldRow
          label="Subtotal"
          value={subtotal}
          onChange={setSubtotal}
          confidence={fields?.subtotal?.confidence}
          type="number"
          disabled={disabled}
        />
        <FieldRow
          label="Tax"
          value={tax}
          onChange={setTax}
          confidence={fields?.tax?.confidence}
          type="number"
          disabled={disabled}
        />
      </div>

      {lineItems.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-300">Line items (reference)</div>
          <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-xs text-slate-400">
            {lineItems.slice(0, 12).map((li, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-slate-800/80 py-1">
                <span className="truncate">{li.description || '—'}</span>
                <span className="shrink-0 tabular-nums">
                  {li.amount != null ? li.amount : '—'}
                  {isLowConfidence({ value: li.amount ?? li.description, confidence: li.confidence })
                    ? ' · verify'
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={handleApply} disabled={disabled} className="theme-btn-primary text-sm">
          Apply to Entry
        </button>
        <button type="button" onClick={onCancel} disabled={disabled} className="theme-btn-secondary text-sm">
          Discard scan
        </button>
      </div>
    </section>
  )
}
