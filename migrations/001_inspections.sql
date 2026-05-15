-- Inspections table
-- Captures everything the "Inbound Outbound Truck Inspection" Google Form was collecting.
-- One arrival can have multiple inspections (e.g., inbound + outbound on the same truck).
-- Run this in the Supabase SQL editor.

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),

  -- Linkage to arrivals (nullable so historical / standalone inspections still work)
  arrival_id uuid references public.arrivals(id) on delete set null,
  inspected_by uuid references auth.users(id),
  inspector_name text,                       -- free text fallback (e.g. "Kerwin", "David M")
  team text,                                 -- 'Cold Storage' | 'Logistics' | 'Walden Inventory'

  -- When the inspection happened
  inspected_at timestamptz not null default now(),

  -- Direction & parties
  direction text not null check (direction in ('Inbound','Outbound','Both')),
  carrier_name text,
  vendor_name text not null,                 -- normalized vendor name (used by report search)
  vendor_type text check (vendor_type in ('Walden','Cold Storage')),
  order_or_po text,

  -- BOL & sealing
  bol_included boolean,
  truck_locked_or_sealed text,               -- 'Locked - LTL or Walden Shipment' | 'Sealed - third party' | etc.
  seal_number text,
  seal_matches_paperwork boolean,            -- null when n/a

  -- Temperature
  temperature_required text check (temperature_required in ('Frozen','Refrigerated','Ambient')),
  set_point numeric,
  frozen_actual numeric,
  refrigerated_actual numeric,
  temperature_acceptable boolean,

  -- Inspection results
  truck_inspection_ok boolean default true,  -- true = "No Non Conformances Identified"
  truck_nc_notes text,
  pallet_inspection_ok boolean default true,
  pallet_nc_notes text,
  pallet_type text,                          -- e.g. 'No Double Pallet Beams'

  -- BOL verification (this column set started 1/12/2026)
  bol_verify_link text,                      -- google drive URL to scanned BOL
  bol_verified_date date,
  bol_verified_initials text,
  bol_matches_product boolean,
  bol_match_explanation text,

  created_at timestamptz not null default now()
);

-- Indexes used by the Inspection Log report
create index if not exists idx_inspections_inspected_at on public.inspections(inspected_at desc);
create index if not exists idx_inspections_vendor_name  on public.inspections(vendor_name);
create index if not exists idx_inspections_arrival_id   on public.inspections(arrival_id);

-- Row-Level Security: same model as the rest of the app
alter table public.inspections enable row level security;

drop policy if exists "inspections_select" on public.inspections;
create policy "inspections_select"
  on public.inspections for select
  to authenticated
  using (true);

drop policy if exists "inspections_insert" on public.inspections;
create policy "inspections_insert"
  on public.inspections for insert
  to authenticated
  with check (auth.uid() = inspected_by or inspected_by is null);

drop policy if exists "inspections_update" on public.inspections;
create policy "inspections_update"
  on public.inspections for update
  to authenticated
  using (
    inspected_by = auth.uid()
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  );

drop policy if exists "inspections_delete" on public.inspections;
create policy "inspections_delete"
  on public.inspections for delete
  to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

-- Realtime: let the report page live-update
alter publication supabase_realtime add table public.inspections;
