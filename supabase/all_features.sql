-- Run once in Supabase SQL Editor (after existing tables)

-- Legacy cleanup
alter table public.company_profiles drop column if exists department_id;

alter table public.company_profiles
  add column if not exists admin_notes text,
  add column if not exists last_login_at timestamptz,
  add column if not exists avatar_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_password text;

alter table public.admin_accounts
  add column if not exists last_login_at timestamptz,
  add column if not exists avatar_url text;

alter table public.departments
  add column if not exists email text,
  add column if not exists password text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_login_at timestamptz,
  add column if not exists avatar_url text,
  add column if not exists delete_password text;

create unique index if not exists departments_email_unique
  on public.departments (lower(email))
  where email is not null;

alter table public.transactions
  add column if not exists currency text default 'GBP',
  add column if not exists exchange_rate numeric default 1,
  add column if not exists vat_rate numeric default 0,
  add column if not exists status text default 'approved',
  add column if not exists attachment_path text,
  add column if not exists due_date date,
  add column if not exists invoice_ref text,
  add column if not exists payment_method text default 'cash';

alter table public.transactions
  add column if not exists other_direction text;

alter table public.transactions drop constraint if exists transactions_other_direction_check;
alter table public.transactions
  add constraint transactions_other_direction_check
  check (other_direction is null or other_direction in ('profit', 'expense'));

alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check check (status in ('pending', 'approved', 'rejected'));

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check check (type in ('sale', 'purchase', 'expense', 'other'));

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entry_type text not null check (entry_type in ('sale', 'purchase', 'expense', 'other', 'all')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, entry_type)
);

create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid not null references public.company_profiles(id) on delete cascade,
  email text not null,
  password text not null,
  role text not null default 'accountant' check (role in ('accountant', 'manager')),
  department_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  avatar_url text,
  created_at timestamptz not null default now(),
  unique (company_profile_id, email)
);

alter table public.company_users
  add column if not exists avatar_url text;

create table if not exists public.recurring_entries (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  type text not null check (type in ('sale', 'purchase', 'expense', 'other')),
  category text not null,
  description text,
  amount numeric not null,
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  is_active boolean not null default true,
  last_posted_month text,
  created_at timestamptz not null default now()
);

create table if not exists public.department_targets (
  department_id uuid not null references public.departments(id) on delete cascade,
  month_key text not null,
  revenue_target numeric not null default 0,
  primary key (department_id, month_key)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_role text not null,
  user_id uuid not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists is_sensitive boolean not null default false;

-- Sensitive Events Log (append-only; app purges rows after 30 days)
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

create index if not exists idx_sensitive_events_created on public.sensitive_events(created_at desc);
create index if not exists idx_sensitive_events_expires on public.sensitive_events(expires_at);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  account_type text not null check (account_type in ('admin', 'company', 'company_user')),
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_email_time on public.login_attempts(email, attempted_at desc);

-- Storage bucket for receipts (create in Dashboard > Storage if SQL fails)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

alter table public.categories disable row level security;
grant select, insert, update, delete on public.categories to anon, authenticated, service_role;
alter table public.company_users disable row level security;
alter table public.recurring_entries disable row level security;
alter table public.department_targets disable row level security;
alter table public.notifications disable row level security;
alter table public.sensitive_events disable row level security;
grant select, insert, update, delete on public.sensitive_events to anon, authenticated, service_role;

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
alter table public.user_sessions disable row level security;
grant select, insert, update, delete on public.user_sessions to anon, authenticated, service_role;

alter table public.password_reset_tokens disable row level security;
alter table public.login_attempts disable row level security;

alter table public.admin_accounts disable row level security;
alter table public.company_profiles disable row level security;
alter table public.departments disable row level security;
alter table public.transactions disable row level security;
alter table public.department_budgets disable row level security;

grant select, insert, update, delete on public.admin_accounts to anon, authenticated, service_role;
grant select, insert, update, delete on public.company_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.departments to anon, authenticated, service_role;
grant select, insert, update, delete on public.transactions to anon, authenticated, service_role;
grant select, insert, update, delete on public.department_budgets to anon, authenticated, service_role;

-- Refresh PostgREST schema cache (run again after manual SQL migrations if needed)
notify pgrst, 'reload schema';
