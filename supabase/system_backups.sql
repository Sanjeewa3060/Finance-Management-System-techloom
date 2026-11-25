-- System backups (EMS-style daily snapshots)
-- =============================================================================
-- PURPOSE
--   Persist full JSON snapshots of FMS operational tables on the server so
--   automatic daily backups and "Backup now" do not rely on the browser.
--
-- STORAGE PLACE
--   Supabase Postgres table: public.system_backups (JSONB payload + metadata)
--   History in Profile → Security lists rows from this table.
--
-- HOW TO APPLY (required once per Supabase project)
--   1. Open Supabase → SQL Editor
--      Techloom: https://supabase.com/dashboard/project/nhmtytoryyaxgsigtwox/sql/new
--   2. Paste and run this entire file (safe to re-run)
--   OR from the repo: npm run migrate:db (includes this in pending_migrations.sql)
--
-- IF "Backup now" FAILS WITH RLS
--   Symptom: new row violates row-level security policy for table "system_backups"
--   Cause: table exists with RLS still on (Dashboard default / auth.uid() policies).
--   This app uses the anon key + custom auth — auth.uid() is always null.
--   Fix: run supabase/fix_system_backups_rls.sql (or the DO $$ … block below).
--
-- DAILY JOB (no browser required)
--   Vercel Cron in vercel.json: "30 18 * * *" (= 00:00 Asia/Colombo)
--   Endpoint: GET/POST /api/cron-backup
--   Set on Vercel:
--     SUPABASE_URL (or VITE_SUPABASE_URL)
--     SUPABASE_SERVICE_ROLE_KEY (preferred) or anon key
--     CRON_SECRET (recommended; Authorization: Bearer <secret>)
-- =============================================================================

create table if not exists public.system_backups (
  id uuid primary key default gen_random_uuid(),
  backup_date date not null,
  trigger text not null default 'cron'
    check (trigger in ('cron', 'manual', 'auto')),
  row_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists system_backups_date_idx
  on public.system_backups (backup_date desc, created_at desc);

create index if not exists system_backups_created_idx
  on public.system_backups (created_at desc);

comment on table public.system_backups is
  'Full JSON snapshots of FMS operational tables for daily / manual backup. Retained ~90 days by app prune.';

-- Drop leftover RLS policies (safe when none exist), then disable RLS.
-- App uses the anon key (custom session auth, not Supabase Auth JWT).
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

alter table public.system_backups disable row level security;

grant select, insert, update, delete on public.system_backups to anon, authenticated, service_role;

notify pgrst, 'reload schema';
