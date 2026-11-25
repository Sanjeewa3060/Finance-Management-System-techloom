-- VERIFY: transaction_edit_history setup (paste results if History still fails)
-- =============================================================================
-- Run on the SAME Supabase project as VITE_SUPABASE_URL for the deploy you use.
-- Expected healthy result:
--   table_exists = true
--   rls_enabled  = false
--   policies     = (empty / 0 rows)
--   grants       = anon + authenticated have SELECT, INSERT (and ideally UPDATE/DELETE)
-- =============================================================================

-- 1) Table present?
select
  to_regclass('public.transaction_edit_history') is not null as table_exists;

-- 2) RLS on/off?
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'transaction_edit_history';

-- 3) Policies (should be empty after the fix script)
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'transaction_edit_history'
order by policyname;

-- 4) Column list (must include actor_* + changed_fields / old_values / new_values)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transaction_edit_history'
order by ordinal_position;

-- 5) Grants to anon / authenticated / service_role
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'transaction_edit_history'
  and grantee in ('anon', 'authenticated', 'service_role', 'public')
order by grantee, privilege_type;

-- 6) Optional smoke insert+delete (uses a real transaction id if any exist)
-- Uncomment to test write access as the SQL Editor role (not the anon key):
-- do $$
-- declare
--   tid uuid;
--   hid uuid;
-- begin
--   select id into tid from public.transactions limit 1;
--   if tid is null then
--     raise notice 'No transactions to test against';
--     return;
--   end if;
--   insert into public.transaction_edit_history (
--     transaction_id, actor_role, actor_email, changed_fields, old_values, new_values
--   ) values (
--     tid, 'verify', 'verify@local', array['description'],
--     '{"description":"old"}'::jsonb, '{"description":"new"}'::jsonb
--   ) returning id into hid;
--   delete from public.transaction_edit_history where id = hid;
--   raise notice 'Smoke write OK for transaction %', tid;
-- end $$;
