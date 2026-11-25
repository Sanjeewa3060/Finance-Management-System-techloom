import React, { useState } from 'react'
import Modal from './Modal.jsx'
import { parseTransactionsCsv } from '../utils/csvImport.js'

export default function BulkImportModal({ open, onClose, onImport, departments, loading }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(null)

  async function handleImport() {
    setError(null)
    try {
      const rows = parseTransactionsCsv(text)
      await onImport(rows)
      setText('')
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Import failed')
    }
  }

  if (!open) return null

  return (
    <Modal open={open} title="Bulk import CSV" onClose={onClose} footer={
      <div className="theme-modal-footer">
        <button type="button" disabled={loading} onClick={handleImport} className="theme-btn-primary theme-btn-primary--block">Import</button>
        <button type="button" onClick={onClose} className="theme-btn-secondary">Cancel</button>
      </div>
    }>
      <p className="text-xs text-slate-400 mb-2">Headers: date, type, category, amount, department (name), description</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm font-mono" placeholder="date,type,category,amount,department&#10;2026-06-01,expense,Rent,500,Main" />
      <p className="mt-2 text-xs text-slate-500">Known departments: {departments.map((d) => d.name).join(', ') || 'none'}</p>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
    </Modal>
  )
}
