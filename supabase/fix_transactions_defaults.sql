-- Fix Save Entry on Techloom DB (nhmtytoryyaxgsigtwox / fms-techloom.kaionex.app)
-- Error: null value in column "id" of relation "transactions"
-- Dashboard: https://supabase.com/dashboard/project/nhmtytoryyaxgsigtwox/sql/new
-- Safe to re-run.

alter table public.transactions
  alter column id set default gen_random_uuid();

alter table public.transactions
  add column if not exists created_at timestamptz;

alter table public.transactions
  alter column created_at set default now();

update public.transactions set created_at = now() where created_at is null;

alter table public.transactions
  alter column created_at set not null;

alter table public.transactions
  add column if not exists other_direction text;

alter table public.transactions disable row level security;

grant select, insert, update, delete on public.transactions to anon, authenticated, service_role;

notify pgrst, 'reload schema';
