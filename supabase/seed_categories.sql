-- Run once in Supabase SQL Editor to add default sale, purchase, expense, and other categories.
-- Skips rows that already exist (unique on name + entry_type).

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
