import React, { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { APP_RED } from '../utils/themeColors.js'

const PRESET_COLORS = [
  '#6366f1',
  '#22c55e',
  '#f97316',
  APP_RED,
  '#14b8a6',
  '#eab308',
  '#a855f7',
  '#3b82f6',
]

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function AddDepartmentModal({
  open,
  onClose,
  onSave,
  isAdmin = false,
  loading = false,
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [color, setColor] = useState(randomFrom(PRESET_COLORS))
  const [error, setError] = useState(null)

  const canSave = useMemo(() => {
    if (!name.trim() || loading) return false
    if (isAdmin) return email.trim().length > 0 && password.length >= 8
    return true
  }, [name, email, password, loading, isAdmin])

  function reset() {
    setName('')
    setEmail('')
    setPassword('')
    setColor(randomFrom(PRESET_COLORS))
    setError(null)
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  async function handleSave() {
    setError(null)
    try {
      const result = await onSave({
        name: name.trim(),
        color,
        email: email.trim(),
        password,
      })
      if (result === false) return
      reset()
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Failed to add department.')
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      title="Add Department"
      onClose={handleClose}
      footer={
        <div className="theme-modal-footer">
          <button type="button" onClick={handleSave} disabled={!canSave} className="theme-btn-primary theme-btn-primary--block">
            {loading ? 'Saving…' : 'Create department'}
          </button>
          <button type="button" onClick={handleClose} disabled={loading} className="theme-btn-secondary">
            Cancel
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {isAdmin ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100/90">
            Each department gets its own login, dashboard, and data. Only that department can see its entries.
          </div>
        ) : null}

        <div>
          <label className="text-sm font-medium text-slate-200">Department name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Manchester Store"
            className="theme-input mt-1"
            disabled={loading}
          />
        </div>

        {isAdmin ? (
          <>
            <div>
              <label className="text-sm font-medium text-slate-200">Login email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="department@example.com"
                className="theme-input mt-1"
                disabled={loading}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-200">Login password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="theme-input mt-1"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          </>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-slate-200">Color</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setColor(randomFrom(PRESET_COLORS))}
                disabled={loading}
                className="theme-btn-secondary px-3 text-xs"
              >
                Random
              </button>
              <div className="h-9 w-9 rounded-lg border border-slate-700" style={{ backgroundColor: color }} aria-label={`Selected color: ${color}`} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                disabled={loading}
                className="h-8 w-8 rounded-lg border border-slate-800 hover:border-slate-600 disabled:opacity-50"
                style={{
                  backgroundColor: c,
                  outline: c === color ? '2px solid rgba(99,102,241,0.9)' : 'none',
                  outlineOffset: '2px',
                }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>

        {error ? <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}
      </div>
    </Modal>
  )
}
