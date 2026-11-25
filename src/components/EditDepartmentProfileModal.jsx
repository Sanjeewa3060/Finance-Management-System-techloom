import React, { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

export default function EditDepartmentProfileModal({
  open,
  profile,
  departmentName = '',
  onClose,
  onRequestSave,
  saving = false,
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !profile) return
    setName(departmentName || '')
    setEmail(profile.email ?? '')
    setFullName(profile.full_name ?? '')
    setPhone(profile.phone ?? '')
    setAddress(profile.address ?? '')
    setError('')
  }, [open, profile, departmentName])

  if (!open || !profile) return null

  const canSave =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    !saving

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSave) return
    setError('')
    onRequestSave?.({
      name: name.trim(),
      email: email.trim(),
      full_name: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
    })
  }

  return (
    <Modal
      open={open}
      title="Edit department profile"
      size="md"
      closeOnBackdrop={!saving}
      onClose={() => {
        if (!saving) onClose?.()
      }}
      footer={
        <div className="theme-modal-footer">
          <button
            type="submit"
            form="edit-department-profile-form"
            disabled={!canSave}
            className="theme-btn-primary theme-btn-primary--block"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="theme-btn-secondary">
            Cancel
          </button>
        </div>
      }
    >
      <form id="edit-department-profile-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-400">
          Update department details. You will be asked for your admin password before changes are saved.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-200">Department name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              required
              className="theme-input"
              autoComplete="off"
              disabled={saving}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-200">Login email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="theme-input"
              autoComplete="off"
              disabled={saving}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-200">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
              className="theme-input"
              autoComplete="off"
              disabled={saving}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-200">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              className="theme-input"
              autoComplete="off"
              disabled={saving}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-200">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              type="text"
              className="theme-input"
              autoComplete="off"
              disabled={saving}
            />
          </div>
        </div>
        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
        ) : null}
      </form>
    </Modal>
  )
}
