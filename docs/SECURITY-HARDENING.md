# Security hardening (defensive) — Buraco del Luis

Short notes on what changed for moderation and spam resistance. No attack procedures.

Mapped against a typical 10-point defensive checklist (headers, captcha on egress, rate limits, error hygiene, CORS, privacy copy, CDN pinning, CSP tradeoffs, residual risks, ops).

## What changed (this pass + prior)

### 1. HTTP security headers (`vercel.json`)
- Applied to all routes `/(.*)`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (+ CSP `frame-ancestors 'none'`)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` — map/`navigator.geolocation` is MVP-hidden (`#mapa.mvp-later`); reopen geolocation=(self) if the map ships
  - Content-Security-Policy: allow `'self'`; scripts from Turnstile / unpkg Leaflet / jsDelivr Supabase; `connect-src` to project Supabase + Turnstile; OSM tile `img-src`; **`'unsafe-inline'` for script and style** because `index.html` embeds CSS/JS inline
- **CSP tradeoff:** a stricter CSP (nonces/hashes, no unsafe-inline) would break the current single-file page. Prefer a useful CSP that still loads the site over a strict one that blanks it.
- **Do not** set `Access-Control-Allow-Origin: *` on the static site (not present).

### 2. Turnstile on every submit that leaves the browser
- Listing + review already used `submit-protected`.
- **Extended:** `need`, `comment`, and `#contactForm` (`contact-local`) now have `.turnstile-slot` widgets.
- Client calls `submitProtected("gate", …)` (Turnstile + rate limit, no DB insert) before opening WhatsApp / finishing contact.
- New Edge Function type: `type: "gate"` with empty/`{}` payload → `{ ok: true }` after captcha + rate checks.

### 3. Edge Function improvements (`submit-protected`)
- Rate-limit by **IP** (unchanged: max **8** / **10 minutes**).
- Also rate-limit by **normalized WhatsApp** when payload has `whatsapp` / `contact` / `contacto` digits → bucket key `whatsapp:<digits>` (same 8/10min window, same table column `ip`).
- Error responses stay **generic codes only** (`insert_failed`, `rate_limited`, …) — never raw DB messages.
- CORS allowlist only (`buracodeluis.vercel.app` + localhost) — **no `*`**.

### 4. Privacy blurb (ES/PT)
- i18n key `privacyNote` near `#reglas` and in the footer: what is published after moderation, WhatsApp for contact, how to request removal via admin WhatsApp.

### 5. Third-party scripts
- Leaflet already pinned: `leaflet@1.9.4` (unpkg).
- Supabase CDN pinned from floating `@2` → **`@2.49.1`** (matches Edge Function import).
- **SRI / integrity hashes:** not added yet (wrong hash would break the page). Follow-up: compute correct SRI for Leaflet + supabase-js and add `integrity` + `crossorigin`.

### 6. Prior hardening (still in force)
1. **Pending insert without SELECT** — no `.select().single()` after insert for anon.
2. **Forced `status: pending`** — Edge Function strips client `status`; known columns only.
3. **Reviews moderation** — default `pending`; UI `reviewOk` copy.
4. **WhatsApp normalization** — digits only, length 8–15 (client + Edge Function).
5. **Honeypot + cooldown** — `.hp-field` + ~45s `localStorage` on listing/review forms.
6. **Turnstile + Edge Function primary gate** for listing/review inserts via service role; anon insert policies dropped via `submit-rate-limits.sql`.

## Residual risks (honest)

- Client checks (honeypot, cooldown) remain **bypassable**; server Turnstile + rate limit are the real gate once SQL + function are deployed.
- Shared NATs / repeated WhatsApp can hit 429 sooner.
- Inline `'unsafe-inline'` weakens XSS containment; migrate to nonces later if the page is split into hashed assets.
- Map geolocation is denied by Permissions-Policy while MVP-hidden.
- Admin approval still happens in Supabase (no in-app admin UI).

## Ops (Victor / parent)

1. Paste real Turnstile **secret** into `.secrets/turnstile-secret.txt` (mode 600) if still a placeholder.
2. Apply `supabase/submit-rate-limits.sql` in the SQL Editor (if not already).
3. Set Edge Function secret `TURNSTILE_SECRET_KEY` (and confirm `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).
4. **Redeploy** `submit-protected` so `type: "gate"` and WhatsApp rate keys are live.
5. Redeploy front on Vercel so `vercel.json` headers apply.
6. Confirm front points at  
   `https://kslhlktxlgtgoquhjhnz.supabase.co/functions/v1/submit-protected`.
7. Do not commit `.secrets/` or the service-role key. Do not push from agents unless asked.
