import React, { useEffect, useId, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { updateGuide } from '../data/updateGuide.js'
import './UpdateGuideMascot.css'

export default function UpdateGuideMascot({ userId, updateAvailable, onUpdate, checking }) {
  const navigate = useNavigate()
  const storageKey = `fms-update-guide:${userId}:${updateGuide.id}`
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [unread, setUnread] = useState(false)
  const button = useRef(null)
  const panel = useRef(null)
  const id = useId()

  useEffect(() => {
    let seen = false
    try { seen = localStorage.getItem(storageKey) === 'seen' } catch { /* Storage may be unavailable. */ }
    setUnread(!seen)
    setOpen(!seen)
    setStep(0)
  }, [storageKey])

  useEffect(() => {
    if (open) panel.current?.focus()
  }, [open])

  function dismiss() {
    try { localStorage.setItem(storageKey, 'seen') } catch { /* The guide still works without storage. */ }
    setUnread(false)
    setOpen(false)
    button.current?.focus()
  }

  function goToStep(next) {
    setStep(next)
    const path = updateGuide.steps[next].path
    if (path) navigate(path)
  }

  const current = updateGuide.steps[step]
  return (
    <aside className="fms-guide" aria-label="FMS update assistant">
      {open && (
        <section ref={panel} id={id} role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1}
          className="fms-guide-panel" onKeyDown={(event) => {
            if (event.key === 'Escape') { event.stopPropagation(); dismiss() }
          }}>
          <div className="fms-guide-heading">
            <span>YOUR FMS GUIDE</span>
            <button type="button" onClick={dismiss} aria-label="Close update guide"><X size={18} /></button>
          </div>
          {updateAvailable ? (
            <>
              <h3 id={`${id}-title`}>An FMS update is ready</h3>
              <p>Finish any unsaved work, then reload to get the latest version. I’ll guide you through new features when a new guide is included.</p>
              <button type="button" className="fms-guide-primary" disabled={checking} onClick={onUpdate}>Reload FMS</button>
            </>
          ) : (
            <>
              <div aria-live="polite" aria-atomic="true">
                <span className="fms-guide-count">What’s new · Step {step + 1} of {updateGuide.steps.length}</span>
                <h3 id={`${id}-title`}>{current.title}</h3>
                <p>{current.text}</p>
              </div>
              <div className="fms-guide-dots" aria-hidden="true">
                {updateGuide.steps.map((item, index) => <span key={item.title} className={index === step ? 'active' : ''} />)}
              </div>
              <div className="fms-guide-actions">
                <button type="button" onClick={dismiss}>Skip guide</button>
                <div>
                  {step > 0 && <button type="button" onClick={() => goToStep(step - 1)}>Back</button>}
                  <button type="button" className="fms-guide-primary" onClick={() => step === updateGuide.steps.length - 1 ? dismiss() : goToStep(step + 1)}>
                    {step === updateGuide.steps.length - 1 ? 'Got it' : step === 0 ? 'Show me' : 'Next'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
      <button ref={button} type="button" className="fms-mascot" aria-label={updateAvailable ? 'FMS update available — open guide' : 'Open FMS update guide'}
        aria-expanded={open} aria-controls={id} aria-haspopup="dialog"
        onClick={() => { if (open) dismiss(); else { setStep(0); setOpen(true) } }}>
        <span className="fms-mascot-orbit" aria-hidden="true">
          <span className="fms-mascot-antenna"><i /><i /><i /></span>
          <span className="fms-mascot-body"><span className="fms-mascot-eyes"><i /><i /></span><span className="fms-mascot-smile" /><span className="fms-mascot-feet" /></span>
        </span>
        <span className={`fms-mascot-badge ${unread || updateAvailable ? 'has-news' : ''}`} aria-hidden="true"><MessageCircle size={15} /></span>
      </button>
    </aside>
  )
}
