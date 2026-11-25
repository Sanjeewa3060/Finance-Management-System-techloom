-- FIX: system_backups RLS blocking "Backup now"
-- =============================================================================
-- SYMPTOM
--   Profile → Security → Backup now fails with:
--   new row violates row-level security policy for table "system_backups"
--   (SELECT may still work, so the UI says "Server storage is configured")
--
-- WHY
--   This app uses custom hashed-password auth + the Supabase anon key
--   (NOT Supabase Auth JWT). Policies that rely on auth.uid() always deny
--   inserts. Creating the table in the Dashboard also enables RLS by default.
--
-- FIX (paste into Supabase SQL Editor and run once — safe to re-run)
-- =============================================================================

-- Drop every existing policy on the table (names vary by how it was created).
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'system_backups'
  loop
    execute format('drop policy if exists %I on public.system_backups', pol.policyname);
  end loop;
end $$;

-- Match other FMS tables (sensitive_events, audit_logs, categories, …):
-- disable RLS and grant CRUD to anon so the browser client can insert.
alter table public.system_backups disable row level security;

grant select, insert, update, delete on public.system_backups to anon, authenticated, service_role;

notify pgrst, 'reload schema';
