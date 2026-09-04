(function () {
  const el = document.getElementById("map");
  if (!el || !window.L || !window.SITE) return;

  const { lat, lng, zoom } = window.SITE.map;
  const map = L.map("map").setView([lat, lng], zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  L.marker([lat, lng]).addTo(map).bindPopup("Paso de los Libres");

  (window.DEMO_SHOPS || []).forEach((s, i) => {
    const offLat = lat + (i - 1.5) * 0.004;
    const offLng = lng + (i % 2 === 0 ? 0.005 : -0.004);
    L.marker([offLat, offLng]).addTo(map).bindPopup(s.es);
  });

  let pin;
  function setPin(la, ln) {
    if (pin) map.removeLayer(pin);
    pin = L.marker([la, ln]).addTo(map);
    document.getElementById("pinLat").value = la.toFixed(6);
    document.getElementById("pinLng").value = ln.toFixed(6);
  }

  map.on("click", (e) => setPin(e.latlng.lat, e.latlng.lng));

  document.getElementById("useGps")?.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const la = pos.coords.latitude;
      const ln = pos.coords.longitude;
      map.setView([la, ln], 16);
      setPin(la, ln);
    });
  });
})();
