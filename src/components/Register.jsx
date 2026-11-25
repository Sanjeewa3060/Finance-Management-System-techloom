import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import CompanyLogo from './CompanyLogo.jsx'
import AppIcon from './AppIcon.jsx'
import AuthBackButton from './AuthBackButton.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

export default function Register({ onRegister, loading = false, error = null }) {
  const { theme, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirmPassword) return
    setSubmitting(true)
    try {
      await onRegister?.({ email, password })
    } finally {
      setSubmitting(false)
    }
  }

  const passwordsMatch = password === confirmPassword
  const canSubmit = email && password.length >= 6 && passwordsMatch && !submitting && !loading
  const busy = submitting || loading

  return (
    <div className="login-page relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <AuthBackButton />
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        className="login-theme-toggle absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-slate-700/60 bg-slate-900/50 text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300 sm:right-6 sm:top-6"
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label="Toggle theme"
      >
        <AppIcon icon={theme === 'dark' ? Sun : Moon} size="md" />
      </button>

      <CompanyLogo size="auth" />

      <div className="login-card mt-8 w-full max-w-[420px] rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6 shadow-xl backdrop-blur-sm sm:p-8">
        <h1 className="text-center text-3xl font-bold tracking-tight text-slate-50">Register</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Create an admin account to manage departments and finance data
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="register-email" className="text-sm font-medium text-slate-200">
              Admin email
            </label>
            <input
              id="register-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
              className="login-input mt-2"
              placeholder="admin@kaionex.com"
            />
          </div>

          <div>
            <label htmlFor="register-password" className="text-sm font-medium text-slate-200">
              Password
            </label>
            <div className="relative mt-2">
              <input
                id="register-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                className="login-input pr-11"
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <AppIcon icon={showPassword ? EyeOff : Eye} size="md" />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="register-confirm" className="text-sm font-medium text-slate-200">
              Confirm password
            </label>
            <div className="relative mt-2">
              <input
                id="register-confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                className="login-input pr-11"
                placeholder="Re-enter your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-200"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <AppIcon icon={showConfirmPassword ? EyeOff : Eye} size="md" />
              </button>
            </div>
            {!passwordsMatch && confirmPassword ? (
              <p className="mt-1.5 text-xs text-rose-400">Passwords do not match</p>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button type="submit" disabled={!canSubmit || busy} className="theme-btn-primary theme-btn-primary--block w-full">
            {busy ? 'Creating account…' : 'Create Admin Account'}
          </button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
