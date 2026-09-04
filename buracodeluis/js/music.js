// Música generada en el navegador (sin archivos pagos ni copyright).
(function () {
  let ctx, timer, on = false;

  function beep(time, freq, dur, type, gainVal) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gainVal, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  function loop() {
    const t0 = ctx.currentTime + 0.05;
    const notes = [523.25, 659.25, 783.99, 659.25, 880, 783.99, 659.25, 523.25];
    notes.forEach((n, i) => {
      beep(t0 + i * 0.22, n, 0.2, "triangle", 0.05);
      if (i % 2 === 0) beep(t0 + i * 0.22, n / 2, 0.2, "sine", 0.03);
    });
  }

  function start() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    loop();
    timer = setInterval(loop, 1800);
    on = true;
    const btn = document.getElementById("musicBtn");
    if (btn && window.I18N) btn.textContent = (window.I18N[document.documentElement.lang] || window.I18N.es).musicOn;
  }

  function stop() {
    clearInterval(timer);
    on = false;
    const btn = document.getElementById("musicBtn");
    if (btn && window.I18N) btn.textContent = (window.I18N[document.documentElement.lang] || window.I18N.es).musicOff;
  }

  document.getElementById("musicBtn")?.addEventListener("click", () => {
    if (on) stop();
    else start();
  });
})();
