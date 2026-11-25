import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Folder, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import AppIcon from './AppIcon.jsx'
import Modal from './Modal.jsx'
import DropdownMenu from './DropdownMenu.jsx'
import { ENTRY_TYPES, TYPE_LABELS, normalizeEntryType } from '../utils/entryTypes.js'
import { formatSupabaseError } from '../utils/supabaseErrors.js'
import { useConfirmWithPassword } from '../hooks/useConfirmWithPassword.jsx'

const DEFAULT_TAB = 'expense'

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase()
}

function CategoryRowMenu({ category, busy, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const itemClass =
    'theme-dropdown-item flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm disabled:opacity-50'

  return (
    <div className="relative inline-flex">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-500/10 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/60 disabled:opacity-50"
        aria-label={`More actions for ${category.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <AppIcon icon={MoreHorizontal} size="sm" />
      </button>
      <DropdownMenu open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={188}>
        <button
          type="button"
          className={itemClass}
          role="menuitem"
          onClick={() => {
            setOpen(false)
            onEdit?.(category)
          }}
        >
          <AppIcon icon={Pencil} size="sm" />
          Edit Category
        </button>
        <button
          type="button"
          className={`${itemClass} text-rose-600 hover:bg-rose-500/10 dark:text-rose-300`}
          role="menuitem"
          onClick={() => {
            setOpen(false)
            onDelete?.(category)
          }}
        >
          <AppIcon icon={Trash2} size="sm" />
          Delete Category
        </button>
      </DropdownMenu>
    </div>
  )
}

export default function Categories({
  categories = [],
  transactions = [],
  onCreate,
  onUpdate,
  onDelete,
  loading = false,
  authUser,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const typeFromUrl = normalizeEntryType(searchParams.get('type'))
  const activeType = typeFromUrl || DEFAULT_TAB

  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addType, setAddType] = useState(DEFAULT_TAB)
  const [saving, setSaving] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [deletingId, setDeletingId] = useState(null)
  const { confirmWithPassword, passwordConfirmModal } = useConfirmWithPassword(authUser)

  useEffect(() => {
    if (!typeFromUrl) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('type', DEFAULT_TAB)
          return next
        },
        { replace: true },
      )
    }
  }, [typeFromUrl, setSearchParams])

  function setActiveType(typeId) {
    const nextType = normalizeEntryType(typeId) || DEFAULT_TAB
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('type', nextType)
      return next
    })
    setSearch('')
    setError(null)
  }

  const usageByKey = useMemo(() => {
    const map = new Map()
    for (const tx of transactions ?? []) {
      const type = normalizeEntryType(tx.type)
      const name = normalizeName(tx.category)
      if (!type || !name) continue
      const key = `${type}::${name}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [transactions])

  const countsByType = useMemo(() => {
    const counts = Object.fromEntries(ENTRY_TYPES.map((t) => [t.id, 0]))
    for (const c of categories ?? []) {
      const type = normalizeEntryType(c.entry_type)
      if (counts[type] != null) counts[type] += 1
    }
    return counts
  }, [categories])

  const activeLabel = TYPE_LABELS[activeType] ?? 'Expense'

  const typeCategories = useMemo(() => {
    return (categories ?? [])
      .filter((c) => normalizeEntryType(c.entry_type) === activeType)
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [categories, activeType])

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return typeCategories
    return typeCategories.filter((c) => String(c.name ?? '').toLowerCase().includes(q))
  }, [typeCategories, search])

  function openAddModal() {
    setError(null)
    setAddName('')
    setAddType(activeType)
    setAddOpen(true)
  }

  function closeAddModal() {
    if (saving) return
    setAddOpen(false)
    setAddName('')
    setError(null)
  }

  function openEditModal(category) {
    setError(null)
    setEditing(category)
    setEditName(category.name ?? '')
    setEditOpen(true)
  }

  function closeEditModal() {
    if (savingEdit) return
    setEditOpen(false)
    setEditing(null)
    setEditName('')
    setError(null)
  }

  function hasDuplicateName(name, entryType, excludeId = null) {
    const normalized = normalizeName(name)
    const type = normalizeEntryType(entryType)
    return (categories ?? []).some(
      (c) =>
        c.id !== excludeId &&
        normalizeEntryType(c.entry_type) === type &&
        normalizeName(c.name) === normalized,
    )
  }

  async function handleCreate(e) {
    e.preventDefault()
    const trimmed = addName.trim()
    if (!trimmed) {
      setError('Category name is required.')
      return
    }
    if (hasDuplicateName(trimmed, addType)) {
      setError('That category already exists for this entry type.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onCreate?.({
        name: trimmed,
        entry_type: addType,
      })
      setAddOpen(false)
      setAddName('')
      if (normalizeEntryType(addType) !== activeType) {
        setActiveType(addType)
      }
    } catch (err) {
      setError(formatSupabaseError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editing) return
    const trimmed = editName.trim()
    if (!trimmed) {
      setError('Category name is required.')
      return
    }
    if (hasDuplicateName(trimmed, editing.entry_type, editing.id)) {
      setError('That category already exists for this entry type.')
      return
    }
    if (trimmed === editing.name) {
      closeEditModal()
      return
    }
    setError(null)
    setSavingEdit(true)
    try {
      await onUpdate?.({
        id: editing.id,
        name: trimmed,
      })
      setEditOpen(false)
      setEditing(null)
      setEditName('')
    } catch (err) {
      setError(formatSupabaseError(err))
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(category) {
    const usage =
      usageByKey.get(`${normalizeEntryType(category.entry_type)}::${normalizeName(category.name)}`) ?? 0
    const usageNote =
      usage > 0
        ? ` This category is used on ${usage} transaction${usage === 1 ? '' : 's'}; those records will keep the category name, but it will no longer appear in the library.`
        : ''

    const password = await confirmWithPassword({
      title: 'Delete Category?',
      message: `Are you sure you want to delete “${category.name}”? This action may affect existing records.${usageNote}`,
      confirmLabel: 'Delete Category',
    })
    if (!password) return

    setError(null)
    setDeletingId(category.id)
    try {
      await onDelete?.(category.id, password)
    } catch (err) {
      setError(formatSupabaseError(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="categories-ipad-fit mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-4 lg:py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Categories
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage and organize transaction categories.
          </p>
        </div>
        <button type="button" onClick={openAddModal} className="theme-btn-primary w-full sm:w-auto">
          <AppIcon icon={Plus} size="sm" className="text-white" />
          Add Category
        </button>
      </div>

      <div className="mt-5 border-b border-slate-700/50">
        <div
          className="finance-scroll flex items-center gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Category entry types"
        >
          {ENTRY_TYPES.map((type) => {
            const active = activeType === type.id
            const count = countsByType[type.id] ?? 0
            return (
              <button
                key={type.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveType(type.id)}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors sm:px-4 ${
                  active
                    ? 'theme-tab-active font-semibold'
                    : 'border-transparent font-medium text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="whitespace-nowrap">
                  {type.label}
                  <span className={`ml-1.5 tabular-nums ${active ? 'text-emerald-300/90' : 'opacity-70'}`}>
                    ({count})
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {activeLabel} Categories
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {typeCategories.length} categor{typeCategories.length === 1 ? 'y' : 'ies'}
            {search.trim()
              ? ` · ${filteredCategories.length} match${filteredCategories.length === 1 ? '' : 'es'}`
              : ''}
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <AppIcon
            icon={Search}
            size="sm"
            className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="theme-input !mt-0 w-full !py-2 !pl-10 !pr-9 text-sm"
            aria-label={`Search ${activeLabel.toLowerCase()} categories`}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 z-[1] flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-500/20 hover:text-slate-100"
              aria-label="Clear search"
              title="Clear search"
            >
              <AppIcon icon={X} size="sm" />
            </button>
          ) : null}
        </div>
      </div>

      {error && !addOpen && !editOpen ? (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="glass mt-3 overflow-hidden rounded-xl border border-slate-700/50">
        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">Loading categories…</div>
        ) : filteredCategories.length === 0 ? (
          <div className="px-4 py-10 text-center">
            {search.trim() ? (
              <>
                <div className="text-sm font-medium text-slate-200">No matching categories found</div>
                <p className="mt-1 text-sm text-slate-500">Try another search term.</p>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="theme-btn-secondary mt-4 text-sm"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-slate-200">
                  No {activeLabel.toLowerCase()} categories yet
                </div>
                <p className="mt-1 text-sm text-slate-500">Add one to use it in Add Entry for this type.</p>
                <button type="button" onClick={openAddModal} className="theme-btn-primary mt-4 text-sm">
                  <AppIcon icon={Plus} size="sm" className="text-white" />
                  Add Category
                </button>
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/40" role="list">
            {filteredCategories.map((category) => {
              const usage =
                usageByKey.get(
                  `${normalizeEntryType(category.entry_type)}::${normalizeName(category.name)}`,
                ) ?? 0
              const busy = deletingId === category.id
              return (
                <li
                  key={category.id}
                  className="flex min-h-[52px] items-center gap-3 px-3 py-2 transition hover:bg-emerald-500/[0.04] sm:px-4"
                >
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <AppIcon icon={Folder} size="sm" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {category.name}
                    </div>
                    {usage > 0 ? (
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Used in {usage} transaction{usage === 1 ? '' : 's'}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(category)}
                      disabled={busy}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-400 transition hover:bg-slate-500/10 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/60 disabled:opacity-50"
                    >
                      <AppIcon icon={Pencil} size="sm" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                    <CategoryRowMenu
                      category={category}
                      busy={busy}
                      onEdit={openEditModal}
                      onDelete={handleDelete}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal
        open={addOpen}
        title="Add New Category"
        onClose={closeAddModal}
        closeOnBackdrop={!saving}
        footer={
          <div className="theme-modal-footer flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeAddModal}
              disabled={saving}
              className="theme-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-category-form"
              disabled={saving || !addName.trim()}
              className="theme-btn-primary"
            >
              {saving ? 'Creating…' : 'Create Category'}
            </button>
          </div>
        }
      >
        <form id="add-category-form" className="space-y-4" onSubmit={handleCreate}>
          {error && addOpen ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="add-category-name" className="text-xs font-medium text-slate-500">
              Category Name
            </label>
            <input
              id="add-category-name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              required
              autoFocus
              placeholder="Enter category name"
              className="theme-input mt-1"
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor="add-category-type" className="text-xs font-medium text-slate-500">
              Entry Type
            </label>
            <select
              id="add-category-type"
              value={addType}
              onChange={(e) => setAddType(e.target.value)}
              className="theme-input mt-1"
              disabled={saving}
            >
              {ENTRY_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        title="Edit Category"
        onClose={closeEditModal}
        closeOnBackdrop={!savingEdit}
        footer={
          <div className="theme-modal-footer flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={savingEdit}
              className="theme-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-category-form"
              disabled={savingEdit || !editName.trim()}
              className="theme-btn-primary"
            >
              {savingEdit ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <form id="edit-category-form" className="space-y-4" onSubmit={handleSaveEdit}>
          {error && editOpen ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="edit-category-name" className="text-xs font-medium text-slate-500">
              Category Name
            </label>
            <input
              id="edit-category-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              autoFocus
              className="theme-input mt-1"
              disabled={savingEdit}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Entry Type</label>
            <input
              value={TYPE_LABELS[normalizeEntryType(editing?.entry_type)] ?? '—'}
              className="theme-input mt-1"
              disabled
              readOnly
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Entry type cannot be changed after creation to protect linked transactions and reports.
            </p>
          </div>
        </form>
      </Modal>

      {passwordConfirmModal}
    </div>
  )
}
