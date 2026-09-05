# Security hardening (defensive) — Buraco del Luis

Short notes on what changed for moderation and spam resistance. No attack procedures.

## Latest follow-up list (Grok-style items 1–6)

Mapped here so prior work is not re-done from scratch.

### 1. robots.txt
- Site root `robots.txt`: `Allow: /`; `Disallow: /api/` and `Disallow: /.secrets/`.
- Static site has no real admin UI routes; keep this file simple.

### 2. localStorage PII
- **Contact form:** no longer writes name / contacto / mensaje to `localStorage`. After Turnstile gate: optional `mailto:` if `SITE.contactEmail` is set + UI confirmation only.
- **Reviews:** on remote failure, **no** localStorage fallback with contact/name (or any PII). Alert / empty UI only; inserts go through `submit-protected`.
- **Kept (non-PII):** `bcl_lang`, `bcl_fx`, cooldown timestamps (`bcl_last_*`), `bcl_help_seen`.

### 3. Rate limit (`submit-protected`)
- **Now:** `RATE_MAX = 5`; `RATE_WINDOW_MS = 60 * 60 * 1000` (5 per hour) per IP **and** per WhatsApp key (`whatsapp:<digits>`).
- Replaces prior 8 / 10 minutes. Redeploy Edge Function for this to apply in production.

### 4. XSS
- User fields in cards already go through `escapeHtml` / `escapeAttr` (listings, reviews, shops, products, used, auctions).
- Optional hardening added: `stripNullBytes` + `sanitizeFormStrings` on form submit paths (generic listing forms, review, contact).
- No raw user-string inserts found outside escaped card helpers.

### 5. WhatsApp encryption in DB — **not implemented (by design for now)**
- Published listings **intentionally** expose WhatsApp as public contact for the marketplace.
- Pending rows are protected by RLS (anon cannot read pending).
- Encrypt-at-rest is Supabase/Postgres disk encryption.
- **Later phase:** app-level field encryption only if WhatsApp is hidden behind a click / reveal flow. Do not encrypt published contact while the product needs it visible.

### 6. Logs
- Ops: use **Supabase Edge Function logs** + **Vercel logs**.
- Edge Function already `console.error`s failures without returning internals to the client (generic error codes only).
- Do **not** `console.log` full WhatsApp numbers; current EF/client warns avoid logging WA payloads. Keep redacting if any new debug logs are added.

---

## Already in place (prior pass — do not redo Turnstile from scratch)

Mapped against an earlier 10-point defensive checklist (headers, captcha on egress, rate limits, error hygiene, CORS, privacy copy, CDN pinning, CSP tradeoffs, residual risks, ops).

### A. HTTP security headers (`vercel.json`)
- Applied to all routes `/(.*)`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (+ CSP `frame-ancestors 'none'`)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` — map/`navigator.geolocation` is MVP-hidden (`#mapa.mvp-later`); reopen geolocation=(self) if the map ships
  - Content-Security-Policy: allow `'self'`; scripts from Turnstile / unpkg Leaflet / jsDelivr Supabase; `connect-src` to project Supabase + Turnstile; OSM tile `img-src`; **`'unsafe-inline'` for script and style** because `index.html` embeds CSS/JS inline
- **CSP tradeoff:** a stricter CSP (nonces/hashes, no unsafe-inline) would break the current single-file page. Prefer a useful CSP that still loads the site over a strict one that blanks it.
- **Do not** set `Access-Control-Allow-Origin: *` on the static site (not present).

### B. Turnstile on every submit that leaves the browser
- Listing + review already used `submit-protected`.
- **Extended:** `need`, `comment`, and `#contactForm` (`contact-local`) now have `.turnstile-slot` widgets.
- Client calls `submitProtected("gate", …)` (Turnstile + rate limit, no DB insert) before opening WhatsApp / finishing contact.
- Edge Function type: `type: "gate"` with empty/`{}` payload → `{ ok: true }` after captcha + rate checks.

### C. Edge Function (`submit-protected`) — captcha + rate + moderated insert
- Rate-limit by **IP** and by **normalized WhatsApp** when payload has `whatsapp` / `contact` / `contacto` digits → bucket key `whatsapp:<digits>` (see item 3 above for current window).
- Error responses stay **generic codes only** (`insert_failed`, `rate_limited`, …) — never raw DB messages.
- CORS allowlist only (`buracodeluis.vercel.app` + localhost) — **no `*`**.

### D. Privacy blurb (ES/PT)
- i18n key `privacyNote` near `#reglas` and in the footer: what is published after moderation, WhatsApp for contact, how to request removal via admin WhatsApp.

### E. Third-party scripts
- Leaflet already pinned: `leaflet@1.9.4` (unpkg).
- Supabase CDN pinned from floating `@2` → **`@2.49.1`** (matches Edge Function import).
- **SRI / integrity hashes:** not added yet (wrong hash would break the page). Follow-up: compute correct SRI for Leaflet + supabase-js and add `integrity` + `crossorigin`.

### F. Prior hardening (still in force)
1. **Pending insert without SELECT** — no `.select().single()` after insert for anon.
2. **Forced `status: pending`** — Edge Function strips client `status`; known columns only.
3. **Reviews moderation** — default `pending`; UI `reviewOk` copy.
4. **WhatsApp normalization** — digits only, length 8–15 (client + Edge Function).
5. **Honeypot + cooldown** — `.hp-field` + ~45s `localStorage` on listing/review forms (timestamps only, not PII).
6. **Turnstile + Edge Function primary gate** for listing/review inserts via service role; anon insert policies dropped via `submit-rate-limits.sql`.

## Residual risks (honest)

- Client checks (honeypot, cooldown) remain **bypassable**; server Turnstile + rate limit are the real gate once SQL + function are deployed.
- Shared NATs / repeated WhatsApp can hit 429 sooner (especially at 5/hour).
- Inline `'unsafe-inline'` weakens XSS containment; migrate to nonces later if the page is split into hashed assets.
- Map geolocation is denied by Permissions-Policy while MVP-hidden.
- Admin approval still happens in Supabase (no in-app admin UI).
- Published WhatsApp remains publicly readable by design (see item 5).

## Ops (Victor / parent)

1. Paste real Turnstile **secret** into `.secrets/turnstile-secret.txt` (mode 600) if still a placeholder.
2. Apply `supabase/submit-rate-limits.sql` in the SQL Editor (if not already).
3. Set Edge Function secret `TURNSTILE_SECRET_KEY` (and confirm `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).
4. **Redeploy** `submit-protected` so `type: "gate"` and the **5/hour** IP+WhatsApp rate keys are live.
5. Redeploy front on Vercel so `vercel.json` headers + `robots.txt` + front PII changes apply.
6. Confirm front points at  
   `https://kslhlktxlgtgoquhjhnz.supabase.co/functions/v1/submit-protected`.
7. Do not commit `.secrets/` or the service-role key. Do not push from agents unless asked.
8. Monitor: Supabase Edge Function logs + Vercel logs; avoid logging full WhatsApp.
