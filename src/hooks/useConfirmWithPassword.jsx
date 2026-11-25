import { useCallback, useRef, useState } from 'react'
import ConfirmPasswordModal from '../components/ConfirmPasswordModal.jsx'
import { verifyAuthUserPassword } from '../utils/safeQuery.js'

/**
 * Reusable login-password confirmation for destructive actions.
 *
 * @example
 * const { confirmWithPassword, passwordConfirmModal } = useConfirmWithPassword(authUser)
 * const password = await confirmWithPassword({ title: 'Delete category', message: '…' })
 * if (!password) return // cancelled
 * await onDelete(id, password)
 */
export function useConfirmWithPassword(authUser, { verify = true } = {}) {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState({
    title: 'Confirm delete',
    message: 'Enter your login password to permanently delete. This cannot be undone.',
    passwordLabel: 'Login password',
    confirmLabel: 'Confirm Delete',
  })
  const pendingRef = useRef(null)

  const confirmWithPassword = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      pendingRef.current = resolve
      setConfig({
        title: opts.title ?? 'Confirm delete',
        message:
          opts.message ??
          'Enter your login password to permanently delete. This cannot be undone.',
        passwordLabel: opts.passwordLabel ?? 'Login password',
        confirmLabel: opts.confirmLabel ?? 'Confirm Delete',
        skipVerify: opts.skipVerify === true,
      })
      setOpen(true)
    })
  }, [])

  const finish = useCallback((result) => {
    const resolve = pendingRef.current
    pendingRef.current = null
    setOpen(false)
    resolve?.(result)
  }, [])

  const handleClose = useCallback(() => {
    if (!pendingRef.current) {
      setOpen(false)
      return
    }
    finish(null)
  }, [finish])

  const handleConfirm = useCallback(
    async (password) => {
      if (verify && !config.skipVerify) {
        await verifyAuthUserPassword(authUser, password)
      }
      finish(password)
    },
    [authUser, config.skipVerify, finish, verify],
  )

  const passwordConfirmModal = (
    <ConfirmPasswordModal
      open={open}
      title={config.title}
      message={config.message}
      passwordLabel={config.passwordLabel}
      confirmLabel={config.confirmLabel}
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  )

  return { confirmWithPassword, passwordConfirmModal }
}
