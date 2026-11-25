import React, { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import AppIcon from './AppIcon.jsx'
import { formatSupabaseError } from '../utils/supabaseErrors.js'
import { ENTRY_TYPES, TYPE_LABELS, normalizeEntryType } from '../utils/entryTypes.js'

export { normalizeEntryType }

function normalizeCategoryRecord(c) {
  return {
    ...c,
    entry_type: normalizeEntryType(c?.entry_type ?? c?.entryType),
  }
}

export function categoryMatchesType(entryType, selectedType) {
  const normalized = normalizeEntryType(entryType)
  const type = normalizeEntryType(selectedType)
  if (!type) return false
  return normalized === type
}

/** Categories for the dropdown — strictly the selected entry type only. */
export function buildCategoryOptionGroups(
  libraryCategories,
  type,
  currentValue = '',
  _recentNames = [],
  transactions = [],
) {
  const selectedType = normalizeEntryType(type)
  const library = (libraryCategories ?? []).map(normalizeCategoryRecord)
  const forType = library
    .filter((c) => categoryMatchesType(c.entry_type, selectedType))
    .map((c) => ({ name: c.name, entry_type: c.entry_type, group: 'library' }))

  const knownForType = new Set(forType.map((o) => o.name))
  const recentSeen = new Set()
  const recent = []

  for (const tx of transactions ?? []) {
    if (normalizeEntryType(tx.type) !== selectedType || !tx.category) continue
    if (knownForType.has(tx.category) || recentSeen.has(tx.category)) continue
    recentSeen.add(tx.category)
    recent.push({ name: tx.category, entry_type: selectedType, group: 'recent' })
  }

  const trimmedCurrent = String(currentValue ?? '').trim()
  if (trimmedCurrent && !knownForType.has(trimmedCurrent) && !recentSeen.has(trimmedCurrent)) {
    recent.unshift({ name: trimmedCurrent, entry_type: selectedType, group: 'recent' })
  }

  const options = []
  const seen = new Set()
  for (const opt of [...forType, ...recent]) {
    if (seen.has(opt.name)) continue
    seen.add(opt.name)
    options.push(opt)
  }

  return {
    forType,
    recent,
    options,
    allNames: options.map((o) => o.name),
  }
}

/** Pick a valid category name when the entry type changes. */
export function pickCategoryForType(libraryCategories, transactions, type, currentCategory = '') {
  const selectedType = normalizeEntryType(type)
  const trimmed = String(currentCategory ?? '').trim()

  if (trimmed && selectedType) {
    const library = (libraryCategories ?? []).map(normalizeCategoryRecord)
    const inLibrary = library.some(
      (c) => c.name === trimmed && categoryMatchesType(c.entry_type, selectedType),
    )
    const inTransactions = (transactions ?? []).some(
      (tx) => normalizeEntryType(tx.type) === selectedType && tx.category === trimmed,
    )
    if (inLibrary || inTransactions) return trimmed
  }

  const { allNames } = buildCategoryOptionGroups(libraryCategories, type, '', [], transactions)
  return allNames[0] ?? ''
}

export function categoriesForType(libraryCategories, type, currentValue = '', transactions = []) {
  return buildCategoryOptionGroups(libraryCategories, type, currentValue, [], transactions).allNames
}

export default function CategoryField({
  type,
  libraryCategories = [],
  recentCategoryNames = [],
  transactions = [],
  value,
  onChange,
  onCreateCategory,
  isAdmin = false,
  loading = false,
  disabled = false,
  layout = 'default',
}) {
  const selectedType = normalizeEntryType(type)

  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEntryType, setNewEntryType] = useState(selectedType || 'expense')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    if (selectedType) setNewEntryType(selectedType)
  }, [selectedType])

  useEffect(() => {
    if (showAdd && selectedType) setNewEntryType(selectedType)
  }, [showAdd, selectedType])

  const groups = useMemo(
    () => buildCategoryOptionGroups(libraryCategories, selectedType, value, recentCategoryNames, transactions),
    [libraryCategories, selectedType, value, recentCategoryNames, transactions],
  )

  const selectValue = groups.allNames.includes(value) ? value : ''
  const hasOptions = groups.options.length > 0
  const isFullWidth = layout === 'full'

  async function handleAddCategory() {
    const name = newName.trim()
    const entryType = normalizeEntryType(newEntryType)
    if (!name || !onCreateCategory || !entryType) return
    setAddError(null)
    setAdding(true)
    try {
      await onCreateCategory({ name, entry_type: entryType })
      if (entryType === selectedType) onChange(name)
      setNewName('')
      setShowAdd(false)
    } catch (e) {
      setAddError(formatSupabaseError(e))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className={isFullWidth ? 'w-full' : ''}>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Category{' '}
        <span className="font-normal text-slate-500 dark:text-slate-400">
          ({TYPE_LABELS[selectedType] ?? selectedType} only)
        </span>
      </label>
      <div className={`mt-1 flex gap-2 ${isFullWidth ? 'flex-col sm:flex-row' : ''}`}>
        <select
          value={selectValue}
          onChange={(e) => onChange(e.target.value)}
          className={`theme-input min-w-0 ${isFullWidth ? 'w-full sm:flex-1' : 'flex-1'}`}
          disabled={loading || disabled}
        >
          <option value="">
            {hasOptions
              ? `Select ${TYPE_LABELS[selectedType]?.toLowerCase() ?? selectedType} category…`
              : `No ${TYPE_LABELS[selectedType]?.toLowerCase() ?? selectedType} categories yet — add one with +`}
          </option>
          {groups.options.map((opt) => (
            <option key={opt.name} value={opt.name}>
              {opt.name}
            </option>
          ))}
        </select>
        {onCreateCategory ? (
          <button
            type="button"
            onClick={() => {
              setShowAdd((v) => !v)
              setAddError(null)
              setNewEntryType(selectedType || 'expense')
            }}
            disabled={loading || disabled}
            className={`theme-btn-secondary flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 ${
              isFullWidth ? 'w-full sm:w-auto' : 'w-10'
            }`}
            title={`Add ${TYPE_LABELS[selectedType]?.toLowerCase() ?? selectedType} category`}
          >
            <AppIcon icon={Plus} size="md" />
            {isFullWidth ? <span className="text-sm font-medium">New category</span> : null}
          </button>
        ) : null}
      </div>
      {!hasOptions && !onCreateCategory ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Ask an admin to add {TYPE_LABELS[selectedType]?.toLowerCase() ?? selectedType} categories in the Category library.
        </p>
      ) : null}
      {showAdd && onCreateCategory ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              className="theme-input min-w-[10rem] flex-1"
              disabled={adding}
            />
            <select
              value={newEntryType}
              onChange={(e) => setNewEntryType(e.target.value)}
              className="theme-input w-auto min-w-[8.5rem]"
              disabled={adding}
              aria-label="Category entry type"
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddCategory}
              disabled={!newName.trim() || adding}
              className="theme-btn-primary px-3"
            >
              {adding ? 'Adding…' : 'Create'}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose which entry type this category belongs to. It appears in Add Entry when that type is selected.
          </p>
        </div>
      ) : null}
      {addError ? <p className="mt-1 text-xs text-rose-300">{addError}</p> : null}
    </div>
  )
}
