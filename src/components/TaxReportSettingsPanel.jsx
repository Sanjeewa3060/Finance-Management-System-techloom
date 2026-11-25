import React, { useEffect, useState } from 'react'
import { DEFAULT_DISALLOWABLE_PATTERNS, DEFAULT_PARTNERS, normalizeTaxSettings } from '../utils/taxComputation.js'

function PartnerRow({ partner, index, onChange, onRemove, canRemove }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-[8rem] flex-1">
        <span className="text-xs text-slate-500">Name</span>
        <input
          value={partner.name}
          onChange={(e) => onChange(index, { ...partner, name: e.target.value })}
          className="theme-input mt-1 text-sm"
        />
      </label>
      <label className="w-16">
        <span className="text-xs text-slate-500">Share</span>
        <input
          type="number"
          min="1"
          value={partner.shareNum}
          onChange={(e) => onChange(index, { ...partner, shareNum: Number(e.target.value) || 1 })}
          className="theme-input mt-1 text-sm"
        />
      </label>
      <span className="pb-2 text-slate-500">/</span>
      <label className="w-16">
        <span className="text-xs text-slate-500">&nbsp;</span>
        <input
          type="number"
          min="1"
          value={partner.shareDen}
          onChange={(e) => onChange(index, { ...partner, shareDen: Number(e.target.value) || 1 })}
          className="theme-input mt-1 text-sm"
        />
      </label>
      {canRemove ? (
        <button type="button" onClick={() => onRemove(index)} className="theme-btn-secondary rounded-lg px-2 py-2 text-xs">
          Remove
        </button>
      ) : null}
    </div>
  )
}

export default function TaxReportSettingsPanel({ settings, onSave, saving = false }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => normalizeTaxSettings(settings))

  useEffect(() => {
    setDraft(normalizeTaxSettings(settings))
  }, [settings])

  function updateDraft(patch) {
    setDraft((prev) => normalizeTaxSettings({ ...prev, ...patch }))
  }

  function updatePartner(index, partner) {
    setDraft((prev) => {
      const partners = [...prev.partners]
      partners[index] = partner
      return normalizeTaxSettings({ ...prev, partners })
    })
  }

  function addPartner() {
    setDraft((prev) =>
      normalizeTaxSettings({
        ...prev,
        partners: [...prev.partners, { name: `Partner ${prev.partners.length + 1}`, shareNum: 1, shareDen: 1 }],
      }),
    )
  }

  function removePartner(index) {
    setDraft((prev) => {
      const partners = prev.partners.filter((_, i) => i !== index)
      return normalizeTaxSettings({ ...prev, partners: partners.length ? partners : DEFAULT_PARTNERS })
    })
  }

  function updatePattern(index, patch) {
    setDraft((prev) => {
      const disallowable_patterns = [...prev.disallowable_patterns]
      disallowable_patterns[index] = { ...disallowable_patterns[index], ...patch }
      return normalizeTaxSettings({ ...prev, disallowable_patterns })
    })
  }

  function updateManualOverride(key, value, subKey = null) {
    setDraft((prev) => {
      const manual_overrides = { ...prev.manual_overrides }
      if (subKey) {
        manual_overrides.disallowable = { ...(manual_overrides.disallowable ?? {}), [subKey]: value === '' ? undefined : value }
      } else {
        manual_overrides[key] = value === '' ? undefined : value
      }
      return normalizeTaxSettings({ ...prev, manual_overrides })
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    await onSave?.(draft)
  }

  function resetDefaults() {
    setDraft(
      normalizeTaxSettings({
        ...draft,
        partners: DEFAULT_PARTNERS,
        disallowable_patterns: DEFAULT_DISALLOWABLE_PATTERNS,
      }),
    )
  }

  return (
    <div className="glass rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-200"
      >
        Tax report settings (admin)
        <span className="text-xs font-normal text-slate-400">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <form onSubmit={handleSave} className="space-y-4 border-t border-slate-700/50 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className="text-xs text-slate-400">Assessment year start</span>
              <input
                type="number"
                value={draft.assessment_year_start}
                onChange={(e) => updateDraft({ assessment_year_start: Number(e.target.value) })}
                className="theme-input mt-1 text-sm"
              />
            </label>
            <label>
              <span className="text-xs text-slate-400">Tax free allowance</span>
              <input
                type="number"
                min="0"
                value={draft.tax_free_allowance}
                onChange={(e) => updateDraft({ tax_free_allowance: Number(e.target.value) })}
                className="theme-input mt-1 text-sm"
              />
            </label>
            <label>
              <span className="text-xs text-slate-400">Tax rate (%)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.tax_rate_percent}
                onChange={(e) => updateDraft({ tax_rate_percent: Number(e.target.value) })}
                className="theme-input mt-1 text-sm"
              />
            </label>
            <label>
              <span className="text-xs text-slate-400">Tax paid</span>
              <input
                type="number"
                min="0"
                value={draft.tax_paid}
                onChange={(e) => updateDraft({ tax_paid: Number(e.target.value) })}
                className="theme-input mt-1 text-sm"
              />
            </label>
          </div>

          <label>
            <span className="text-xs text-slate-400">Currency note</span>
            <input
              value={draft.currency_label}
              onChange={(e) => updateDraft({ currency_label: e.target.value })}
              className="theme-input mt-1 text-sm"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400">Partners</span>
              <button type="button" onClick={addPartner} className="text-xs text-emerald-400 hover:underline">
                + Add partner
              </button>
            </div>
            <div className="space-y-2">
              {draft.partners.map((partner, index) => (
                <PartnerRow
                  key={index}
                  partner={partner}
                  index={index}
                  onChange={updatePartner}
                  onRemove={removePartner}
                  canRemove={draft.partners.length > 1}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Manual overrides (optional)</span>
            <label className="mt-2 block">
              <span className="text-xs text-slate-500">Net income override</span>
              <input
                type="number"
                value={draft.manual_overrides?.netIncome ?? ''}
                onChange={(e) => updateManualOverride('netIncome', e.target.value)}
                placeholder="Auto from transactions"
                className="theme-input mt-1 text-sm"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Disallowable patterns</span>
            <div className="mt-2 space-y-2">
              {draft.disallowable_patterns.map((pattern, index) => (
                <div key={pattern.label} className="grid gap-2 sm:grid-cols-2">
                  <label>
                    <span className="text-xs text-slate-500">{pattern.label}</span>
                    <input
                      value={(pattern.match ?? []).join(', ')}
                      onChange={(e) =>
                        updatePattern(index, {
                          match: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      placeholder="category keywords, comma-separated"
                      className="theme-input mt-1 text-sm"
                    />
                  </label>
                  <label>
                    <span className="text-xs text-slate-500">Override amount</span>
                    <input
                      type="number"
                      min="0"
                      value={draft.manual_overrides?.disallowable?.[pattern.label] ?? ''}
                      onChange={(e) => updateManualOverride('disallowable', e.target.value, pattern.label)}
                      placeholder="Auto from transactions"
                      className="theme-input mt-1 text-sm"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <button type="button" onClick={resetDefaults} className="theme-btn-secondary rounded-lg px-4 py-2 text-sm">
              Reset partners & patterns
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
