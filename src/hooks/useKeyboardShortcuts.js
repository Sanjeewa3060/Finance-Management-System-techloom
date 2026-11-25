import { useEffect } from 'react'

export function useKeyboardShortcuts({ onNewEntry, enabled = true }) {
  useEffect(() => {
    if (!enabled) return
    function onKey(e) {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.tagName === 'SELECT') return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        onNewEntry?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNewEntry, enabled])
}
