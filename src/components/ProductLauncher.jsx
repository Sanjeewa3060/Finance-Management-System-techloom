import React, { useRef, useState } from 'react'
import DropdownMenu from './DropdownMenu.jsx'
import { KAIONEX_PRODUCTS } from './KaionexProducts.js'

/** This app (FMS) — used to mark self-links if FMS is ever added to the suite list. */
export const CURRENT_APP_ID = 'fms'

const KAIONEX_MARK_SRC = '/kaionex-mark.svg'

/** Dark navy tile with soft mint/light-green dots. */
const TILE_DOT_BG = {
  backgroundColor: '#0f172a',
  backgroundImage: 'radial-gradient(circle, rgba(167, 243, 208, 0.32) 0.7px, transparent 0.7px)',
  backgroundSize: '5px 5px',
}

/** Launcher order: POS → EMS → E-COM (URLs from KaionexProducts). */
const LAUNCHER_ORDER = ['pos', 'ems', 'ecommerce']

const LAUNCHER_PRODUCTS = LAUNCHER_ORDER.map((id) => KAIONEX_PRODUCTS.find((p) => p.id === id)).filter(
  Boolean,
)

function GridDotsIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden
    >
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => (
          <circle
            key={`${row}-${col}`}
            cx={5 + col * 7}
            cy={5 + row * 7}
            r={2.15}
          />
        )),
      )}
    </svg>
  )
}

export default function ProductLauncher() {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)

  function closeMenu() {
    setOpen(false)
  }

  function openProduct(product) {
    if (product.id === CURRENT_APP_ID) {
      closeMenu()
      return
    }
    const href = product.href
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer')
    }
    closeMenu()
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`topbar-icon-btn inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 transition hover:bg-emerald-500/15 hover:text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 dark:hover:text-emerald-200${
          open ? ' bg-emerald-500/15 dark:bg-emerald-500/25' : ''
        }`}
        title="Kaionex products"
        aria-label="Kaionex products"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <GridDotsIcon className="shrink-0" />
      </button>

      <DropdownMenu open={open} anchorRef={anchorRef} onClose={closeMenu} width={172}>
        <div className="px-3 pt-2.5 pb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Kaionex products
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 px-2.5 pb-2.5">
          {LAUNCHER_PRODUCTS.map((product) => {
            const isCurrent = product.id === CURRENT_APP_ID
            const label = product.kaionexName || product.name || product.badge
            return (
              <button
                key={product.id}
                type="button"
                role="menuitem"
                disabled={isCurrent}
                onClick={() => openProduct(product)}
                title={label}
                aria-label={label}
                className={`relative flex h-[3.25rem] w-11 shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border border-slate-200/80 transition hover:border-emerald-500/50 hover:ring-2 hover:ring-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-white/10 ${
                  isCurrent
                    ? 'cursor-default opacity-70 ring-2 ring-emerald-500/30'
                    : ''
                }`}
                style={TILE_DOT_BG}
              >
                <img
                  src={KAIONEX_MARK_SRC}
                  alt=""
                  className="relative z-10 h-3.5 w-auto shrink-0 object-contain"
                  draggable={false}
                />
                <span className="relative z-10 text-[8px] font-bold uppercase leading-none tracking-wide text-white">
                  {product.badge}
                </span>
              </button>
            )
          })}
        </div>
      </DropdownMenu>
    </div>
  )
}
