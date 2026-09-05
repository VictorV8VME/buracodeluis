# Hoja de ruta — Buraco del Luis (solo lectura)

**Para:** equipo de estudiantes  
**Uso:** mirar qué se hizo, recomendar mejoras, y **copiar ideas** para su proyecto **Librestrabaja.com** (página gemela).  
**No es:** acceso de edición a Buraco, ni instructivo para tocar producción, GitHub write, Vercel o Supabase del sitio en vivo.

| Referencia | Enlace |
|------------|--------|
| Sitio vivo (solo ver) | https://buracodeluis.vercel.app/ |
| Código de ejemplo (solo ver / fork propio) | https://github.com/VictorV8VME/buracodeluis |
| Su proyecto | Librestrabaja.com (repo y stack **propios**) |

**Fecha:** septiembre 2026

---

## 0. Reglas de uso de este documento

1. **Mirar y aprender.** Buraco del Luis es el caso de estudio.
2. **Recomendar** por escrito (UX, seguridad, producto) sin cambiar el sitio de referencia.
3. **Implementar en Librestrabaja.com**, no en el despliegue de Buraco.
4. **No pedir** claves de admin, `service_role`, acceso a Vercel ni escritura en el repo de Victor.
5. Si necesitan código: **fork** o copia a su repo; PRs al repo de referencia solo si el owner lo pide.

---

## 1. Qué es Buraco del Luis (1 minuto)

Marketplace local **Paso de los Libres / Uruguaiana** (Argentina–Brasil):

| Quién | Qué hace en la web |
|--------|---------------------|
| Cliente | Busca oficios, pide presupuesto |
| Proveedor | Publica servicio / producto / usado / remate |
| Comercio | Se anuncia |
| Admin | Modera lo que sale en la home |

**Idea de producto:** la web se **autogestiona** (el formulario guarda en base). WhatsApp al admin **no** se abre en cada alta; solo en pedidos y reclamos.

**Idea de seguridad (actual):** las altas nuevas entran en **`pending`** y **no aparecen solas** en la home hasta que alguien las aprueba (`published`).

Eso es lo que conviene repetir en Librestrabaja.com desde el día 1.

---

## 2. Stack que se usó (para replicar en gemela)

```
Navegador
   │
   ▼
index.html  (HTML + CSS + JS en un solo archivo)
   │  HTTPS / REST (cliente Supabase JS por CDN)
   ▼
Supabase  (Postgres + RLS)
   tablas: listings, reviews
   │
   ▼
Vercel  (hosting estático desde GitHub main)
```

| Capa | Elección en Buraco | Nota para Librestrabaja |
|------|--------------------|-------------------------|
| Frontend | Un `index.html` | Pueden empezar igual o con Vite/React |
| Datos | Supabase + RLS | Proyecto **nuevo**, tablas propias |
| Deploy | Vercel ← `main` | Cuenta y proyecto **suyos** |
| Idiomas | ES / PT en el mismo HTML | Ideal mantener bilingüe |
| Mapa | Leaflet | Opcional |
| Audio | Mixkit (licencia libre, CDN) | Opcional; botón “Music” |

**Deliberado:** sin Next/React al inicio, para desplegar rápido y entender el flujo.

---

## 3. Pasos que ya se hicieron (cronología real)

Solo hechos consumados en Buraco — no backlog de trabajo sobre ese sitio.

### Fase A — UX y conversión
1. Banner “3 meses gratis”
2. CTAs claros (Solicitar presupuesto / Publicar)
3. SEO básico (title + meta description)
4. Buscador de rubros + grupos en acordeón
5. Propuesta de valor más corta
6. Sección **Servicios publicados**
7. Nota ARS/BRL de referencia (texto simple)
8. Reglas de confianza cerca del contacto
9. Bloque visual “cómo funciona”

### Fase B — Datos y autogestión
1. Tabla `listings` (servicio, producto, usado, remate, comercio)
2. Formularios → INSERT en Supabase → refresco de listas
3. Sin WhatsApp al admin al publicar
4. Tabla `reviews` (nombre + contacto + estrellas)
5. Demos etiquetados cuando no hay datos reales
6. **Moderación:** altas con `status = pending`; home solo muestra `published`

### Fase C — Pulido
1. Scroll correcto bajo header sticky
2. Nav que no se apila en tablet
3. Contraste del CTA “Solicitar presupuesto”
4. Music vía CDN Mixkit (evitar 404 de MP3 local en Vercel)

---

## 4. Flujos (para dibujar en el pizarrón)

### Alta de aviso (como quedó)
```
Formulario (#ofrecer / venta / etc.)
        ↓
JS arma fila con status: pending
        ↓
INSERT en listings (RLS: solo permite pending)
        ↓
Mensaje: “quedó en revisión” (NO aparece solo en la home)
        ↓
Admin aprueba → status: published → sale en la home
```

### Pedido de presupuesto
```
Formulario #pedir
        ↓
WhatsApp hacia el admin (pedido)
```

### Búsqueda de oficio
```
Rubros (buscador / acordeón) → pedir presupuesto
   o
Servicios publicados (solo published) → WhatsApp del proveedor
```

### Reseña
```
Formulario de reseña → INSERT en reviews
(hoy pueden salir publicadas; mejora típica: también pending)
```

---

## 5. Mapa conceptual del código (lectura)

En `index.html` de referencia (solo para entender, no para editar prod):

| Zona | Rol |
|------|-----|
| `<style>` | Diseño (colores, banner, cards, nav) |
| Secciones `#inicio`, `#servicios`, … | Estructura |
| `window.SITE` | Config pública del front |
| `window.I18N` | Textos ES / PT |
| `window.SERVICES` | Catálogo de rubros |
| Cliente Supabase (`fetchListings` / `insertListing`) | Lectura de published + altas |
| `mapFormToListing` | Arma la fila (incluye `pending`) |
| WhatsApp helper | Solo pedidos / reclamos |
| Leaflet / Music | Mapa y audio |

SQL de referencia en carpeta `supabase/` del repo (esquema y políticas RLS).

---

## 6. Seguridad — qué quedó resuelto y qué no

**Resuelto / acotado en Buraco**
- Home solo lee `published` (RLS)
- Inserts de listings forzados a `pending` (app + política)
- Anon no UPDATE/DELETE listings
- Sin `service_role` en el front
- Altas sin spam de WhatsApp al admin

**Riesgos abiertos (útiles para recomendar en Librestrabaja)**
- Spam de inserts (captcha, rate limit, honeypot)
- Reviews sin moderación estricta
- Sin panel admin en la web (aprobación vía dashboard de datos)
- Contenido libre (cuidado al renderizar HTML)
- Quien tenga write en GitHub puede romper el deploy

**Recomendación para la gemela:** copiar el modelo **pending → published** y sumar captcha temprano.

---

## 7. Qué pueden hacer ustedes (Librestrabaja.com)

| Sí | No |
|----|----|
| Recorrer buracodeluis.vercel.app y anotar mejoras | Pedir claves admin de Buraco |
| Fork o clonar para estudiar | Pushear a `main` de Victor sin permiso |
| Montar **su** Supabase + **su** Vercel | Usar el proyecto Supabase de Buraco |
| Proponer recomendaciones por escrito | “Probar” borrando/editando datos de prod ajenos |
| Reusar ideas de UX, flujos y RLS | Compartir `service_role` en el repo |

### Ideas de mejora (para discutir, no para aplicar en Buraco)

1. Captcha / límite de altas por IP o WhatsApp  
2. Panel admin mínimo con login  
3. Fotos en Storage  
4. Menú hamburguesa móvil  
5. Reseñas en `pending` + derecho a réplica  
6. Cotización BRL actualizable  
7. Tests E2E (publicar → no aparece → aprobar → aparece)  
8. Migrar a Vite/módulos cuando el HTML único se vuelva difícil  

---

## 8. Roles sugeridos en el equipo (para Librestrabaja)

| Rol | Enfoque |
|-----|---------|
| Producto | Priorizar con el owner del proyecto gemelo |
| Frontend | UI, i18n, móvil |
| Datos | Schema, RLS, moderación |
| QA | Checklist en celu + desktop |

---

## 9. Checklist de observación (sobre Buraco, solo ver)

- [ ] Banner y CTAs visibles  
- [ ] Buscador de rubros responde  
- [ ] Hay sección de servicios publicados  
- [ ] Pedir presupuesto abre flujo de contacto  
- [ ] Music funciona  
- [ ] ES ↔ PT  
- [ ] Mapa carga  
- [ ] Consola sin errores graves  

*(No incluye “publicar prueba en prod de Buraco”.)*

---

## 10. Glosario corto

| Término | Significado |
|---------|-------------|
| Listing | Una publicación |
| `pending` / `published` / `hidden` | Estados de moderación |
| RLS | Reglas en Postgres de quién lee/escribe qué |
| Publishable key | Key del cliente; segura solo con RLS bien puesta |
| Autogestión | El form guarda solo; el admin modera visibilidad |
| Página gemela | Mismo concepto de producto, proyecto e infraestructura propios |

---

## 11. Mensaje final

Buraco del Luis muestra **un camino ya recorrido**: HTML estático + Supabase + Vercel + moderación `pending`.  
Librestrabaja.com es el lugar donde el equipo **construye y decide**.  
Este documento es espejo y mochila de ideas — no un pase de edición.

---

*Documento de solo lectura · septiembre 2026*
