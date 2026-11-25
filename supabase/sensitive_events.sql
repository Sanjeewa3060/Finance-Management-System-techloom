-- Sensitive Events Log (immutable append-only; app purges rows after 30 days)
-- Run once in Supabase SQL Editor (safe to re-run).

create table if not exists public.sensitive_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_email text,
  actor_role text,
  actor_id uuid,
  entity_type text,
  entity_id uuid,
  success boolean not null default false,
  device_label text,
  device_user_agent text,
  message text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

alter table public.sensitive_events add column if not exists actor_email text;
alter table public.sensitive_events add column if not exists actor_role text;
alter table public.sensitive_events add column if not exists actor_id uuid;
alter table public.sensitive_events add column if not exists entity_type text;
alter table public.sensitive_events add column if not exists entity_id uuid;
alter table public.sensitive_events add column if not exists success boolean not null default false;
alter table public.sensitive_events add column if not exists device_label text;
alter table public.sensitive_events add column if not exists device_user_agent text;
alter table public.sensitive_events add column if not exists expires_at timestamptz not null default (now() + interval '30 days');

create index if not exists idx_sensitive_events_created on public.sensitive_events(created_at desc);
create index if not exists idx_sensitive_events_expires on public.sensitive_events(expires_at);

alter table public.notifications add column if not exists is_sensitive boolean not null default false;

alter table public.sensitive_events disable row level security;

grant select, insert, update, delete on public.sensitive_events to anon, authenticated, service_role;

-- Refresh PostgREST schema cache so the API sees the new table immediately
notify pgrst, 'reload schema';
