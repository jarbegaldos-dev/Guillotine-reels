"use strict";

// Hornea la profundidad de los simbolos normales en PNG nuevos
// (assets/symbols/depth/), para que no haya que calcular filtros en cada
// fotograma del giro. Los originales no se tocan.
//
// Tres efectos, nitidos y sin halos:
// - Bisel: la luz de arriba a la izquierda (la luna) aclara los bordes que
//   miran hacia ella y oscurece los de abajo a la derecha, siempre por dentro
//   del contorno. Brillo especular suave en los cantos iluminados.
// - Luz interior: todo el simbolo algo mas claro arriba a la izquierda y mas
//   oscuro abajo a la derecha, como un objeto con volumen bajo esa luz.
// - Grosor: debajo del simbolo, copias oscurecidas de su propio color
//   desplazadas hacia abajo a la derecha, como el canto de una moneda.
//
// Las medidas estan en "px de pantalla" de una ficha de ~110 px de alto y se
// escalan al tamano real de cada PNG, asi que todos los simbolos quedan igual.
//
// Uso: node tools/bake-symbol-depth.js

const path = require("path");
const { Jimp } = require("jimp");

const root = path.resolve(__dirname, "..");
const SYMBOLS = [
  "small-blade",
  "petrified-heart",
  "gold-coin",
  "bird",
  "broken-bone",
  "wild",
  "silver-coin",
  "ancestral-skull"
];

// Intensidad global del efecto: 1 = la version fuerte (canto 4.6 x 6 px,
// bisel 7, luz interior x1.12 / x0.74). Escala a la vez el canto, la altura
// del bisel, el brillo y la luz interior. El usuario la quiso al 25%.
const DEPTH_STRENGTH = 0.25;

const DISPLAY_SIZE = 110; // alto aproximado de la ficha en pantalla a 900 px
const BEVEL_BLUR = 2.8; // px de pantalla: ancho del bisel
const SURFACE_SCALE = 7 * DEPTH_STRENGTH; // altura del bisel
const LIGHT_AZIMUTH = 225; // grados; con y hacia abajo, 225 = arriba a la izquierda
const LIGHT_ELEVATION = 34; // mas baja = mas contraste entre canto iluminado y en sombra
const SPECULAR_STRENGTH = 0.6 * DEPTH_STRENGTH;
const SPECULAR_EXPONENT = 20;
const SPECULAR_COLOR = [1, 0.94, 0.86];
// Luz interior: multiplica el color de todo el simbolo de arriba a la
// izquierda (INTERIOR_LIT) a abajo a la derecha (INTERIOR_SHADE), medido
// sobre la caja del arte.
const INTERIOR_LIT = 1 + 0.12 * DEPTH_STRENGTH;
const INTERIOR_SHADE = 1 - 0.26 * DEPTH_STRENGTH;
// Grosor: canto hasta THICKNESS_DX/DY px de pantalla, en THICKNESS_STEPS
// capas que se oscurecen de NEAR (pegada al simbolo) a FAR (fondo del canto).
const THICKNESS_DX = 4.6 * DEPTH_STRENGTH;
const THICKNESS_DY = 6 * DEPTH_STRENGTH;
const THICKNESS_STEPS = Math.max(3, Math.round(11 * DEPTH_STRENGTH));
const THICKNESS_TINT_NEAR = [0.62, 0.55, 0.5];
const THICKNESS_TINT_FAR = [0.2, 0.17, 0.15];
const THICKNESS_LAYERS = Array.from({ length: THICKNESS_STEPS }, (_, i) => {
  const t = (i + 1) / THICKNESS_STEPS;
  const k = i / Math.max(1, THICKNESS_STEPS - 1);
  return {
    dx: THICKNESS_DX * t,
    dy: THICKNESS_DY * t,
    tint: THICKNESS_TINT_NEAR.map((near, c) => near + (THICKNESS_TINT_FAR[c] - near) * k)
  };
});

function gaussianKernel(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  return { kernel, radius };
}

function blur(src, w, h, sigma) {
  const { kernel, radius } = gaussianKernel(sigma);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        acc += src[y * w + xx] * kernel[k + radius];
      }
      tmp[y * w + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        acc += tmp[yy * w + x] * kernel[k + radius];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

// Muestreo bilineal de un canal RGBA (0..1, sin premultiplicar) con fuera = 0.
function sampleBilinear(rgba, w, h, x, y, out) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  out[0] = out[1] = out[2] = out[3] = 0;
  const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  const coords = [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]];
  // Premultiplicado para que los bordes no se ensucien.
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = coords[i];
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const p = (cy * w + cx) * 4;
    const a = rgba[p + 3] * weights[i];
    out[0] += rgba[p] * a;
    out[1] += rgba[p + 1] * a;
    out[2] += rgba[p + 2] * a;
    out[3] += a;
  }
  if (out[3] > 0) {
    out[0] /= out[3];
    out[1] /= out[3];
    out[2] /= out[3];
  }
}

function over(dst, p, r, g, b, a) {
  // dst sin premultiplicar; "source over" con la nueva capa ENCIMA.
  const da = dst[p + 3];
  const oa = a + da * (1 - a);
  if (oa <= 0) {
    dst[p] = dst[p + 1] = dst[p + 2] = dst[p + 3] = 0;
    return;
  }
  dst[p] = (r * a + dst[p] * da * (1 - a)) / oa;
  dst[p + 1] = (g * a + dst[p + 1] * da * (1 - a)) / oa;
  dst[p + 2] = (b * a + dst[p + 2] * da * (1 - a)) / oa;
  dst[p + 3] = oa;
}

async function bake(name) {
  const srcPath = path.join(root, "assets", "symbols", name + ".png");
  const outPath = path.join(root, "assets", "symbols", "depth", name + ".png");
  const image = await Jimp.read(srcPath);
  const { width: w, height: h, data } = image.bitmap;
  const scale = Math.min(w, h) / DISPLAY_SIZE; // px del PNG por px de pantalla
  const n = w * h;

  const src = new Float32Array(n * 4);
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    src[i * 4] = data[i * 4] / 255;
    src[i * 4 + 1] = data[i * 4 + 1] / 255;
    src[i * 4 + 2] = data[i * 4 + 2] / 255;
    src[i * 4 + 3] = data[i * 4 + 3] / 255;
    alpha[i] = src[i * 4 + 3];
  }

  // Caja del arte (sin el margen transparente) para la luz interior.
  let artX0 = w, artY0 = h, artX1 = 0, artY1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] <= 0.03) continue;
      if (x < artX0) artX0 = x;
      if (x > artX1) artX1 = x;
      if (y < artY0) artY0 = y;
      if (y > artY1) artY1 = y;
    }
  }
  const artW = Math.max(1, artX1 - artX0);
  const artH = Math.max(1, artY1 - artY0);

  // --- Bisel ---------------------------------------------------------------
  const height = blur(alpha, w, h, BEVEL_BLUR * scale);
  const az = (LIGHT_AZIMUTH * Math.PI) / 180;
  const el = (LIGHT_ELEVATION * Math.PI) / 180;
  const L = [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
  const Hl = [L[0], L[1], L[2] + 1];
  const hLen = Math.hypot(Hl[0], Hl[1], Hl[2]);
  const H = [Hl[0] / hLen, Hl[1] / hLen, Hl[2] / hLen];
  const flat = Math.sin(el); // luz difusa de una zona plana: se normaliza a 1

  const beveled = new Float32Array(n * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      const a = src[p + 3];
      beveled[p + 3] = a;
      if (a <= 0) continue;
      const xl = height[y * w + Math.max(0, x - 1)];
      const xr = height[y * w + Math.min(w - 1, x + 1)];
      const yu = height[Math.max(0, y - 1) * w + x];
      const yd = height[Math.min(h - 1, y + 1) * w + x];
      // Pendiente por px de pantalla.
      const gx = ((xr - xl) / 2) * scale;
      const gy = ((yd - yu) / 2) * scale;
      let nx = -2 * SURFACE_SCALE * gx;
      let ny = -2 * SURFACE_SCALE * gy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const diffuse = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) / flat;
      const spec = SPECULAR_STRENGTH * Math.pow(Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]), SPECULAR_EXPONENT);
      const t = Math.min(1, Math.max(0, ((x - artX0) / artW + (y - artY0) / artH) / 2));
      const interior = INTERIOR_LIT + (INTERIOR_SHADE - INTERIOR_LIT) * t;
      for (let c = 0; c < 3; c++) {
        beveled[p + c] = Math.min(1, src[p + c] * diffuse * interior + spec * SPECULAR_COLOR[c]);
      }
    }
  }

  // --- Grosor + simbolo encima --------------------------------------------
  const out = new Float32Array(n * 4);
  const sample = new Float32Array(4);
  for (let l = THICKNESS_LAYERS.length - 1; l >= 0; l--) {
    const layer = THICKNESS_LAYERS[l];
    const ox = layer.dx * scale;
    const oy = layer.dy * scale;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        sampleBilinear(src, w, h, x - ox, y - oy, sample);
        if (sample[3] <= 0) continue;
        over(out, (y * w + x) * 4,
          sample[0] * layer.tint[0], sample[1] * layer.tint[1], sample[2] * layer.tint[2], sample[3]);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (beveled[p + 3] <= 0) continue;
    over(out, p, beveled[p], beveled[p + 1], beveled[p + 2], beveled[p + 3]);
  }

  for (let i = 0; i < n * 4; i++) {
    data[i] = Math.max(0, Math.min(255, Math.round(out[i] * 255)));
  }
  await image.write(outPath);
  console.log("ok", name, w + "x" + h, "escala", scale.toFixed(2));
}

(async () => {
  for (const name of SYMBOLS) await bake(name);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
