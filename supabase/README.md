# Supabase listings (Buraco del Luis)

Publicaciones viven en `public.listings` (ver `schema.sql`).
Reseñas viven en `public.reviews` (ver `reviews.sql`).

## Front (`index.html`)
- CDN `@supabase/supabase-js@2`
- `SITE.supabaseUrl` + `SITE.supabaseKey` (publishable / anon)
- Helpers: `sb()`, `fetchListings(kind)`, `insertListing(row)`, `fetchReviews()`, `insertReview(row)`
- Market/shops/servicios leen `status=published` (servicio, producto, usado, remate, comercio)
- Formularios offer/product/used/auction/shop/pin insertan en Supabase (sin WhatsApp de aviso al publicar)
- Pedidos (`need`) y comentarios (`comment`) sí abren WhatsApp a Víctor
- Reseñas: insert/fetch en `reviews`; si la tabla no existe, fallback a localStorage + demos etiquetados
- Contacto sin WhatsApp sigue en localStorage (+ mailto opcional)

## Setup
1. Corre `schema.sql` en el SQL Editor del proyecto
2. Corre `reviews.sql` (después de listings, por el FK opcional a `listings`)
3. Confirma RLS: SELECT published + INSERT anon en ambas tablas
4. Pega URL y publishable key en `window.SITE`

Sin filas publicadas, la UI muestra DEMO_* con tag Demo / “Reseñas de ejemplo”.
