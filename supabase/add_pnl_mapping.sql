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
