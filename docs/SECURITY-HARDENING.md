# Security hardening (defensive) — Buraco del Luis

Short notes on what changed for moderation and spam resistance. No attack procedures.

## What changed

1. **Pending insert without SELECT** — `insertListing` / `insertReview` now call `.insert(...)` only (no `.select().single()`). Anon RLS cannot read pending rows; returning them caused false failures after a successful insert.

2. **Forced `status: pending`** — Client always overwrites `row.status = 'pending'` before insert (listings and reviews). Forms and map helpers already preferred pending; this blocks a tampered payload that tries to send `published`.

3. **Reviews moderation** — Default status is `pending`. Anon insert policy allows `status = 'pending'` only. UI copy (`reviewOk`) says the review awaits approval and will not show alone. Migration for live DB: `supabase/harden-reviews-pending.sql` (apply in Supabase SQL Editor). Baseline schema: `supabase/reviews.sql`.

4. **WhatsApp normalization** — `normalizeWhatsapp` keeps digits only and requires length 8–15. Invalid numbers reject listing submit with `publishFail`; stored value is digits-only.

5. **Honeypot + cooldown** — Off-screen `.hp-field` (`name="website"`) on listing forms (offer/product/used/auction/shop/pin) and the review form. Non-empty honeypot → silent fake success (no insert). Client cooldown ~45s via `localStorage` keys `bcl_last_listing` / `bcl_last_review` (`publishSlow` / `reviewSlow` i18n).

Listings remain moderated (`pending` until approved). Demo reviews / i18n / `escapeHtml` usage were left intact.

## Residual risks (honest)

- Client checks (honeypot, cooldown, WhatsApp length) are **bypassable** by anyone who posts directly to the Supabase anon API; they only reduce casual browser spam.
- Anon **insert** is still open by design (community submissions); RLS + pending moderation are the real gate for what appears publicly.
- Cooldown is **per browser** (`localStorage`); clearing storage or another device resets it.
- Honeypot does not stop bots that skip unknown fields or use headless APIs.
- Admin approval still happens in the Supabase dashboard (or service role); there is no in-app admin UI in this change set.

## Ops (parent / Victor)

- Apply `supabase/harden-reviews-pending.sql` on the live project.
- Confirm listings already use pending insert policy (`moderation-pending.sql` or equivalent).
- Do not commit secrets; anon key remains public by design with RLS.
