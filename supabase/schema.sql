-- Buraco del Luis — publicaciones
-- Run in Supabase SQL Editor (or via MCP after auth)

create extension if not exists "pgcrypto";

create type public.listing_kind as enum (
  'servicio',
  'producto',
  'usado',
  'remate',
  'comercio'
);

create type public.listing_status as enum (
  'published',
  'pending',
  'hidden'
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  kind public.listing_kind not null,
  status public.listing_status not null default 'published',
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  rubro text,
  category text,
  zone text,
  city text check (city is null or city in ('Libres', 'Uruguaiana', 'Ambas')),
  price_label text,           -- free text e.g. "ARS 12.000" or "Consultar"
  price_min_label text,       -- for remates
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  whatsapp text not null check (char_length(whatsapp) between 6 and 32),
  lat double precision,
  lng double precision,
  ends_at timestamptz,        -- remates
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_kind_status_created_idx
  on public.listings (kind, status, created_at desc);

create index if not exists listings_rubro_idx
  on public.listings (rubro);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

alter table public.listings enable row level security;

-- Public read of published listings only
drop policy if exists "Public read published listings" on public.listings;
create policy "Public read published listings"
  on public.listings
  for select
  to anon, authenticated
  using (status = 'published');

-- Anyone can insert a new listing (published by default for v1 automation)
drop policy if exists "Anon insert listings" on public.listings;
create policy "Anon insert listings"
  on public.listings
  for insert
  to anon, authenticated
  with check (
    status in ('published', 'pending')
    and char_length(title) >= 2
    and char_length(contact_name) >= 2
    and char_length(whatsapp) >= 6
  );

-- No public update/delete (admin via service role / dashboard)
