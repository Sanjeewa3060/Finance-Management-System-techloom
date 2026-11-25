import React, { useEffect, useId, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { parseISODate, toISODate } from '../utils/dates.js'
import { getDatePresetRange, normalizeDatePreset } from '../utils/filters.js'

const presets = [
  ['today', 'Today'], ['yesterday', 'Yesterday'],
  ['this_month', 'Month to date'],
  ['last_month', 'Last month'], ['this_year', 'Year to date'],
  ['this_week', 'This week'], ['last_week', 'Last week'],
  ['all', 'All time'],
]
const shortDate = (iso) => parseISODate(iso)?.toLocaleDateString(undefined, {
  month: 'short', day: 'numeric', year: 'numeric',
}) || 'Any date'

function resolveDraft(fromDate, toDate, preset) {
  const safe = normalizeDatePreset(preset)
  if (safe === preset) return { fromDate, toDate, preset }
  return { ...getDatePresetRange(safe), preset: safe }
}

export default function ReportDateRangePicker({ fromDate, toDate, preset, onApply }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => resolveDraft(fromDate, toDate, preset))
  const [month, setMonth] = useState(new Date())
  const root = useRef(null)
  const trigger = useRef(null)
  const panel = useRef(null)
  const id = useId()
  const today = toISODate(new Date())

  function close(confirmed = false) {
    setOpen(false)
    if (!confirmed) setDraft(resolveDraft(fromDate, toDate, preset))
    trigger.current?.focus()
  }

  const validRange = Boolean(draft.fromDate && draft.toDate && draft.fromDate <= draft.toDate)

  function updateDate(field, value) {
    setDraft((current) => ({ ...current, [field]: value, preset: 'custom' }))
    if (field === 'fromDate' && value) setMonth(parseISODate(value) || new Date())
  }

  function openCalendar() {
    setDraft(resolveDraft(fromDate, toDate, preset))
    setMonth(parseISODate(fromDate) || new Date())
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const dismiss = (event) => {
      if (!root.current?.contains(event.target)) {
        setOpen(false)
        setDraft(resolveDraft(fromDate, toDate, preset))
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open, fromDate, toDate, preset])

  function selectDay(iso) {
    setDraft((current) => {
      if (!current.fromDate || current.toDate) return { fromDate: iso, toDate: '', preset: 'custom' }
      return { fromDate: iso < current.fromDate ? iso : current.fromDate,
        toDate: iso < current.fromDate ? current.fromDate : iso, preset: 'custom' }
    })
  }

  function selectPreset(value) {
    const range = getDatePresetRange(value)
    setDraft({ ...range, preset: value })
    setMonth(parseISODate(range.fromDate) || new Date())
  }

  return (
    <div ref={root} className="shrink-0" onKeyDown={(event) => {
      if (event.key === 'Escape' && open) { event.stopPropagation(); close() }
    }}>
      <button ref={trigger} type="button" aria-label="Choose report dates" title="Choose report dates"
        aria-controls={id} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => open ? close() : openCalendar()}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-emerald-400 hover:border-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
        <Calendar size={20} />
      </button>
      {open && (
        <div ref={panel} id={id} role="dialog" aria-label="Choose report date range" tabIndex={-1}
          className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(36rem,calc(100vw-4rem))] max-w-full overflow-auto rounded-xl border border-slate-700 bg-[#1c2333] p-3 text-slate-100 shadow-2xl outline-none">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="min-w-0">
              <span className="text-xs font-medium text-slate-400">From date</span>
              <input type="date" value={draft.fromDate} max={draft.toDate || undefined}
                onChange={(event) => updateDate('fromDate', event.target.value)}
                className="theme-input mt-1 w-full min-w-0 text-sm" />
            </label>
            <label className="min-w-0">
              <span className="text-xs font-medium text-slate-400">To date</span>
              <input type="date" value={draft.toDate} min={draft.fromDate || undefined}
                onChange={(event) => updateDate('toDate', event.target.value)}
                className="theme-input mt-1 w-full min-w-0 text-sm" />
            </label>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" className="rounded p-2 hover:bg-slate-700" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
            <span className="text-xs text-slate-400">Confirm your report dates</span>
            <button type="button" aria-label="Next month" className="rounded p-2 hover:bg-slate-700" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[-1, 0].map((offset) => {
              const first = new Date(month.getFullYear(), month.getMonth() + offset, 1)
              const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
              return (
                <section key={offset} aria-label={first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}>
                  <h4 className="mb-4 text-center text-sm font-semibold">{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h4>
                  <div className="grid grid-cols-7 text-center text-xs">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="pb-3 font-semibold text-slate-300">{day}</span>)}
                    {Array.from({ length: first.getDay() }, (_, index) => <span key={`blank-${index}`} />)}
                    {Array.from({ length: days }, (_, index) => {
                      const date = new Date(first.getFullYear(), first.getMonth(), index + 1)
                      const iso = toISODate(date)
                      const endpoint = iso === draft.fromDate || iso === draft.toDate
                      const inside = draft.fromDate && draft.toDate && iso > draft.fromDate && iso < draft.toDate
                      return <button key={iso} type="button" aria-label={date.toLocaleDateString(undefined, { dateStyle: 'full' })}
                        aria-pressed={Boolean(endpoint || inside)}
                        className={`h-9 text-xs font-medium ${iso > today ? 'opacity-30' : ''} outline-offset-[-2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 ${endpoint ? 'rounded-lg bg-emerald-500 text-white' : inside ? 'bg-slate-700/60 text-white hover:bg-slate-600' : 'text-slate-300 hover:rounded-lg hover:bg-slate-700'}`}
                        onClick={() => selectDay(iso)}>{index + 1}</button>
                    })}
                  </div>
                </section>
              )
            })}
          </div>
          <div className="mt-3 rounded-b-lg bg-[#101827] p-3">
            <div className="flex flex-wrap gap-2">
              {presets.map(([value, label]) => <button key={value} type="button" aria-pressed={draft.preset === value}
                onClick={() => selectPreset(value)}
                className={`rounded border px-2 py-1 text-xs ${draft.preset === value ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-transparent text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{label}</button>)}
            </div>
            <p className="mt-3 text-xs text-slate-400" aria-live="polite">{draft.preset === 'all' ? 'All time' : `${shortDate(draft.fromDate)} – ${draft.toDate ? shortDate(draft.toDate) : 'Select end date'}`}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => close()} className="rounded-md border border-slate-500 px-4 py-1.5 text-xs font-semibold hover:bg-slate-700">Cancel</button>
              <button type="button" disabled={draft.preset !== 'all' && !validRange}
                onClick={() => { onApply(draft); close(true) }} className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40">Confirm &amp; generate report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
