(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Cartel breve con las letras de oro del juego (OssuaryNumberFont con
  // { letters: true }) que anuncia la tirada gratis de la cadena del Raven
  // Bonus: la piedra ha matado un cuervo y hay otra tirada ("+1 SPIN"). El "+"
  // no existe en las letras horneadas: va dibujado por CSS en el mismo oro.
  // Solo visual: lo llama game.js (continueRavenChain). Estilos en
  // src/fx/raven-bonus.css.
  // ---------------------------------------------------------------------------

  var SHOW_MS = 1500;
  var el = null;
  var plusEl = null;
  var label = null;
  var timer = 0;

  function speedMs(ms) {
    if (window.OssuaryGameSpeed && typeof window.OssuaryGameSpeed.ms === "function") {
      return window.OssuaryGameSpeed.ms(ms);
    }
    return ms;
  }

  function ensure() {
    if (el && el.isConnected) return el;
    el = document.createElement("div");
    el.className = "raven-banner";
    el.setAttribute("role", "status");
    plusEl = document.createElement("span");
    plusEl.className = "raven-banner__plus";
    plusEl.setAttribute("aria-hidden", "true");
    label = document.createElement("div");
    label.className = "raven-banner__label";
    el.appendChild(plusEl);
    el.appendChild(label);
    document.body.appendChild(el);
    return el;
  }

  function show(text) {
    var root = ensure();
    var str = String(text || "");
    var plus = str.charAt(0) === "+";
    var rest = plus ? str.slice(1) : str;
    plusEl.hidden = !plus;
    var font = window.OssuaryNumberFont;
    if (font && typeof font.canRenderLetters === "function" && font.canRenderLetters(rest)) {
      font.render(label, rest, { letters: true });
    } else {
      label.classList.remove("ossuary-number-font");
      label.textContent = rest;
    }
    root.setAttribute("aria-label", str);
    root.classList.remove("is-on");
    void root.offsetWidth;
    root.classList.add("is-on");
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      root.classList.remove("is-on");
    }, speedMs(SHOW_MS));
  }

  // Letras y cifras del cartel en memoria desde el principio: la primera vez
  // que sale no debe faltar ninguna.
  if (window.OssuaryNumberFont) {
    if (typeof window.OssuaryNumberFont.preload === "function") window.OssuaryNumberFont.preload();
    if (typeof window.OssuaryNumberFont.preloadLetters === "function") window.OssuaryNumberFont.preloadLetters("SPIN");
  }

  window.OssuaryRavenBanner = { show: show };
})();
