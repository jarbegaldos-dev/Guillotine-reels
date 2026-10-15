// Hornea letras de oro cincelado a juego con las cifras del contador BIG WIN
// (assets/fonts/numbers/0-9.png, que son imagenes y no traen letras).
//
//   node tools/bake-letter-font.js
//
// Salida: assets/fonts/letters/<LETRA>.png, play.png (triangulo de play) y
// middot.png (punto medio), con el mismo alto (464px), linea base y margenes
// que las cifras, para pintarse juntas con OssuaryNumberFont.render(...,
// { letters: true }).
//
// Las letras se dibujan como poligonos con el lenguaje de las cifras (trazos
// gruesos, esquinas en chaflan, remates en cuna, picos en las barras) y se
// iluminan como metal cincelado: cara plana moteada, bisel de anchura fija
// (distancia al borde), filo brillante entre cara y bisel, borde oscuro,
// picaduras y grietas. Luz de arriba-izquierda.
//
// Solo hay las letras que usa el juego hoy (PLAY, FREE SPIN, CHANCES). Para
// anadir una: definir su poligono en GLYPHS y volver a hornear.
"use strict";

const path = require("path");
const fs = require("fs");
const { Jimp } = require("jimp");

const OUT_DIR = path.join(__dirname, "..", "assets", "fonts", "letters");
const SS = 2; // supermuestreo
const CANVAS_H = 464; // alto de las cifras
const TOP = 12; // y de la parte alta de la letra
const MARGIN = 6; // margen lateral (como las cifras)
const BEVEL = 27; // ancho del bisel (unidades = px a 1x)

// Unidades: alto de mayuscula 440 (y=0 arriba, y=440 linea base).
// add: poligonos que suman; cut: huecos (contrapunzones).
const GLYPHS = {
  A: {
    w: 300,
    add: [[[92, 38], [138, 0], [120, 64]], [[126, 0], [174, 0], [286, 396], [306, 440], [184, 440], [212, 404], [191, 330], [109, 330], [88, 404], [116, 440], [-6, 440], [14, 396]]],
    cut: [[[150, 184], [174, 262], [126, 262]]]
  },
  C: {
    w: 236,
    add: [[[52, 0], [236, 0], [236, 120], [190, 72], [110, 72], [82, 100], [82, 340], [110, 368], [190, 368], [236, 320], [236, 440], [52, 440], [0, 388], [0, 52]]]
  },
  E: {
    w: 234,
    add: [[[0, 50], [44, 0], [234, 0], [234, 128], [192, 72], [108, 72], [108, 182], [170, 182], [198, 218], [170, 254], [108, 254], [108, 370], [178, 370], [236, 304], [236, 440], [-4, 440], [28, 392], [28, 80]]]
  },
  F: {
    w: 234,
    add: [[[0, 50], [44, 0], [234, 0], [234, 128], [192, 72], [108, 72], [108, 182], [170, 182], [198, 218], [170, 254], [108, 254], [108, 392], [140, 440], [-4, 440], [28, 392], [28, 80]]]
  },
  H: {
    w: 300,
    add: [[[0, 50], [44, 0], [108, 0], [108, 184], [192, 184], [192, 0], [256, 0], [300, 50], [272, 80], [272, 392], [304, 440], [160, 440], [192, 392], [192, 256], [108, 256], [108, 392], [140, 440], [-4, 440], [28, 392], [28, 80]]]
  },
  I: {
    w: 136,
    add: [[[0, 50], [44, 0], [108, 0], [108, 392], [140, 440], [-4, 440], [28, 392], [28, 80]]]
  },
  L: {
    w: 232,
    add: [[[0, 50], [44, 0], [108, 0], [108, 370], [178, 370], [236, 304], [236, 440], [-4, 440], [28, 392], [28, 80]]]
  },
  N: {
    w: 300,
    add: [
      [[0, 50], [44, 0], [108, 0], [108, 392], [140, 440], [-4, 440], [28, 392], [28, 80]],
      [[192, 0], [256, 0], [300, 50], [272, 80], [272, 392], [304, 440], [192, 440]],
      [[28, 0], [100, 0], [272, 404], [272, 440], [200, 440], [28, 40]]
    ]
  },
  P: {
    w: 252,
    add: [[[0, 50], [44, 0], [196, 0], [250, 62], [250, 176], [196, 236], [108, 236], [108, 392], [140, 440], [-4, 440], [28, 392], [28, 80]]],
    cut: [[[108, 72], [168, 72], [182, 88], [182, 150], [168, 166], [108, 166]]]
  },
  R: {
    w: 282,
    add: [
      [[0, 50], [44, 0], [196, 0], [250, 62], [250, 176], [196, 236], [108, 236], [108, 392], [140, 440], [-4, 440], [28, 392], [28, 80]],
      [[150, 224], [228, 224], [262, 392], [288, 440], [172, 440], [190, 404]]
    ],
    cut: [[[108, 72], [168, 72], [182, 88], [182, 150], [168, 166], [108, 166]]]
  },
  S: {
    w: 242,
    add: [[[52, 0], [238, 0], [238, 118], [192, 72], [110, 72], [84, 98], [84, 138], [108, 162], [184, 162], [240, 218], [240, 384], [184, 440], [4, 440], [4, 322], [48, 368], [130, 368], [156, 342], [156, 270], [130, 244], [52, 244], [0, 192], [0, 52]]]
  },
  Y: {
    w: 300,
    add: [[[0, 0], [84, 0], [150, 138], [216, 0], [300, 0], [300, 14], [190, 250], [190, 392], [222, 440], [78, 440], [110, 392], [110, 250], [0, 14]]]
  },
  middot: {
    w: 110,
    add: [[[55, 172], [103, 220], [55, 268], [7, 220]]]
  },
  play: {
    w: 300,
    add: [[[16, 44], [44, 8], [296, 198], [296, 242], [44, 432], [16, 396]]]
  }
};

// --- ruido -----------------------------------------------------------------
function hash(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, seed, oct) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < oct; i++) { sum += amp * valueNoise(x * f, y * f, seed + i * 17); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
function rand(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// --- geometria -------------------------------------------------------------
function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Distancia euclidea exacta (Felzenszwalb) de cada pixel interior al exterior.
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    while (true) {
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      if (s <= z[k]) { k--; continue; }
      break;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
function distanceInside(mask, w, h) {
  const INF = 1e12, grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = mask[i] ? INF : 0;
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) grid[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]); }
  return grid;
}

// --- color -----------------------------------------------------------------
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (t) => Math.max(0, Math.min(1, t));
// Colores medidos sobre las cifras (cara #c1792b..#efae5c, contorno #251102).
const FACE_DARK = hex("#8a4206");
const FACE_MID = hex("#c96a10");
const FACE_LIGHT = hex("#f29a32");
const GLINT = hex("#ffc35a");
const BEVEL_DARK = hex("#170801");
const BEVEL_LIGHT = hex("#f2a24a");
const RIM = hex("#ffe8b4");
const EDGE = hex("#1c0b02");
const PIT = hex("#3d1c04");
const SIDE = hex("#2b1305"); // grosor (extrusion) abajo-derecha
const LIGHT = (() => { const l = Math.hypot(-0.65, -1); return [-0.65 / l, -1 / l]; })();
const EXTRUDE = [4, 6]; // unidades
const OUTLINE = 2.2; // contorno oscuro por fuera

function bakeGlyph(name, glyph, seedBase) {
  const W1 = glyph.w + MARGIN * 2;
  const w = W1 * SS, h = CANVAS_H * SS;
  const shapeAt = (ux, uy) => {
    let inside = glyph.add.some((p) => inPoly(p, ux, uy));
    if (inside && glyph.cut) inside = !glyph.cut.some((p) => inPoly(p, ux, uy));
    return inside;
  };
  const mask = new Uint8Array(w * h);
  const side = new Uint8Array(w * h);
  for (let py = 0; py < h; py++) {
    const uy = (py + 0.5) / SS - TOP;
    for (let px = 0; px < w; px++) {
      const ux = (px + 0.5) / SS - MARGIN;
      mask[py * w + px] = shapeAt(ux, uy) ? 1 : 0;
      side[py * w + px] = shapeAt(ux - EXTRUDE[0], uy - EXTRUDE[1]) ? 1 : 0;
    }
  }
  // El grosor sale de la letra en diagonal: une la letra con su copia.
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const i = py * w + px;
    if (side[i] || mask[i]) continue;
    for (let t = 0.25; t < 1; t += 0.25) {
      const sx = Math.round(px - EXTRUDE[0] * SS * t), sy = Math.round(py - EXTRUDE[1] * SS * t);
      if (sx >= 0 && sy >= 0 && mask[sy * w + sx]) { side[i] = 1; break; }
    }
  }
  const dist = distanceInside(mask, w, h); // px de supermuestreo
  const outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) outside[i] = mask[i] ? 0 : 1;
  const distOut = distanceInside(outside, w, h);
  const seed = seedBase;

  // Grietas finas que nacen en la cara.
  const crack = new Float32Array(w * h);
  const rnd = rand(seed * 7919 + 13);
  const faceCells = [];
  for (let i = 0; i < w * h; i++) if (dist[i] / SS > BEVEL + 4) faceCells.push(i);
  const nCracks = Math.round(faceCells.length / (SS * SS) / 3800) + 3;
  for (let c = 0; c < nCracks && faceCells.length; c++) {
    const start = faceCells[Math.floor(rnd() * faceCells.length)];
    let x = start % w, y = Math.floor(start / w);
    let ang = rnd() * Math.PI * 2;
    const segs = 2 + Math.floor(rnd() * 4);
    for (let s = 0; s < segs; s++) {
      ang += (rnd() - 0.5) * 1.4;
      const len = (6 + rnd() * 16) * SS;
      for (let t = 0; t < len; t += 0.5) {
        const cx = Math.round(x + Math.cos(ang) * t), cy = Math.round(y + Math.sin(ang) * t);
        if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= h - 1 || !mask[cy * w + cx]) break;
        const k = cy * w + cx;
        crack[k] = Math.max(crack[k], 1 - (t / len) * 0.5);
        crack[k + 1] = Math.max(crack[k + 1], 0.4);
      }
      x += Math.cos(ang) * len; y += Math.sin(ang) * len;
    }
  }

  // Pendiente del campo de distancia, suavizada (sin escalones en diagonal).
  const gxA = new Float32Array(w * h), gyA = new Float32Array(w * h);
  for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) {
    const i = py * w + px;
    gxA[i] = (dist[i + 1] - dist[i - 1]) / 2; gyA[i] = (dist[i + w] - dist[i - w]) / 2;
  }
  const blur = (src) => {
    const R = 3, tmp = new Float32Array(w * h), dst = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0, n = 0; for (let k = -R; k <= R; k++) { const xx = x + k; if (xx < 0 || xx >= w || !mask[y * w + xx]) continue; a += src[y * w + xx]; n++; } tmp[y * w + x] = n ? a / n : 0; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0, n = 0; for (let k = -R; k <= R; k++) { const yy = y + k; if (yy < 0 || yy >= h || !mask[yy * w + x]) continue; a += tmp[yy * w + x]; n++; } dst[y * w + x] = n ? a / n : 0; }
    return dst;
  };
  const gxS = blur(gxA), gyS = blur(gyA);

  const out = new Float32Array(w * h * 4);
  for (let py = 1; py < h - 1; py++) {
    for (let px = 1; px < w - 1; px++) {
      const i = py * w + px;
      const ux = px / SS, uy = py / SS;
      const vert = 1.08 - 0.16 * clamp01((uy - TOP) / 440);
      let col, alpha = 255;
      if (mask[i]) {
        const d = dist[i] / SS;
        const gx = gxS[i], gy = gyS[i];
        const gl = Math.hypot(gx, gy) || 1;
        const facing = (-gx / gl) * LIGHT[0] + (-gy / gl) * LIGHT[1]; // -1..1
        const broad = fbm(ux / 40, uy / 40, seed + 3, 3);
        const mid = fbm(ux / 11, uy / 11, seed + 9, 3);
        const grain = fbm(ux / 2.6, uy / 2.6, seed + 41, 2);
        if (d < BEVEL) {
          const t = clamp01(0.5 + 0.6 * facing);
          col = mix(BEVEL_DARK, BEVEL_LIGHT, Math.pow(t, 1.9));
          // filo claro en el canto de fuera del lado de la luz
          if (d > 1.2 && d < 3.6 && facing > 0.2) col = mix(col, GLINT, (1 - Math.abs(d - 2.4) / 1.2) * 0.55 * facing);
          // el bisel se oscurece hacia el borde de fuera
          col = col.map((c) => c * (0.72 + 0.28 * (d / BEVEL)) * (0.86 + 0.26 * mid));
          if (d < 2.2) col = mix(col, EDGE, ((2.2 - d) / 2.2) * 0.9);
        } else {
          // Metal pulido: manchas anchas + vetas casi verticales + reflejos.
          const streak = fbm(ux / 26, uy / 110, seed + 21, 3);
          const m = clamp01((broad - 0.32) * 1.7 + (streak - 0.5) * 1.1);
          col = m < 0.5 ? mix(FACE_DARK, FACE_MID, m * 2) : mix(FACE_MID, FACE_LIGHT, (m - 0.5) * 2);
          col = col.map((c) => c * (0.94 + 0.1 * (mid - 0.5) + 0.08 * (grain - 0.5)));
          if (streak > 0.6) col = mix(col, GLINT, clamp01((streak - 0.6) / 0.12) * 0.35);
          const pit = fbm(ux / 4.2, uy / 4.2, seed + 77, 2);
          if (pit > 0.83) col = mix(col, PIT, clamp01((pit - 0.83) / 0.05) * 0.7);
          // La cara se oscurece hacia sus bordes (centro mas brillante).
          col = col.map((c) => c * (0.74 + 0.26 * clamp01((d - BEVEL) / 16)));
        }
        const rimD = Math.abs(d - BEVEL);
        if (rimD < 2) col = mix(col, RIM, (1 - rimD / 2) * (0.45 + 0.55 * clamp01(facing + 0.3)));
        if (crack[i] > 0) col = mix(col, PIT, crack[i] * 0.9);
        else if (crack[i - w - 1] > 0.5 || crack[i - w] > 0.5) col = mix(col, RIM, 0.3);
        col = col.map((c) => Math.min(255, c * vert));
      } else if (side[i]) {
        col = SIDE.map((c) => c * (0.8 + 0.3 * fbm(ux / 9, uy / 9, seed + 5, 2)));
      } else {
        const dO = distOut[i] / SS;
        if (dO > OUTLINE) continue;
        col = EDGE;
        alpha = 255 * clamp01(OUTLINE - dO + 0.5) * 0.85;
      }
      out[i * 4] = col[0]; out[i * 4 + 1] = col[1]; out[i * 4 + 2] = col[2]; out[i * 4 + 3] = alpha;
    }
  }

  // Reduccion 2x2 (premultiplicada) -> antialias.
  const img = new Jimp({ width: W1, height: CANVAS_H, color: 0x00000000 });
  const data = img.bitmap.data;
  for (let y = 0; y < CANVAS_H; y++) {
    for (let x = 0; x < W1; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const k = ((y * SS + sy) * w + x * SS + sx) * 4;
        const al = out[k + 3] / 255;
        r += out[k] * al; g += out[k + 1] * al; b += out[k + 2] * al; a += al;
      }
      const o = (y * W1 + x) * 4;
      if (a > 0) { data[o] = r / a; data[o + 1] = g / a; data[o + 2] = b / a; }
      data[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return img;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const names = Object.keys(GLYPHS);
  for (let n = 0; n < names.length; n++) {
    const name = names[n];
    const img = bakeGlyph(name, GLYPHS[name], 101 + n * 31);
    const file = path.join(OUT_DIR, name + ".png");
    await img.write(file);
    console.log("ok", path.relative(process.cwd(), file), img.bitmap.width + "x" + img.bitmap.height);
  }
})();
