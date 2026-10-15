(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Ojos del encapuchado — SOLO VISUAL.
  //
  // Cuando la piedra del esqueleto golpea al encapuchado de arriba (el centro
  // de rib1, sin matar a ningun cuervo), en el hueco negro de su capucha se
  // encienden dos ojos blancos, desparejos y siniestros, que tiemblan cada uno
  // a su ritmo y se apagan. Sutil: pequenos y con muy poco brillo. Peticion del
  // usuario (2026-10-13).
  //
  // Tres caras al azar, sin repetir la anterior (peticion del usuario,
  // 2026-10-14): "tonto" (los ojos desparejos de siempre), "enfadado" (ojos
  // rasgados hacia el centro, cejas y brillo rojo) y "llorando" (ojos caidos
  // y lagrimas que resbalan).
  //
  // Cara "watch" (peticion del usuario, 2026-10-15): durante la espera de la
  // cadena del Execution Bonus el encapuchado mira fijo con dos ascuas rojas;
  // no se va sola: game.js la quita con release("watch") en el desenlace.
  //
  // game.js llama a show(anchorFn), donde anchorFn() devuelve el rect
  // (viewport) de la casilla central de rib1; la cara de la capucha queda
  // encima (faceOffsetYCells). Estilos en src/fx/raven-bonus.css.
  // ---------------------------------------------------------------------------

  var SETTINGS = {
    // Centro de la cara respecto a la casilla central de rib1, en anchos de
    // casilla (x) y altos de casilla (y, hacia arriba).
    // (Medido sobre el hueco negro de la capucha a 1600x900.)
    faceOffsetXCells: 0.03,
    faceOffsetYCells: 0.36,
    // Separacion entre los ojos y tamano del ojo grande, en anchos de casilla.
    eyeGapCells: 0.105,
    eyeSizeCells: 0.058,
    showMs: 2100,
    // Tope de la cara "watch" por si nadie la quita.
    watchMaxMs: 9000,
    moods: ["silly", "angry", "crying"]
  };

  var lastMood = null;

  function pickMood() {
    var options = SETTINGS.moods.filter(function (m) { return m !== lastMood; });
    if (!options.length) options = SETTINGS.moods.slice();
    lastMood = options[Math.floor(Math.random() * options.length)];
    return lastMood;
  }

  // Ojos (y cejas o lagrimas) de cada cara, en px respecto al centro de la
  // cara. size = ojo grande, gap = separacion entre ojos.
  function partsFor(mood, size, gap) {
    if (mood === "watch") {
      return [
        { x: -gap / 2, y: 0, w: size * 1.05, h: size * 0.42, rot: 14, cls: "hood-eyes__eye hood-eyes__eye--watch" },
        { x: gap / 2, y: 0, w: size * 1.05, h: size * 0.42, rot: -14, cls: "hood-eyes__eye hood-eyes__eye--watch" }
      ];
    }
    if (mood === "angry") {
      return [
        { x: -gap / 2, y: 0, w: size, h: size * 0.36, rot: 26, cls: "hood-eyes__eye hood-eyes__eye--angry" },
        { x: gap / 2, y: 0, w: size, h: size * 0.36, rot: -26, cls: "hood-eyes__eye hood-eyes__eye--angry" },
        { x: -gap / 2 + size * 0.08, y: -size * 0.5, w: size * 1.2, h: Math.max(1.2, size * 0.15), rot: 34, cls: "hood-eyes__brow" },
        { x: gap / 2 - size * 0.08, y: -size * 0.5, w: size * 1.2, h: Math.max(1.2, size * 0.15), rot: -34, cls: "hood-eyes__brow" }
      ];
    }
    if (mood === "crying") {
      var tearW = Math.max(2, size * 0.34);
      var tearH = Math.max(3, size * 0.5);
      var tearY = size * 0.45;
      return [
        { x: -gap / 2, y: 0, w: size * 0.8, h: size * 0.66, rot: -12, cls: "hood-eyes__eye hood-eyes__eye--sad" },
        { x: gap / 2, y: 0, w: size * 0.8, h: size * 0.66, rot: 12, cls: "hood-eyes__eye hood-eyes__eye--sad" },
        { x: -gap / 2 - size * 0.12, y: tearY, w: tearW, h: tearH, rot: 0, cls: "hood-eyes__tear", delay: 0.25 },
        { x: -gap / 2 + size * 0.1, y: tearY, w: tearW, h: tearH, rot: 0, cls: "hood-eyes__tear", delay: 0.8 },
        { x: gap / 2 + size * 0.12, y: tearY, w: tearW, h: tearH, rot: 0, cls: "hood-eyes__tear", delay: 0.5 },
        { x: gap / 2 - size * 0.1, y: tearY, w: tearW, h: tearH, rot: 0, cls: "hood-eyes__tear", delay: 1.05 }
      ];
    }
    return [
      { x: -gap / 2, y: -size * 0.24, w: size, h: size * 0.64, rot: -12, cls: "hood-eyes__eye hood-eyes__eye--a" },
      { x: gap / 2 + size * 0.08, y: size * 0.34, w: size * 0.82, h: size * 0.28, rot: 22, cls: "hood-eyes__eye hood-eyes__eye--b" }
    ];
  }

  var layerEl = null;
  var current = null;

  function ensureLayer() {
    if (layerEl && layerEl.isConnected) return layerEl;
    layerEl = document.createElement("div");
    layerEl.className = "hood-eyes-layer";
    document.body.appendChild(layerEl);
    return layerEl;
  }

  function speedMs(ms) {
    var speed = window.OssuaryGameSpeed;
    return speed && typeof speed.ms === "function" ? speed.ms(ms) : ms;
  }

  function hide() {
    if (!current) return;
    var el = current.el;
    window.clearTimeout(current.timer);
    current = null;
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  // Apaga con un fundido la cara que se queda (solo si sigue siendo esa).
  function release(mood) {
    if (!current || (mood && current.mood !== mood)) return;
    var el = current.el;
    window.clearTimeout(current.timer);
    current = null;
    el.classList.add("is-leaving");
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }

  // Cada cara con su temblor (CSS) y un encendido a parpadeos. mood es
  // opcional (para probar una cara concreta): si no, al azar.
  function show(anchorFn, mood) {
    var rect = typeof anchorFn === "function" ? anchorFn() : anchorFn;
    if (!rect || !rect.width || !rect.height) return false;
    hide();
    var cx = rect.left + rect.width / 2 + rect.width * SETTINGS.faceOffsetXCells;
    var cy = rect.top - rect.height * SETTINGS.faceOffsetYCells;
    var size = rect.width * SETTINGS.eyeSizeCells;
    var gap = rect.width * SETTINGS.eyeGapCells;

    var watch = mood === "watch";
    var faceMood = watch || SETTINGS.moods.indexOf(mood) >= 0 ? mood : pickMood();
    var face = document.createElement("div");
    face.className = "hood-eyes hood-eyes--" + faceMood;
    face.style.left = cx + "px";
    face.style.top = cy + "px";
    // Lo que caen las lagrimas (CSS: --hood-tear-fall).
    face.style.setProperty("--hood-tear-fall", (size * 4.2) + "px");
    partsFor(faceMood, size, gap).forEach(function (part) {
      var el = document.createElement("span");
      el.className = part.cls;
      var s = el.style;
      s.width = part.w + "px";
      s.height = part.h + "px";
      s.left = (part.x - part.w / 2) + "px";
      s.top = (part.y - part.h / 2) + "px";
      if (part.rot) s.rotate = part.rot + "deg";
      if (part.delay) s.animationDelay = speedMs(part.delay * 1000) + "ms";
      face.appendChild(el);
    });
    ensureLayer().appendChild(face);
    if (watch) {
      current = { el: face, mood: faceMood, timer: window.setTimeout(function () { release("watch"); }, SETTINGS.watchMaxMs) };
      return true;
    }
    var ms = speedMs(SETTINGS.showMs);
    face.style.animationDuration = ms + "ms";
    current = { el: face, mood: faceMood, timer: window.setTimeout(hide, ms + 60) };
    return true;
  }

  window.OssuaryHoodEyes = { show: show, hide: hide, release: release, settings: SETTINGS };
})();
