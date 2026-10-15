"use strict";

// Genera las texturas de humo que van detras de cada simbolo
// (assets/effects/smoke/). PNG blanco con el humo en el alfa: el color se lo
// pone el CSS (mask-image).
//
// - Ruido fractal con el dominio deformado dos veces y estirado en una
//   direccion distinta en cada textura: jirones alargados, no manchas.
// - La silueta es la union de varios lobulos irregulares (uno en el centro,
//   detras del simbolo, y otros que se escapan hacia arriba, abajo, los
//   lados o en diagonal), cada uno con el borde ondulado por otro ruido:
//   nunca sale un circulo.
// - Todo se apaga antes del borde de la textura, asi que al moverla no se
//   ve ningun corte.
//
// Uso: node tools/bake-symbol-smoke.js

const path = require("path");
const fs = require("fs");
const { Jimp } = require("jimp");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "assets", "effects", "smoke");

// Lobulos en coordenadas de -1 a 1 sobre la textura: centro (x, y) y radios
// (rx, ry). El primero es el nucleo detras del simbolo. angle: direccion
// (grados) en la que se estiran los jirones.
const TEXTURES = [
  {
    name: "symbol-smoke-1", seed: 11, angle: 25,
    lobes: [[0, 0, 0.46, 0.46], [-0.42, -0.5, 0.41, 0.41], [0.55, 0.12, 0.41, 0.36]]
  },
  {
    name: "symbol-smoke-2", seed: 37, angle: 95,
    lobes: [[0.02, 0.02, 0.44, 0.46], [0, 0.56, 0.41, 0.41], [0.46, -0.44, 0.36, 0.38]]
  },
  {
    name: "symbol-smoke-3", seed: 73, angle: -20,
    lobes: [[0, 0, 0.48, 0.44], [-0.56, 0.04, 0.41, 0.38], [0.42, 0.5, 0.38, 0.38]]
  },
  {
    name: "symbol-smoke-4", seed: 101, angle: 70,
    lobes: [[0.03, 0, 0.44, 0.46], [0, -0.56, 0.43, 0.4], [-0.44, 0.46, 0.36, 0.36]]
  },
  {
    name: "symbol-smoke-5", seed: 151, angle: -55,
    lobes: [[0, 0.02, 0.46, 0.46], [0.5, -0.32, 0.46, 0.36], [-0.5, 0.36, 0.41, 0.36]]
  },
  {
    name: "symbol-smoke-6", seed: 199, angle: 140,
    lobes: [[0, 0, 0.46, 0.46], [-0.46, -0.46, 0.38, 0.38], [0.46, 0.46, 0.38, 0.38]]
  }
];

const WIDTH = 384;
const HEIGHT = 384;
const NOISE_SCALE_X = 1.3; // a lo largo del jiron: menos que a lo ancho
const NOISE_SCALE_Y = 2;
const OCTAVES = 4;
const WARP = 3; // cuanto se retuerce el humo
const DENSITY_LOW = 0.28; // por debajo: aire limpio
const DENSITY_HIGH = 0.9; // por encima: humo pleno
const SOFTEN = 5; // px de difuminado del alfa, para que el humo sea blando
const LOBE_JITTER = 0.32; // cuanto ondula el borde de cada lobulo
const LOBE_FADE_START = 0.35; // donde empieza a apagarse cada lobulo (fraccion del radio)
const BORDER_FADE = 0.14; // margen en el que todo se apaga hacia el borde de la textura

function makeNoise(seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  const grad = (h, x, y) => {
    switch (h & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  };
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const X = xi & 255;
    const Y = yi & 255;
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    return lerp(v,
      lerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf)),
      lerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1)));
  };
}

// Difuminado de caja separable (dos pasadas = casi gaussiano).
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = acc / size;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = acc / size;
    }
  }
  return out;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

async function bake(texture) {
  const w = WIDTH;
  const h = HEIGHT;
  const noise = makeNoise(texture.seed);
  const fbm = (x, y) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < OCTAVES; o++) {
      sum += amp * noise(x * freq, y * freq);
      freq *= 2.02;
      amp *= 0.5;
    }
    return sum;
  };

  const cosA = Math.cos((texture.angle * Math.PI) / 180);
  const sinA = Math.sin((texture.angle * Math.PI) / 180);
  const raw = new Float32Array(w * h);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Gira el dominio para que cada textura estire los jirones en su
      // direccion.
      const ux = x / w - 0.5;
      const uy = y / h - 0.5;
      const px = (cosA * ux + sinA * uy) * NOISE_SCALE_X * 2 + 10;
      const py = (-sinA * ux + cosA * uy) * NOISE_SCALE_Y * 2 + 10;
      const qx = fbm(px, py);
      const qy = fbm(px + 5.2, py + 1.3);
      const rx = fbm(px + WARP * qx + 1.7, py + WARP * qy + 9.2);
      const ry = fbm(px + WARP * qx + 8.3, py + WARP * qy + 2.8);
      const d = fbm(px + WARP * rx, py + WARP * ry);
      raw[y * w + x] = d;
      if (d < min) min = d;
      if (d > max) max = d;
    }
  }

  const image = new Jimp({ width: w, height: h, color: 0xffffff00 });
  const data = image.bitmap.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = (raw[y * w + x] - min) / (max - min);
      const density = smoothstep(DENSITY_LOW, DENSITY_HIGH, d);
      const u = (x / (w - 1)) * 2 - 1;
      const v = (y / (h - 1)) * 2 - 1;
      let shape = 0;
      texture.lobes.forEach(([cx, cy, rx, ry], index) => {
        const lu = (u - cx) / rx;
        const lv = (v - cy) / ry;
        const angle = Math.atan2(lv, lu);
        const wobble = noise(Math.cos(angle) * 1.6 + 3.1 + index * 4.3, Math.sin(angle) * 1.6 + 7.7 + index * 2.9);
        const radius = 1 + LOBE_JITTER * wobble;
        const lobe = 1 - smoothstep(radius * LOBE_FADE_START, radius, Math.hypot(lu, lv));
        // Los lobulos laterales llevan menos humo que el nucleo.
        shape = Math.max(shape, index === 0 ? lobe : lobe * 0.8);
      });
      const border = smoothstep(0, BORDER_FADE, 1 - Math.abs(u)) * smoothstep(0, BORDER_FADE, 1 - Math.abs(v));
      const p = (y * w + x) * 4;
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
      data[p + 3] = Math.round(255 * density * shape * border);
    }
  }
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];
  const soft = boxBlur(boxBlur(alpha, w, h, SOFTEN), w, h, SOFTEN);
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = Math.round(soft[i]);
  await image.write(path.join(outDir, texture.name + ".png"));
  console.log("ok", texture.name, w + "x" + h);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const texture of TEXTURES) await bake(texture);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
