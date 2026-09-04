const $ = (s) => document.querySelector(s);
let lang = localStorage.getItem("bcl_lang") || "es";

function t() {
  return window.I18N[lang];
}

function applyTexts() {
  document.documentElement.lang = lang;
  const dict = t();
  document.querySelectorAll("[data-i]").forEach((el) => {
    const key = el.getAttribute("data-i");
    if (dict[key]) el.textContent = dict[key];
  });
  $("#langBtn").textContent = lang === "es" ? "PT" : "ES";
  renderServices();
  renderSteps();
  renderShops();
  renderMarket();
  fillSelects();
}

function renderServices() {
  $("#serviciosGrid").innerHTML = window.SERVICES.map((s) => `
    <article class="card">
      <h3>${lang === "es" ? s.es : s.pt}</h3>
      <p>${lang === "es" ? s.d_es : s.d_pt}</p>
    </article>
  `).join("");
}

function renderSteps() {
  $("#steps").innerHTML = t().steps.map((s) => `
    <article class="step"><b>${s[0]}</b><h3>${s[1]}</h3><p>${s[2]}</p></article>
  `).join("");
}

function renderShops() {
  $("#shops").innerHTML = window.DEMO_SHOPS.map((s) => `
    <article class="shop">
      <div class="tag">${s.city}</div>
      <h3>${lang === "es" ? s.es : s.pt}</h3>
      <p>${lang === "es" ? s.offer_es : s.offer_pt}</p>
    </article>
  `).join("");
}

function renderMarket() {
  $("#products").innerHTML = window.DEMO_PRODUCTS.map((p) => `
    <article class="shop">
      <div class="tag">${lang === "es" ? p.cat_es : p.cat_pt}</div>
      <h3>${lang === "es" ? p.es : p.pt}</h3>
      <p>${p.price}</p>
    </article>`).join("");
  $("#used").innerHTML = window.DEMO_USED.map((p) => `
    <article class="shop">
      <div class="tag">${lang === "es" ? "Usado" : "Usado"}</div>
      <h3>${lang === "es" ? p.es : p.pt}</h3>
      <p>${p.price}</p>
    </article>`).join("");
  $("#auctions").innerHTML = window.DEMO_AUCTIONS.map((p) => `
    <article class="shop">
      <div class="tag">${lang === "es" ? p.ends_es : p.ends_pt}</div>
      <h3>${lang === "es" ? p.es : p.pt}</h3>
      <p>${t().minBid}: ${p.min}</p>
    </article>`).join("");
}

function fillSelects() {
  const opts = `<option value=""></option>` + window.SERVICES.map((s) => {
    const label = lang === "es" ? s.es : s.pt;
    return `<option value="${s.es}">${label}</option>`;
  }).join("");
  $("#rubroNeed").innerHTML = opts;
  $("#rubroOffer").innerHTML = opts;
  $("#catProduct").innerHTML = `<option value=""></option>` + window.PRODUCT_CATS.map((c) =>
    `<option value="${c.es}">${lang === "es" ? c.es : c.pt}</option>`
  ).join("");
}

function wa(text) {
  window.open(`https://wa.me/${window.SITE.whatsapp}?text=${encodeURIComponent(text)}`, "_blank");
}

document.querySelectorAll("form").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    const kind = form.dataset.kind;
    if (kind === "need") {
      wa(`BuracodeLuis - PEDIDO\nNombre: ${d.nombre}\nWhatsApp: ${d.whatsapp}\nRubro: ${d.rubro}\nDetalle: ${d.detalle}`);
    } else if (kind === "offer") {
      wa(`BuracodeLuis - PROVEEDOR (3 meses gratis)\nNombre: ${d.nombre}\nWhatsApp: ${d.whatsapp}\nRubro: ${d.rubro}\nZona: ${d.zona || "-"}`);
    } else if (kind === "product") {
      wa(`BuracodeLuis - VENTA PRODUCTO\nNombre: ${d.nombre}\nWhatsApp: ${d.whatsapp}\nCategoria: ${d.categoria}\nProducto: ${d.producto}\nPrecio: ${d.precio || "a convenir"}`);
    } else if (kind === "used") {
      wa(`BuracodeLuis - USADO\nNombre: ${d.nombre}\nWhatsApp: ${d.whatsapp}\nProducto: ${d.producto}\nPrecio: ${d.precio}`);
    } else if (kind === "pin") {
      wa(`BuracodeLuis - UBICACION COMERCIO\nComercio: ${d.nombre}\nWhatsApp: ${d.whatsapp}\nDireccion: ${d.direccion || "-"}\nLat: ${d.lat || "-"}\nLng: ${d.lng || "-"}\nAdmin: ${window.SITE.owner}`);
    } else if (kind === "auction") {
      wa(`BuracodeLuis - REMATE (mejor oferta gana)\nNombre: ${d.nombre}\nWhatsApp: ${d.whatsapp}\nProducto: ${d.producto}\nOferta minima: ${d.minimo}`);
    } else {
      wa(`BuracodeLuis - COMERCIO / PUBLICIDAD\nComercio: ${d.nombre}\nWhatsApp: ${d.whatsapp}\nOfertas: ${d.ofertas}`);
    }
  });
});

$("#langBtn").addEventListener("click", () => {
  lang = lang === "es" ? "pt" : "es";
  localStorage.setItem("bcl_lang", lang);
  applyTexts();
});

const clippy = $("#clippy");
$("#helpOpen").addEventListener("click", () => {
  clippy.hidden = !clippy.hidden;
});
$("#helpClose").addEventListener("click", () => {
  clippy.hidden = true;
});
if (!localStorage.getItem("bcl_help_seen")) {
  clippy.hidden = false;
  localStorage.setItem("bcl_help_seen", "1");
}

applyTexts();
