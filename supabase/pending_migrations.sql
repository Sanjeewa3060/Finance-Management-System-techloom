-- Pending migrations — safe to re-run in Supabase SQL Editor
-- Or run: npm run migrate:db (with SUPABASE_DB_PASSWORD in .env)

-- === sensitive_events.sql ===

create table if not exists public.sensitive_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_email text,
  actor_role text,
  actor_id uuid,
  entity_type text,
  entity_id uuid,
  success boolean not null default false,
  device_label text,
  device_user_agent text,
  message text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

alter table public.sensitive_events add column if not exists actor_email text;
alter table public.sensitive_events add column if not exists actor_role text;
alter table public.sensitive_events add column if not exists actor_id uuid;
alter table public.sensitive_events add column if not exists entity_type text;
alter table public.sensitive_events add column if not exists entity_id uuid;
alter table public.sensitive_events add column if not exists success boolean not null default false;
alter table public.sensitive_events add column if not exists device_label text;
alter table public.sensitive_events add column if not exists device_user_agent text;
alter table public.sensitive_events add column if not exists expires_at timestamptz not null default (now() + interval '30 days');

create index if not exists idx_sensitive_events_created on public.sensitive_events(created_at desc);
create index if not exists idx_sensitive_events_expires on public.sensitive_events(expires_at);

alter table public.notifications add column if not exists is_sensitive boolean not null default false;

alter table public.sensitive_events disable row level security;

grant select, insert, update, delete on public.sensitive_events to anon, authenticated, service_role;

-- === add_other_direction.sql ===

alter table public.transactions
  add column if not exists other_direction text;

alter table public.transactions drop constraint if exists transactions_other_direction_check;
alter table public.transactions
  add constraint transactions_other_direction_check
  check (other_direction is null or other_direction in ('profit', 'expense'));

notify pgrst, 'reload schema';

-- === user_sessions.sql ===

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_role text not null,
  user_id uuid not null,
  device_label text,
  device_user_agent text,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_user_sessions_user on public.user_sessions(user_role, user_id, last_active_at desc);
create index if not exists idx_user_sessions_active on public.user_sessions(user_id) where revoked_at is null;

alter table public.user_sessions disable row level security;

grant select, insert, update, delete on public.user_sessions to anon, authenticated, service_role;

-- === fix_audit_logs_grants.sql (session + sensitive-events fallback) ===

alter table public.audit_logs disable row level security;

grant select, insert, update, delete on public.audit_logs to anon, authenticated, service_role;

-- === add_other_entry_type.sql ===

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check check (type in ('sale', 'purchase', 'expense', 'other'));

alter table public.categories drop constraint if exists categories_entry_type_check;
alter table public.categories
  add constraint categories_entry_type_check check (entry_type in ('sale', 'purchase', 'expense', 'other', 'all'));

-- === fix_categories_grants.sql ===

alter table public.categories disable row level security;

grant select, insert, update, delete on public.categories to anon, authenticated, service_role;

insert into public.categories (name, entry_type)
values
  ('Project Payment', 'sale'),
  ('Milestone Payment', 'sale'),
  ('Advance Payment', 'sale'),
  ('Consultation Fee', 'sale'),
  ('Service Income', 'sale'),
  ('Materials Sale', 'sale'),
  ('Equipment Rental Income', 'sale'),
  ('Subcontract Recovery', 'sale'),
  ('Retention Release', 'sale'),
  ('Variation Order', 'sale'),
  ('Other Sales', 'sale'),
  ('Materials', 'purchase'),
  ('Subcontractor', 'purchase'),
  ('Equipment Hire', 'purchase'),
  ('Tools & Supplies', 'purchase'),
  ('Plant & Machinery', 'purchase'),
  ('Professional Fees', 'purchase'),
  ('Other Purchase', 'purchase'),
  ('Rent', 'expense'),
  ('Utilities', 'expense'),
  ('Fuel', 'expense'),
  ('Wages & Salaries', 'expense'),
  ('Insurance', 'expense'),
  ('Office Supplies', 'expense'),
  ('Travel', 'expense'),
  ('Repairs & Maintenance', 'expense'),
  ('Other Expense', 'expense'),
  ('Miscellaneous', 'other'),
  ('Adjustment', 'other'),
  ('Transfer', 'other'),
  ('Donation', 'other'),
  ('Other', 'other')
on conflict (name, entry_type) do nothing;

notify pgrst, 'reload schema';

-- === system_backups.sql (daily / manual server snapshots) ===

create table if not exists public.system_backups (
  id uuid primary key default gen_random_uuid(),
  backup_date date not null,
  trigger text not null default 'cron'
    check (trigger in ('cron', 'manual', 'auto')),
  row_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists system_backups_date_idx
  on public.system_backups (backup_date desc, created_at desc);

create index if not exists system_backups_created_idx
  on public.system_backups (created_at desc);

comment on table public.system_backups is
  'Full JSON snapshots of FMS operational tables for daily / manual backup. Retained ~90 days by app prune.';

-- Drop leftover RLS policies (Dashboard / auth.uid() leftovers), then disable RLS.
-- App uses anon key + custom auth — auth.uid() policies block Backup now inserts.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'system_backups'
  loop
    execute format('drop policy if exists %I on public.system_backups', pol.policyname);
  end loop;
end $$;

alter table public.system_backups disable row level security;

grant select, insert, update, delete on public.system_backups to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- === transaction_edit_history.sql (field-level edit audit trail) ===
-- Run on the SAME Supabase project as VITE_SUPABASE_URL for this deploy.
-- Verify with: supabase/verify_transaction_edit_history.sql

create table if not exists public.transaction_edit_history (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  actor_role text,
  actor_id uuid,
  actor_email text,
  changed_fields text[] not null default '{}',
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.transaction_edit_history add column if not exists actor_role text;
alter table public.transaction_edit_history add column if not exists actor_id uuid;
alter table public.transaction_edit_history add column if not exists actor_email text;
alter table public.transaction_edit_history add column if not exists changed_fields text[];
alter table public.transaction_edit_history add column if not exists old_values jsonb;
alter table public.transaction_edit_history add column if not exists new_values jsonb;
alter table public.transaction_edit_history add column if not exists created_at timestamptz;

update public.transaction_edit_history set changed_fields = '{}'::text[] where changed_fields is null;
update public.transaction_edit_history set old_values = '{}'::jsonb where old_values is null;
update public.transaction_edit_history set new_values = '{}'::jsonb where new_values is null;
update public.transaction_edit_history set created_at = now() where created_at is null;

alter table public.transaction_edit_history alter column changed_fields set default '{}';
alter table public.transaction_edit_history alter column old_values set default '{}'::jsonb;
alter table public.transaction_edit_history alter column new_values set default '{}'::jsonb;
alter table public.transaction_edit_history alter column created_at set default now();

create index if not exists idx_tx_edit_history_transaction
  on public.transaction_edit_history (transaction_id, created_at desc);

create index if not exists idx_tx_edit_history_created
  on public.transaction_edit_history (created_at desc);

comment on table public.transaction_edit_history is
  'Field-level audit trail for transaction edits (old vs new values).';

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_edit_history'
  loop
    execute format('drop policy if exists %I on public.transaction_edit_history', pol.policyname);
  end loop;
end $$;

alter table public.transaction_edit_history disable row level security;

grant select, insert, update, delete on public.transaction_edit_history to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- === add_pnl_mapping.sql ===
-- Detailed P&L stock adjustments (+ legacy category columns kept for compatibility)
-- Safe to re-run. Backward compatible. Summary report unchanged.
-- Does not alter transactions.type (sale | purchase | expense | other).
--
-- DESIGN (app layer): Detailed P&L classifies by Entry Type, not pnl_group.
--   sale → Revenue, purchase → Cost of Sales, expense → Operating Expenses,
--   other → Other Income. No Admin / Selling / Finance split without a future
--   reliable classifier. Do NOT drop pnl_group/pnl_order destructively.
--
-- Stock period matching — Method A (exact period):
--   A pnl_stock_adjustments row matches a report when
--   period_from = report fromDate AND period_to = report toDate
--   and department_id matches the report department filter
--   (NULL department_id = "All departments").
--   Applies to full calendar months, custom date ranges, single department,
--   and all-departments views — always exact from/to + dept match.
--
-- SECURITY (why this is not auth.uid() RLS):
--   This app uses the Supabase anon key + custom table-based login
--   (admin_accounts / departments / company_profiles / company_users).
--   auth.uid() is always null — JWT RLS would block all clients.
--   Core tables (categories, transactions, budgets, …) therefore disable RLS
--   and rely on app-layer role checks. Stock is tighter than that pattern:
--   anon/authenticated get SELECT only; writes go through SECURITY DEFINER
--   RPC upsert_pnl_stock_adjustment which requires a real admin_accounts row
--   and the admin login password (bcrypt via pgcrypto, or legacy plain-text).
--   Department isolation for reads remains app-layer (scoped queries / UI).
--   Actor identity for audit is admin_accounts.id (NOT auth.users).

create extension if not exists pgcrypto;

-- Legacy columns retained (nullable). App Detailed P&L no longer depends on them.
alter table public.categories
  add column if not exists pnl_group text;

alter table public.categories
  add column if not exists pnl_order integer;

-- Keep check permissive for older rows; app ignores these values.
alter table public.categories drop constraint if exists categories_pnl_group_check;
alter table public.categories
  add constraint categories_pnl_group_check
  check (
    pnl_group is null
    or pnl_group in (
      'sales',
      'cogs',
      'administration',
      'selling_distribution',
      'finance_others',
      'other_income',
      'expense'
    )
  );

comment on column public.categories.pnl_group is
  'LEGACY — unused by Detailed P&L (classifies by entry_type). Kept for DB compatibility; do not drop.';
comment on column public.categories.pnl_order is
  'LEGACY — unused by Detailed P&L. Kept for DB compatibility; do not drop.';

create table if not exists public.pnl_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  opening_stock numeric not null default 0,
  closing_stock numeric not null default 0,
  notes text,
  -- App actor ids (admin_accounts.id); no FK to auth.users (unused by this app).
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_to >= period_from),
  check (opening_stock >= 0),
  check (closing_stock >= 0)
);

-- Older installs: add actor columns if table already existed without them.
alter table public.pnl_stock_adjustments
  add column if not exists created_by uuid;

alter table public.pnl_stock_adjustments
  add column if not exists updated_by uuid;

-- Unique per department + period without zero-UUID sentinel.
-- Postgres UNIQUE treats NULLs as distinct, so use two partial indexes
-- (company-wide NULL dept vs per-department). Matches project style better
-- than coalesce(department_id, '00000000-…').
drop index if exists idx_pnl_stock_adj_dept_period;

create unique index if not exists idx_pnl_stock_adj_period_all_depts
  on public.pnl_stock_adjustments (period_from, period_to)
  where department_id is null;

create unique index if not exists idx_pnl_stock_adj_period_dept
  on public.pnl_stock_adjustments (department_id, period_from, period_to)
  where department_id is not null;

create index if not exists idx_pnl_stock_adj_period
  on public.pnl_stock_adjustments (period_from, period_to);

-- updated_at helper (no shared project trigger existed; define one for this table).
create or replace function public.set_pnl_stock_adjustments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pnl_stock_adjustments_updated_at on public.pnl_stock_adjustments;
create trigger trg_pnl_stock_adjustments_updated_at
  before update on public.pnl_stock_adjustments
  for each row
  execute function public.set_pnl_stock_adjustments_updated_at();

-- Drop leftover RLS policies if any, then disable RLS (auth.uid() unused).
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pnl_stock_adjustments'
  loop
    execute format('drop policy if exists %I on public.pnl_stock_adjustments', pol.policyname);
  end loop;
end $$;

alter table public.pnl_stock_adjustments disable row level security;

-- Min privileges: anon may read stock for Detailed P&L; writes via RPC only.
revoke all on table public.pnl_stock_adjustments from anon, authenticated;
grant select on table public.pnl_stock_adjustments to anon, authenticated, service_role;
grant all on table public.pnl_stock_adjustments to service_role;

-- Admin password check shared by stock write RPC (actor = admin_accounts, not auth.users).
create or replace function public.verify_admin_password(p_admin_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text;
begin
  if p_admin_id is null or p_password is null or length(trim(p_password)) = 0 then
    return false;
  end if;

  select password into stored
  from public.admin_accounts
  where id = p_admin_id
  limit 1;

  if stored is null then
    return false;
  end if;

  -- bcrypt (bcryptjs / pgcrypto) or legacy plain-text
  if stored like '$2%' then
    return crypt(p_password, stored) = stored;
  end if;

  return stored = p_password;
end;
$$;

revoke all on function public.verify_admin_password(uuid, text) from public;
grant execute on function public.verify_admin_password(uuid, text) to service_role;

create or replace function public.upsert_pnl_stock_adjustment(
  p_admin_id uuid,
  p_password text,
  p_department_id uuid,
  p_period_from date,
  p_period_to date,
  p_opening_stock numeric,
  p_closing_stock numeric,
  p_notes text default null
)
returns public.pnl_stock_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  result public.pnl_stock_adjustments;
begin
  if p_period_from is null or p_period_to is null then
    raise exception 'Period from and to dates are required.';
  end if;
  if p_period_to < p_period_from then
    raise exception 'period_to must be >= period_from.';
  end if;
  if p_opening_stock is null or p_opening_stock < 0
     or p_closing_stock is null or p_closing_stock < 0 then
    raise exception 'Opening and closing stock must be non-negative numbers.';
  end if;
  if p_department_id is not null
     and not exists (select 1 from public.departments d where d.id = p_department_id) then
    raise exception 'Unknown department_id.';
  end if;
  if not public.verify_admin_password(p_admin_id, p_password) then
    raise exception 'Only admins can save stock adjustments (invalid admin credentials).';
  end if;

  if p_department_id is null then
    select id into existing_id
    from public.pnl_stock_adjustments
    where department_id is null
      and period_from = p_period_from
      and period_to = p_period_to
    limit 1;
  else
    select id into existing_id
    from public.pnl_stock_adjustments
    where department_id = p_department_id
      and period_from = p_period_from
      and period_to = p_period_to
    limit 1;
  end if;

  if existing_id is not null then
    update public.pnl_stock_adjustments
    set
      opening_stock = p_opening_stock,
      closing_stock = p_closing_stock,
      notes = p_notes,
      updated_by = p_admin_id
      -- updated_at set by trigger
    where id = existing_id
    returning * into result;
  else
    insert into public.pnl_stock_adjustments (
      id,
      department_id,
      period_from,
      period_to,
      opening_stock,
      closing_stock,
      notes,
      created_by,
      updated_by
    ) values (
      gen_random_uuid(),
      p_department_id,
      p_period_from,
      p_period_to,
      p_opening_stock,
      p_closing_stock,
      p_notes,
      p_admin_id,
      p_admin_id
    )
    returning * into result;
  end if;

  return result;
end;
$$;

revoke all on function public.upsert_pnl_stock_adjustment(uuid, text, uuid, date, date, numeric, numeric, text) from public;
grant execute on function public.upsert_pnl_stock_adjustment(uuid, text, uuid, date, date, numeric, numeric, text)
  to anon, authenticated, service_role;

comment on table public.pnl_stock_adjustments is
  'Opening/closing stock for Detailed P&L. Method A: exact period_from/period_to + department match (full month, custom range, dept, or all). Writes via upsert_pnl_stock_adjustment RPC only.';
comment on function public.upsert_pnl_stock_adjustment(uuid, text, uuid, date, date, numeric, numeric, text) is
  'Admin-password-gated upsert for pnl_stock_adjustments. Actor is admin_accounts.id (not auth.users).';

notify pgrst, 'reload schema';
