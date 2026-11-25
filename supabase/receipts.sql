-- Receipt scan support for Add Entry (OCR + storage)
-- Dashboard: https://supabase.com/dashboard/project/nhmtytoryyaxgsigtwox/sql/new
-- Safe to re-run.

alter table public.transactions
  add column if not exists receipt_url text;

alter table public.transactions
  add column if not exists raw_ocr_data jsonb;

comment on column public.transactions.receipt_url is
  'Public URL of uploaded receipt/bill image in storage bucket receipts.';

comment on column public.transactions.raw_ocr_data is
  'OCR text + parsed fields from tesseract client scan.';

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

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

grant select, insert, update on public.transactions to anon, authenticated, service_role;

notify pgrst, 'reload schema';
