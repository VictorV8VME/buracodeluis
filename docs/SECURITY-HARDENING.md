# Security hardening (defensive) — Buraco del Luis

Short notes on what changed for moderation and spam resistance. No attack procedures.

## What changed

1. **Pending insert without SELECT** — Client helpers no longer rely on `.select().single()` after insert. Pending rows are not readable by anon RLS.

2. **Forced `status: pending`** — Edge Function strips any client-provided `status` and always inserts `pending` (listings and reviews). Only known columns are accepted.

3. **Reviews moderation** — Default status is `pending`. UI copy (`reviewOk`) says the review awaits approval. Baseline schema: `supabase/reviews.sql`. Live hardening history: `supabase/harden-reviews-pending.sql`.

4. **WhatsApp normalization** — Digits only, length 8–15 (client + Edge Function). Invalid numbers reject listing submit.

5. **Honeypot + cooldown** — Off-screen `.hp-field` (`name="website"`) on listing forms and the review form. Non-empty honeypot → silent fake success (no network insert). Client cooldown ~45s via `localStorage` (`publishSlow` / `reviewSlow`).

6. **Cloudflare Turnstile + Edge Function (primary gate)** — Browser submits go to `submit-protected` (not direct anon insert):
   - Front: Turnstile widget + `SITE.turnstileSiteKey` / `SITE.functionsUrl`
   - Function: verify Turnstile (`TURNSTILE_SECRET_KEY`), rate-limit IP (max **8** / **10 minutes** in `public.submit_rate_limits`), insert via **service role**
   - SQL: `supabase/submit-rate-limits.sql` — creates rate-limit table (RLS on, **no anon policies**), **DROP**s `"Anon insert listings"` and `"Anon insert reviews"`. Public SELECT of published stays.
   - Secret: local file `.secrets/turnstile-secret.txt` only (gitignored). Set the same value in Supabase Dashboard → Edge Functions → Secrets as `TURNSTILE_SECRET_KEY`. Never put the secret in `index.html`, docs, or committed SQL.
   - Deploy steps: `supabase/functions/submit-protected/README.md`

## Residual risks (honest)

- Client checks (honeypot, cooldown) are still **bypassable** in the browser; after SQL is applied they no longer reach the DB without the Edge Function + Turnstile + rate limit.
- Until `submit-rate-limits.sql` is applied and the function is deployed with secrets, anon insert policies may still exist on the live project — apply SQL before relying on this path.
- Rate limit is per IP + 10-minute window; shared NATs can hit 429 sooner (`publishSlow`-style messaging).
- Admin approval still happens in the Supabase dashboard (or service role); there is no in-app admin UI in this change set.

## Ops (Victor / parent)

1. Paste real Turnstile **secret** into `.secrets/turnstile-secret.txt` (mode 600) if still a placeholder.
2. Apply `supabase/submit-rate-limits.sql` in the SQL Editor.
3. Set Edge Function secret `TURNSTILE_SECRET_KEY` in the Dashboard (and confirm `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).
4. Deploy `submit-protected` (CLI or Dashboard) — see function README.
5. Confirm front on Vercel points at  
   `https://kslhlktxlgtgoquhjhnz.supabase.co/functions/v1/submit-protected`.
6. Do not commit `.secrets/` or the service-role key.
