#!/usr/bin/env node
"use strict";

// Quita restos de croma verde del contorno de PNG con transparencia (arte
// recortado sobre fondo verde). Solo toca los pixeles a <= EDGE_PX del fondo
// transparente: si el verde domina (G > max(R, B)), lo baja a max(R, B). El
// interior del dibujo no cambia. Mismo criterio que la correccion de
// bird.png / bird-dead.png del 2026-10-06.
//
//   node tools/despill-edges.js <archivo.png> [mas archivos...]
//
// Antes de escribir guarda el original en _backups/despill_<fecha>/ con su
// ruta relativa. Imprime cuantos pixeles ha corregido en cada archivo.

const fs = require("fs");
const path = require("path");
const { Jimp } = require("jimp");

const EDGE_PX = 5;
const TRANSPARENT_ALPHA = 30;
const ROOT = path.join(__dirname, "..");

function edgeDistance(data, width, height) {
  // Distancia (en pasos de 4-vecinos, hasta EDGE_PX) al pixel transparente
  // mas cercano. BFS multi-origen.
  const dist = new Int16Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3] < TRANSPARENT_ALPHA) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    if (d >= EDGE_PX) continue;
    const x = i % width;
    const y = (i - x) / width;
    const next = [];
    if (x > 0) next.push(i - 1);
    if (x < width - 1) next.push(i + 1);
    if (y > 0) next.push(i - width);
    if (y < height - 1) next.push(i + width);
    for (const j of next) {
      if (dist[j] !== -1) continue;
      dist[j] = d + 1;
      queue[tail++] = j;
    }
  }
  return dist;
}

async function despill(file) {
  const abs = path.resolve(file);
  const img = await Jimp.read(abs);
  const { width, height, data } = img.bitmap;
  const dist = edgeDistance(data, width, height);
  let fixed = 0;
  for (let i = 0; i < width * height; i++) {
    const d = dist[i];
    // Tambien los casi transparentes del borde (el halo mas externo).
    if (d < 0 || data[i * 4 + 3] === 0) continue;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const limit = Math.max(r, b);
    if (g > limit) {
      data[i * 4 + 1] = limit;
      fixed++;
    }
  }
  if (!fixed) return { file, fixed };
  const stamp = new Date().toISOString().slice(0, 10);
  const backup = path.join(ROOT, "_backups", "despill_" + stamp, path.relative(ROOT, abs));
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.copyFileSync(abs, backup);
  await img.write(abs);
  return { file, fixed };
}

(async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.log("Uso: node tools/despill-edges.js <archivo.png> [...]");
    process.exit(1);
  }
  for (const file of files) {
    const result = await despill(file);
    console.log(result.file + ": " + result.fixed + " pixeles corregidos");
  }
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
