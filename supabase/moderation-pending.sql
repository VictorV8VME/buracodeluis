-- Moderación: altas nuevas en pending; anon no puede forzar published
alter table public.listings alter column status set default 'pending';

drop policy if exists "Anon insert listings" on public.listings;
create policy "Anon insert listings"
  on public.listings
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and char_length(title) >= 2
    and char_length(contact_name) >= 2
    and char_length(whatsapp) >= 6
  );
