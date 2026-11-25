import React from 'react'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ session, loading, children }) {
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-950" role="status" aria-label="Loading">
        <img
          src="/favicon.png"
          alt=""
          className="kaionex-loading-logo"
          width={28}
          height={28}
          draggable={false}
        />
        <div className="text-sm text-slate-300">Loading...</div>
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return children
}
