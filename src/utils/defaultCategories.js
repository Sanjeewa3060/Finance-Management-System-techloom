/** Default category library — inserted once when missing (unique on name + entry_type). */
export const DEFAULT_CATEGORIES = [
  // Sale
  { name: 'Project Payment', entry_type: 'sale' },
  { name: 'Milestone Payment', entry_type: 'sale' },
  { name: 'Advance Payment', entry_type: 'sale' },
  { name: 'Consultation Fee', entry_type: 'sale' },
  { name: 'Service Income', entry_type: 'sale' },
  { name: 'Materials Sale', entry_type: 'sale' },
  { name: 'Equipment Rental Income', entry_type: 'sale' },
  { name: 'Subcontract Recovery', entry_type: 'sale' },
  { name: 'Retention Release', entry_type: 'sale' },
  { name: 'Variation Order', entry_type: 'sale' },
  { name: 'Other Sales', entry_type: 'sale' },
  // Purchase
  { name: 'Materials', entry_type: 'purchase' },
  { name: 'Subcontractor', entry_type: 'purchase' },
  { name: 'Equipment Hire', entry_type: 'purchase' },
  { name: 'Tools & Supplies', entry_type: 'purchase' },
  { name: 'Plant & Machinery', entry_type: 'purchase' },
  { name: 'Professional Fees', entry_type: 'purchase' },
  { name: 'Other Purchase', entry_type: 'purchase' },
  // Expense
  { name: 'Rent', entry_type: 'expense' },
  { name: 'Utilities', entry_type: 'expense' },
  { name: 'Fuel', entry_type: 'expense' },
  { name: 'Wages & Salaries', entry_type: 'expense' },
  { name: 'Insurance', entry_type: 'expense' },
  { name: 'Office Supplies', entry_type: 'expense' },
  { name: 'Travel', entry_type: 'expense' },
  { name: 'Repairs & Maintenance', entry_type: 'expense' },
  { name: 'Other Expense', entry_type: 'expense' },
  // Other
  { name: 'Miscellaneous', entry_type: 'other' },
  { name: 'Adjustment', entry_type: 'other' },
  { name: 'Transfer', entry_type: 'other' },
  { name: 'Donation', entry_type: 'other' },
  { name: 'Other', entry_type: 'other' },
]

export async function ensureDefaultCategories(supabase) {
  if (!supabase) return false

  // Include inactive rows so soft-deleted defaults are not re-seeded on refresh.
  const { data: existing, error: loadError } = await supabase.from('categories').select('name,entry_type,is_active')
  if (loadError) {
    console.warn('default categories:', loadError.message)
    return false
  }

  const existingKeys = new Set(
    (existing ?? []).map((c) => `${String(c.entry_type).toLowerCase()}:${String(c.name).trim().toLowerCase()}`),
  )

  const toInsert = DEFAULT_CATEGORIES.filter(
    (c) => !existingKeys.has(`${c.entry_type}:${c.name.trim().toLowerCase()}`),
  ).map((c) => ({
    id: crypto.randomUUID(),
    name: c.name,
    entry_type: c.entry_type,
    is_active: true,
    created_at: new Date().toISOString(),
  }))

  if (toInsert.length === 0) return false

  const { error: insertError } = await supabase.from('categories').insert(toInsert)
  if (insertError) {
    console.warn('default categories insert:', insertError.message)
    return false
  }

  return true
}
