-- Each department acts as its own branch/company with its own login.
-- Run in Supabase SQL Editor.

alter table public.departments
  add column if not exists email text,
  add column if not exists password text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_login_at timestamptz,
  add column if not exists avatar_url text,
  add column if not exists delete_password text;

create unique index if not exists departments_email_unique
  on public.departments (lower(email))
  where email is not null;
