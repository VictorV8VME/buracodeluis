# Supabase listings (Buraco del Luis)

Publicaciones viven en `public.listings` (ver `schema.sql`).
Reseñas viven en `public.reviews` (ver `reviews.sql`).

## Front (`index.html`)
- CDN `@supabase/supabase-js@2` (reads only)
- Cloudflare Turnstile + `SITE.functionsUrl` → Edge Function `submit-protected` for inserts
- `SITE.supabaseUrl` + `SITE.supabaseKey` (publishable / anon) for SELECT published
- Helpers: `sb()`, `fetchListings(kind)`, `insertListing(row, token)` → `submitProtected`, `fetchReviews()`, `insertReview(row, token)` → `submitProtected`
- Market/shops/servicios leen `status=published`
- Formularios offer/product/used/auction/shop/pin + reseñas: captcha + POST a la Edge Function (pending)
- Pedidos (`need`) y comentarios (`comment`) abren WhatsApp a Víctor
- Contacto: Turnstile gate + mailto opcional + UI ok (sin PII en localStorage)

## Setup
1. Corre `schema.sql` y `reviews.sql` en el SQL Editor (baseline)
2. Corre **`submit-rate-limits.sql`** (rate-limit table + DROP anon insert policies)
3. Deploy Edge Function `functions/submit-protected` + secret `TURNSTILE_SECRET_KEY` (ver su README)
4. Pega URL / publishable key / Turnstile site key en `window.SITE` (ya en `index.html`)

Sin filas publicadas, la UI muestra DEMO_* con tag Demo / “Reseñas de ejemplo”.
