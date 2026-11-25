-- =============================================================================
-- Kaionex Finance Tracker â€” COMPLETE DATABASE SETUP
-- =============================================================================
-- Run this ENTIRE file once in Supabase â†’ SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS / ON CONFLICT DO NOTHING).
--
-- After running:
--   1. npm run seed:admin          (creates admin@kaionex.com / Admin123!)
--   2. npm run test:db             (verify all tables/columns)
--   3. Refresh the app
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- SECTION 1 â€” CORE TABLES (required for login, departments, transactions)
-- =============================================================================

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password text not null,
  last_login_at timestamptz,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password text not null,
  full_name text,
  phone text,
  address text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  admin_notes text,
  last_login_at timestamptz,
  avatar_url text,
  delete_password text,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  company_profile_id uuid references public.company_profiles(id) on delete cascade,
  email text,
  password text,
  full_name text,
  phone text,
  address text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  last_login_at timestamptz,
  avatar_url text,
  delete_password text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  type text not null,
  other_direction text,
  category text not null,
  description text,
  amount numeric not null,
  entry_date date not null,
  currency text default 'GBP',
  exchange_rate numeric default 1,
  vat_rate numeric default 0,
  status text default 'approved',
  attachment_path text,
  due_date date,
  invoice_ref text,
  payment_method text default 'cash',
  created_at timestamptz not null default now()
);

create table if not exists public.department_budgets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  month_key text not null,
  budget_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (department_id, month_key)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_role text not null,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- SECTION 2 â€” CORE TABLE COLUMNS (for databases created from older SQL)
-- =============================================================================

alter table public.admin_accounts
  add column if not exists last_login_at timestamptz,
  add column if not exists avatar_url text;

alter table public.company_profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists admin_notes text,
  add column if not exists last_login_at timestamptz,
  add column if not exists avatar_url text,
  add column if not exists delete_password text;

alter table public.company_profiles drop column if exists department_id;

alter table public.departments
  add column if not exists company_profile_id uuid references public.company_profiles(id) on delete cascade,
  add column if not exists email text,
  add column if not exists password text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists avatar_url text,
  add column if not exists delete_password text;

alter table public.transactions
  add column if not exists other_direction text,
  add column if not exists currency text default 'GBP',
  add column if not exists exchange_rate numeric default 1,
  add column if not exists vat_rate numeric default 0,
  add column if not exists status text default 'approved',
  add column if not exists attachment_path text,
  add column if not exists due_date date,
  add column if not exists invoice_ref text,
  add column if not exists payment_method text default 'cash',
  add column if not exists created_at timestamptz not null default now();

update public.transactions set created_at = now() where created_at is null;

-- =============================================================================
-- SECTION 3 â€” FEATURE TABLES
-- =============================================================================

-- Category library (Add Entry dropdown)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entry_type text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, entry_type)
);

-- Company team users (accountant / manager logins)
create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid not null references public.company_profiles(id) on delete cascade,
  email text not null,
  password text not null,
  role text not null default 'accountant',
  department_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  avatar_url text,
  created_at timestamptz not null default now(),
  unique (company_profile_id, email)
);

alter table public.company_users
  add column if not exists avatar_url text;

-- Recurring monthly entries
create table if not exists public.recurring_entries (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  type text not null,
  category text not null,
  description text,
  amount numeric not null,
  day_of_month int not null default 1,
  is_active boolean not null default true,
  last_posted_month text,
  created_at timestamptz not null default now()
);

-- Department revenue KPI targets
create table if not exists public.department_targets (
  department_id uuid not null references public.departments(id) on delete cascade,
  month_key text not null,
  revenue_target numeric not null default 0,
  primary key (department_id, month_key)
);

-- In-app notifications (budget alerts, sensitive alerts)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_role text not null,
  user_id uuid not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists is_sensitive boolean not null default false;

-- Sensitive Events Log (30-day retention)
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

-- Transaction edit history (field-level old vs new)
-- Must be applied on the same Supabase project as VITE_SUPABASE_URL for each deploy.
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

-- Active user sessions
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

-- Forgot / reset password tokens
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  account_type text not null,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Login rate limiting
create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempted_at timestamptz not null default now()
);

-- Tax report settings (Reports / tax computation)
create table if not exists public.tax_report_settings (
  id uuid primary key default gen_random_uuid(),
  assessment_year_start int not null default 2023,
  tax_free_allowance numeric not null default 1000000,
  tax_rate_percent numeric not null default 6,
  tax_paid numeric not null default 0,
  currency_label text not null default 'Sri Lankan Rupees',
  partners jsonb not null default '[
    {"name":"Mrs. S. V","shareNum":1,"shareDen":3},
    {"name":"Mr. S. P","shareNum":1,"shareDen":3},
    {"name":"Mr. S. P","shareNum":1,"shareDen":3}
  ]'::jsonb,
  disallowable_patterns jsonb not null default '[]'::jsonb,
  manual_overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- SECTION 4 â€” INDEXES
-- =============================================================================

create index if not exists idx_departments_company_profile_id on public.departments(company_profile_id);

create unique index if not exists departments_email_unique
  on public.departments (lower(email))
  where email is not null;

create index if not exists idx_company_profiles_deleted_at
  on public.company_profiles (deleted_at)
  where deleted_at is not null;

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

create index if not exists idx_sensitive_events_created on public.sensitive_events(created_at desc);
create index if not exists idx_sensitive_events_expires on public.sensitive_events(expires_at);
create index if not exists idx_tx_edit_history_transaction on public.transaction_edit_history(transaction_id, created_at desc);
create index if not exists idx_tx_edit_history_created on public.transaction_edit_history(created_at desc);

create index if not exists idx_user_sessions_user on public.user_sessions(user_role, user_id, last_active_at desc);
create index if not exists idx_user_sessions_active on public.user_sessions(user_id) where revoked_at is null;

create index if not exists idx_login_attempts_email_time on public.login_attempts(email, attempted_at desc);

-- =============================================================================
-- SECTION 5 â€” CHECK CONSTRAINTS
-- =============================================================================

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check check (type in ('sale', 'purchase', 'expense', 'other'));

alter table public.transactions drop constraint if exists transactions_other_direction_check;
alter table public.transactions
  add constraint transactions_other_direction_check
  check (other_direction is null or other_direction in ('profit', 'expense'));

alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check check (status in ('pending', 'approved', 'rejected'));

alter table public.categories drop constraint if exists categories_entry_type_check;
alter table public.categories
  add constraint categories_entry_type_check check (entry_type in ('sale', 'purchase', 'expense', 'other', 'all'));

alter table public.company_users drop constraint if exists company_users_role_check;
alter table public.company_users
  add constraint company_users_role_check check (role in ('accountant', 'manager'));

alter table public.recurring_entries drop constraint if exists recurring_entries_type_check;
alter table public.recurring_entries
  add constraint recurring_entries_type_check check (type in ('sale', 'purchase', 'expense', 'other'));

alter table public.recurring_entries drop constraint if exists recurring_entries_day_of_month_check;
alter table public.recurring_entries
  add constraint recurring_entries_day_of_month_check check (day_of_month between 1 and 28);

alter table public.password_reset_tokens drop constraint if exists password_reset_tokens_account_type_check;
alter table public.password_reset_tokens
  add constraint password_reset_tokens_account_type_check check (account_type in ('admin', 'company', 'company_user'));

-- =============================================================================
-- SECTION 6 â€” STORAGE BUCKETS (avatars + receipts)
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
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

drop policy if exists "receipts public read" on storage.objects;
drop policy if exists "receipts public insert" on storage.objects;
drop policy if exists "receipts public update" on storage.objects;

create policy "receipts public read"
  on storage.objects for select
  using (bucket_id = 'receipts');

create policy "receipts public insert"
  on storage.objects for insert
  with check (bucket_id = 'receipts');

create policy "receipts public update"
  on storage.objects for update
  using (bucket_id = 'receipts');

-- =============================================================================
-- SECTION 7 â€” DEFAULT CATEGORY DATA (Add Entry dropdown)
-- =============================================================================

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

-- =============================================================================
-- SECTION 8 â€” DISABLE RLS (app uses table-based login with anon key)
-- =============================================================================

alter table public.admin_accounts disable row level security;
alter table public.company_profiles disable row level security;
alter table public.departments disable row level security;
alter table public.transactions disable row level security;
alter table public.department_budgets disable row level security;
alter table public.audit_logs disable row level security;
alter table public.categories disable row level security;
alter table public.company_users disable row level security;
alter table public.recurring_entries disable row level security;
alter table public.department_targets disable row level security;
alter table public.notifications disable row level security;
alter table public.sensitive_events disable row level security;
alter table public.transaction_edit_history disable row level security;
alter table public.user_sessions disable row level security;
alter table public.password_reset_tokens disable row level security;
alter table public.login_attempts disable row level security;
alter table public.tax_report_settings disable row level security;

do $$
begin
  if to_regclass('public.system_backups') is not null then
    execute 'alter table public.system_backups disable row level security';
  end if;
end $$;

-- =============================================================================
-- SECTION 9 â€” GRANTS (required for anon key reads/writes)
-- =============================================================================

grant select, insert, update, delete on public.admin_accounts to anon, authenticated, service_role;
grant select, insert, update, delete on public.company_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.departments to anon, authenticated, service_role;
grant select, insert, update, delete on public.transactions to anon, authenticated, service_role;
grant select, insert, update, delete on public.department_budgets to anon, authenticated, service_role;
grant select, insert, update, delete on public.audit_logs to anon, authenticated, service_role;
grant select, insert, update, delete on public.categories to anon, authenticated, service_role;
grant select, insert, update, delete on public.company_users to anon, authenticated, service_role;
grant select, insert, update, delete on public.recurring_entries to anon, authenticated, service_role;
grant select, insert, update, delete on public.department_targets to anon, authenticated, service_role;
grant select, insert, update, delete on public.notifications to anon, authenticated, service_role;
grant select, insert, update, delete on public.sensitive_events to anon, authenticated, service_role;
grant select, insert, update, delete on public.transaction_edit_history to anon, authenticated, service_role;
grant select, insert, update, delete on public.user_sessions to anon, authenticated, service_role;
grant select, insert, update, delete on public.password_reset_tokens to anon, authenticated, service_role;
grant select, insert, update, delete on public.login_attempts to anon, authenticated, service_role;
grant select, insert, update, delete on public.tax_report_settings to anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.system_backups') is not null then
    execute 'grant select, insert, update, delete on public.system_backups to anon, authenticated, service_role';
  end if;
end $$;

notify pgrst, 'reload schema';

-- =============================================================================
-- SECTION - Detailed P&L stock adjustments (+ legacy category columns)
-- (Contents synced from add_pnl_mapping.sql - do not drift.)
-- =============================================================================
-- Detailed P&L stock adjustments (+ legacy category columns kept for compatibility)
-- Safe to re-run. Backward compatible. Summary report unchanged.
-- Does not alter transactions.type (sale | purchase | expense | other).
--
-- DESIGN (app layer): Detailed P&L classifies by Entry Type, not pnl_group.
--   sale â†’ Revenue, purchase â†’ Cost of Sales, expense â†’ Operating Expenses,
--   other â†’ Other Income. No Admin / Selling / Finance split without a future
--   reliable classifier. Do NOT drop pnl_group/pnl_order destructively.
--
-- Stock period matching â€” Method A (exact period):
--   A pnl_stock_adjustments row matches a report when
--   period_from = report fromDate AND period_to = report toDate
--   and department_id matches the report department filter
--   (NULL department_id = "All departments").
--   Applies to full calendar months, custom date ranges, single department,
--   and all-departments views â€” always exact from/to + dept match.
--
-- SECURITY (why this is not auth.uid() RLS):
--   This app uses the Supabase anon key + custom table-based login
--   (admin_accounts / departments / company_profiles / company_users).
--   auth.uid() is always null â€” JWT RLS would block all clients.
--   Core tables (categories, transactions, budgets, â€¦) therefore disable RLS
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
  'LEGACY â€” unused by Detailed P&L (classifies by entry_type). Kept for DB compatibility; do not drop.';
comment on column public.categories.pnl_order is
  'LEGACY â€” unused by Detailed P&L. Kept for DB compatibility; do not drop.';

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
-- than coalesce(department_id, '00000000-â€¦').
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
-- =============================================================================
-- DONE â€” Next steps (run locally, not in SQL Editor):
--   npm run seed:admin
--   npm run test:db
-- =============================================================================
