import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

export default function ResetPassword({ onReset, loading, error }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await onReset?.({ token, password })
      navigate('/login', { state: { success: 'Password updated. Sign in with your new password.' } })
    } catch {
      /* error shown via prop */
    }
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link to="/login" className="text-sm text-slate-400 hover:text-slate-200">← Back to login</Link>
        <div className="glass mt-6 rounded-2xl p-6">
          <h1 className="text-2xl font-semibold text-slate-100">Reset password</h1>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input value={token} onChange={(e) => setToken(e.target.value)} required placeholder="Reset token" className="theme-input !mt-0" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} placeholder="New password" className="theme-input !mt-0" />
            {error ? <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}
            <button type="submit" disabled={loading} className="theme-btn-primary theme-btn-primary--block w-full">
              {loading ? 'Saving...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
