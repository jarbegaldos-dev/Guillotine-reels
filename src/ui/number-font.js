(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // FUENTE DE NUMEROS DE PAGO — SOLO VISUAL.
  //
  // Pinta una cadena numerica (p.ej. "€1,250.00") usando las imagenes de oro
  // recortadas de assets/fonts/numbers/0.png..9.png para los DIGITOS; el resto
  // de caracteres (€ , . espacio) se quedan como texto con la fuente base para
  // no inventar glifos que no existen en el asset.
  //
  // Las diez imagenes comparten alto y linea base, asi que basta con fijarles
  // una altura comun (height) y se alinean solas. render(el, text) reconstruye
  // el contenido de `el`; el tamaño se controla por CSS (--num-digit-height o
  // font-size del contenedor, ver .ossuary-number-font en style.css).
  // ---------------------------------------------------------------------------

  var BASE_PATH = "assets/fonts/numbers/";
  var cache = {};
  // Separadores en el mismo oro biselado que los digitos (comma.png, dot.png:
  // misma altura y linea base). Solo se usan si quien pinta lo pide con
  // { separatorImages: true }; si no, siguen como texto.
  var SEPARATOR_FILES = { ",": "comma.png", ".": "dot.png" };
  // Letras en el mismo oro cincelado (tools/bake-letter-font.js: mismo alto y
  // linea base que las cifras). Solo las que usa el juego; solo se pintan si
  // quien llama lo pide con { letters: true }. El punto medio va con ellas.
  var LETTERS_PATH = "assets/fonts/letters/";
  var LETTERS = "ACEFHILNPRSY";
  var MIDDOT = "·";
  var NBSP = " ";

  function letterFile(ch) {
    if (ch === MIDDOT) return "middot.png";
    return LETTERS.indexOf(ch) >= 0 ? ch + ".png" : null;
  }

  // true si todo el texto se puede pintar con imagenes (digitos, letras
  // horneadas, punto medio y espacios); si no, conviene dejarlo en texto para
  // no mezclar.
  function canRenderLetters(text) {
    var str = String(text == null ? "" : text);
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === " " || (ch >= "0" && ch <= "9") || letterFile(ch)) continue;
      return false;
    }
    return true;
  }

  // Copias en memoria (blob:) de las cifras y separadores. El servidor manda
  // los PNG con Cache-Control: no-store y el contador BIG WIN repinta el
  // numero en cada fotograma: con la ruta normal cada <img> nueva volvia a
  // pedir y descodificar su PNG y el numero NO SE VEIA mientras contaba
  // (medido 2026-10-09: en 279 de 297 fotogramas las cifras estaban sin
  // descodificar). Mismo arreglo que el arte de las fichas
  // (keepArtResident en src/render/symbol-renderer.js).
  var residentUrls = {};
  var residentRequested = {};

  function keepResident(path) {
    if (residentRequested[path]) return;
    residentRequested[path] = true;
    if (typeof fetch !== "function" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      var plain = new Image();
      plain.src = path;
      cache[path] = plain;
      return;
    }
    fetch(path).then(function (res) {
      return res.ok ? res.blob() : null;
    }).then(function (blob) {
      if (!blob) return null;
      var objectUrl = URL.createObjectURL(blob);
      var img = new Image();
      img.src = objectUrl;
      return (typeof img.decode === "function" ? img.decode() : Promise.resolve()).then(function () {
        cache[path] = img; // mantiene viva la imagen ya descodificada
        residentUrls[path] = objectUrl;
      }, function () {
        URL.revokeObjectURL(objectUrl);
      });
    }).catch(function () {});
  }

  function srcFor(path) {
    return residentUrls[path] || path;
  }

  // Precarga las diez imagenes (y los separadores) para que el primer pago no
  // parpadee.
  function preload() {
    for (var d = 0; d < 10; d++) keepResident(BASE_PATH + d + ".png");
    Object.keys(SEPARATOR_FILES).forEach(function (ch) {
      keepResident(BASE_PATH + SEPARATOR_FILES[ch]);
    });
  }

  // Deja en memoria las letras de un texto que se va a mostrar de golpe (p.ej.
  // el cartel FREE SPIN del Raven Bonus), para que no falte ninguna al salir.
  function preloadLetters(text) {
    var str = String(text == null ? "" : text);
    for (var i = 0; i < str.length; i++) {
      var file = letterFile(str[i]);
      if (file) keepResident(LETTERS_PATH + file);
    }
  }

  // Que nodo toca para un caracter: { tag, cls, src } o { tag, cls, text }.
  function glyphFor(ch, separatorImages, letters) {
    var letter = letters ? letterFile(ch) : null;
    if (letter) return { tag: "IMG", cls: "ossuary-number-font__letter", src: srcFor(LETTERS_PATH + letter) };
    if (separatorImages && SEPARATOR_FILES[ch]) {
      return { tag: "IMG", cls: "ossuary-number-font__sep", src: srcFor(BASE_PATH + SEPARATOR_FILES[ch]) };
    }
    if (ch >= "0" && ch <= "9") {
      return { tag: "IMG", cls: "ossuary-number-font__digit", src: srcFor(BASE_PATH + ch + ".png") };
    }
    // Espacio real para que no colapse en el layout inline.
    return { tag: "SPAN", cls: "ossuary-number-font__sym", text: ch === " " ? NBSP : ch };
  }

  function createGlyph(glyph, ch) {
    var node = document.createElement(glyph.tag === "IMG" ? "img" : "span");
    node.className = glyph.cls;
    if (glyph.tag === "IMG") {
      node.src = glyph.src;
      node.alt = ch;
      node.draggable = false;
    } else {
      node.textContent = glyph.text;
    }
    return node;
  }

  // Pinta en `el` la representacion de `text`. Los digitos son
  // <img class="ossuary-number-font__digit">; con options.separatorImages, la
  // coma y el punto son <img class="ossuary-number-font__sep">; con
  // options.letters, las letras horneadas y el punto medio son
  // <img class="ossuary-number-font__letter">; lo demas, <span>.
  // Reaprovecha los nodos que ya estan (mismo tipo y clase) y solo cambia la
  // imagen de los que cambian: el contador BIG WIN repinta en cada fotograma.
  function render(el, text, options) {
    if (!el) return;
    el.classList.add("ossuary-number-font");
    var separatorImages = Boolean(options && options.separatorImages);
    var letters = Boolean(options && options.letters);
    var str = String(text == null ? "" : text);
    // Texto suelto de antes (p.ej. la etiqueta escrita en el HTML): fuera.
    if (el.childNodes.length !== el.children.length) el.replaceChildren();
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      var glyph = glyphFor(ch, separatorImages, letters);
      var node = el.children[i];
      if (!node || node.tagName !== glyph.tag || node.className !== glyph.cls) {
        var fresh = createGlyph(glyph, ch);
        if (node) el.replaceChild(fresh, node);
        else el.appendChild(fresh);
      } else if (glyph.tag === "IMG") {
        if (node.getAttribute("src") !== glyph.src) node.src = glyph.src;
        if (node.alt !== ch) node.alt = ch;
      } else if (node.textContent !== glyph.text) {
        node.textContent = glyph.text;
      }
    }
    while (el.children.length > str.length) el.removeChild(el.lastElementChild);
  }

  window.OssuaryNumberFont = {
    preload: preload,
    preloadLetters: preloadLetters,
    render: render,
    canRenderLetters: canRenderLetters
  };
})();
