import React, { useState } from 'react'

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export default function CompanyAccounts({
  departments,
  accounts = [],
  onCreateCompanyAccount,
  onToggleCompanyAccount,
  onResetCompanyPassword,
  onRemoveCompanyAccess,
  loading = false,
}) {
  const [companyName, setCompanyName] = useState('')
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [branchId, setBranchId] = useState('')
  const [createMode, setCreateMode] = useState('new')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit =
    emailOrUsername.trim().length > 0 &&
    password.length >= 6 &&
    (createMode === 'new' ? companyName.trim().length > 0 : !!branchId) &&
    !loading &&
    !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const result = await onCreateCompanyAccount?.({
        emailOrUsername,
        password,
        companyName: createMode === 'new' ? companyName.trim() : '',
        existingBranchId: createMode === 'existing' ? branchId : '',
      })
      setSuccess(result?.message ?? 'Department account created successfully.')
      setEmailOrUsername('')
      setPassword('')
      setCompanyName('')
      setBranchId('')
    } catch (e2) {
      setError(e2?.message ?? 'Failed to create department account.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(account) {
    setError('')
    try {
      await onToggleCompanyAccount?.(account.id, !account.is_active)
    } catch (e2) {
      setError(e2?.message ?? 'Failed to update account status.')
    }
  }

  async function handleReset(account) {
    setError('')
    try {
      await onResetCompanyPassword?.(account.login_hint)
      setSuccess(`Reset email sent to ${account.login_hint}`)
    } catch (e2) {
      setError(e2?.message ?? 'Failed to send reset email.')
    }
  }

  async function handleRemove(account) {
    const ok = window.confirm('Disable this department account? They will not be able to login.')
    if (!ok) return
    setError('')
    try {
      await onRemoveCompanyAccess?.(account.id)
    } catch (e2) {
      setError(e2?.message ?? 'Failed to remove department access.')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Department Accounts</h2>
        <p className="mt-1 text-sm text-slate-400">
          Admin-only page to create and manage department login accounts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="theme-surface mt-4 rounded-xl p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-200">Department setup</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateMode('new')}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  createMode === 'new'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200'
                    : 'border-slate-800 text-slate-300'
                }`}
              >
                New department
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('existing')}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  createMode === 'existing'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200'
                    : 'border-slate-800 text-slate-300'
                }`}
              >
                Existing department
              </button>
            </div>
          </div>

          {createMode === 'new' ? (
            <div>
              <label className="text-sm font-medium text-slate-200">Department name</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="theme-input mt-2 py-2 focus:ring-2 focus:ring-indigo-500/70"
                placeholder="e.g. Kaionex Kandy"
              />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-slate-200">Select existing department</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="theme-input mt-2 py-2 focus:ring-2 focus:ring-indigo-500/70"
              >
                <option value="">Choose department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-200">Department login (email or username)</label>
            <input
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              className="theme-input mt-2 py-2 focus:ring-2 focus:ring-indigo-500/70"
              placeholder="e.g. dept1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">Temporary password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="theme-input mt-2 py-2 focus:ring-2 focus:ring-indigo-500/70"
              placeholder="Minimum 6 characters"
            />
          </div>
        </div>

        {success ? <div className="theme-alert-success mt-4 rounded-lg p-3 text-sm">{success}</div> : null}
        {error ? <div className="theme-alert-error mt-4 rounded-lg p-3 text-sm">{error}</div> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create department account'}
        </button>
      </form>

      <div className="theme-table-wrap mt-6 overflow-x-auto">
        <table className="min-w-[980px] w-full border-separate border-spacing-0 text-sm">
          <thead className="theme-table-head">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Login</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="theme-table-cell-muted px-4 py-8 text-center">
                  No department accounts yet.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="theme-table-row">
                  <td className="theme-table-cell px-4 py-3">{a.departments?.name ?? '-'}</td>
                  <td className="theme-table-cell-muted px-4 py-3">{a.login_hint ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={a.is_active ? 'theme-money-positive' : 'theme-money-negative'}>
                      {a.is_active ? 'active' : 'disabled'}
                    </span>
                  </td>
                  <td className="theme-table-cell-muted px-4 py-3">{formatDateTime(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(a)}
                        className="theme-btn-secondary px-3 text-xs"
                      >
                        {a.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReset(a)}
                        className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-500/20"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(a)}
                        className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20"
                      >
                        Remove access
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
