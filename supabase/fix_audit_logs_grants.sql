-- Ensure audit_logs accepts anon writes (required for session/sensitive-event fallbacks)
-- Safe to re-run.

alter table public.audit_logs disable row level security;

grant select, insert, update, delete on public.audit_logs to anon, authenticated, service_role;

notify pgrst, 'reload schema';
