-- Live DB: reviews moderation — pending default + anon insert pending-only
alter table public.reviews alter column status set default 'pending';
drop policy if exists "Anon insert reviews" on public.reviews;
create policy "Anon insert reviews"
  on public.reviews for insert to anon, authenticated
  with check (
      status = 'pending'
      and char_length(name) >= 2
      and char_length(contact) >= 3
      and stars between 1 and 5
      and char_length(comment) >= 2
    );
