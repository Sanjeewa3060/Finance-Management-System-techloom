import { supabase } from '../lib/supabase.js'

const LOCAL_STORAGE_KEY = 'techloom_client_invoices_v2'

function getLocalInvoices() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (err) {
    console.warn('Failed to parse local client invoices', err)
    return []
  }
}

function saveLocalInvoices(invoices) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(invoices))
  } catch (err) {
    console.warn('Failed to save local client invoices', err)
  }
}

export async function fetchClientInvoices(companyProfileId = null) {
  // Clear any legacy demo data from v1
  try {
    localStorage.removeItem('techloom_client_invoices_v1')
  } catch {
    /* ignore */
  }

  if (supabase) {
    try {
      let query = supabase
        .from('client_invoices')
        .select('*')
        .order('send_date', { ascending: false })

      if (companyProfileId) {
        query = query.or(`company_profile_id.eq.${companyProfileId},company_profile_id.is.null`)
      }

      const { data, error } = await query
      if (!error && Array.isArray(data)) {
        // Cache locally for offline resilience
        saveLocalInvoices(data)
        return data
      }
      if (error) {
        console.warn('Supabase client_invoices fetch issue, using local storage fallback:', error.message)
      }
    } catch (err) {
      console.warn('Supabase fetch exception, falling back to local storage:', err)
    }
  }

  const local = getLocalInvoices()
  return Array.isArray(local) ? local : []
}

export async function createClientInvoice(invoiceData) {
  const newRecord = {
    id: crypto.randomUUID(),
    invoice_number: invoiceData.invoice_number?.trim() || `INV-${Date.now().toString().slice(-4)}`,
    client_name: invoiceData.client_name?.trim() || 'Untitled Client',
    amount: Number(invoiceData.amount) || 0,
    status: invoiceData.status || (invoiceData.payment_received ? 'Paid' : 'Sent'),
    send_date: invoiceData.send_date || new Date().toISOString().slice(0, 10),
    due_date: invoiceData.due_date || null,
    payment_received: Boolean(invoiceData.payment_received),
    received_date: invoiceData.payment_received
      ? (invoiceData.received_date || new Date().toISOString().slice(0, 10))
      : null,
    note: invoiceData.note?.trim() || '',
    company_profile_id: invoiceData.company_profile_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('client_invoices')
        .insert([newRecord])
        .select()
        .single()

      if (!error && data) {
        const local = getLocalInvoices()
        saveLocalInvoices([data, ...local])
        return data
      }
      console.warn('Supabase insert failed, storing locally:', error?.message)
    } catch (err) {
      console.warn('Supabase insert error, fallback to local:', err)
    }
  }

  // Fallback locally
  const local = getLocalInvoices()
  const updated = [newRecord, ...local]
  saveLocalInvoices(updated)
  return newRecord
}

export async function updateClientInvoice(id, updates) {
  const patch = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('client_invoices')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (!error && data) {
        const local = getLocalInvoices().map((inv) => (inv.id === id ? data : inv))
        saveLocalInvoices(local)
        return data
      }
      console.warn('Supabase update failed, updating locally:', error?.message)
    } catch (err) {
      console.warn('Supabase update error, fallback to local:', err)
    }
  }

  const local = getLocalInvoices().map((inv) => (inv.id === id ? { ...inv, ...patch } : inv))
  saveLocalInvoices(local)
  return local.find((inv) => inv.id === id)
}

export async function deleteClientInvoice(id) {
  if (supabase) {
    try {
      const { error } = await supabase.from('client_invoices').delete().eq('id', id)
      if (error) {
        console.warn('Supabase delete failed, deleting locally:', error.message)
      }
    } catch (err) {
      console.warn('Supabase delete error, fallback to local:', err)
    }
  }

  const local = getLocalInvoices().filter((inv) => inv.id !== id)
  saveLocalInvoices(local)
  return true
}
