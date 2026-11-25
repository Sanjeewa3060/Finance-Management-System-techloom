-- Disable RLS + grant anon access on core tables (table-based login uses anon key)
-- Safe to re-run.

alter table public.admin_accounts disable row level security;
alter table public.company_profiles disable row level security;
alter table public.departments disable row level security;
alter table public.transactions disable row level security;
alter table public.department_budgets disable row level security;
alter table public.audit_logs disable row level security;
alter table public.categories disable row level security;
alter table public.company_users disable row level security;
alter table public.recurring_entries disable row level security;
alter table public.department_targets disable row level security;
alter table public.notifications disable row level security;
alter table public.sensitive_events disable row level security;
alter table public.user_sessions disable row level security;
alter table public.password_reset_tokens disable row level security;
alter table public.login_attempts disable row level security;

-- Optional: only if system_backups already exists (created by system_backups.sql).
do $$
begin
  if to_regclass('public.system_backups') is not null then
    execute 'alter table public.system_backups disable row level security';
    execute 'grant select, insert, update, delete on public.system_backups to anon, authenticated, service_role';
  end if;
end $$;

grant select, insert, update, delete on public.admin_accounts to anon, authenticated, service_role;
grant select, insert, update, delete on public.company_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.departments to anon, authenticated, service_role;
grant select, insert, update, delete on public.transactions to anon, authenticated, service_role;
grant select, insert, update, delete on public.department_budgets to anon, authenticated, service_role;
grant select, insert, update, delete on public.audit_logs to anon, authenticated, service_role;
grant select, insert, update, delete on public.categories to anon, authenticated, service_role;
grant select, insert, update, delete on public.company_users to anon, authenticated, service_role;
grant select, insert, update, delete on public.recurring_entries to anon, authenticated, service_role;
grant select, insert, update, delete on public.department_targets to anon, authenticated, service_role;
grant select, insert, update, delete on public.notifications to anon, authenticated, service_role;
grant select, insert, update, delete on public.sensitive_events to anon, authenticated, service_role;
grant select, insert, update, delete on public.user_sessions to anon, authenticated, service_role;
grant select, insert, update, delete on public.password_reset_tokens to anon, authenticated, service_role;
grant select, insert, update, delete on public.login_attempts to anon, authenticated, service_role;

notify pgrst, 'reload schema';
