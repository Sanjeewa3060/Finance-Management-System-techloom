-- Run once in Supabase SQL Editor for persistent tax report settings.

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

notify pgrst, 'reload schema';
