-- Fix categories on Techloom DB (nhmtytoryyaxgsigtwox / fms-techloom.kaionex.app)
-- Error: null value in column "created_at" / "id" of relation "categories"
-- Dashboard: https://supabase.com/dashboard/project/nhmtytoryyaxgsigtwox/sql/new
-- Safe to re-run.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entry_type text not null check (entry_type in ('sale', 'purchase', 'expense', 'other', 'all')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, entry_type)
);

alter table public.categories
  alter column id set default gen_random_uuid();

alter table public.categories
  alter column is_active set default true;

alter table public.categories
  alter column created_at set default now();

alter table public.categories disable row level security;

grant select, insert, update, delete on public.categories to anon, authenticated, service_role;

notify pgrst, 'reload schema';
