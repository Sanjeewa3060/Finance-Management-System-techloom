-- FIX: transaction_edit_history empty History / silent insert failures
-- =============================================================================
-- SYMPTOM
--   Edit a transaction (description/category/amount/…) succeeds, but History
--   still shows "No edits recorded yet for this transaction."
--
-- WHY
--   With RLS enabled and no usable policies, PostgREST returns [] on SELECT
--   (no error) while INSERT fails with a row-level security error. The app
--   used to swallow that insert failure, so the UI looked empty forever.
--   Creating the table in the Dashboard also enables RLS by default. This app
--   uses the anon key + custom auth (auth.uid() is always null).
--
-- IMPORTANT — multi-project
--   Techloom / Kaionex / local may use DIFFERENT Supabase projects.
--   Run this SQL on the project that matches VITE_SUPABASE_URL (or Vercel env)
--   for the site you are testing. Running it on the wrong project does nothing.
--   Verify afterward with: supabase/verify_transaction_edit_history.sql
--
-- FIX (paste into Supabase SQL Editor and run once — safe to re-run)
-- =============================================================================

create table if not exists public.transaction_edit_history (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  actor_role text,
  actor_id uuid,
  actor_email text,
  changed_fields text[] not null default '{}',
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Ensure columns exist if an older/incomplete table was created earlier
alter table public.transaction_edit_history add column if not exists actor_role text;
alter table public.transaction_edit_history add column if not exists actor_id uuid;
alter table public.transaction_edit_history add column if not exists actor_email text;
alter table public.transaction_edit_history add column if not exists changed_fields text[];
alter table public.transaction_edit_history add column if not exists old_values jsonb;
alter table public.transaction_edit_history add column if not exists new_values jsonb;
alter table public.transaction_edit_history add column if not exists created_at timestamptz;

update public.transaction_edit_history set changed_fields = '{}'::text[] where changed_fields is null;
update public.transaction_edit_history set old_values = '{}'::jsonb where old_values is null;
update public.transaction_edit_history set new_values = '{}'::jsonb where new_values is null;
update public.transaction_edit_history set created_at = now() where created_at is null;

alter table public.transaction_edit_history alter column changed_fields set default '{}';
alter table public.transaction_edit_history alter column old_values set default '{}'::jsonb;
alter table public.transaction_edit_history alter column new_values set default '{}'::jsonb;
alter table public.transaction_edit_history alter column created_at set default now();

create index if not exists idx_tx_edit_history_transaction
  on public.transaction_edit_history (transaction_id, created_at desc);

create index if not exists idx_tx_edit_history_created
  on public.transaction_edit_history (created_at desc);

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_edit_history'
  loop
    execute format('drop policy if exists %I on public.transaction_edit_history', pol.policyname);
  end loop;
end $$;

alter table public.transaction_edit_history disable row level security;

grant select, insert, update, delete on public.transaction_edit_history to anon, authenticated, service_role;

notify pgrst, 'reload schema';
