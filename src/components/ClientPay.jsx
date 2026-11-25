import React, { useMemo, useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Trash2,
  Edit2,
  DollarSign,
  Calendar,
  X,
  FileCheck,
  Building,
} from 'lucide-react'
import AppIcon from './AppIcon.jsx'
import Modal from './Modal.jsx'
import { formatMoney } from '../utils/money.js'
import {
  fetchClientInvoices,
  createClientInvoice,
  updateClientInvoice,
  deleteClientInvoice,
} from '../utils/clientInvoices.js'

const STATUS_OPTIONS = ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']

function getStatusBadge(status) {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
    case 'Sent':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
    case 'Overdue':
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
    case 'Partially Paid':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
    case 'Cancelled':
      return 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/30'
    default:
      return 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30'
  }
}

export default function ClientPay({ authUser, isAdmin, companyProfileId, showToast }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    invoice_number: '',
    client_name: '',
    amount: '',
    status: 'Sent',
    send_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    payment_received: false,
    received_date: '',
    note: '',
  })

  // Load Invoices
  useEffect(() => {
    let active = true
    async function loadData() {
      setLoading(true)
      try {
        const data = await fetchClientInvoices(companyProfileId)
        if (active) setInvoices(data)
      } catch (err) {
        console.error('Error loading invoices:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [companyProfileId])

  // Open Create Modal
  function handleOpenCreate() {
    setEditingInvoice(null)
    const nextNum = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`
    setFormData({
      invoice_number: nextNum,
      client_name: '',
      amount: '',
      status: 'Sent',
      send_date: new Date().toISOString().slice(0, 10),
      due_date: '',
      payment_received: false,
      received_date: '',
      note: '',
    })
    setModalOpen(true)
  }

  // Open Edit Modal
  function handleOpenEdit(inv) {
    setEditingInvoice(inv)
    setFormData({
      invoice_number: inv.invoice_number || '',
      client_name: inv.client_name || '',
      amount: inv.amount || '',
      status: inv.status || 'Sent',
      send_date: inv.send_date || new Date().toISOString().slice(0, 10),
      due_date: inv.due_date || '',
      payment_received: Boolean(inv.payment_received),
      received_date: inv.received_date || '',
      note: inv.note || '',
    })
    setModalOpen(true)
  }

  // Save Form
  async function handleSave(e) {
    e.preventDefault()
    if (!formData.invoice_number.trim() || !formData.client_name.trim()) {
      showToast?.('error', 'Invoice number and client name are required.')
      return
    }

    setSaving(true)
    try {
      if (editingInvoice) {
        const updated = await updateClientInvoice(editingInvoice.id, {
          ...formData,
          amount: Number(formData.amount) || 0,
        })
        setInvoices((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        showToast?.('success', `Invoice ${formData.invoice_number} updated.`)
      } else {
        const created = await createClientInvoice({
          ...formData,
          amount: Number(formData.amount) || 0,
          company_profile_id: companyProfileId,
        })
        setInvoices((prev) => [created, ...prev])
        showToast?.('success', `Invoice ${formData.invoice_number} added.`)
      }
      setModalOpen(false)
    } catch (err) {
      showToast?.('error', err?.message || 'Failed to save invoice.')
    } finally {
      setSaving(false)
    }
  }

  // Toggle Payment Received Directly
  async function handleTogglePayment(inv) {
    const nextState = !inv.payment_received
    const nextStatus = nextState ? 'Paid' : (inv.status === 'Paid' ? 'Sent' : inv.status)
    const nextDate = nextState ? new Date().toISOString().slice(0, 10) : null

    try {
      const updated = await updateClientInvoice(inv.id, {
        payment_received: nextState,
        status: nextStatus,
        received_date: nextDate,
      })
      setInvoices((prev) => prev.map((item) => (item.id === inv.id ? updated : item)))
      showToast?.(
        'success',
        `Invoice ${inv.invoice_number} marked as ${nextState ? 'Payment Received' : 'Payment Pending'}.`
      )
    } catch (err) {
      showToast?.('error', 'Could not update payment status.')
    }
  }

  // Delete Invoice
  async function handleDelete(inv) {
    if (!window.confirm(`Are you sure you want to delete invoice ${inv.invoice_number}?`)) return
    try {
      await deleteClientInvoice(inv.id)
      setInvoices((prev) => prev.filter((item) => item.id !== inv.id))
      showToast?.('success', `Invoice ${inv.invoice_number} deleted.`)
    } catch (err) {
      showToast?.('error', 'Failed to delete invoice.')
    }
  }

  // Export CSV
  function handleExportCsv() {
    if (!invoices.length) {
      showToast?.('error', 'No invoices to export.')
      return
    }

    const headers = [
      'Invoice Number',
      'Client',
      'Amount',
      'Status',
      'Send Date',
      'Due Date',
      'Payment Received',
      'Received Date',
      'Note',
    ]

    const escapeCsv = (val) => {
      const s = String(val ?? '')
      return `"${s.replace(/"/g, '""')}"`
    }

    const rows = filteredInvoices.map((inv) => [
      inv.invoice_number,
      inv.client_name,
      inv.amount,
      inv.status,
      inv.send_date,
      inv.due_date || '',
      inv.payment_received ? 'YES' : 'NO',
      inv.received_date || '',
      inv.note || '',
    ])

    const csvContent = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `client_invoices_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast?.('success', 'Invoices exported to CSV.')
  }

  // Filtered List
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.trim().toLowerCase()
      if (q) {
        const matchNum = inv.invoice_number?.toLowerCase().includes(q)
        const matchClient = inv.client_name?.toLowerCase().includes(q)
        const matchNote = inv.note?.toLowerCase().includes(q)
        if (!matchNum && !matchClient && !matchNote) return false
      }

      if (statusFilter !== 'all' && inv.status !== statusFilter) {
        return false
      }

      if (paymentFilter === 'received' && !inv.payment_received) {
        return false
      }
      if (paymentFilter === 'pending' && inv.payment_received) {
        return false
      }

      return true
    })
  }, [invoices, search, statusFilter, paymentFilter])

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalInvoiced = 0
    let totalReceived = 0
    let totalPending = 0
    let receivedCount = 0
    let pendingCount = 0

    for (const inv of invoices) {
      const amt = Number(inv.amount) || 0
      totalInvoiced += amt
      if (inv.payment_received) {
        totalReceived += amt
        receivedCount += 1
      } else {
        totalPending += amt
        pendingCount += 1
      }
    }

    return {
      totalCount: invoices.length,
      totalInvoiced,
      totalReceived,
      totalPending,
      receivedCount,
      pendingCount,
    }
  }, [invoices])

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <AppIcon icon={FileText} size="md" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
              Client Pay & Invoices
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
            Track client invoices, send dates, and monitor payment received status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="theme-btn-secondary inline-flex items-center gap-2 text-xs font-semibold"
          >
            <AppIcon icon={Download} size="sm" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="theme-btn-primary inline-flex items-center gap-2 text-xs font-semibold"
          >
            <AppIcon icon={Plus} size="sm" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Total Invoiced */}
        <div className="glass rounded-xl p-4 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Invoiced
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400">
              <AppIcon icon={FileText} size="sm" />
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900 sm:text-2xl dark:text-slate-100">
            {formatMoney(metrics.totalInvoiced)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{metrics.totalCount} total invoices</p>
        </div>

        {/* Payment Received */}
        <div className="glass rounded-xl p-4 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Payment Received
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
              <AppIcon icon={CheckCircle2} size="sm" />
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-emerald-600 sm:text-2xl dark:text-emerald-400">
            {formatMoney(metrics.totalReceived)}
          </p>
          <p className="mt-0.5 text-xs text-emerald-600/80 dark:text-emerald-400/80">
            {metrics.receivedCount} invoices collected
          </p>
        </div>

        {/* Payment Pending */}
        <div className="glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Pending / Unpaid
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300">
              <AppIcon icon={Clock} size="sm" />
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-amber-600 sm:text-2xl dark:text-amber-400">
            {formatMoney(metrics.totalPending)}
          </p>
          <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
            {metrics.pendingCount} awaiting payment
          </p>
        </div>

        {/* Collection Rate */}
        <div className="glass rounded-xl p-4 border border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Collection Rate
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-300">
              <AppIcon icon={DollarSign} size="sm" />
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-blue-600 sm:text-2xl dark:text-blue-400">
            {metrics.totalInvoiced > 0
              ? `${Math.round((metrics.totalReceived / metrics.totalInvoiced) * 100)}%`
              : '0%'}
          </p>
          <p className="mt-0.5 text-xs text-blue-600/80 dark:text-blue-400/80">Received / Invoiced</p>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="glass mt-5 rounded-xl border border-slate-200/80 p-3.5 sm:p-4 dark:border-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="search-input-wrap flex-1">
            <AppIcon
              icon={Search}
              size="sm"
              className="search-icon"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice number, client, or notes..."
              className="theme-input w-full text-xs sm:text-sm"
              aria-label="Search invoices"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="search-clear-btn"
                aria-label="Clear search"
                title="Clear search"
              >
                <AppIcon icon={X} size="sm" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="theme-input !mt-0 w-auto text-xs sm:text-sm"
            >
              <option value="all">All Payment States</option>
              <option value="received">Received</option>
              <option value="pending">Pending / Not Received</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="theme-input !mt-0 w-auto text-xs sm:text-sm"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-3.5 py-3">Invoice Number</th>
                <th className="px-3.5 py-3">Client</th>
                <th className="px-3.5 py-3">Status</th>
                <th className="px-3.5 py-3">Send Date</th>
                <th className="px-3.5 py-3 text-center">Payment Received or Not</th>
                <th className="px-3.5 py-3 text-right">Amount</th>
                <th className="px-3.5 py-3">Note</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <AppIcon icon={FileText} size="md" />
                      </span>
                      <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        No client invoices found
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {search || statusFilter !== 'all' || paymentFilter !== 'all'
                          ? 'Try adjusting your filters or search keywords.'
                          : 'Create your first invoice by clicking "+ New Invoice".'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/70 transition dark:hover:bg-slate-800/40"
                    >
                      {/* Invoice Number */}
                      <td className="px-3.5 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <AppIcon
                            icon={FileText}
                            size="sm"
                            className="text-slate-400 dark:text-slate-500"
                          />
                          <span>{inv.invoice_number}</span>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                          <AppIcon icon={Building} size="sm" className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]" title={inv.client_name}>
                            {inv.client_name}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${getStatusBadge(
                            inv.status
                          )}`}
                        >
                          {inv.status}
                        </span>
                      </td>

                      {/* Send Date */}
                      <td className="px-3.5 py-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1">
                          <AppIcon icon={Calendar} size="sm" className="text-slate-400" />
                          <span>{inv.send_date || '—'}</span>
                        </div>
                      </td>

                      {/* Payment Received or Not (Interactive toggle pill) */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTogglePayment(inv)}
                          title="Click to toggle payment received status"
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition cursor-pointer shadow-sm ${
                            inv.payment_received
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60'
                          }`}
                        >
                          <AppIcon
                            icon={inv.payment_received ? CheckCircle2 : Clock}
                            size="sm"
                            className="shrink-0"
                          />
                          <span>{inv.payment_received ? 'Received' : 'Not Received'}</span>
                        </button>
                      </td>

                      {/* Amount */}
                      <td className="px-3.5 py-3 text-right font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatMoney(inv.amount)}
                      </td>

                      {/* Note */}
                      <td className="px-3.5 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
                        <span className="line-clamp-2" title={inv.note || 'No notes'}>
                          {inv.note || '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(inv)}
                            className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="Edit Invoice"
                          >
                            <AppIcon icon={Edit2} size="sm" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(inv)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                            title="Delete Invoice"
                          >
                            <AppIcon icon={Trash2} size="sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Invoice Modal */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingInvoice ? `Edit Invoice: ${editingInvoice.invoice_number}` : 'New Client Invoice'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Invoice Number *
              </label>
              <input
                type="text"
                required
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="e.g. INV-2026-001"
                className="theme-input mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Client Name *
              </label>
              <input
                type="text"
                required
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="e.g. Acme Corp"
                className="theme-input mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Invoice Amount
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="theme-input mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="theme-input mt-1"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Send Date *
              </label>
              <input
                type="date"
                required
                value={formData.send_date}
                onChange={(e) => setFormData({ ...formData, send_date: e.target.value })}
                className="theme-input mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="theme-input mt-1"
              />
            </div>
          </div>

          {/* Payment Received or Not Toggle */}
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-200">Payment Received or Not</p>
                <p className="text-xs text-slate-400">
                  Toggle whether funds for this invoice have been deposited and confirmed.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.payment_received}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setFormData({
                      ...formData,
                      payment_received: checked,
                      status: checked ? 'Paid' : formData.status === 'Paid' ? 'Sent' : formData.status,
                      received_date: checked
                        ? formData.received_date || new Date().toISOString().slice(0, 10)
                        : '',
                    })
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {formData.payment_received ? (
              <div className="mt-3 border-t border-slate-700/50 pt-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Received Date
                </label>
                <input
                  type="date"
                  value={formData.received_date}
                  onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                  className="theme-input mt-1 max-w-xs"
                />
              </div>
            ) : null}
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Note / Remarks
            </label>
            <textarea
              rows={3}
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="e.g. Payment details, milestones, client contact instructions..."
              className="theme-input mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => setModalOpen(false)}
              className="theme-btn-secondary text-xs sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="theme-btn-primary text-xs sm:text-sm"
            >
              {saving ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
