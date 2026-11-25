import React from 'react'
import { FMS_ACCESS_GROUP } from '../auth/asgardeoConfig.js'

export default function Unauthorized({ email = '', groups = [], onSignOut, signingOut = false }) {
  return (
    <div className="login-page flex min-h-screen items-center justify-center px-4 py-10">
      <div className="login-card w-full max-w-[460px] rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-bold text-slate-50">FMS access is not enabled</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This Asgardeo account can sign in, but it is not allowed to open KAIONEX FMS.
          Access requires the <span className="font-semibold text-slate-100">{FMS_ACCESS_GROUP}</span> group.
        </p>
        {email ? (
          <p className="mt-4 text-sm text-slate-200">
            Signed in as <span className="font-semibold">{email}</span>
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-400">
          Groups on this login: {groups.length ? groups.join(', ') : 'none'}
        </p>
        <button type="button" className="login-submit-btn mt-6" onClick={onSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
