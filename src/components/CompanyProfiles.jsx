import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Plus } from 'lucide-react'
import PageShell from './PageShell.jsx'
import AppIcon from './AppIcon.jsx'
import DropdownMenu from './DropdownMenu.jsx'
import EditDepartmentProfileModal from './EditDepartmentProfileModal.jsx'
import ConfirmPasswordModal from './ConfirmPasswordModal.jsx'
import { useConfirmWithPassword } from '../hooks/useConfirmWithPassword.jsx'

function fmt(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v ?? '-'
  return d.toLocaleString()
}

function ActionMenu({ profile: p, busyId, onView, onImpersonate, onEdit, onToggle, onResetPassword, onSetDeletePassword, onDelete }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const wrapRef = useRef(null)

  const itemClass =
    'theme-dropdown-item block w-full rounded-lg px-3 py-2 text-left text-sm disabled:opacity-50'

  return (
    <div className="relative inline-block text-left" ref={wrapRef}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busyId === p.id}
        className="theme-btn-secondary"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="inline-flex items-center gap-1">
          Actions
          <AppIcon icon={ChevronDown} size="sm" />
        </span>
      </button>
      <DropdownMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        width={208}
      >
        <Link to={onView} className={itemClass} onClick={() => setOpen(false)} role="menuitem">
          View department
        </Link>
        {onImpersonate ? (
          <button type="button" className={itemClass} role="menuitem" onClick={() => { onImpersonate(p); setOpen(false) }}>
            Login as department
          </button>
        ) : null}
        <button type="button" className={itemClass} role="menuitem" onClick={() => { onEdit(p); setOpen(false) }}>
          Edit
        </button>
        <button type="button" className={itemClass} role="menuitem" onClick={() => { onToggle(p); setOpen(false) }}>
          {p.is_active === false ? 'Activate account' : 'Deactivate account'}
        </button>
        <button type="button" className={itemClass} role="menuitem" onClick={() => { onResetPassword(p); setOpen(false) }}>
          Reset login password
        </button>
        <button type="button" className={itemClass} role="menuitem" onClick={() => { onSetDeletePassword(p); setOpen(false) }}>
          {p.has_delete_password ? 'Change delete password' : 'Set delete password'}
        </button>
        <button
          type="button"
          className={`${itemClass} text-rose-600 hover:bg-rose-500/10 dark:text-rose-300`}
          role="menuitem"
          onClick={() => { onDelete(p); setOpen(false) }}
        >
          Delete department
        </button>
      </DropdownMenu>
    </div>
  )
}

function StatusBadge({ active, deleted = false }) {
  if (deleted) {
    return (
      <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-200">
        Deleted
      </span>
    )
  }
  return (
    <span
      className={
        active === false
          ? 'rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-200'
          : 'rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200'
      }
    >
      {active === false ? 'Deactivated' : 'Active'}
    </span>
  )
}

function ProfilesTable({
  rows,
  loading,
  emptyLabel,
  deptNameByProfileId,
  busyId,
  onImpersonate,
  openEdit,
  handleToggle,
  handleResetPassword,
  handleSetDeletePassword,
  handleDelete,
  handleImpersonateProfile,
  onRestore,
  handleRestore,
}) {
  return (
    <div className="theme-table-wrap overflow-x-auto">
      <table className="min-w-[960px] w-full text-sm">
        <thead className="theme-table-head">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-medium">Department</th>
            <th className="px-4 py-3 font-medium">Login email</th>
            <th className="px-4 py-3 font-medium">Full name</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Delete password</th>
            <th className="px-4 py-3 font-medium">Last login</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} className="theme-table-cell-muted px-4 py-8 text-center">
                Loading departments…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="theme-table-cell-muted px-4 py-8 text-center">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((p) => {
              const deptName = deptNameByProfileId.get(p.id)
              const isDeleted = Boolean(p.deleted_at)
              return (
                <tr key={p.id} className="theme-table-row">
                  <td className="theme-table-cell px-4 py-3">
                    <div className="font-medium text-slate-100">{deptName || p.email}</div>
                    {deptName ? <div className="text-xs text-slate-500">{p.address || 'No address'}</div> : null}
                  </td>
                  <td className="theme-table-cell-muted px-4 py-3">{p.email}</td>
                  <td className="theme-table-cell px-4 py-3">{p.full_name || '—'}</td>
                  <td className="theme-table-cell-muted px-4 py-3">{p.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={p.is_active} deleted={isDeleted} />
                  </td>
                  <td className="theme-table-cell-muted px-4 py-3">{p.has_delete_password ? 'Configured' : 'Not set'}</td>
                  <td className="theme-table-cell-muted px-4 py-3">{p.last_login_at ? fmt(p.last_login_at) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {isDeleted && onRestore ? (
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => handleRestore(p.id)}
                        className="theme-btn-secondary"
                      >
                        Restore
                      </button>
                    ) : (
                      <ActionMenu
                        profile={p}
                        busyId={busyId}
                        onView={`/dashboard/companies/${p.id}`}
                        onImpersonate={onImpersonate && p.is_active !== false ? () => handleImpersonateProfile(p) : null}
                        onEdit={() => openEdit(p)}
                        onToggle={() => handleToggle(p.id, p.is_active === false)}
                        onResetPassword={() => handleResetPassword(p.id)}
                        onSetDeletePassword={() => handleSetDeletePassword(p.id)}
                        onDelete={() => handleDelete(p.id)}
                      />
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function CompanyProfiles({
  profiles,
  deletedProfiles = [],
  departments = [],
  loading,
  onCreate,
  onDelete,
  onRestore,
  onToggleActive,
  onResetPassword,
  onSetDeletePassword,
  onUpdate,
  onImpersonate,
  onClearAllData,
  onBackupSystemData,
  onListSystemBackups,
  onDownloadStoredBackup,
  authUser,
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [clearPasswordOpen, setClearPasswordOpen] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')
  const [backups, setBackups] = useState([])
  const [backupRetention, setBackupRetention] = useState(90)
  const [backupLoading, setBackupLoading] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [pendingEdit, setPendingEdit] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const { confirmWithPassword, passwordConfirmModal } = useConfirmWithPassword(authUser)

  const loadBackups = useCallback(async () => {
    if (!onListSystemBackups) return
    setBackupLoading(true)
    try {
      const data = await onListSystemBackups()
      setBackups(Array.isArray(data?.backups) ? data.backups : [])
      setBackupRetention(data?.retentionDays || 90)
    } catch (e2) {
      if (e2?.code !== 'MISSING_BACKUP_TABLE') {
        setError(e2?.message ?? 'Could not load backups.')
      }
      setBackups([])
    } finally {
      setBackupLoading(false)
    }
  }, [onListSystemBackups])

  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  const deptNameByProfileId = React.useMemo(() => {
    const map = new Map()
    for (const d of departments ?? []) {
      if (d.company_profile_id) map.set(d.company_profile_id, d.name)
    }
    return map
  }, [departments])

  const canSave =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 4 &&
    deletePassword.length >= 4 &&
    !saving

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onCreate?.({ name: name.trim(), email: email.trim(), password, deletePassword })
      setName('')
      setEmail('')
      setPassword('')
      setDeletePassword('')
    } catch (e2) {
      setError(e2?.message ?? 'Failed to create department profile.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id, nextIsActive) {
    const action = nextIsActive ? 'Activate' : 'Deactivate'
    const loginPassword = await confirmWithPassword({
      title: `${action} account`,
      message: nextIsActive
        ? 'Enter your login password to activate this department account and restore login access.'
        : 'Enter your login password to deactivate this department account. Login will be blocked until it is activated again.',
      confirmLabel: `${action} account`,
    })
    if (!loginPassword) return
    setError('')
    setBusyId(id)
    try {
      await onToggleActive?.(id, nextIsActive)
    } catch (e2) {
      setError(e2?.message ?? 'Failed to update account status.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleResetPassword(id) {
    const newPassword = window.prompt('Enter new temporary password (min 4 characters)')
    if (!newPassword) return
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }
    setError('')
    setBusyId(id)
    try {
      await onResetPassword?.(id, newPassword)
    } catch (e2) {
      setError(e2?.message ?? 'Failed to reset department password.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleSetDeletePassword(id) {
    const newPassword = window.prompt('Enter delete transaction password (min 4 characters). Department users need this to delete entries.')
    if (!newPassword) return
    if (newPassword.length < 4) {
      setError('Delete password must be at least 4 characters.')
      return
    }
    setError('')
    setBusyId(id)
    try {
      await onSetDeletePassword?.(id, newPassword)
    } catch (e2) {
      setError(e2?.message ?? 'Failed to set delete password.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id) {
    const loginPassword = await confirmWithPassword({
      title: 'Delete department',
      message:
        'Enter your login password to permanently delete this department. Its login and transactions will be removed. This cannot be undone.',
      confirmLabel: 'Delete department',
    })
    if (!loginPassword) return
    setError('')
    setBusyId(id)
    try {
      await onDelete?.(id, loginPassword)
    } catch (e2) {
      setError(e2?.message ?? 'Failed to delete department profile.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRestore(id) {
    const loginPassword = await confirmWithPassword({
      title: 'Restore department',
      message:
        'Enter your login password to restore this soft-deleted department and make the account active again.',
      confirmLabel: 'Restore department',
    })
    if (!loginPassword) return
    setError('')
    setBusyId(id)
    try {
      await onRestore?.(id)
    } catch (e2) {
      setError(e2?.message ?? 'Failed to restore department profile.')
    } finally {
      setBusyId(null)
    }
  }

  const activeProfiles = React.useMemo(
    () => (profiles ?? []).filter((p) => p.is_active !== false),
    [profiles],
  )
  const deactivatedProfiles = React.useMemo(
    () => (profiles ?? []).filter((p) => p.is_active === false),
    [profiles],
  )

  async function handleImpersonateProfile(profile) {
    if (!onImpersonate) return
    setError('')
    setBusyId(profile.id)
    try {
      await onImpersonate(profile)
    } catch (e2) {
      setError(e2?.message ?? 'Failed to log in as department.')
    } finally {
      setBusyId(null)
    }
  }

  function openEdit(profile) {
    setError('')
    setEditingProfile(profile)
  }

  function handleEditRequestSave(formData) {
    if (!editingProfile) return
    setPendingEdit(formData)
  }

  async function handleConfirmEdit(adminPassword) {
    if (!editingProfile || !pendingEdit) return
    setError('')
    setEditSaving(true)
    try {
      await onUpdate?.(editingProfile.id, { ...pendingEdit, adminPassword })
      setEditingProfile(null)
      setPendingEdit(null)
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <PageShell>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">Department Profiles</h2>
        <p className="mt-1 text-sm text-slate-400">
          View department accounts in the table below. Create a new department at the bottom of the active list.
        </p>
      </div>

      <div className="glass mt-4 rounded-xl">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-100">Active departments</h3>
          <p className="mt-1 text-xs text-slate-500">
            {activeProfiles.length} department{activeProfiles.length === 1 ? '' : 's'}
          </p>
        </div>

        <ProfilesTable
          rows={activeProfiles}
          loading={loading}
          emptyLabel="No active departments yet. Create one below."
          deptNameByProfileId={deptNameByProfileId}
          busyId={busyId}
          onImpersonate={onImpersonate}
          openEdit={openEdit}
          handleToggle={handleToggle}
          handleResetPassword={handleResetPassword}
          handleSetDeletePassword={handleSetDeletePassword}
          handleDelete={handleDelete}
          handleImpersonateProfile={handleImpersonateProfile}
        />

        <form onSubmit={handleSubmit} className="border-t border-slate-200/80 p-4 sm:p-5 dark:border-slate-700/50">
          <h4 className="text-sm font-semibold text-slate-100">Create department</h4>
          <p className="mt-1 text-xs text-slate-500">
            Add a department with login email, login password, and delete transaction password.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-slate-200">Department name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                required
                className="theme-input"
                placeholder="e.g. Civil Works"
                autoComplete="off"
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
                placeholder="department@example.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-200">Login password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
                className="theme-input"
                placeholder="Min. 4 characters"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-200">Delete transaction password</label>
              <input
                type="text"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
                minLength={4}
                className="theme-input"
                placeholder="Required to delete entries"
                autoComplete="off"
              />
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={!canSave}
            className="theme-btn-primary theme-btn-primary--block mt-4 w-full sm:w-auto"
          >
            <AppIcon icon={Plus} size="sm" />
            {saving ? 'Creating…' : 'Create department'}
          </button>
        </form>
      </div>

      {!loading && deactivatedProfiles.length > 0 ? (
        <div className="glass mt-6 rounded-xl">
          <div className="border-b border-amber-500/20 p-4">
            <h3 className="text-sm font-semibold text-slate-100">Deactivated departments</h3>
            <p className="mt-1 text-xs text-slate-500">
              Login is blocked, but transactions and categories are still in the database. Use Actions → Activate
              account to restore access.
            </p>
          </div>
          <ProfilesTable
            rows={deactivatedProfiles}
            loading={false}
            emptyLabel="No deactivated departments."
            deptNameByProfileId={deptNameByProfileId}
            busyId={busyId}
            onImpersonate={onImpersonate}
            openEdit={openEdit}
            handleToggle={handleToggle}
            handleResetPassword={handleResetPassword}
            handleSetDeletePassword={handleSetDeletePassword}
            handleDelete={handleDelete}
            handleImpersonateProfile={handleImpersonateProfile}
          />
        </div>
      ) : null}

      {!loading && deletedProfiles.length > 0 ? (
        <div className="glass mt-6 rounded-xl">
          <div className="border-b border-rose-500/20 p-4">
            <h3 className="text-sm font-semibold text-slate-100">Soft-deleted departments</h3>
            <p className="mt-1 text-xs text-slate-500">
              These accounts were marked deleted but rows may still exist. Restore to make them active again.
            </p>
          </div>
          <ProfilesTable
            rows={deletedProfiles}
            loading={false}
            emptyLabel="No soft-deleted departments."
            deptNameByProfileId={deptNameByProfileId}
            busyId={busyId}
            onImpersonate={null}
            openEdit={openEdit}
            handleToggle={handleToggle}
            handleResetPassword={handleResetPassword}
            handleSetDeletePassword={handleSetDeletePassword}
            handleDelete={handleDelete}
            handleImpersonateProfile={handleImpersonateProfile}
            onRestore={onRestore}
            handleRestore={handleRestore}
          />
        </div>
      ) : null}

      {onBackupSystemData || onClearAllData ? (
        <section className="mt-8 rounded-xl border border-slate-500/30 bg-slate-500/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-100">System backup</h3>
          <p className="mt-1 text-xs text-slate-400">
            Full snapshots of departments, transactions, categories, budgets, users, and related records. A backup runs
            automatically every day around midnight Sri Lanka time (and when an admin opens the app if today’s snapshot
            is missing). Kept for {backupRetention} days. You can also back up now and download any snapshot as JSON.
          </p>
          {backupMessage ? (
            <p className="mt-2 text-xs text-emerald-400">{backupMessage}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {onBackupSystemData ? (
              <button
                type="button"
                disabled={backingUp || loading || backupLoading}
                onClick={async () => {
                  setError('')
                  setBackupMessage('')
                  setBackingUp(true)
                  try {
                    const result = await onBackupSystemData()
                    setBackupMessage(result?.filename ? `Saved ${result.filename}` : 'Backup completed.')
                    await loadBackups()
                  } catch (e2) {
                    setError(e2?.message ?? 'Backup failed.')
                  } finally {
                    setBackingUp(false)
                  }
                }}
                className="theme-btn-primary"
              >
                {backingUp ? 'Backing up…' : 'Backup now'}
              </button>
            ) : null}
            {onListSystemBackups ? (
              <button
                type="button"
                disabled={backupLoading || backingUp}
                onClick={loadBackups}
                className="theme-btn-secondary"
              >
                {backupLoading ? 'Refreshing…' : 'Refresh list'}
              </button>
            ) : null}
          </div>

          {onListSystemBackups ? (
            <div className="mt-4">
              {backupLoading && !backups.length ? (
                <p className="text-sm text-slate-400">Loading backups…</p>
              ) : backups.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No backups yet. Run one now, or wait for the nightly job after you run{' '}
                  <code className="rounded bg-black/20 px-1">supabase/system_backups.sql</code>.
                </p>
              ) : (
                <ul className="divide-y divide-slate-700/60 rounded-lg border border-slate-700/60">
                  {backups.map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                    >
                      <div>
                        <div className="font-medium text-slate-100">
                          {b.backupDate}{' '}
                          <span className="font-normal text-slate-400">
                            · {b.rowCount} row{b.rowCount === 1 ? '' : 's'} · {b.trigger}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {b.createdAt ? new Date(b.createdAt).toLocaleString() : ''}
                        </div>
                      </div>
                      {onDownloadStoredBackup ? (
                        <button
                          type="button"
                          className="theme-btn-secondary"
                          onClick={async () => {
                            setError('')
                            try {
                              await onDownloadStoredBackup(b.id)
                            } catch (e2) {
                              setError(e2?.message ?? 'Download failed.')
                            }
                          }}
                        >
                          Download JSON
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {onClearAllData ? (
        <section className="mt-8 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-rose-200">Reset system data</h3>
          <p className="mt-1 text-xs text-slate-400">
            Permanently removes all departments, transactions, categories, budgets, and company profiles. Admin login is kept.
            Default categories are restored after reset. Your admin password is required to confirm.
          </p>
          <button
            type="button"
            disabled={clearing || loading}
            onClick={() => {
              const ok = window.confirm(
                'Delete ALL system data? This cannot be undone. Departments, transactions, and profiles will be removed.',
              )
              if (!ok) return
              setError('')
              setClearPasswordOpen(true)
            }}
            className="mt-4 rounded-lg border border-rose-500/40 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Clear all system data'}
          </button>
        </section>
      ) : null}

      <EditDepartmentProfileModal
        open={!!editingProfile && !pendingEdit}
        profile={editingProfile}
        departmentName={editingProfile ? deptNameByProfileId.get(editingProfile.id) ?? '' : ''}
        saving={editSaving}
        onClose={() => {
          if (!editSaving) setEditingProfile(null)
        }}
        onRequestSave={handleEditRequestSave}
      />

      <ConfirmPasswordModal
        open={!!pendingEdit}
        title="Confirm edit"
        message="Enter your admin password to save changes to this department profile."
        passwordLabel="Admin password"
        confirmLabel="Save changes"
        loading={editSaving}
        onConfirm={handleConfirmEdit}
        onClose={() => {
          if (!editSaving) setPendingEdit(null)
        }}
      />

      <ConfirmPasswordModal
        open={clearPasswordOpen}
        title="Confirm reset"
        message="Enter your admin password to permanently delete all system data. Admin login will be kept."
        passwordLabel="Admin password"
        confirmLabel="Clear all data"
        loading={clearing}
        onConfirm={async (adminPassword) => {
          setError('')
          setClearing(true)
          try {
            await onClearAllData?.(adminPassword)
            setClearPasswordOpen(false)
          } catch (e2) {
            setError(e2?.message ?? 'Failed to clear system data.')
            throw e2
          } finally {
            setClearing(false)
          }
        }}
        onClose={() => {
          if (!clearing) setClearPasswordOpen(false)
        }}
      />
      {passwordConfirmModal}
    </PageShell>
  )
}
