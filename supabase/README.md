# Supabase listings (Buraco del Luis)

Publicaciones viven en `public.listings` (ver `schema.sql`).

## Front (`index.html`)
- CDN `@supabase/supabase-js@2`
- `SITE.supabaseUrl` + `SITE.supabaseKey` (publishable / anon)
- Helpers: `sb()`, `fetchListings(kind)`, `insertListing(row)`
- Market/shops leen `status=published` (producto, usado, remate, comercio)
- Formularios offer/product/used/auction/shop/pin insertan y luego avisan por WhatsApp
- review-local y contact-local siguen en localStorage

## Setup
1. Corre `schema.sql` en el SQL Editor del proyecto
2. Confirma RLS: SELECT published + INSERT anon
3. Pega URL y publishable key en `window.SITE`

Sin filas publicadas, la UI muestra DEMO_* con tag Demo.
