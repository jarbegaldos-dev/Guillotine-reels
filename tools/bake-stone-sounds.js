#!/usr/bin/env node
"use strict";

// Genera por sintesis el sonido de la expectativa de la piedra del
// esqueleto (assets/audio/fx/), sin assets de partida:
//
//   node tools/bake-stone-sounds.js
//
// - stone_tension.wav (~1.3 s): con un cuervo posado, mientras el esqueleto
//   sale y arma el brazo (se corta en la suelta, ~1.1 s). Dos latidos (el
//   segundo mas fuerte y rapido) sobre un zumbido grave que sube de tono y de
//   volumen, y un aire que se aspira. Tambien en la espera de la cadena del
//   Execution Bonus.
//
// Ruido con semilla fija: el resultado es siempre el mismo. Para retocar un
// sonido, cambiar sus parametros abajo y volver a ejecutar.

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, "..", "assets", "audio", "fx");

function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seno amortiguado con caida de frecuencia (golpe con cuerpo).
function damped(buffer, startSec, freq, amp, tauSec, glide) {
  const start = Math.round(startSec * SAMPLE_RATE);
  const length = Math.round(tauSec * 9 * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < length && start + i < buffer.length; i++) {
    const t = i / SAMPLE_RATE;
    const f = freq * (1 - (glide || 0) * (1 - Math.exp(-t / (tauSec * 0.6))));
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.003);
    buffer[start + i] += Math.sin(phase) * amp * attack * Math.exp(-t / tauSec);
  }
}

// Latido: "lub" grave y "dub" algo mas agudo y corto.
function heartbeat(buffer, atSec, amp) {
  damped(buffer, atSec, 62, amp, 0.075, 0.35);
  damped(buffer, atSec, 124, amp * 0.25, 0.03, 0.3);
  damped(buffer, atSec + 0.17, 74, amp * 0.72, 0.06, 0.35);
  damped(buffer, atSec + 0.17, 150, amp * 0.18, 0.025, 0.3);
}

// Filtro de estado variable (paso banda) con frecuencia y Q por muestra.
function bandpassNoise(buffer, startSec, durSec, random, freqAt, ampAt, q) {
  const start = Math.round(startSec * SAMPLE_RATE);
  const length = Math.round(durSec * SAMPLE_RATE);
  let low = 0;
  let band = 0;
  for (let i = 0; i < length && start + i < buffer.length; i++) {
    const p = i / length;
    const f = Math.min(0.45, 2 * Math.sin(Math.PI * freqAt(p) / SAMPLE_RATE));
    const white = random() * 2 - 1;
    const high = white - low - band / q;
    band += f * high;
    low += f * band;
    buffer[start + i] += band * ampAt(p);
  }
}

function normalize(buffer, peak) {
  let max = 0;
  for (let i = 0; i < buffer.length; i++) max = Math.max(max, Math.abs(buffer[i]));
  const k = max > 0 ? peak / max : 1;
  for (let i = 0; i < buffer.length; i++) buffer[i] *= k;
}

function fadeTail(buffer, sec) {
  const n = Math.round(sec * SAMPLE_RATE);
  for (let i = 0; i < n; i++) {
    const idx = buffer.length - n + i;
    if (idx >= 0) buffer[idx] *= 1 - i / n;
  }
}

function writeWav(file, buffer) {
  const data = Buffer.alloc(buffer.length * 2);
  for (let i = 0; i < buffer.length; i++) {
    const v = Math.max(-1, Math.min(1, buffer[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

function bakeTension() {
  const dur = 1.3;
  const buffer = new Float32Array(Math.round(dur * SAMPLE_RATE));
  const random = makeRandom(0x570e7e);
  // Zumbido grave que sube (48 -> 78 Hz) y crece, con su octava y una
  // quinta suave; se corta de golpe en la suelta (ultimos 40 ms).
  let ph1 = 0;
  let ph2 = 0;
  let ph3 = 0;
  for (let i = 0; i < buffer.length; i++) {
    const t = i / SAMPLE_RATE;
    const p = t / dur;
    const f = 48 + 30 * p * p;
    ph1 += (2 * Math.PI * f) / SAMPLE_RATE;
    ph2 += (2 * Math.PI * f * 2) / SAMPLE_RATE;
    ph3 += (2 * Math.PI * f * 3) / SAMPLE_RATE;
    const env = Math.min(1, t / 0.25) * (0.25 + 0.75 * p * p);
    const cut = t > dur - 0.04 ? Math.max(0, (dur - t) / 0.04) : 1;
    buffer[i] += (Math.sin(ph1) * 0.32 + Math.sin(ph2) * 0.12 + Math.sin(ph3) * 0.05) * env * cut;
  }
  // Aire que se aspira: ruido en banda que sube de tono y de volumen.
  bandpassNoise(buffer, 0.15, dur - 0.19, random,
    function (p) { return 500 + 2600 * p * p; },
    function (p) { return 0.05 + 0.4 * p * p * p; },
    3.5);
  // Dos latidos, el segundo mas fuerte y mas pegado.
  heartbeat(buffer, 0.06, 0.95);
  heartbeat(buffer, 0.62, 1.25);
  normalize(buffer, 0.88);
  fadeTail(buffer, 0.01);
  return buffer;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
writeWav(path.join(OUT_DIR, "stone_tension.wav"), bakeTension());
console.log("Sonido de la piedra generado en " + path.relative(process.cwd(), OUT_DIR));
