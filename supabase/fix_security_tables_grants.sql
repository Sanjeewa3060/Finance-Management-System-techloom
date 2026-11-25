-- Fix permissions for Sensitive Events Log, Active Sessions, notifications, and backups.
-- Run once in Supabase SQL Editor (safe to re-run).
-- Required when tables exist but the app shows RLS / permission errors.

alter table public.sensitive_events disable row level security;
alter table public.user_sessions disable row level security;
alter table public.audit_logs disable row level security;
alter table public.notifications disable row level security;

grant select, insert, update, delete on public.sensitive_events to anon, authenticated, service_role;
grant select, insert, update, delete on public.user_sessions to anon, authenticated, service_role;
grant select, insert, update, delete on public.audit_logs to anon, authenticated, service_role;
grant select, insert, update, delete on public.notifications to anon, authenticated, service_role;

-- system_backups: drop leftover policies then disable RLS (anon key + custom auth).
do $$
declare
  pol record;
begin
  if to_regclass('public.system_backups') is null then
    return;
  end if;
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'system_backups'
  loop
    execute format('drop policy if exists %I on public.system_backups', pol.policyname);
  end loop;
  execute 'alter table public.system_backups disable row level security';
  execute 'grant select, insert, update, delete on public.system_backups to anon, authenticated, service_role';
end $$;

notify pgrst, 'reload schema';
