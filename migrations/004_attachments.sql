-- Receiving document attachments (BOL, invoices, vendor sheets)
-- Storage bucket + attachments table

insert into storage.buckets (id, name, public)
values ('receiving-docs', 'receiving-docs', false)
on conflict (id) do nothing;

create policy "receiving_docs_select" on storage.objects
  for select to authenticated using (bucket_id = 'receiving-docs');
create policy "receiving_docs_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'receiving-docs');
create policy "receiving_docs_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'receiving-docs');

create table if not exists public.receiving_attachments (
  id uuid primary key default gen_random_uuid(),
  receiving_log_id uuid not null references public.receiving_logs(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text not null default 'other' check (file_type in ('bol','invoice','vendor_sheet','other')),
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.receiving_attachments enable row level security;
create policy "attachments_select" on public.receiving_attachments for select to authenticated using (true);
create policy "attachments_insert" on public.receiving_attachments for insert to authenticated with check (true);
create policy "attachments_delete" on public.receiving_attachments for delete to authenticated using (true);
