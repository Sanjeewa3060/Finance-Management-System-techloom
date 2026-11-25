import React from 'react'

/** Consistent page wrapper: works with sidebar layout and prevents horizontal clip. */
export default function PageShell({ children, className = '' }) {
  return (
    <div className={`mx-auto w-full max-w-6xl min-w-0 px-3 py-3 sm:px-4 sm:py-4 lg:py-5 ${className}`}>
      {children}
    </div>
  )
}
