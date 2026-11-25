import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Fixed-position dropdown rendered in a portal so table overflow cannot clip it.
 */
export default function DropdownMenu({ open, onClose, anchorRef, children, width = 208 }) {
  const menuRef = useRef(null)
  const [style, setStyle] = useState(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) {
      setStyle(null)
      return
    }

    function position() {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const menuHeight = menuRef.current?.offsetHeight ?? 280
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < menuHeight + 8 && rect.top > menuHeight + 8
      const top = openUp ? rect.top - menuHeight - 4 : rect.bottom + 4
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))

      setStyle({
        position: 'fixed',
        top,
        left,
        width,
        zIndex: 9999,
      })
    }

    position()
    window.addEventListener('resize', position)
    return () => window.removeEventListener('resize', position)
  }, [open, anchorRef, width, children])

  useEffect(() => {
    if (!open) return undefined

    let removeListeners = null
    const frameId = requestAnimationFrame(() => {
      function onScroll() {
        onClose?.()
      }
      function onKey(e) {
        if (e.key === 'Escape') onClose?.()
      }
      function onPointerDown(e) {
        if (menuRef.current?.contains(e.target)) return
        if (anchorRef?.current?.contains(e.target)) return
        onClose?.()
      }

      window.addEventListener('scroll', onScroll, true)
      window.addEventListener('keydown', onKey)
      document.addEventListener('mousedown', onPointerDown)
      document.addEventListener('touchstart', onPointerDown, { passive: true })

      removeListeners = () => {
        window.removeEventListener('scroll', onScroll, true)
        window.removeEventListener('keydown', onKey)
        document.removeEventListener('mousedown', onPointerDown)
        document.removeEventListener('touchstart', onPointerDown)
      }
    })

    return () => {
      cancelAnimationFrame(frameId)
      removeListeners?.()
    }
  }, [open, onClose, anchorRef])

  if (!open || !style) return null

  return createPortal(
    <div ref={menuRef} style={style} className="theme-dropdown rounded-xl py-1 shadow-2xl" role="menu">
      {children}
    </div>,
    document.body,
  )
}
