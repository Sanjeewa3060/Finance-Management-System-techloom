-- Admin-controlled password required for department users to delete transactions.
-- Run in Supabase SQL Editor.

alter table public.company_profiles
  add column if not exists delete_password text;

alter table public.departments
  add column if not exists delete_password text;
