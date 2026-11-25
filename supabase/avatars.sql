-- Run in Supabase SQL Editor to enable profile photos
-- Safe even if company_users table does not exist yet (run all_features.sql later for team accounts)

alter table public.company_profiles
  add column if not exists avatar_url text;

alter table public.admin_accounts
  add column if not exists avatar_url text;

alter table public.departments
  add column if not exists avatar_url text;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'company_users'
  ) then
    alter table public.company_users add column if not exists avatar_url text;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars public insert" on storage.objects;
drop policy if exists "avatars public update" on storage.objects;

create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars public insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

create policy "avatars public update"
  on storage.objects for update
  using (bucket_id = 'avatars');
