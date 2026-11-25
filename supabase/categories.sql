-- Run in Supabase SQL Editor if category add/list fails

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entry_type text not null check (entry_type in ('sale', 'purchase', 'expense', 'other', 'all')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, entry_type)
);

-- This app uses the anon key (table-based login). RLS must be off or inserts fail.
alter table public.categories disable row level security;

grant select, insert, update, delete on public.categories to anon, authenticated, service_role;
