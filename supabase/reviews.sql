-- Buraco del Luis — reseñas / avaliações
-- Run in Supabase SQL Editor after schema.sql (listings)

create extension if not exists "pgcrypto";

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  contact text not null check (char_length(contact) between 3 and 120),
  stars int not null check (stars between 1 and 5),
  comment text not null check (char_length(comment) between 2 and 500),
  city text check (city is null or city in ('Libres', 'Uruguaiana', 'Ambas')),
  rubro text,
  listing_id uuid null references public.listings(id) on delete set null,
  status text not null default 'published' check (status in ('published', 'pending')),
  created_at timestamptz not null default now()
);

create index if not exists reviews_status_created_idx
  on public.reviews (status, created_at desc);

alter table public.reviews enable row level security;

-- Public read of published reviews only
drop policy if exists "Public read published reviews" on public.reviews;
create policy "Public read published reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (status = 'published');

-- Anyone can insert a review (published by default for v1)
drop policy if exists "Anon insert reviews" on public.reviews;
create policy "Anon insert reviews"
  on public.reviews
  for insert
  to anon, authenticated
  with check (
    status in ('published', 'pending')
    and char_length(name) >= 2
    and char_length(contact) >= 3
    and stars between 1 and 5
    and char_length(comment) >= 2
  );

-- No public update/delete (admin via service role / dashboard)
