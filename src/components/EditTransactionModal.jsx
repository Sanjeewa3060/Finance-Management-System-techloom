import React, { useEffect, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import CategoryField, { pickCategoryForType } from './CategoryField.jsx'
import EntryReceipt from './EntryReceipt.jsx'
import ReceiptScanField from './ReceiptScanField.jsx'
import TransactionEditHistory from './TransactionEditHistory.jsx'
import { CURRENCY_LABEL } from '../utils/money.js'
import { PAYMENT_METHOD_IDS, PAYMENT_METHODS } from '../utils/constants.js'
import { getReceiptUrl } from '../utils/receiptDisplay.js'

import { ENTRY_TYPE_IDS, ENTRY_TYPES, OTHER_DIRECTIONS, resolveOtherDirection } from '../utils/entryTypes.js'

export default function EditTransactionModal({
  open,
  transaction,
  departments,
  onClose,
  onSave,
  transactions = [],
  loading = false,
  libraryCategories = [],
  recentCategoryNames = [],
  onCreateCategory,
  isAdmin = false,
  hideDepartmentField = false,
  authUserId = 'anon',
}) {
  const [departmentId, setDepartmentId] = useState('')
  const [type, setType] = useState('sale')
  const [otherDirection, setOtherDirection] = useState('expense')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [error, setError] = useState(null)
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [attachmentPath, setAttachmentPath] = useState(null)
  const [rawOcrData, setRawOcrData] = useState(null)
  const [receiptScanKey, setReceiptScanKey] = useState(0)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  useEffect(() => {
    if (!transaction) return
    setDepartmentId(transaction.department_id ?? departments?.[0]?.id ?? '')
    setType(transaction.type ?? 'sale')
    setOtherDirection(resolveOtherDirection(transaction) ?? 'expense')
    setCategory(transaction.category ?? '')
    setDescription(transaction.description ?? '')
    setAmount(String(transaction.amount ?? ''))
    setEntryDate(transaction.entry_date ?? '')
    setPaymentMethod(PAYMENT_METHOD_IDS.includes(transaction.payment_method) ? transaction.payment_method : 'cash')
    setReceiptUrl(getReceiptUrl(transaction))
    setAttachmentPath(transaction.attachment_path ?? null)
    setRawOcrData(transaction.raw_ocr_data ?? null)
    setReceiptScanKey((k) => k + 1)
    setError(null)
  }, [transaction, departments])

  useEffect(() => {
    if (!transaction) return
    const next = pickCategoryForType(libraryCategories, transactions, type, category)
    if (next !== category) setCategory(next)
  }, [type, libraryCategories, transactions, category, transaction])

  const canSave = useMemo(() => {
    const a = Number(amount)
    return (
      !!transaction?.id &&
      !!departmentId &&
      ENTRY_TYPE_IDS.includes(type) &&
      category.trim().length > 0 &&
      Number.isFinite(a) &&
      a > 0 &&
      !!entryDate &&
      PAYMENT_METHOD_IDS.includes(paymentMethod) &&
      !loading
    )
  }, [transaction, departmentId, type, category, amount, entryDate, paymentMethod, loading])

  async function handleSave() {
    setError(null)
    try {
      await onSave?.({
        id: transaction.id,
        department_id: departmentId,
        type,
        other_direction: type === 'other' ? otherDirection : null,
        category: category.trim(),
        description: description.trim() ? description.trim() : null,
        amount: Number(amount),
        entry_date: entryDate,
        payment_method: paymentMethod,
        attachment_path: attachmentPath,
        receipt_url: receiptUrl,
        raw_ocr_data: rawOcrData,
      })
      setHistoryRefreshKey((k) => k + 1)
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Failed to update transaction.')
    }
  }

  function handleReceiptExtracted(result) {
    setError(null)
    // Proof-only attach — do not auto-fill form fields from OCR.
    setReceiptUrl(result.receipt_url || null)
    setAttachmentPath(result.attachment_path || null)
    setRawOcrData(result.raw_ocr_data || null)
  }

  if (!open || !transaction) return null

  return (
    <Modal
      open={open}
      title="Edit Transaction"
      size="md"
      onClose={() => {
        if (!loading) onClose()
      }}
      footer={
        <div className="theme-modal-footer">
          <button type="button" onClick={handleSave} disabled={!canSave} className="theme-btn-primary theme-btn-primary--block">
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={onClose} disabled={loading} className="theme-btn-secondary">
            Cancel
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {!hideDepartmentField ? (
          <div>
            <label className="text-sm font-medium text-slate-200">Department</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="theme-input" disabled={loading}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={`grid gap-3 ${hideDepartmentField ? '' : 'sm:grid-cols-2'}`}>
          <div>
            <label className="text-sm font-medium text-slate-200">Type</label>
            <select
              value={type}
              onChange={(e) => {
                const nextType = e.target.value
                setType(nextType)
                if (nextType !== 'other') setOtherDirection('expense')
                setCategory(pickCategoryForType(libraryCategories, transactions, nextType, ''))
              }}
              className="theme-input"
              disabled={loading}
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {type === 'other' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOtherDirection('profit')}
                  disabled={loading}
                  title="Profit (Other income)"
                  className={`min-w-[2.75rem] flex-1 sm:flex-none ${
                    otherDirection === 'profit'
                      ? 'theme-btn-primary'
                      : 'theme-btn-secondary text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {OTHER_DIRECTIONS.profit.label}
                </button>
                <button
                  type="button"
                  onClick={() => setOtherDirection('expense')}
                  disabled={loading}
                  title="Expense"
                  className={`min-w-[2.75rem] flex-1 sm:flex-none ${
                    otherDirection === 'expense'
                      ? 'theme-btn-danger'
                      : 'theme-btn-secondary text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {OTHER_DIRECTIONS.expense.label}
                </button>
                <span className="text-xs text-slate-500">
                  {otherDirection === 'profit' ? 'Other income' : 'Expense'}
                </span>
              </div>
            ) : null}
          </div>
          <CategoryField
            layout="full"
            type={type}
            libraryCategories={libraryCategories}
            recentCategoryNames={recentCategoryNames}
            transactions={transactions}
            value={category}
            onChange={setCategory}
            onCreateCategory={onCreateCategory}
            isAdmin={isAdmin}
            loading={loading}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-200">Payment method</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPaymentMethod(opt.id)}
                disabled={loading}
                className={`flex-1 sm:flex-none ${
                  paymentMethod === opt.id ? 'theme-btn-primary' : 'theme-btn-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-200">Description / name</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="theme-input"
            disabled={loading}
            placeholder="Optional note or name"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-200">Amount ({CURRENCY_LABEL})</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="theme-input"
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-200">Date</label>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="theme-input" disabled={loading} />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">Receipt / bill (proof)</label>
          {receiptUrl ? (
            <div className="mb-3 flex items-center gap-3">
              <EntryReceipt
                transaction={{ receipt_url: receiptUrl, raw_ocr_data: rawOcrData }}
                size="lg"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setReceiptUrl(null)
                  setAttachmentPath(null)
                  setRawOcrData(null)
                  setReceiptScanKey((k) => k + 1)
                }}
                className="theme-btn-secondary text-xs"
              >
                Remove bill
              </button>
            </div>
          ) : (
            <p className="mb-2 text-xs text-slate-500">No receipt attached yet.</p>
          )}
          <ReceiptScanField
            key={receiptScanKey}
            disabled={loading}
            userId={authUserId}
            onExtracted={handleReceiptExtracted}
            onCleared={() => {
              setReceiptUrl(null)
              setAttachmentPath(null)
              setRawOcrData(null)
            }}
          />
        </div>

        {error ? <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

        <div className="border-t border-slate-700/60 pt-4">
          <TransactionEditHistory
            transactionId={transaction.id}
            departments={departments}
            refreshKey={historyRefreshKey}
            compact
          />
        </div>
      </div>
    </Modal>
  )
}
