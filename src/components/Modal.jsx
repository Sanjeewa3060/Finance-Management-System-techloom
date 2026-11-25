import React from 'react'

const SIZE_CLASS = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
}

export default function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  closeOnBackdrop = true,
  size = 'sm',
}) {
  if (!open) return null

  const maxWidth = SIZE_CLASS[size] ?? SIZE_CLASS.sm

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 theme-modal-overlay bg-slate-950/70 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        role="presentation"
      />
      <div className={`relative mx-auto flex h-full ${maxWidth} items-center px-3 py-4 sm:px-4 sm:py-6`}>
        <div className="glass max-h-[min(92dvh,900px)] w-full overflow-hidden rounded-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-700/70 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-slate-100">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="theme-btn-secondary shrink-0 px-3 text-sm"
              aria-label="Close modal"
            >
              Close
            </button>
          </div>

          <div className="finance-scroll max-h-[calc(min(92dvh,900px)-8.5rem)] overflow-y-auto px-3 py-4 sm:px-5">{children}</div>
          {footer ? <div className="border-t border-slate-700/70 px-3 py-4 sm:px-5">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}
