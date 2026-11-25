# Kaionex finance Tracker

A daark-themed, Supabase-backed full-stack app built with **React + Vite + Tailwind + Recharts**.

## Tech stack

- Frontend: React (Vite), Tailwind CSS, Recharts
- Database: Supabase PostgreSQL
- DB client: `@supabase/supabase-js`
- Charts: Recharts

## 1) Create Supabase project

1. Go to [Supabase](https://supabase.com) and create a new project.
2. Copy:
   - your `Project URL`
   - your `anon public` key

## 2) Run SQL tables in Supabase SQL Editor

Open **SQL Editor** in your Supabase project and run:

```sql
create extension if not exists pgcrypto;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  type text not null check (type in ('sale', 'purchase', 'expense')),
  category text not null,
  description text,
  amount numeric not null,
  entry_date date not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'branch')),
  branch_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  login_hint text,
  created_at timestamptz default now()
);

create table if not exists public.department_budgets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  month_key text not null,
  budget_amount numeric not null default 0,
  created_at timestamptz default now(),
  unique (department_id, month_key)
);

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  email text not null,
  password text not null,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, branch_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'branch'),
    nullif(new.raw_user_meta_data->>'branch_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user_profile();
```

Then add RLS policies (or disable RLS in no-auth mode):

```sql
alter table public.departments enable row level security;
alter table public.transactions enable row level security;
alter table public.profiles enable row level security;
alter table public.department_budgets enable row level security;
alter table public.company_profiles enable row level security;

-- IMPORTANT for no-auth mode:
-- If you removed login/register and use open dashboard, disable RLS instead:
-- alter table public.departments disable row level security;
-- alter table public.transactions disable row level security;
-- alter table public.department_budgets disable row level security;
-- alter table public.company_profiles disable row level security;

-- If you keep RLS enabled, allow broad access:
create policy "company_profiles_open_select"
  on public.company_profiles for select using (true);
create policy "company_profiles_open_insert"
  on public.company_profiles for insert with check (true);
create policy "company_profiles_open_delete"
  on public.company_profiles for delete using (true);

create policy "profiles select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles admin read branch accounts"
  on public.profiles for select
  using (
    auth.uid() = id
    or (
      role = 'branch'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  );

create policy "profiles admin update branch accounts"
  on public.profiles for update
  using (
    auth.uid() = id
    or (
      role = 'branch'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  )
  with check (
    auth.uid() = id
    or (
      role = 'branch'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  );

create policy "departments read all auth users"
  on public.departments for select
  using (auth.uid() is not null);

create policy "transactions read by role"
  on public.transactions for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or p.branch_id = department_id
        )
    )
  );

create policy "admin insert departments"
  on public.departments for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "admin delete departments"
  on public.departments for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "transactions insert by role"
  on public.transactions for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or p.branch_id = department_id
        )
    )
  );

create policy "transactions delete by role"
  on public.transactions for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or p.branch_id = department_id
        )
    )
  );

create policy "transactions update by role"
  on public.transactions for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or p.branch_id = department_id
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or p.branch_id = department_id
        )
    )
  );

create policy "budgets read by role"
  on public.department_budgets for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or p.branch_id = department_id
        )
    )
  );

create policy "budgets upsert admin"
  on public.department_budgets for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "budgets update admin"
  on public.department_budgets for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
```

## 3) Add environment variables

Create a `.env` file locally based on `.env.example`:

```bash
cp .env.example .env
```

Set:

- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

## 4) Run locally

```bash
npm run dev
```

## 4.1) Create users and roles

1. In Supabase, go to **Authentication → Users** and create users.
2. The trigger creates `profiles` automatically.
3. Set user metadata when creating users:
   - Admin user metadata:
     ```json
     { "role": "admin" }
     ```
   - Branch user metadata:
     ```json
     { "role": "branch", "branch_id": "DEPARTMENT_UUID_HERE" }
     ```
4. Admin sees all branches; branch users only see their own branch dashboard.

## 5) Deploy to Vercel

1. Create a new Vercel project and connect your GitHub repo.
2. Add these environment variables in **Vercel → Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Use the default Vite build settings:
   - Build command: `npm run build`
   - Output: `dist`

## Supabase table overview

- `departments` stores department name + color.
- `transactions` stores sales/purchases/expenses entries and links to departments via `department_id` (cascade delete).
- `profiles` stores login role and assigned branch per auth user.
- `department_budgets` stores monthly budget targets per department.


## Current Auth Setup (Required)

This project currently uses **table-based login** (not Supabase Auth) to avoid the previous hosted auth timeout issues.

Run this SQL in Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password text not null,
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
  created_at timestamptz not null default now()
);

alter table public.company_profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists is_active boolean not null default true;

alter table public.departments
  add column if not exists company_profile_id uuid references public.company_profiles(id) on delete cascade;

create index if not exists idx_departments_company_profile_id on public.departments(company_profile_id);

-- REQUIRED if you see "null value in column department_id" when creating a company:
-- (migrates from old 1-company-1-department schema to company → many departments)
update public.departments d
set company_profile_id = cp.id
from public.company_profiles cp
where cp.department_id is not null
  and cp.department_id = d.id
  and d.company_profile_id is null;

alter table public.company_profiles drop column if exists department_id;

alter table public.departments disable row level security;
alter table public.transactions disable row level security;
alter table public.department_budgets disable row level security;
alter table public.admin_accounts disable row level security;
alter table public.company_profiles disable row level security;

-- Audit log (Bundle C)
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

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
alter table public.audit_logs disable row level security;
```

### Security (Bundle A)

- Passwords are stored as **bcrypt hashes** (legacy plain-text passwords are upgraded automatically on next login).
- Company data is scoped in the app by `company_profile_id` on departments.
- Session is kept in `sessionStorage` for the browser tab only (no password stored client-side).
- For production, migrate to Supabase Auth + RLS policies; table-based login uses disabled RLS for reliability on the anon key.
- **Data backups** (Profile → Security): snapshots persist in Supabase table `public.system_backups`. Run `supabase/system_backups.sql` once (see [`supabase/BACKUP_SETUP.md`](./supabase/BACKUP_SETUP.md)). If Backup now fails with an RLS error, run [`supabase/fix_system_backups_rls.sql`](./supabase/fix_system_backups_rls.sql). Daily cron: Vercel `/api/cron-backup` at midnight Asia/Colombo.

### Reports & filters (Bundle B)

- **Overview** filters: department, type, date presets (today / this month / last month / custom).
- **Budget alerts** when department spend reaches 80% or exceeds 100% of monthly budget.
- **Export CSV** and **Print Report** on Overview; CSV export on Transactions.
- **Top expense categories** chart on Overview.

### Extended features (run `supabase/all_features.sql`)

- Forgot / reset password (token-based; link on login page)
- Login rate limiting (8 attempts / 15 min)
- Light / dark theme toggle
- In-app notifications (budget alerts)
- CSV bulk import on Transactions
- Transaction approval workflow (company entries pending until admin approves)
- Recurring monthly entries + “Post due”
- Category library (admin)
- Company team users (accountant / branch manager logins)
- Admin impersonate (“Login as” on company)
- Reports (P&L summary + print)
- Budget month picker + revenue KPI targets per department
- VAT / currency / invoice fields on transactions (when columns exist)
- Audit log filters
- **Sensitive Events Log** (admin sidebar): login and delete-attempt tracking with device name; mirrored in notifications; append-only, auto-purged after 30 days
- PWA manifest (`public/manifest.json`)
- Keyboard shortcut **N** = new entry

**Not included** (need external services): email delivery, Supabase Auth migration, 2FA, bank reconciliation, full AP/AR.

### Admin detail & audit (Bundle C)

- **Company Profiles → View** opens a company detail page (summary, departments, recent transactions).
- **Audit Log** tab records create/update/delete actions for companies, departments, transactions, and budgets.
- **Sensitive Events Log** (admin): security events stored in `sensitive_events` table. Included in `supabase/all_features.sql` for new installs. **Existing databases:** run `supabase/sensitive_events.sql` once in Supabase SQL Editor.

### How login/register now works

- `Register` page creates **admin** account in `admin_accounts`.
- Admin can create company login in `Company Profiles` using only email + password.
- Each company can have **multiple departments** via `departments.company_profile_id`.
- Company users can open `Profile` tab and fill personal details (`full_name`, `phone`, `address`).
- Admin can view company personal details, activate/deactivate accounts, and reset company passwords in `Company Profiles` (passwords are hashed; use Reset Password to set a new one).
- `Sign in`, `Register`, and `Sign out` buttons all use this flow.
