#!/usr/bin/env node
"use strict";

// Genera el CUERVO DORADO de los rodillos (simbolo GOLDEN_CROW) desde el
// cuervo con profundidad horneada:
//
//   node tools/bake-golden-crow.js
//
// Entrada: assets/symbols/depth/bird.png. Salida:
// assets/symbols/depth/bird-golden.png (mismo tamano y alfa). Aplica a cada
// pixel la MISMA cadena de filtro que el cuervo dorado posado
// (src/fx/raven-bonus.css: grayscale, sepia, saturate, hue-rotate,
// brightness, contrast), un poco mas luminosa para que destaque en la
// casilla: oro amarillo puro con sombras naranjas. Va horneado (no como
// filtro CSS) porque la ficha se mueve en cada fotograma mientras gira el
// rodillo. Si cambia el cuervo, volver a ejecutarlo.

const path = require("path");
const { Jimp } = require("jimp");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets", "symbols", "depth", "bird.png");
const OUT = path.join(ROOT, "assets", "symbols", "depth", "bird-golden.png");

const SATURATE = 5.5;
const HUE_DEG = -4;
const BRIGHTNESS = 1.9;
const CONTRAST = 1.35;

const clamp = (v) => Math.max(0, Math.min(1, v));

function apply(m, c) {
  return [
    m[0] * c[0] + m[1] * c[1] + m[2] * c[2],
    m[3] * c[0] + m[4] * c[1] + m[5] * c[2],
    m[6] * c[0] + m[7] * c[1] + m[8] * c[2]
  ].map(clamp);
}

// Matrices de los filtros CSS (Filter Effects).
const GRAYSCALE = [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722];
const SEPIA = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];

function saturate(s) {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s
  ];
}

function hueRotate(deg) {
  const a = deg * Math.PI / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072
  ];
}

function gold(rgb) {
  let c = apply(GRAYSCALE, rgb);
  c = apply(SEPIA, c);
  c = apply(saturate(SATURATE), c);
  c = apply(hueRotate(HUE_DEG), c);
  c = c.map((v) => clamp(v * BRIGHTNESS));
  return c.map((v) => clamp((v - 0.5) * CONTRAST + 0.5));
}

async function main() {
  const img = await Jimp.read(SRC);
  const data = img.bitmap.data;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] === 0) continue;
    const c = gold([data[p] / 255, data[p + 1] / 255, data[p + 2] / 255]);
    data[p] = Math.round(c[0] * 255);
    data[p + 1] = Math.round(c[1] * 255);
    data[p + 2] = Math.round(c[2] * 255);
  }
  await img.write(OUT);
  console.log("Cuervo dorado generado: " + path.relative(ROOT, OUT));
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
