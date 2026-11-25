-- Ensure transactions record when each entry was saved (used for Time column in UI).
-- Run once in Supabase SQL Editor.

alter table public.transactions
  add column if not exists created_at timestamptz not null default now();

update public.transactions set created_at = now() where created_at is null;
