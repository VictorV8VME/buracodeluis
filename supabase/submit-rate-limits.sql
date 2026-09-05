-- Buraco del Luis — rate limits + close anon inserts (service role / Edge Function only)
-- APPLY THIS in Supabase Dashboard → SQL Editor (Victor). Do not skip before deploying submit-protected.

-- 1) Rate-limit table (Edge Function uses service role; no anon access)
create table if not exists public.submit_rate_limits (
  ip text not null,
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0 check (count >= 0),
  primary key (ip, bucket, window_start)
);

create index if not exists submit_rate_limits_window_idx
  on public.submit_rate_limits (window_start desc);

alter table public.submit_rate_limits enable row level security;

-- Intentionally NO policies for anon/authenticated — service role bypasses RLS.
-- Drop any accidental public policies if re-applied.
drop policy if exists "Anon read rate limits" on public.submit_rate_limits;
drop policy if exists "Anon write rate limits" on public.submit_rate_limits;

-- 2) Remove direct anon/authenticated inserts on listings & reviews.
-- Public SELECT of published rows stays (existing policies).
-- After this, only the Edge Function (service role) can insert.

drop policy if exists "Anon insert listings" on public.listings;
drop policy if exists "Anon insert reviews" on public.reviews;

-- Keep published reads (recreate if missing — idempotent)
drop policy if exists "Public read published listings" on public.listings;
create policy "Public read published listings"
  on public.listings
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Public read published reviews" on public.reviews;
create policy "Public read published reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (status = 'published');

-- Note: defaults remain pending for new rows inserted via service role.
