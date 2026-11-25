-- Transaction edit history (audit trail of field-level changes)
-- =============================================================================
-- PURPOSE
--   Record who changed a transaction, when, and old vs new field values.
--   Shown in Edit Transaction → Edit history / Transactions → History.
--
-- HOW TO APPLY (required once per Supabase project)
--   1. Open Supabase → SQL Editor for the project matching VITE_SUPABASE_URL
--   2. Paste and run this entire file (safe to re-run)
--   OR: npm run migrate:db (includes this in pending_migrations.sql)
--   OR: supabase/fix_transaction_edit_history_rls.sql (same grants/RLS fix)
--   Then: supabase/verify_transaction_edit_history.sql to confirm
--
-- AUTH / MULTI-PROJECT NOTE
--   This app uses the anon key + custom auth (auth.uid() is always null).
--   RLS must be disabled (same pattern as audit_logs / sensitive_events).
--   Techloom vs other deploys may hit different Supabase projects — SQL must
--   run on the same project as VITE_SUPABASE_URL for that deploy.
--   If History shows empty after edits, RLS is usually still on (or wrong project).
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

comment on table public.transaction_edit_history is
  'Field-level audit trail for transaction edits (old vs new values).';

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
