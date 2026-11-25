import React, { useState } from 'react'
import { Link } from 'react-router-dom'

export default function ForgotPassword({ onRequestReset, loading, error }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const result = await onRequestReset?.(email)
    if (result?.token) setToken(result.token)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link to="/login" className="text-sm text-slate-400 hover:text-slate-200">← Back to login</Link>
        <div className="glass mt-6 rounded-2xl p-6">
          <h1 className="text-2xl font-semibold text-slate-100">Forgot password</h1>
          <p className="mt-2 text-sm text-slate-400">Request a reset token for your account email.</p>
          {token ? (
            <div className="mt-4 space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <p>Reset token (valid 1 hour). Share with admin or use on reset page:</p>
              <code className="block break-all rounded bg-slate-950/80 p-2 text-xs">{token}</code>
              <Link to={`/reset-password?token=${encodeURIComponent(token)}`} className="inline-block text-emerald-300 hover:underline">
                Go to reset password →
              </Link>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="theme-input !mt-0"
              />
              {error ? <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}
              <button type="submit" disabled={loading} className="theme-btn-primary theme-btn-primary--block w-full">
                {loading ? 'Creating token...' : 'Get reset token'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
