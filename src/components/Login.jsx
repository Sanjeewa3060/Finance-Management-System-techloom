import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import CompanyLogo from './CompanyLogo.jsx'
import AppIcon from './AppIcon.jsx'
import AuthBackButton from './AuthBackButton.jsx'
import LoginProductShowcase from './LoginProductShowcase.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { getDeviceInfo } from '../utils/deviceInfo.js'

export default function Login({ onLogin, loading = false, error = null, connectionWarning = null, onRetryConnection }) {
  const location = useLocation()
  const success = location.state?.success
  const { theme, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Only lock outer scroll on desktop with sufficient viewport height
    const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 961px) and (min-height: 700px)') : null
    const updateScrollLock = () => {
      if (mq?.matches) {
        document.body.classList.add('login-no-scroll')
      } else {
        document.body.classList.remove('login-no-scroll')
      }
    }
    updateScrollLock()
    mq?.addEventListener?.('change', updateScrollLock)
    return () => {
      mq?.removeEventListener?.('change', updateScrollLock)
      document.body.classList.remove('login-no-scroll')
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onLogin?.({ email, password, rememberMe, device: getDeviceInfo() })
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || loading

  return (
    <div className="login-shell">
      <LoginProductShowcase />

      <section className="login-panel" aria-label="Sign in">
        <div className="login-panel__top">
          <AuthBackButton />
          <button
            type="button"
            onClick={toggleTheme}
            className="login-theme-toggle flex size-10 items-center justify-center rounded-full"
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle theme"
          >
            <AppIcon icon={theme === 'dark' ? Sun : Moon} size="md" />
          </button>
        </div>

        <div className="login-panel__body">
          <div className="login-panel__brand">
            <CompanyLogo size="auth" />
            <h1 className="login-panel__welcome">Welcome to FMS</h1>
            <p className="login-panel__lead">Sign in to your finance workspace</p>
          </div>

          <div className="login-card animate-fade-in">
            <h2 className="login-card__title">Sign in</h2>
            <p className="login-card__hint">
              Please enter your credentials below to continue
            </p>

            {success ? (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200">
                {success}
              </div>
            ) : null}
            {connectionWarning ? (
              <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-100">
                <p>{connectionWarning}</p>
                {onRetryConnection ? (
                  <button
                    type="button"
                    onClick={onRetryConnection}
                    disabled={busy}
                    className="mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200"
                  >
                    Retry connection
                  </button>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <div className="login-card__error rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            <form className="login-card__form" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="login-email" className="login-field-label">
                  Email
                </label>
                <input
                  id="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  autoComplete="email"
                  className="login-input"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="login-field-label">
                  Password
                </label>
                <div className="login-password-wrap">
                  <input
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="login-input login-input--password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="login-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <AppIcon icon={showPassword ? EyeOff : Eye} size="md" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="login-remember flex-1">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500/40"
                  />
                  <span>
                    <span className="login-remember__title">Remember me for 30 days</span>
                    <span className="login-remember__sub">Stay signed in on this device.</span>
                  </span>
                </label>
                <Link to="/forgot-password" className="shrink-0 pt-1 text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
                  Forgot Password?
                </Link>
              </div>

              <button type="submit" disabled={busy} className="login-submit-btn">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="login-panel__legal">
            <span>FMS v1.1.0 · Powered by</span>
            <a
              href="https://www.techloom.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="login-panel__techloom"
            >
              <img
                src="/techloom-mark.svg"
                alt="Techloom.ai"
                className="login-panel__techloom-mark"
              />
            </a>
          </p>
        </div>
      </section>
    </div>
  )
}
