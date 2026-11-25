-- Active user sessions (multi-device list + remote sign-out)
-- Safe to re-run.

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_role text not null,
  user_id uuid not null,
  device_label text,
  device_user_agent text,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_user_sessions_user on public.user_sessions(user_role, user_id, last_active_at desc);
create index if not exists idx_user_sessions_active on public.user_sessions(user_id) where revoked_at is null;

alter table public.user_sessions disable row level security;

grant select, insert, update, delete on public.user_sessions to anon, authenticated, service_role;

notify pgrst, 'reload schema';
