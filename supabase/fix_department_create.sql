-- Fix "Create department" on Techloom (and similar) Supabase projects.
-- Project for fms-techloom.kaionex.app: nhmtytoryyaxgsigtwox
-- Dashboard: https://supabase.com/dashboard/project/nhmtytoryyaxgsigtwox/sql/new
-- Safe to re-run.

-- Root cause: id columns exist but have NO default, so inserts without id fail.
alter table public.company_profiles
  alter column id set default gen_random_uuid();

alter table public.departments
  alter column id set default gen_random_uuid();

-- Account lifecycle + delete password + department login columns
alter table public.company_profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_password text;

alter table public.departments
  add column if not exists deleted_at timestamptz,
  add column if not exists email text,
  add column if not exists password text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_login_at timestamptz,
  add column if not exists avatar_url text,
  add column if not exists delete_password text;

-- CRITICAL: columns may exist as NOT NULL without a default (app insert omits them on older builds)
alter table public.company_profiles
  alter column is_active set default true;

alter table public.departments
  alter column is_active set default true;

update public.company_profiles set is_active = true where is_active is null;
update public.departments set is_active = true where is_active is null;

create unique index if not exists departments_email_unique
  on public.departments (lower(email))
  where email is not null;

create index if not exists idx_company_profiles_deleted_at
  on public.company_profiles (deleted_at)
  where deleted_at is not null;

-- Disable RLS + grant anon access (app uses table-based login + anon key)
alter table public.company_profiles disable row level security;
alter table public.departments disable row level security;

grant select, insert, update, delete on public.company_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.departments to anon, authenticated, service_role;

notify pgrst, 'reload schema';
