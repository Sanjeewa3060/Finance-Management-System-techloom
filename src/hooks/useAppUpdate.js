import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 60 * 1000
const DISMISS_KEY = 'kaionex_update_dismissed_build'

async function fetchBuildSignature() {
  try {
    const versionRes = await fetch(`/version.json?check=${Date.now()}`, { cache: 'no-store' })
    if (versionRes.ok) {
      const data = await versionRes.json()
      if (data?.buildId) return String(data.buildId)
    }
  } catch {
    /* fallback to index.html */
  }

  const res = await fetch(`/index.html?check=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('version check failed')
  const html = await res.text()
  const script = html.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/)
  if (script?.[1]) return script[1]
  const stylesheet = html.match(/\/assets\/index-([A-Za-z0-9_-]+)\.css/)
  if (stylesheet?.[1]) return stylesheet[1]
  return String(html.length)
}

export function applyAppUpdate() {
  try {
    const path = window.location.pathname + window.location.search + window.location.hash
    sessionStorage.setItem('kaionex_post_update_path', path)
  } catch {
    /* ignore */
  }
  window.location.reload()
}

export function useAppUpdate({ enabled = true } = {}) {
  const initialBuild = useRef(null)
  const pendingBuild = useRef(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [checking, setChecking] = useState(false)

  const markUpdateAvailable = useCallback((buildId) => {
    pendingBuild.current = buildId
    try {
      const dismissed = sessionStorage.getItem(DISMISS_KEY)
      if (dismissed && dismissed === buildId) return
    } catch {
      /* ignore */
    }
    setUpdateAvailable(true)
  }, [])

  const checkForUpdate = useCallback(async () => {
    if (!enabled) return
    setChecking(true)
    try {
      const buildId = await fetchBuildSignature()
      if (initialBuild.current === null) {
        initialBuild.current = buildId
        return
      }
      if (buildId !== initialBuild.current) {
        markUpdateAvailable(buildId)
      }
    } catch {
      /* offline or deploy in progress */
    } finally {
      setChecking(false)
    }
  }, [enabled, markUpdateAvailable])

  useEffect(() => {
    if (!enabled) return undefined
    checkForUpdate()
    const id = window.setInterval(checkForUpdate, POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, checkForUpdate])

  useEffect(() => {
    if (!enabled) return undefined

    function onVisible() {
      if (document.visibilityState === 'visible') checkForUpdate()
    }

    function onFocus() {
      checkForUpdate()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, checkForUpdate])

  useEffect(() => {
    if (!enabled) return undefined

    function onPreloadError(event) {
      event?.preventDefault?.()
      markUpdateAvailable('chunk-error')
    }

    function onUnhandled(event) {
      const msg = String(event.reason?.message ?? event.reason ?? '')
      if (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module')
      ) {
        event.preventDefault?.()
        markUpdateAvailable('dynamic-import-error')
      }
    }

    window.addEventListener('vite:preloadError', onPreloadError)
    window.addEventListener('unhandledrejection', onUnhandled)
    return () => {
      window.removeEventListener('vite:preloadError', onPreloadError)
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  }, [enabled, markUpdateAvailable])

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false)
    try {
      if (pendingBuild.current) sessionStorage.setItem(DISMISS_KEY, pendingBuild.current)
    } catch {
      /* ignore */
    }
  }, [])

  const reloadForUpdate = useCallback(() => {
    applyAppUpdate()
  }, [])

  return { updateAvailable, checking, dismissUpdate, reloadForUpdate, checkForUpdate }
}
