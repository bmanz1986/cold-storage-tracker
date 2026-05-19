-- Receiving Log tables
-- Run this in the Supabase SQL editor.

-- Running lot number sequence (current highest is 06475, next is 06476)
create sequence if not exists lot_number_seq start with 6476;

-- One record per inbound shipment
create table if not exists public.receiving_logs (
  id uuid primary key default gen_random_uuid(),
  arrival_id uuid references public.arrivals(id) on delete set null,
  vendor_name text not null,
  received_date date not null default current_date,
  truck_number text,
  dot_permit text,
  po_carrier text,
  invoice_number text,                    -- filled in later by office staff
  transport_clean boolean,
  transport_ventilation boolean,
  transport_no_damage boolean,
  product_condition_ok boolean,
  safety_guidelines_ok boolean,
  comments text,
  received_by text,
  written_up_by text,
  status text not null default 'receiving' check (status in ('receiving','complete')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- One record per product line inside a shipment
create table if not exists public.receiving_items (
  id uuid primary key default gen_random_uuid(),
  receiving_log_id uuid not null references public.receiving_logs(id) on delete cascade,
  lot_number integer not null default nextval('lot_number_seq'),
  upc text,
  description text,
  pallets integer,
  cases integer,
  code_date date,
  weight_per_pallet text,
  location text,
  created_at timestamptz not null default now()
);

-- Indexes for search
create index if not exists idx_receiving_logs_vendor   on public.receiving_logs(vendor_name);
create index if not exists idx_receiving_logs_date     on public.receiving_logs(received_date desc);
create index if not exists idx_receiving_logs_invoice  on public.receiving_logs(invoice_number);
create index if not exists idx_receiving_items_lot     on public.receiving_items(lot_number);

-- RLS
alter table public.receiving_logs  enable row level security;
alter table public.receiving_items enable row level security;

drop policy if exists "receiving_logs_select"  on public.receiving_logs;
drop policy if exists "receiving_logs_insert"  on public.receiving_logs;
drop policy if exists "receiving_logs_update"  on public.receiving_logs;
drop policy if exists "receiving_logs_delete"  on public.receiving_logs;

create policy "receiving_logs_select" on public.receiving_logs for select to authenticated using (true);
create policy "receiving_logs_insert" on public.receiving_logs for insert to authenticated with check (true);
create policy "receiving_logs_update" on public.receiving_logs for update to authenticated using (true);
create policy "receiving_logs_delete" on public.receiving_logs for delete to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "receiving_items_select" on public.receiving_items;
drop policy if exists "receiving_items_insert" on public.receiving_items;
drop policy if exists "receiving_items_update" on public.receiving_items;
drop policy if exists "receiving_items_delete" on public.receiving_items;

create policy "receiving_items_select" on public.receiving_items for select to authenticated using (true);
create policy "receiving_items_insert" on public.receiving_items for insert to authenticated with check (true);
create policy "receiving_items_update" on public.receiving_items for update to authenticated using (true);
create policy "receiving_items_delete" on public.receiving_items for delete to authenticated using (true);

-- Realtime
alter publication supabase_realtime add table public.receiving_logs;
alter publication supabase_realtime add table public.receiving_items;
