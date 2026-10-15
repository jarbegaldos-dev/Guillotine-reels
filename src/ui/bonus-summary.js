(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Resumen al acabar un bonus — SOLO presentacion.
  //
  // Al terminar el Execution Bonus o la cadena del cuervo, una pantalla con el
  // nombre del bonus y el TOTAL WIN (cifras de oro de number-font.js contando
  // hacia arriba), cuantas veces la apuesta y CONTINUE. Peticion del usuario
  // (2026-10-14): antes el bonus terminaba de golpe.
  //
  // game.js llama a show({ kind, total, bet, spins, auto }) y espera la
  // promesa: mientras esta abierta el juego no gira (ni autoplay). Un clic (o
  // Espacio/Enter) durante la cuenta la salta al final; con la cuenta hecha,
  // cierra. Con autoplay se cierra sola. Estilos: src/ui/bonus-summary.css.
  // ---------------------------------------------------------------------------

  var COUNT_MS = 1500;
  var AUTO_CLOSE_MS = 4200;
  var CLOSE_FADE_MS = 280;

  var TITLES = {
    execution: "EXECUTION BONUS",
    raven: "RAVEN BONUS"
  };

  var root = null;
  var titleEl = null;
  var valueEl = null;
  var multEl = null;
  var spinsEl = null;
  var current = null;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function build() {
    root = el("div", "bonus-summary");
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Bonus summary");

    var panel = el("div", "bonus-summary__panel");
    titleEl = el("div", "bonus-summary__title");
    // Separador con el reloj de arena del HUD.
    var rule = el("div", "bonus-summary__rule");
    rule.innerHTML = '<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M1 1h10L6 8z M1 15h10L6 8z"/></svg>';
    var label = el("div", "bonus-summary__label", "TOTAL WIN");
    valueEl = el("div", "bonus-summary__value");
    var meta = el("div", "bonus-summary__meta");
    multEl = el("span", "bonus-summary__mult");
    spinsEl = el("span", "bonus-summary__spins");
    meta.appendChild(multEl);
    meta.appendChild(spinsEl);
    var btn = el("button", "bonus-summary__continue", "CONTINUE");
    btn.type = "button";

    panel.appendChild(titleEl);
    panel.appendChild(rule);
    panel.appendChild(label);
    panel.appendChild(valueEl);
    panel.appendChild(meta);
    panel.appendChild(btn);
    root.appendChild(panel);
    document.body.appendChild(root);

    root.addEventListener("click", function (event) {
      event.stopPropagation();
      advance();
    });
  }

  function formatMoney(value) {
    var amount = Math.round((Number(value) || 0) * 100) / 100;
    return "€" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderAmount(value) {
    var text = formatMoney(value);
    if (window.OssuaryNumberFont) {
      window.OssuaryNumberFont.render(valueEl, text, { separatorImages: true });
    } else {
      valueEl.textContent = text;
    }
  }

  function formatMultiplier(total, bet) {
    if (!(bet > 0)) return "";
    var x = total / bet;
    var shown = x >= 100 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return "x" + shown + " BET";
  }

  function speedMs(ms) {
    var speed = window.OssuaryGameSpeed;
    return speed && typeof speed.ms === "function" ? speed.ms(ms) : ms;
  }

  function stopCount() {
    if (!current) return;
    if (current.frame) window.cancelAnimationFrame(current.frame);
    if (current.countTimer) window.clearTimeout(current.countTimer);
    current.frame = 0;
    current.countTimer = 0;
  }

  function finishCount() {
    if (!current || current.counted) return;
    stopCount();
    current.counted = true;
    renderAmount(current.total);
    root.classList.add("is-counted");
    if (current.auto) current.autoTimer = window.setTimeout(close, speedMs(AUTO_CLOSE_MS));
  }

  // Clic o tecla: primero salta la cuenta; despues, cierra.
  function advance() {
    if (!current) return;
    if (!current.counted) {
      finishCount();
      return;
    }
    if (window.OssuaryAudio) window.OssuaryAudio.trigger("button_click");
    close();
  }

  function onKey(event) {
    if (!current) return;
    if (event.key === " " || event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      advance();
    }
  }

  function close() {
    if (!current) return;
    var done = current;
    current = null;
    stopCountFor(done);
    if (done.autoTimer) window.clearTimeout(done.autoTimer);
    window.removeEventListener("keydown", onKey, true);
    root.classList.remove("is-open");
    window.setTimeout(function () {
      if (!current) {
        root.hidden = true;
        root.classList.remove("is-counted");
      }
      done.resolve();
    }, CLOSE_FADE_MS);
  }

  function stopCountFor(state) {
    if (state.frame) window.cancelAnimationFrame(state.frame);
    if (state.countTimer) window.clearTimeout(state.countTimer);
  }

  function show(options) {
    options = options || {};
    if (!root) build();
    if (current) close();
    var total = Math.max(0, Number(options.total) || 0);
    var kind = TITLES[options.kind] ? options.kind : "execution";
    root.className = "bonus-summary bonus-summary--" + kind;
    titleEl.textContent = TITLES[kind];
    multEl.textContent = formatMultiplier(total, Number(options.bet) || 0);
    var spins = Number(options.spins) || 0;
    spinsEl.textContent = kind === "raven" && spins > 0 ? spins + (spins === 1 ? " SPIN" : " SPINS") : "";
    spinsEl.hidden = !spinsEl.textContent;
    renderAmount(0);
    root.hidden = false;
    void root.offsetWidth; // arranca la transicion de entrada
    root.classList.add("is-open");
    window.addEventListener("keydown", onKey, true);

    return new Promise(function (resolve) {
      current = { total: total, auto: Boolean(options.auto), resolve: resolve, counted: false, frame: 0, countTimer: 0, autoTimer: 0 };
      if (total <= 0) {
        finishCount();
        return;
      }
      var duration = speedMs(COUNT_MS);
      var start = window.performance.now();
      var mine = current;
      function step(now) {
        if (current !== mine || mine.counted) return;
        var t = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        renderAmount(Math.round(total * eased * 100) / 100);
        if (t < 1) mine.frame = window.requestAnimationFrame(step);
        else finishCount();
      }
      mine.frame = window.requestAnimationFrame(step);
      // Red de seguridad (pestana en segundo plano sin rAF).
      mine.countTimer = window.setTimeout(finishCount, duration + 120);
    });
  }

  window.OssuaryBonusSummary = {
    show: show,
    close: close,
    isOpen: function () { return Boolean(current); }
  };
})();
