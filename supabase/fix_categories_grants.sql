-- Fix categories RLS/grants and restore default categories (run once in Supabase SQL Editor)
-- Safe to re-run.

alter table public.categories disable row level security;

grant select, insert, update, delete on public.categories to anon, authenticated, service_role;

insert into public.categories (name, entry_type)
values
  ('Project Payment', 'sale'),
  ('Milestone Payment', 'sale'),
  ('Advance Payment', 'sale'),
  ('Consultation Fee', 'sale'),
  ('Service Income', 'sale'),
  ('Materials Sale', 'sale'),
  ('Equipment Rental Income', 'sale'),
  ('Subcontract Recovery', 'sale'),
  ('Retention Release', 'sale'),
  ('Variation Order', 'sale'),
  ('Other Sales', 'sale'),
  ('Materials', 'purchase'),
  ('Subcontractor', 'purchase'),
  ('Equipment Hire', 'purchase'),
  ('Tools & Supplies', 'purchase'),
  ('Plant & Machinery', 'purchase'),
  ('Professional Fees', 'purchase'),
  ('Other Purchase', 'purchase'),
  ('Rent', 'expense'),
  ('Utilities', 'expense'),
  ('Fuel', 'expense'),
  ('Wages & Salaries', 'expense'),
  ('Insurance', 'expense'),
  ('Office Supplies', 'expense'),
  ('Travel', 'expense'),
  ('Repairs & Maintenance', 'expense'),
  ('Other Expense', 'expense'),
  ('Miscellaneous', 'other'),
  ('Adjustment', 'other'),
  ('Transfer', 'other'),
  ('Donation', 'other'),
  ('Other', 'other')
on conflict (name, entry_type) do nothing;

notify pgrst, 'reload schema';
