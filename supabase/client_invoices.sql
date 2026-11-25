-- Table for Client Pay (Invoices & Payment Tracking)
create table if not exists public.client_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  client_name text not null,
  amount numeric not null default 0,
  status text not null default 'Sent', -- 'Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'
  send_date date not null default current_date,
  due_date date,
  payment_received boolean not null default false,
  received_date date,
  note text,
  company_profile_id uuid references public.company_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for frequent queries
create index if not exists idx_client_invoices_send_date on public.client_invoices(send_date desc);
create index if not exists idx_client_invoices_client_name on public.client_invoices(client_name);
create index if not exists idx_client_invoices_payment_received on public.client_invoices(payment_received);

-- Enable Row Level Security (RLS)
alter table public.client_invoices enable row level security;

-- Drop prior policies if any exist
drop policy if exists "Enable read access for all users" on public.client_invoices;
drop policy if exists "Enable insert access for all users" on public.client_invoices;
drop policy if exists "Enable update access for all users" on public.client_invoices;
drop policy if exists "Enable delete access for all users" on public.client_invoices;

-- Allow authenticated and anon access based on standard FMS policy pattern
create policy "Enable read access for all users" on public.client_invoices for select using (true);
create policy "Enable insert access for all users" on public.client_invoices for insert with check (true);
create policy "Enable update access for all users" on public.client_invoices for update using (true) with check (true);
create policy "Enable delete access for all users" on public.client_invoices for delete using (true);

-- Grant permissions to anon and authenticated roles
grant all on table public.client_invoices to anon, authenticated, service_role;
