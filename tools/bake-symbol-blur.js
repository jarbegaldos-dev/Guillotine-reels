"use strict";

// Hornea el desenfoque de movimiento de los simbolos (assets/symbols/blur/):
// mientras un rodillo gira rapido, sus fichas cambian el arte por esta
// version borrosa (src/render/reel-renderer.js, syncTileMotionBlur) y al
// frenar vuelven al nitido. Asi no hay filtros en vivo en el giro.
//
// Dos versiones por simbolo, segun el sentido del giro:
// - h/: estela horizontal (rib1 y las costillas, que giran de lado);
// - v/: estela vertical (el esternon).
//
// Sale de la version con profundidad (assets/symbols/depth/), reducida a
// SIZE px (la ficha se pinta a ~110 px; borrosa no necesita mas detalle) y
// con el mismo encuadre, para que encaje exactamente donde el nitido.
//
// Uso: node tools/bake-symbol-blur.js

const fs = require("fs");
const path = require("path");
const { Jimp } = require("jimp");

const root = path.resolve(__dirname, "..");
const SYMBOLS = [
  "small-blade",
  "petrified-heart",
  "gold-coin",
  "bird",
  "bird-golden",
  "broken-bone",
  "wild",
  "silver-coin",
  "ancestral-skull"
];

const SIZE = 256;
// Largo de la estela en fraccion del simbolo. Dos pasadas de caja de este
// largo dan un perfil triangular (mas denso en el centro, sin bordes duros).
const STREAK = 0.11;
// Un poco de transparencia: lo que pasa rapido se ve menos solido.
const ALPHA = 0.94;

// Desenfoque de caja en un eje sobre RGBA premultiplicado (sin halos negros
// en los bordes transparentes).
function boxBlurAxis(src, w, h, radius, horizontal) {
  const out = new Float32Array(src.length);
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const win = radius * 2 + 1;
  for (let line = 0; line < lines; line++) {
    const sum = [0, 0, 0, 0];
    const idx = (i) => {
      const c = Math.min(len - 1, Math.max(0, i));
      // Fuera del lienzo cuenta como transparente, no como el borde.
      if (i < 0 || i >= len) return -1;
      return horizontal ? (line * w + c) * 4 : (c * w + line) * 4;
    };
    for (let i = -radius; i <= radius; i++) {
      const p = idx(i);
      if (p < 0) continue;
      for (let k = 0; k < 4; k++) sum[k] += src[p + k];
    }
    for (let i = 0; i < len; i++) {
      const o = horizontal ? (line * w + i) * 4 : (i * w + line) * 4;
      for (let k = 0; k < 4; k++) out[o + k] = sum[k] / win;
      const add = idx(i + radius + 1);
      const sub = idx(i - radius);
      if (add >= 0) for (let k = 0; k < 4; k++) sum[k] += src[add + k];
      if (sub >= 0) for (let k = 0; k < 4; k++) sum[k] -= src[sub + k];
    }
  }
  return out;
}

async function bake(name) {
  const input = path.join(root, "assets/symbols/depth", name + ".png");
  const img = await Jimp.read(input);
  img.resize({ w: SIZE, h: Math.round(SIZE * img.bitmap.height / img.bitmap.width) });
  const { width: w, height: h, data } = img.bitmap;

  const pre = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    pre[i] = data[i] * a;
    pre[i + 1] = data[i + 1] * a;
    pre[i + 2] = data[i + 2] * a;
    pre[i + 3] = data[i + 3];
  }

  for (const dir of ["h", "v"]) {
    const horizontal = dir === "h";
    const radius = Math.max(1, Math.round((horizontal ? w : h) * STREAK / 2));
    let buf = boxBlurAxis(pre, w, h, radius, horizontal);
    buf = boxBlurAxis(buf, w, h, radius, horizontal);
    const out = new Jimp({ width: w, height: h });
    const od = out.bitmap.data;
    for (let i = 0; i < buf.length; i += 4) {
      const a = buf[i + 3];
      if (a <= 0.5) continue;
      const inv = 255 / a;
      od[i] = Math.min(255, Math.round(buf[i] * inv));
      od[i + 1] = Math.min(255, Math.round(buf[i + 1] * inv));
      od[i + 2] = Math.min(255, Math.round(buf[i + 2] * inv));
      od[i + 3] = Math.min(255, Math.round(a * ALPHA));
    }
    const dirPath = path.join(root, "assets/symbols/blur", dir);
    fs.mkdirSync(dirPath, { recursive: true });
    const file = path.join(dirPath, name + ".png");
    await out.write(file);
    console.log(path.relative(root, file), Math.round(fs.statSync(file).size / 1024) + " KB");
  }
}

(async () => {
  for (const name of SYMBOLS) await bake(name);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
