-- Run once in Supabase SQL Editor after add_other_entry_type.sql.
-- Adds profit/expense direction for "other" entry type (+ / - in Add Entry).

alter table public.transactions
  add column if not exists other_direction text;

alter table public.transactions drop constraint if exists transactions_other_direction_check;
alter table public.transactions
  add constraint transactions_other_direction_check
  check (other_direction is null or other_direction in ('profit', 'expense'));

-- Refresh PostgREST schema cache (Supabase API)
notify pgrst, 'reload schema';
