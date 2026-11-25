import React, { useState } from 'react'
import { ExternalLink, FileText, ImageIcon } from 'lucide-react'
import AppIcon from './AppIcon.jsx'
import Modal from './Modal.jsx'
import { getReceiptUrl, isPdfReceipt } from '../utils/receiptDisplay.js'

/**
 * Thumbnail / open link for a bill saved on a transaction.
 */
export default function EntryReceipt({ transaction, size = 'sm', className = '' }) {
  const [open, setOpen] = useState(false)
  const url = getReceiptUrl(transaction)
  if (!url) {
    return <span className={`text-xs text-slate-400 ${className}`}>—</span>
  }

  const pdf = isPdfReceipt(transaction)
  const thumb = size === 'lg' ? 'h-28 w-28' : size === 'xs' ? 'h-8 w-8' : 'h-10 w-10'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group inline-flex items-center gap-1.5 rounded-md border border-slate-300/70 bg-slate-50 p-0.5 text-left dark:border-slate-600/60 dark:bg-slate-900/60 ${className}`}
        title={pdf ? 'View bill PDF' : 'View bill image'}
      >
        {pdf ? (
          <span className={`flex ${thumb} items-center justify-center rounded bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>
            <AppIcon icon={FileText} size="sm" />
          </span>
        ) : (
          <img
            src={url}
            alt="Bill"
            className={`${thumb} rounded object-cover`}
            loading="lazy"
          />
        )}
        {size === 'lg' ? (
          <span className="pr-2 text-xs text-emerald-700 dark:text-emerald-400">Open bill</span>
        ) : null}
      </button>

      <Modal
        open={open}
        title={pdf ? 'Bill (PDF)' : 'Bill image'}
        size="lg"
        onClose={() => setOpen(false)}
        footer={
          <div className="theme-modal-footer">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="theme-btn-primary inline-flex items-center justify-center gap-2"
            >
              <AppIcon icon={ExternalLink} size="sm" />
              Open in new tab
            </a>
          </div>
        }
      >
        {pdf ? (
          <div className="flex flex-col items-center gap-3 py-8 text-slate-600 dark:text-slate-300">
            <AppIcon icon={FileText} size="lg" />
            <p className="text-sm">PDF bills open in a new tab.</p>
            <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-emerald-600 underline dark:text-emerald-400">
              Open PDF
            </a>
          </div>
        ) : (
          <div className="flex justify-center">
            <img
              src={url}
              alt="Saved bill"
              className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
            />
          </div>
        )}
        {!pdf ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <AppIcon icon={ImageIcon} size="sm" />
            Saved with this entry
          </p>
        ) : null}
      </Modal>
    </>
  )
}
