import React from 'react'

export default function ImpersonationBanner({ companyEmail, onExit }) {
  return (
    <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100">
      Viewing as <strong>{companyEmail}</strong>
      <button type="button" onClick={onExit} className="ml-3 rounded-md border border-amber-400/50 px-2 py-0.5 text-xs hover:bg-amber-500/20">
        Exit impersonation
      </button>
    </div>
  )
}
