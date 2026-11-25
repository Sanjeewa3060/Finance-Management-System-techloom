import React, { useState } from 'react'
import { useConfirmWithPassword } from '../hooks/useConfirmWithPassword.jsx'

export default function CompanyUsers({ companyId, companyEmail, users, departments, onCreate, onDelete, isAdmin, authUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('accountant')
  const [departmentId, setDepartmentId] = useState('')
  const { confirmWithPassword, passwordConfirmModal } = useConfirmWithPassword(authUser)

  if (!companyId) return <div className="p-6 text-sm text-slate-500">Select a department.</div>

  async function handleDelete(user) {
    const loginPassword = await confirmWithPassword({
      title: 'Remove team member',
      message: `Enter your login password to permanently remove “${user.email}”.`,
      confirmLabel: 'Remove user',
    })
    if (!loginPassword) return
    await onDelete?.(user.id, loginPassword)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h2 className="text-lg font-semibold">Team — {companyEmail}</h2>
      <p className="mt-1 text-sm text-slate-400">Additional logins for this department (accountant or department manager).</p>
      {(isAdmin || true) && (
        <form
          className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={async (e) => {
            e.preventDefault()
            await onCreate?.({ company_profile_id: companyId, email, password, role, department_id: role === 'manager' ? departmentId : null })
            setEmail('')
            setPassword('')
          }}
        >
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} placeholder="Password" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="accountant">Accountant</option>
            <option value="manager">Department manager</option>
          </select>
          {role === 'manager' ? (
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              {departments.filter((d) => d.company_profile_id === companyId).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          ) : <div />}
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">Add user</button>
        </form>
      )}
      <table className="mt-4 min-w-[640px] w-full text-sm">
        <thead><tr className="text-left text-xs text-slate-400"><th className="py-2">Email</th><th className="py-2">Role</th><th className="py-2" /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-slate-800/60">
              <td className="py-3">{u.email}</td>
              <td className="py-3">{u.role}</td>
              <td className="py-3"><button type="button" onClick={() => handleDelete(u)} className="text-rose-300 text-xs">Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {passwordConfirmModal}
    </div>
  )
}
