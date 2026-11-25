import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import CategoryField, { pickCategoryForType } from './CategoryField.jsx'
import { formatDisplayDate, todayISO } from '../utils/dates.js'
import {
  clearEntryDateLock,
  isLockExpired,
  resolveEntryDateLock,
  saveEntryDateLock,
} from '../utils/entryDateLock.js'
import { DEFAULT_CURRENCY, CURRENCY_LABEL } from '../utils/money.js'
import { PAYMENT_METHOD_IDS, PAYMENT_METHODS } from '../utils/constants.js'
import { ENTRY_TYPES, OTHER_DIRECTIONS, entryTypeIdleButtonClass, entryTypeSelectedButtonClass } from '../utils/entryTypes.js'
import ReceiptScanField from './ReceiptScanField.jsx'
import { mapNormalizedToEntryFields } from '../utils/textractNormalize.js'

function resolveStickyEntryDate(initialDate, lastSavedEntryDate, lastSavedSessionDay) {
  if (initialDate) return initialDate
  if (lastSavedEntryDate && lastSavedSessionDay === todayISO()) return lastSavedEntryDate
  return todayISO()
}

/** Keep-date should follow the Transactions page day when the modal was opened from there. */
function resolveDateToKeep(pageDate, formDate) {
  return pageDate || formDate
}

export default function AddEntryModal({
  open,
  onClose,
  onSave,
  departments,
  transactions = [],
  loading = false,
  libraryCategories = [],
  recentCategoryNames = [],
  onCreateCategory,
  isAdmin = false,
  hideDepartmentField = false,
  initialDate = null,
  initialDepartmentId = null,
  requiresApproval = false,
  authUserId = 'anon',
  authUser = null,
}) {
  const [departmentId, setDepartmentId] = useState(departments?.[0]?.id ?? '')
  const [type, setType] = useState('sale')
  const [otherDirection, setOtherDirection] = useState('expense')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(todayISO())
  const [vatRate, setVatRate] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [error, setError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [categoryFieldKey, setCategoryFieldKey] = useState(0)
  const [keepDateLocked, setKeepDateLocked] = useState(false)
  const [lockSessionDay, setLockSessionDay] = useState('')
  /** Remembers the date from the last successful save for consecutive adds (same calendar day). */
  const [lastSavedEntryDate, setLastSavedEntryDate] = useState(null)
  const [lastSavedSessionDay, setLastSavedSessionDay] = useState('')
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [attachmentPath, setAttachmentPath] = useState(null)
  const [rawOcrData, setRawOcrData] = useState(null)
  const [receiptScanKey, setReceiptScanKey] = useState(0)
  const wasOpenRef = useRef(false)

  function clearSaveSuccess() {
    setSaveSuccess(false)
  }

  const expireDateLockIfNeeded = useCallback(() => {
    if (!keepDateLocked || !lockSessionDay) return false
    if (!isLockExpired(lockSessionDay)) return false
    clearEntryDateLock()
    setKeepDateLocked(false)
    setLockSessionDay('')
    setEntryDate(resolveStickyEntryDate(initialDate, lastSavedEntryDate, lastSavedSessionDay))
    return true
  }, [keepDateLocked, lockSessionDay, initialDate, lastSavedEntryDate, lastSavedSessionDay])

  function handleKeepDateChange(checked) {
    clearSaveSuccess()
    if (checked) {
      const sessionDay = todayISO()
      const lockedDate = resolveDateToKeep(initialDate, entryDate)
      if (lockedDate && lockedDate !== entryDate) setEntryDate(lockedDate)
      setKeepDateLocked(true)
      setLockSessionDay(sessionDay)
      saveEntryDateLock({ entryDate: lockedDate, sessionDay })
      return
    }
    clearEntryDateLock()
    setKeepDateLocked(false)
    setLockSessionDay('')
  }

  // Init date / lock only when the modal opens — not when departments refresh after save
  // (that was resetting the date back to today between consecutive adds).
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true
    if (!justOpened) return

    const stored = resolveEntryDateLock()
    if (initialDate) {
      // Transactions page date wins over a leftover lock from another day.
      setEntryDate(initialDate)
      if (stored) {
        setKeepDateLocked(true)
        setLockSessionDay(stored.sessionDay)
        saveEntryDateLock({ entryDate: initialDate, sessionDay: stored.sessionDay })
      } else {
        setKeepDateLocked(false)
        setLockSessionDay('')
      }
    } else if (stored) {
      setKeepDateLocked(true)
      setLockSessionDay(stored.sessionDay)
      setEntryDate(stored.entryDate)
    } else {
      setKeepDateLocked(false)
      setLockSessionDay('')
      setEntryDate(resolveStickyEntryDate(null, lastSavedEntryDate, lastSavedSessionDay))
    }
    if (initialDepartmentId && departments.some((d) => d.id === initialDepartmentId)) {
      setDepartmentId(initialDepartmentId)
    }
    setError(null)
    setSaveSuccess(false)
  }, [open, initialDate, initialDepartmentId, departments, lastSavedEntryDate, lastSavedSessionDay])

  useEffect(() => {
    if (!open || !keepDateLocked || !initialDate) return
    if (entryDate !== initialDate) setEntryDate(initialDate)
  }, [open, keepDateLocked, initialDate, entryDate])

  useEffect(() => {
    if (!open || !keepDateLocked) return

    function checkExpiry() {
      expireDateLockIfNeeded()
    }

    checkExpiry()
    const intervalId = window.setInterval(checkExpiry, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkExpiry()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [open, keepDateLocked, expireDateLockIfNeeded])

  useEffect(() => {
    if (departments.length === 0) {
      setDepartmentId('')
      return
    }
    if (!departments.some((d) => d.id === departmentId)) {
      setDepartmentId(departments[0].id)
    }
  }, [departments, departmentId])

  useEffect(() => {
    const next = pickCategoryForType(libraryCategories, transactions, type, category)
    if (next !== category) setCategory(next)
  }, [type, libraryCategories, transactions, category])

  function handleTypeChange(nextType) {
    clearSaveSuccess()
    setType(nextType)
    if (nextType !== 'other') setOtherDirection('expense')
    setCategory(pickCategoryForType(libraryCategories, transactions, nextType, ''))
  }

  const canSave = useMemo(() => {
    const a = Number(amount)
    return (
      !!departmentId &&
      category.trim().length > 0 &&
      Number.isFinite(a) &&
      a > 0 &&
      !!entryDate &&
      PAYMENT_METHOD_IDS.includes(paymentMethod) &&
      !loading
    )
  }, [departmentId, category, amount, entryDate, paymentMethod, loading])

  function resetAfterSave(savedDate) {
    // Keep entryDate (and most other fields) so "Add another" stays on the same day.
    if (savedDate) {
      setLastSavedEntryDate(savedDate)
      setLastSavedSessionDay(todayISO())
      if (keepDateLocked && lockSessionDay && !isLockExpired(lockSessionDay)) {
        const lockedDate = resolveDateToKeep(initialDate, savedDate)
        if (lockedDate && lockedDate !== entryDate) setEntryDate(lockedDate)
        saveEntryDateLock({ entryDate: lockedDate, sessionDay: lockSessionDay })
      }
    }
    setDescription('')
    setAmount('')
    setError(null)
    setReceiptUrl(null)
    setAttachmentPath(null)
    setRawOcrData(null)
    setReceiptScanKey((k) => k + 1)
    setCategoryFieldKey((k) => k + 1)
  }

  function resetOnClose() {
    setDepartmentId(departments?.[0]?.id ?? '')
    setType('sale')
    setOtherDirection('expense')
    setCategory(pickCategoryForType(libraryCategories, transactions, 'sale', ''))
    setDescription('')
    setAmount('')
    if (keepDateLocked && lockSessionDay && !isLockExpired(lockSessionDay)) {
      saveEntryDateLock({ entryDate: resolveDateToKeep(initialDate, entryDate), sessionDay: lockSessionDay })
    } else {
      clearEntryDateLock()
      setKeepDateLocked(false)
      setLockSessionDay('')
      setEntryDate(resolveStickyEntryDate(initialDate, lastSavedEntryDate, lastSavedSessionDay))
    }
    setVatRate('0')
    setPaymentMethod('cash')
    setError(null)
    setReceiptUrl(null)
    setAttachmentPath(null)
    setRawOcrData(null)
    setReceiptScanKey((k) => k + 1)
    setCategoryFieldKey((k) => k + 1)
  }

  function handleClose() {
    if (loading) return
    setSaveSuccess(false)
    resetOnClose()
    onClose()
  }

  function handleReceiptExtracted(result) {
    clearSaveSuccess()
    setError(null)
    // Attach proof / pending scan metadata — form fields fill only after review Apply.
    setReceiptUrl(result.receipt_url || null)
    setAttachmentPath(result.attachment_path || null)
    setRawOcrData(result.raw_ocr_data || null)
  }

  function handleScanApplied(reviewed, meta) {
    clearSaveSuccess()
    setError(null)
    // Never set Entry Type from OCR — user picks it manually.
    const { patch } = mapNormalizedToEntryFields(reviewed)
    if (patch.description) setDescription(patch.description)
    if (patch.amount) setAmount(patch.amount)
    if (patch.entry_date) {
      const iso = String(patch.entry_date)
      if (iso <= todayISO()) {
        if (!keepDateLocked) setEntryDate(iso)
      }
    }
    if (meta?.receipt_url) setReceiptUrl(meta.receipt_url)
    if (meta?.attachment_path) setAttachmentPath(meta.attachment_path)
    setRawOcrData({
      fileName: meta?.fileName ?? null,
      contentType: meta?.contentType ?? null,
      attachedAt: new Date().toISOString(),
      mode: 'scan',
      source: 'amazon_textract_analyze_expense',
      fields: reviewed,
      appliedAt: new Date().toISOString(),
    })
  }

  async function handleSave() {
    setError(null)
    setSaveSuccess(false)
    try {
      const a = Number(amount)
      await onSave({
        department_id: departmentId,
        type,
        other_direction: type === 'other' ? otherDirection : null,
        category: category.trim(),
        description: description.trim() ? description.trim() : null,
        amount: a,
        entry_date: entryDate,
        currency: DEFAULT_CURRENCY,
        vat_rate: Number(vatRate) || 0,
        payment_method: paymentMethod,
        attachment_path: attachmentPath,
        receipt_url: receiptUrl,
        raw_ocr_data: rawOcrData,
      })
      resetAfterSave(entryDate)
      setSaveSuccess(true)
    } catch (e) {
      setError(e?.message ?? 'Failed to add entry.')
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      title="Add Entry"
      size="lg"
      closeOnBackdrop={false}
      onClose={handleClose}
      footer={
        <div className="theme-modal-footer">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || departments.length === 0}
            className="theme-btn-primary theme-btn-primary--block"
          >
            {loading ? 'Saving…' : 'Save entry'}
          </button>
          <button type="button" onClick={handleClose} disabled={loading} className="theme-btn-secondary">
            Close
          </button>
        </div>
      }
    >
      {departments.length === 0 ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          {hideDepartmentField
            ? 'Your department account is not linked yet. Contact admin.'
            : 'Create a department first, then add entries by date.'}
        </div>
      ) : null}

      {saveSuccess ? (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Entry saved. Add another or click Close.
        </div>
      ) : null}

      <div className="space-y-5">
        <ReceiptScanField
          key={receiptScanKey}
          disabled={loading}
          userId={authUserId}
          authUser={authUser}
          departmentId={departmentId || null}
          onExtracted={handleReceiptExtracted}
          onScanApplied={handleScanApplied}
          onCleared={() => {
            clearSaveSuccess()
            setReceiptUrl(null)
            setAttachmentPath(null)
            setRawOcrData(null)
          }}
        />
        {receiptUrl ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Receipt / bill attached as proof — it will be saved with this entry. Choose Entry Type manually before
            saving.
          </p>
        ) : null}

        <section>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Date</label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={entryDate}
              max={todayISO()}
              onChange={(e) => {
                if (keepDateLocked) return
                clearSaveSuccess()
                setEntryDate(e.target.value)
              }}
              className="theme-input w-full max-w-xs"
              disabled={loading || keepDateLocked}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={keepDateLocked}
                onChange={(e) => handleKeepDateChange(e.target.checked)}
                disabled={loading || !(entryDate || initialDate)}
                className="h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500"
              />
              Keep this date
            </label>
          </div>
          {keepDateLocked ? (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {initialDate
                ? `Locked to ${formatDisplayDate(entryDate)} — same as the Transactions page. Stay on this date for the next entries. Uncheck or return tomorrow to use today's date.`
                : `Locked to ${formatDisplayDate(entryDate)} — stay on this date for the next entries. Uncheck or return tomorrow to use today's date.`}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {initialDate
                ? 'After you save, this date stays for the next entry. Check Keep this date to lock to the Transactions page date.'
                : 'After you save, this date stays for the next entry. Check Keep this date to lock the field.'}
            </p>
          )}
        </section>

        <section className={hideDepartmentField ? '' : 'grid gap-4 sm:grid-cols-2'}>
          {!hideDepartmentField ? (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Department</label>
              <select
                value={departmentId}
                onChange={(e) => {
                  clearSaveSuccess()
                  setDepartmentId(e.target.value)
                }}
                className="theme-input mt-1"
                disabled={loading || departments.length === 0}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Entry type</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {ENTRY_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id)}
                  disabled={loading}
                  className={`flex-1 sm:flex-none ${
                    type === t.id
                      ? entryTypeSelectedButtonClass(t.id, t.id === 'other' ? otherDirection : null)
                      : entryTypeIdleButtonClass(t.id, t.id === 'other' ? otherDirection : null)
                  }`}
                >
                  {t.label}
                </button>
              ))}
              {type === 'other' ? (
                <>
                  <span className="hidden h-6 w-px bg-slate-600/50 sm:inline" aria-hidden />
                  <button
                    type="button"
                    onClick={() => {
                      clearSaveSuccess()
                      setOtherDirection('profit')
                    }}
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
                    onClick={() => {
                      clearSaveSuccess()
                      setOtherDirection('expense')
                    }}
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
                </>
              ) : null}
            </div>
            {type === 'other' ? (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {otherDirection === 'profit'
                  ? `${OTHER_DIRECTIONS.profit.label} Profit — counts as Other income in reports`
                  : `${OTHER_DIRECTIONS.expense.label} Expense — counts as expense in reports`}
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <CategoryField
            key={categoryFieldKey}
            layout="full"
            type={type}
            libraryCategories={libraryCategories}
            recentCategoryNames={recentCategoryNames}
            transactions={transactions}
            value={category}
            onChange={(v) => {
              clearSaveSuccess()
              setCategory(v)
            }}
            onCreateCategory={onCreateCategory}
            isAdmin={isAdmin}
            loading={loading}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Payment method</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    clearSaveSuccess()
                    setPaymentMethod(opt.id)
                  }}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Amount ({CURRENCY_LABEL})</label>
              <input
                value={amount}
                onChange={(e) => {
                  clearSaveSuccess()
                  setAmount(e.target.value)
                }}
                type="number"
                min="0"
                step="0.01"
                className="theme-input mt-1"
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">VAT %</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={vatRate}
                onChange={(e) => {
                  clearSaveSuccess()
                  setVatRate(e.target.value)
                }}
                className="theme-input mt-1"
                disabled={loading}
              />
            </div>
          </div>
        </section>

        <section>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => {
              clearSaveSuccess()
              setDescription(e.target.value)
            }}
            className="theme-input mt-1"
            placeholder="Notes for this entry"
            disabled={loading}
          />
        </section>

        {requiresApproval ? (
          <p className="text-xs text-amber-700 dark:text-amber-200/90">Entries may need approval before they appear in reports.</p>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
      ) : null}
    </Modal>
  )
}
