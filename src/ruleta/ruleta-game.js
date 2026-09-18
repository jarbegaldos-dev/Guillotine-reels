(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // RULETA GAME — contador del cofre + transicion + juego de ruleta.
  //
  // Flujo (juego BASE unicamente, nunca durante el bonus):
  //  1. Cada corte de la cuchilla pequena hace caer simbolos; game.js llama a
  //     addFallenSymbols(n) con cuantos simbolos cayeron (las cuchillas NO
  //     cuentan). El total se muestra como contador sobre el cofre central.
  //  2. Al llegar a SYMBOL_TARGET (25): el cofre del juego se sustituye por el
  //     VIDEO del cofre abriendose, alineado frame a frame (el video arranca
  //     escalado/posicionado para que su cofre coincida exactamente con el
  //     cofre estatico, y hace zoom a pantalla completa mientras reproduce).
  //     Justo antes de terminar, flash rapido blanco -> negro.
  //  3. Sobre el negro aparece la pantalla PLAY (boton circular estilo SPIN).
  //  4. PLAY monta la ruleta: fondo + rueda (detras del recubrimiento, dentro
  //     del aro bajo la flecha) + tablero encima, con dos botones:
  //       - COLLECT: cobra apuesta x1 (premio por llenar el cofre) y vuelve al
  //         juego base con un flash.
  //       - GAMBLE: la rueda gira; negro = x0, blanco = x25, BONUS GAME =
  //         activa directamente el Bonus Game FREE SPIN con un flash.
  //     Bajo los botones se muestra el premio actual (apuesta x1).
  //
  // Probabilidad del giro: sector uniforme (5 negros, 4 blancos, 1 bonus) —
  // PROVISIONAL, pendiente de modelo matematico real (Codex).
  //
  // Contrato de independencia: este modulo NO toca RNG de reels, outcome,
  // locks ni strips. Cobra premios y entra al bonus SOLO via los hooks que
  // game.js inyecta con configure() (pago via payment-engine real).
  // ---------------------------------------------------------------------------

  var SYMBOL_TARGET = 25;
  // El flash blanco arranca este margen antes del final del video.
  var FLASH_LEAD_MS = 550;
  // Fallback por si el video no puede reproducirse (asset ausente, autoplay
  // bloqueado...): se salta directo al flash para no dejar la pantalla colgada.
  var VIDEO_FAILSAFE_MS = 6500;
  // Zoom del video: de "cofre alineado con el del juego" a pantalla completa.
  var VIDEO_ZOOM_MS = 900;

  // Caja visible del cofre en el PRIMER frame del video (medida sobre el
  // webm ya sin croma, en coordenadas del frame 1920x1080). Sirve para
  // calcular el encaje inicial video<->cofre del juego en cualquier viewport.
  var VIDEO_FRAME = { w: 1920, h: 1080 };
  var VIDEO_CHEST_BBOX = { x: 813, y: 700, w: 292, h: 242 };

  // Sectores de la rueda, en sentido horario empezando por el que esta bajo
  // la flecha con la imagen en reposo (BONUS GAME arriba). 36 grados cada uno.
  var WHEEL_SECTORS = ["BONUS", "X0", "X25", "X0", "X25", "X0", "X25", "X0", "X25", "X0"];
  var WHEEL_SPIN_MS = 4600;
  var WHEEL_FULL_TURNS = 5;

  var ASSETS = {
    video: "assets/ruleta/cofre_apertura.webm",
    fondo: "assets/ruleta/fondo_juego_ruleta.png",
    tablero: "assets/ruleta/tablero_ruleta.png",
    ruleta: "assets/ruleta/ruleta.png"
  };

  // Hooks inyectados por game.js (configure). Sin ellos el modulo funciona en
  // modo visual puro (no paga, no entra al bonus).
  var hooks = {
    getBet: function () { return 0; },
    payWin: null,
    enterFreeSpins: null
  };

  var count = 0;
  var sequenceStarted = false;
  // El contador llego a SYMBOL_TARGET pero la apertura del cofre esta EN
  // ESPERA: game.js la arranca (startPendingSequence) cuando el spin termina
  // de pagar, para que el video del cofre no tape las lineas de pago.
  var pendingSequence = false;
  var counterEl = null;
  var transitionEl = null;
  var ruletaScreenEl = null;
  var failsafeTimer = null;
  var hiddenChestForVideo = false;
  var wheelImgEl = null;
  var wheelRotation = 0;
  var wheelSpinning = false;

  function chestLayerEl() {
    return document.querySelector('[data-scene-layer="chest_normal_game"]');
  }

  // --- Contador sobre el cofre ----------------------------------------------
  // Vive en #structureOverlay (mismo contenedor y por tanto mismo transform
  // que el cofre) y espeja su atributo hidden, de modo que desaparece con el
  // cofre durante el Bonus Game sin mas puntos de sincronizacion.
  function ensureCounter() {
    if (counterEl && counterEl.isConnected) return counterEl;
    var chest = chestLayerEl();
    var overlay = document.getElementById("structureOverlay");
    if (!chest || !overlay) return null;
    counterEl = document.createElement("div");
    counterEl.className = "ruleta-chest-counter game-number";
    counterEl.textContent = String(count);
    counterEl.hidden = chest.hidden;
    overlay.appendChild(counterEl);
    var observer = new MutationObserver(function () {
      counterEl.hidden = chest.hidden;
    });
    observer.observe(chest, { attributes: true, attributeFilter: ["hidden"] });
    return counterEl;
  }

  function renderCounter() {
    var el = ensureCounter();
    if (!el) return;
    el.textContent = String(Math.min(count, SYMBOL_TARGET));
    if (count >= SYMBOL_TARGET) el.classList.add("ruleta-chest-counter--full");
    else el.classList.remove("ruleta-chest-counter--full");
  }

  function addFallenSymbols(n) {
    n = Number(n) || 0;
    if (n <= 0 || sequenceStarted) return count;
    count += n;
    renderCounter();
    // Al completarse el cofre NO se abre aqui (taparia las lineas de pago del
    // spin en curso): queda pendiente hasta que game.js llame a
    // startPendingSequence() al terminar de pagar el spin.
    if (count >= SYMBOL_TARGET) pendingSequence = true;
    return count;
  }

  // Arranca la apertura del cofre si quedo pendiente (contador completo).
  // La llama game.js cuando el spin ya revelo y pago sus lineas.
  function startPendingSequence() {
    if (!pendingSequence || sequenceStarted) return false;
    pendingSequence = false;
    startTransitionSequence();
    return true;
  }

  function resetCounter() {
    count = 0;
    renderCounter();
  }

  function formatMoney(amount) {
    return "€" + Number(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // --- Encaje video <-> cofre del juego --------------------------------------
  // El video se pinta a pantalla completa con object-fit cover. Devuelve la
  // transformacion (translate + scale uniforme) que hay que aplicar al
  // contenedor del video para que el cofre de su PRIMER frame coincida con el
  // rect del cofre estatico del juego.
  function computeVideoAlignTransform() {
    var chest = chestLayerEl();
    if (!chest) return null;
    var target = chest.getBoundingClientRect();
    if (!target.width || !target.height) return null;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    // object-fit: cover
    var cover = Math.max(vw / VIDEO_FRAME.w, vh / VIDEO_FRAME.h);
    var dispW = VIDEO_FRAME.w * cover;
    var dispH = VIDEO_FRAME.h * cover;
    var offX = (vw - dispW) / 2;
    var offY = (vh - dispH) / 2;

    // Rect en pantalla del cofre del video (frame 0).
    var srcX = offX + VIDEO_CHEST_BBOX.x * cover;
    var srcY = offY + VIDEO_CHEST_BBOX.y * cover;
    var srcW = VIDEO_CHEST_BBOX.w * cover;
    var srcH = VIDEO_CHEST_BBOX.h * cover;

    var scale = target.width / srcW;
    var srcCx = srcX + srcW / 2;
    var srcCy = srcY + srcH / 2;
    var dstCx = target.left + target.width / 2;
    // Ancla por la BASE del cofre (ambos cofres "apoyan" en el suelo).
    var dstCy = target.top + target.height - (srcH * scale) / 2;

    return {
      originX: srcCx,
      originY: srcCy,
      translateX: dstCx - srcCx,
      translateY: dstCy - srcCy,
      scale: scale
    };
  }

  // --- Transicion: video del cofre + flash blanco->negro + pantalla PLAY ----

  function startTransitionSequence() {
    if (sequenceStarted) return;
    sequenceStarted = true;

    transitionEl = document.createElement("div");
    transitionEl.className = "ruleta-transition";

    var zoom = document.createElement("div");
    zoom.className = "ruleta-transition__zoom";

    var video = document.createElement("video");
    video.className = "ruleta-transition__video";
    video.src = ASSETS.video;
    // El video del cofre trae su propio audio: se reproduce CON sonido
    // (siempre llega tras interaccion del jugador, autoplay permitido).
    video.muted = false;
    video.volume = 1;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.disablePictureInPicture = true;

    var flash = document.createElement("div");
    flash.className = "ruleta-transition__flash";

    zoom.appendChild(video);
    transitionEl.appendChild(zoom);
    transitionEl.appendChild(flash);
    document.body.appendChild(transitionEl);

    // Arranque alineado: el cofre del primer frame del video coincide con el
    // cofre del juego; luego zoom suave hasta pantalla completa.
    var align = computeVideoAlignTransform();
    if (align) {
      zoom.style.transformOrigin = align.originX + "px " + align.originY + "px";
      zoom.style.transform =
        "translate(" + align.translateX + "px, " + align.translateY + "px) scale(" + align.scale + ")";
    }

    var chest = chestLayerEl();
    function swapChestForVideo() {
      // Ocultar el cofre estatico (y su contador via observer) SOLO cuando el
      // video ya esta pintando, para que no haya hueco ni doble cofre.
      if (chest && !chest.hidden) {
        chest.hidden = true;
        hiddenChestForVideo = true;
      }
      if (align) {
        // Zoom a pantalla completa mientras el video reproduce.
        zoom.style.transition = "transform " + VIDEO_ZOOM_MS + "ms cubic-bezier(0.32, 0.05, 0.35, 1)";
        window.requestAnimationFrame(function () {
          zoom.style.transform = "translate(0px, 0px) scale(1)";
        });
      }
    }
    video.addEventListener("playing", swapChestForVideo, { once: true });

    var flashFired = false;
    function fireFlash() {
      if (flashFired) return;
      flashFired = true;
      flash.classList.add("ruleta-transition__flash--active");
    }

    var playShown = false;
    function showPlay() {
      if (playShown) return;
      playShown = true;
      if (failsafeTimer) { window.clearTimeout(failsafeTimer); failsafeTimer = null; }
      fireFlash();
      showPlayScreen();
    }

    video.addEventListener("timeupdate", function () {
      if (!flashFired && video.duration && video.currentTime >= video.duration - FLASH_LEAD_MS / 1000) {
        fireFlash();
      }
    });
    video.addEventListener("ended", showPlay);
    video.addEventListener("error", showPlay);
    failsafeTimer = window.setTimeout(showPlay, VIDEO_FAILSAFE_MS);

    var p = video.play();
    if (p && p.catch) p.catch(function () {
      // Si el navegador bloquea el autoplay CON sonido, mejor el video mudo
      // que saltarse la transicion entera.
      video.muted = true;
      var retry = video.play();
      if (retry && retry.catch) retry.catch(function () { showPlay(); });
    });
  }

  function showPlayScreen() {
    if (!transitionEl) return;
    var playScreen = document.createElement("div");
    playScreen.className = "ruleta-play-screen";

    var btn = document.createElement("button");
    btn.className = "ruleta-play-btn";
    btn.type = "button";
    btn.textContent = "PLAY";
    btn.setAttribute("aria-label", "Jugar a la ruleta");
    btn.addEventListener("click", function () {
      showRuletaScreen();
    });

    playScreen.appendChild(btn);
    transitionEl.appendChild(playScreen);
    window.requestAnimationFrame(function () {
      playScreen.classList.add("ruleta-play-screen--visible");
    });
  }

  // --- Flash generico de salida (blanco rapido, revela lo de debajo) --------
  function flashAndRun(swapFn) {
    var flash = document.createElement("div");
    flash.className = "ruleta-flash-out";
    document.body.appendChild(flash);
    window.requestAnimationFrame(function () {
      flash.classList.add("ruleta-flash-out--white");
      window.setTimeout(function () {
        swapFn();
        flash.classList.remove("ruleta-flash-out--white");
        window.setTimeout(function () {
          if (flash.parentNode) flash.parentNode.removeChild(flash);
        }, 480);
      }, 170);
    });
  }

  // --- Pantalla del juego de ruleta ------------------------------------------

  function showRuletaScreen() {
    if (ruletaScreenEl) return ruletaScreenEl;
    if (window.OssuaryAudio) window.OssuaryAudio.trigger("ruleta_started", {});
    ruletaScreenEl = document.createElement("div");
    ruletaScreenEl.className = "ruleta-screen";

    // Escenario interno: alto = 100dvh, relacion nativa 16:9 de fondo y
    // tablero. El recorte de cover es SOLO horizontal y simetrico, asi que
    // las posiciones verticales en % y el centrado horizontal se conservan.
    var stage = document.createElement("div");
    stage.className = "ruleta-screen__stage";

    var fondo = document.createElement("img");
    fondo.className = "ruleta-screen__fondo";
    fondo.src = ASSETS.fondo;
    fondo.alt = "";
    fondo.draggable = false;

    // La rueda va DETRAS del tablero, con su borde metido bajo el aro del
    // recubrimiento (aro medido sobre el PNG del tablero: centro en
    // x=+23.5px del centro, y=575.5px, radio interior 362.5px, en 3840x2160).
    var wheelBox = document.createElement("div");
    wheelBox.className = "ruleta-screen__wheel-box";
    wheelImgEl = document.createElement("img");
    wheelImgEl.className = "ruleta-screen__ruleta";
    wheelImgEl.src = ASSETS.ruleta;
    wheelImgEl.alt = "";
    wheelImgEl.draggable = false;
    wheelBox.appendChild(wheelImgEl);

    var tablero = document.createElement("img");
    tablero.className = "ruleta-screen__tablero";
    tablero.src = ASSETS.tablero;
    tablero.alt = "";
    tablero.draggable = false;

    // Botonera GAMBLE / COLLECT + premio actual (apuesta x1) debajo.
    var controls = document.createElement("div");
    controls.className = "ruleta-screen__controls";

    var gambleBtn = document.createElement("button");
    gambleBtn.className = "ruleta-action-btn ruleta-action-btn--gamble";
    gambleBtn.type = "button";
    gambleBtn.textContent = "GAMBLE";

    var collectBtn = document.createElement("button");
    collectBtn.className = "ruleta-action-btn ruleta-action-btn--collect";
    collectBtn.type = "button";
    collectBtn.textContent = "COLLECT";

    var prize = document.createElement("div");
    prize.className = "ruleta-screen__prize game-number";
    prize.textContent = formatMoney(hooks.getBet() * 1);

    var buttonsRow = document.createElement("div");
    buttonsRow.className = "ruleta-screen__buttons";
    buttonsRow.appendChild(gambleBtn);
    buttonsRow.appendChild(collectBtn);
    controls.appendChild(buttonsRow);
    controls.appendChild(prize);

    gambleBtn.addEventListener("click", function () { startGamble(gambleBtn, collectBtn); });
    collectBtn.addEventListener("click", function () { collectPrize(gambleBtn, collectBtn); });

    stage.appendChild(fondo);
    stage.appendChild(wheelBox);
    stage.appendChild(tablero);
    stage.appendChild(controls);
    ruletaScreenEl.appendChild(stage);
    document.body.appendChild(ruletaScreenEl);

    // Una vez montada la ruleta, la transicion (video/flash/PLAY) sobra.
    if (transitionEl && transitionEl.parentNode) {
      transitionEl.parentNode.removeChild(transitionEl);
      transitionEl = null;
    }
    return ruletaScreenEl;
  }

  // COLLECT: cobra apuesta x1 y vuelve al juego base con un flash.
  function collectPrize(gambleBtn, collectBtn) {
    if (wheelSpinning) return;
    gambleBtn.disabled = true;
    collectBtn.disabled = true;
    var amount = hooks.getBet() * 1;
    flashAndRun(function () {
      close();
      if (hooks.payWin && amount > 0) hooks.payWin(amount, "ruleta_collect");
    });
  }

  // GAMBLE: gira la rueda. Negro = x0, blanco = x25, BONUS GAME = free spins.
  function startGamble(gambleBtn, collectBtn) {
    if (wheelSpinning || !wheelImgEl) return;
    wheelSpinning = true;
    gambleBtn.disabled = true;
    collectBtn.disabled = true;

    // Sector uniforme (PROVISIONAL, ver cabecera).
    var sectorIndex = Math.floor(Math.random() * WHEEL_SECTORS.length);
    var result = WHEEL_SECTORS[sectorIndex];

    // Rotacion para dejar el sector elegido bajo la flecha (arriba), con un
    // pequeno desvio aleatorio dentro del sector para que no caiga siempre
    // clavado en el centro.
    var jitter = (Math.random() * 2 - 1) * 13;
    var targetMod = (360 - sectorIndex * 36 + jitter + 360) % 360;
    var currentMod = ((wheelRotation % 360) + 360) % 360;
    var delta = WHEEL_FULL_TURNS * 360 + ((targetMod - currentMod + 360) % 360);
    wheelRotation += delta;

    wheelImgEl.style.transition = "transform " + WHEEL_SPIN_MS + "ms cubic-bezier(0.15, 0.55, 0.08, 1)";
    wheelImgEl.style.transform = "rotate(" + wheelRotation + "deg)";

    window.setTimeout(function () {
      wheelSpinning = false;
      resolveGamble(result);
    }, WHEEL_SPIN_MS + 600);
  }

  function resolveGamble(result) {
    var bet = hooks.getBet();
    if (result === "BONUS") {
      // Directo al Bonus Game FREE SPIN con un flash.
      flashAndRun(function () {
        close({ nextMode: "bonus" });
        if (hooks.enterFreeSpins) hooks.enterFreeSpins();
      });
      return;
    }
    var amount = result === "X25" ? bet * 25 : 0;
    flashAndRun(function () {
      close();
      if (hooks.payWin && amount > 0) hooks.payWin(amount, "ruleta_gamble_x25");
    });
  }

  // Cierra todas las capas del modulo y resetea el contador (vuelta al slot).
  function close(options) {
    options = options || {};
    if (transitionEl && transitionEl.parentNode) transitionEl.parentNode.removeChild(transitionEl);
    transitionEl = null;
    if (ruletaScreenEl && ruletaScreenEl.parentNode) ruletaScreenEl.parentNode.removeChild(ruletaScreenEl);
    ruletaScreenEl = null;
    wheelImgEl = null;
    wheelRotation = 0;
    wheelSpinning = false;
    if (failsafeTimer) { window.clearTimeout(failsafeTimer); failsafeTimer = null; }
    if (hiddenChestForVideo) {
      var chest = chestLayerEl();
      if (chest) chest.hidden = false;
      hiddenChestForVideo = false;
    }
    sequenceStarted = false;
    pendingSequence = false;
    resetCounter();
    if (window.OssuaryAudio) window.OssuaryAudio.trigger("ruleta_closed", { nextMode: options.nextMode || "normal" });
  }

  // Pintar el contador inicial en cuanto el DOM este listo (el cofre ya
  // existe: scene-manager.js corre antes que este script). Debug por URL
  // (?rgdebug=sequence|play|ruleta) para revisar las pantallas sin jugar.
  function init() {
    renderCounter();
    var mode = null;
    try { mode = new URLSearchParams(window.location.search).get("rgdebug"); } catch (e) {}
    if (mode === "sequence") {
      startTransitionSequence();
    } else if (mode === "play") {
      sequenceStarted = true;
      transitionEl = document.createElement("div");
      transitionEl.className = "ruleta-transition";
      document.body.appendChild(transitionEl);
      showPlayScreen();
    } else if (mode === "ruleta") {
      sequenceStarted = true;
      showRuletaScreen();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.OssuaryRuletaGame = {
    SYMBOL_TARGET: SYMBOL_TARGET,
    // game.js inyecta aqui sus hooks reales (bet, pago, entrada al bonus).
    configure: function (h) {
      h = h || {};
      if (typeof h.getBet === "function") hooks.getBet = h.getBet;
      if (typeof h.payWin === "function") hooks.payWin = h.payWin;
      if (typeof h.enterFreeSpins === "function") hooks.enterFreeSpins = h.enterFreeSpins;
    },
    addFallenSymbols: addFallenSymbols,
    startPendingSequence: startPendingSequence,
    getCount: function () { return count; },
    resetCounter: resetCounter,
    close: close,
    debug: {
      setCount: function (n) {
        count = Math.max(0, Number(n) || 0);
        renderCounter();
        return count;
      },
      forceSequence: startTransitionSequence,
      showRuleta: showRuletaScreen
    }
  };
})();
