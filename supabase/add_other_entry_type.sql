-- Run in Supabase SQL Editor to allow the "other" entry type on existing databases.
-- Safe to run even if optional tables (e.g. recurring_entries) are not installed yet.

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check check (type in ('sale', 'purchase', 'expense', 'other'));

alter table public.categories drop constraint if exists categories_entry_type_check;
alter table public.categories
  add constraint categories_entry_type_check check (entry_type in ('sale', 'purchase', 'expense', 'other', 'all'));

-- Optional: only runs when recurring_entries exists (from supabase/all_features.sql).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'recurring_entries'
  ) then
    alter table public.recurring_entries drop constraint if exists recurring_entries_type_check;
    alter table public.recurring_entries
      add constraint recurring_entries_type_check check (type in ('sale', 'purchase', 'expense', 'other'));
  end if;
end $$;
