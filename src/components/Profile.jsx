import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Building2,
  Calendar,
  Camera,
  Globe,
  Home,
  KeyRound,
  Mail,
  Save,
  Shield,
  User,
} from 'lucide-react'
import AppIcon from './AppIcon.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { loadPrefs, loadProfileMeta, savePrefs, saveProfileMeta } from '../utils/profilePrefs.js'
import { fetchSessions, getCurrentSessionId, revokeSession, touchSession } from '../utils/sessions.js'

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fmtJoined(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `Joined ${d.toLocaleString(undefined, { month: 'long', year: 'numeric' })}`
}

function roleLabel(role, subRole) {
  if (role === 'admin') return 'Admin'
  if (role === 'department') return 'Department'
  if (role === 'company') return 'Department'
  if (role === 'company_user' && subRole === 'manager') return 'Department manager'
  if (role === 'company_user') return 'Accountant'
  return role ?? 'User'
}

function initials(name, email) {
  const src = (name || email || 'U').trim()
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  )
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 whitespace-nowrap items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active ? 'theme-tab-active' : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      <AppIcon icon={icon} size="sm" />
      {children}
    </button>
  )
}

import SecurityBackups from './SecurityBackups.jsx'

export default function Profile({
  profile,
  branchName,
  createdAt,
  onUpdatePassword,
  onUpdateDetails,
  onUpdateAdminMeta,
  onUpdateAvatar,
  onRemoveAvatar,
  onForceLogout,
  onBackupSystemData,
  onDownloadLocalBackupOnly,
  onListSystemBackups,
  onDownloadStoredBackup,
}) {
  const { theme, setTheme } = useTheme()
  const userId = profile?.id
  const isAdmin = profile?.role === 'admin'
  const isCompanyAccount =
    profile?.role === 'company' || profile?.role === 'company_user' || profile?.role === 'department'

  const photoInputRef = useRef(null)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState('edit')
  const [loading, setLoading] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const adminMeta = useMemo(() => (isAdmin && userId ? loadProfileMeta(userId) : null), [isAdmin, userId])

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [prefs, setPrefs] = useState(() => loadPrefs(userId))
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  const displayName = useMemo(() => {
    if (profile?.full_name) return profile.full_name
    if (isAdmin && adminMeta?.full_name) return adminMeta.full_name
    const email = profile?.email ?? ''
    return email.split('@')[0] || 'User'
  }, [profile, isAdmin, adminMeta])

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'security' || t === 'preferences' || t === 'edit') setTab(t)
  }, [searchParams])

  useEffect(() => {
    if (!profile?.id || !profile?.role) return undefined
    let cancelled = false

    async function loadSessions() {
      setSessionsLoading(true)
      try {
        touchSession(profile).catch(() => {})
        const rows = await fetchSessions(profile)
        if (!cancelled) setSessions(rows)
      } catch {
        if (!cancelled) setSessions([])
      } finally {
        if (!cancelled) setSessionsLoading(false)
      }
    }

    loadSessions()
    const onFocus = () => {
      if (!cancelled) loadSessions()
    }
    const interval = setInterval(() => {
      if (!cancelled) loadSessions()
    }, 60_000)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [profile?.id, profile?.role])

  useEffect(() => {
    if (!userId) return
    setPrefs(loadPrefs(userId))

    if (isCompanyAccount) {
      setFullName(profile?.full_name ?? '')
      setPhone(profile?.phone ?? '')
      setLocation(profile?.address ?? '')
    } else if (isAdmin) {
      const meta = loadProfileMeta(userId)
      setFullName(meta.full_name || displayName)
      setPhone(meta.phone ?? '')
      setLocation(meta.location ?? '')
    }

    const meta = isAdmin && userId ? loadProfileMeta(userId) : null
    setAvatarUrl(profile?.avatar_url || meta?.avatar_url || '')
  }, [userId, profile, isCompanyAccount, isAdmin, displayName])

  const currentSessionId = getCurrentSessionId()
  const badge = roleLabel(profile?.role, profile?.sub_role)
  const imageLabel = isCompanyAccount ? 'logo' : 'profile photo'

  function openPhotoPicker() {
    if (!photoLoading && onUpdateAvatar) photoInputRef.current?.click()
  }

  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onUpdateAvatar) return
    setMessage('')
    setError('')
    setPhotoLoading(true)
    try {
      const url = await onUpdateAvatar(file)
      if (url) {
        setAvatarUrl(url)
        setMessage(`${imageLabel.charAt(0).toUpperCase()}${imageLabel.slice(1)} updated.`)
      }
    } catch (err) {
      setError(err?.message ?? `Failed to upload ${imageLabel}.`)
    } finally {
      setPhotoLoading(false)
    }
  }

  async function handleRemovePhoto() {
    if (!onRemoveAvatar) return
    setMessage('')
    setError('')
    setPhotoLoading(true)
    try {
      await onRemoveAvatar()
      setAvatarUrl('')
      setMessage(`${imageLabel.charAt(0).toUpperCase()}${imageLabel.slice(1)} removed.`)
    } catch (err) {
      setError(err?.message ?? `Failed to remove ${imageLabel}.`)
    } finally {
      setPhotoLoading(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)
    try {
      if (isCompanyAccount) {
        await onUpdateDetails?.({ full_name: fullName, phone, address: location })
      } else if (isAdmin) {
        await onUpdateAdminMeta?.({ full_name: fullName, phone, location })
        saveProfileMeta(userId, { full_name: fullName, phone, location })
      }
      setMessage('Profile saved successfully.')
    } catch (err) {
      setError(err?.message ?? 'Failed to save profile.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('New password must be at least 8 characters with one letter and one number.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await onUpdatePassword?.({ currentPassword, newPassword })
      setMessage('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err?.message ?? 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    savePrefs(userId, next)
    if (key === 'twoFactorEnabled' && value) {
      setMessage('2FA preference saved. Full TOTP setup requires email/SMS integration.')
    }
  }

  async function handleSignOutSession(sessionId) {
    if (!profile?.id) return
    const revokedCurrent = await revokeSession(profile, sessionId)
    setSessions(await fetchSessions(profile))
    if (revokedCurrent) {
      onForceLogout?.()
    } else {
      setMessage('Session signed out on that device. It will be logged out on next activity check.')
    }
  }

  const inputClass = 'theme-input'

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav className="mb-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/dashboard" className="inline-flex hover:text-slate-700 dark:hover:text-slate-200" aria-label="Home">
          <AppIcon icon={Home} size="sm" />
        </Link>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-200">Profile</span>
      </nav>

      <h2 className="text-xl font-semibold tracking-tight text-slate-100">Profile</h2>

      {message ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(260px,300px)_1fr]">
        {/* Left summary */}
        <div className="glass rounded-2xl p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative mx-auto">
              <button
                type="button"
                onClick={openPhotoPicker}
                disabled={photoLoading || !onUpdateAvatar}
                className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-emerald-500 text-3xl font-bold text-white shadow-md ring-4 ring-white disabled:opacity-60 dark:ring-slate-800"
                title={avatarUrl ? `Change ${imageLabel}` : `Upload ${imageLabel}`}
                aria-label={avatarUrl ? `Change ${imageLabel}` : `Upload ${imageLabel}`}
              >
                {photoLoading ? (
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full bg-white object-contain p-2" />
                ) : (
                  initials(displayName, profile?.email)
                )}
              </button>
              <button
                type="button"
                onClick={openPhotoPicker}
                disabled={photoLoading || !onUpdateAvatar}
                className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-slate-600 shadow-md transition hover:bg-white disabled:opacity-50 dark:border-slate-800 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                title={avatarUrl ? `Change ${imageLabel}` : `Upload ${imageLabel}`}
                aria-label={`Upload ${imageLabel}`}
              >
                <AppIcon icon={Camera} size="sm" />
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={handlePhotoSelected}
              />
            </div>
            {avatarUrl && onRemoveAvatar ? (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={photoLoading}
                className="mt-2 text-xs font-medium text-rose-500 hover:text-rose-400 disabled:opacity-50"
              >
                Remove {imageLabel}
              </button>
            ) : null}
            <h3 className="mt-4 text-lg font-semibold text-slate-100">{displayName}</h3>
            <span className="mt-2 inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-0.5 text-xs font-medium text-emerald-200">
              {badge}
            </span>
          </div>

          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <AppIcon icon={Mail} size="sm" className="text-slate-400" />
              <span className="truncate">{profile?.email ?? '—'}</span>
            </li>
            <li className="flex items-center gap-2">
              <AppIcon icon={Calendar} size="sm" className="text-slate-400" />
              <span>{fmtJoined(createdAt)}</span>
            </li>
            {branchName ? (
              <li className="flex items-center gap-2">
                <AppIcon icon={Building2} size="sm" className="text-slate-400" />
                <span>{branchName}</span>
              </li>
            ) : null}
          </ul>
        </div>

        {/* Right panel */}
        <div className="glass rounded-2xl">
          <div className="finance-scroll flex overflow-x-auto border-b border-slate-700/60">
            <TabButton active={tab === 'edit'} onClick={() => setTab('edit')} icon={User}>
              Edit Profile
            </TabButton>
            <TabButton active={tab === 'security'} onClick={() => setTab('security')} icon={Shield}>
              Security
            </TabButton>
            <TabButton active={tab === 'preferences'} onClick={() => setTab('preferences')} icon={Globe}>
              Preferences
            </TabButton>
          </div>

          <div className="p-6">
            {tab === 'edit' ? (
              <form onSubmit={handleSaveProfile}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium text-slate-200">Full Name</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium text-slate-200">Email</label>
                    <input value={profile?.email ?? ''} readOnly className={`${inputClass} opacity-70`} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-200">Phone</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-200">Location</label>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" className={inputClass} />
                  </div>
                </div>
                {isAdmin ? (
                  <p className="mt-3 text-xs text-slate-500">Admin contact details are stored on this device until admin profile fields are added in the database.</p>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">These details are visible to your admin.</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="theme-btn-primary theme-btn-primary--block mt-6"
                >
                  <AppIcon icon={Save} size="sm" className="text-white" />
                  Save Changes
                </button>
              </form>
            ) : null}

            {tab === 'security' ? (
              <div className="space-y-8">
                {isAdmin && onListSystemBackups && onBackupSystemData && onDownloadStoredBackup && (
                  <SecurityBackups
                    onBackup={onBackupSystemData}
                    onList={onListSystemBackups}
                    onDownload={onDownloadStoredBackup}
                    onDownloadLocalOnly={onDownloadLocalBackupOnly}
                  />
                )}
                <form onSubmit={handlePasswordSubmit}>
                  <h3 className="text-base font-semibold text-slate-100">Change Password</h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-200">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={inputClass}
                        autoComplete="current-password"
                      />
                      <p className="mt-1 text-xs text-slate-500">Note: verify against your current login password.</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-200">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputClass}
                        autoComplete="new-password"
                      />
                      <p className="mt-1 text-xs text-slate-500">Minimum 8 characters with at least one letter and one number.</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-200">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputClass}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !currentPassword || !newPassword}
                    className="theme-btn-primary theme-btn-primary--block mt-4"
                  >
                    <AppIcon icon={KeyRound} size="sm" className="text-white" />
                    Update Password
                  </button>
                </form>

                <div className="border-t border-slate-700/60 pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Two-Factor Authentication</h3>
                      <p className="mt-1 text-sm text-slate-500">Add an extra layer of security to your account</p>
                    </div>
                    <Toggle
                      checked={prefs.twoFactorEnabled}
                      onChange={(v) => updatePref('twoFactorEnabled', v)}
                      label="Enable 2FA"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-700/60 pt-6">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Active Sessions</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Sessions across devices. Sign out removes access on that device.
                  </p>
                  <div className="mt-4 space-y-3">
                    {sessionsLoading ? (
                      <p className="text-sm text-slate-500">Loading sessions…</p>
                    ) : sessions.length === 0 ? (
                      <p className="text-sm text-slate-500">No active sessions found for this account.</p>
                    ) : (
                      sessions.map((s) => {
                        const isCurrent = s.id === currentSessionId
                        return (
                          <div
                            key={s.id}
                            className="glass-soft flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xl text-slate-400">🖥</span>
                              <div className="text-sm">
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                  {s.deviceLabel ?? 'Unknown device'}
                                </div>
                                <div className="text-slate-500">Started {fmtDate(s.startedAt)}</div>
                                <div className="text-slate-500">Last active {fmtDate(s.lastActiveAt)}</div>
                              </div>
                            </div>
                            {isCurrent ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                                This device
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSignOutSession(s.id)}
                                className="text-sm font-medium text-rose-600 hover:text-rose-500"
                              >
                                ↪ Sign out
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'preferences' ? (
              <div className="divide-y divide-slate-700/60">
                <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
                  <div>
                    <div className="font-medium text-slate-100">Email Notifications</div>
                    <p className="text-sm text-slate-500">Receive email updates about orders and budgets</p>
                  </div>
                  <Toggle checked={prefs.emailNotifications} onChange={(v) => updatePref('emailNotifications', v)} label="Email notifications" />
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Push Notifications</div>
                    <p className="text-sm text-slate-500">Receive in-app alerts on this device</p>
                  </div>
                  <Toggle checked={prefs.pushNotifications} onChange={(v) => updatePref('pushNotifications', v)} label="Push notifications" />
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Dark Mode</div>
                    <p className="text-sm text-slate-500">Use dark theme throughout the application</p>
                  </div>
                  <Toggle
                    checked={theme === 'dark'}
                    onChange={(dark) => setTheme(dark ? 'dark' : 'light')}
                    label="Dark mode"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
