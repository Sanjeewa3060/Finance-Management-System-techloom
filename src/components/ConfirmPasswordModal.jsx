import React, { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

export default function ConfirmPasswordModal({
  open,
  title = 'Confirm with password',
  message = 'Enter your login password to continue.',
  passwordLabel = 'Login password',
  confirmLabel = 'Confirm Delete',
  onConfirm,
  onClose,
  loading = false,
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setError('')
    setSubmitting(false)
  }, [open])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password.trim()) {
      setError('Password is required.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onConfirm?.(password)
      setPassword('')
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Action failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const busy = loading || submitting

  return (
    <Modal
      open={open}
      title={title}
      closeOnBackdrop={false}
      onClose={() => {
        if (!busy) onClose?.()
      }}
      footer={
        <div className="theme-modal-footer">
          <button
            type="submit"
            form="confirm-password-form"
            disabled={busy || !password.trim()}
            className="theme-btn-danger theme-btn-primary--block"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className="theme-btn-secondary">
            Cancel
          </button>
        </div>
      }
    >
      <form id="confirm-password-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-300">{message}</p>
        <div>
          <label className="text-sm font-medium text-slate-200">{passwordLabel}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="theme-input mt-1"
            autoComplete="current-password"
            disabled={busy}
            autoFocus
          />
        </div>
        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
        ) : null}
      </form>
    </Modal>
  )
}
