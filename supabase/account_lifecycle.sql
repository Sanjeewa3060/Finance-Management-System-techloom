-- Account deactivation, soft-delete, and recoverable removal.
-- Run in Supabase SQL Editor.

alter table public.company_profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz;

alter table public.departments
  add column if not exists deleted_at timestamptz;

create index if not exists idx_company_profiles_deleted_at
  on public.company_profiles (deleted_at)
  where deleted_at is not null;
