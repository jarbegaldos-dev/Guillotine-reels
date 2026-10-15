#!/usr/bin/env node
"use strict";

// Genera los sonidos de interfaz (assets/audio/ui/) por sintesis, sin assets
// de partida: ninguno de los sonidos del juego servia como clic corto (el
// golpe de rodillo dura ~300 ms y es muy grave).
//
//   node tools/bake-ui-sounds.js
//
// - button_click.wav: clic seco de hueso/madera (~70 ms). Transitorio de
//   ruido muy corto + cuerpo resonante amortiguado (dos parciales
//   inarmonicos) + un golpe grave que le da peso.
// - button_error.wav: dos golpes sordos y disonantes (~260 ms) para "no se
//   puede" (SPIN sin saldo suficiente).
//
// Ruido con semilla fija: el resultado es siempre el mismo. Para retocar un
// sonido, cambiar sus parametros abajo y volver a ejecutar.

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, "..", "assets", "audio", "ui");

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

// Ruido filtrado de un polo (paso bajo) para que el transitorio no silbe.
function noiseBurst(buffer, startSec, amp, tauSec, lowpass, random) {
  const start = Math.round(startSec * SAMPLE_RATE);
  const length = Math.round(tauSec * 8 * SAMPLE_RATE);
  let lp = 0;
  for (let i = 0; i < length && start + i < buffer.length; i++) {
    const t = i / SAMPLE_RATE;
    const white = random() * 2 - 1;
    lp += (white - lp) * lowpass;
    buffer[start + i] += lp * amp * Math.exp(-t / tauSec);
  }
}

// Seno amortiguado (resonancia). glide: caida de frecuencia relativa, que
// hace que el golpe suene a material y no a pitido.
function damped(buffer, startSec, freq, amp, tauSec, glide) {
  const start = Math.round(startSec * SAMPLE_RATE);
  const length = Math.round(tauSec * 9 * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < length && start + i < buffer.length; i++) {
    const t = i / SAMPLE_RATE;
    const f = freq * (1 - (glide || 0) * (1 - Math.exp(-t / (tauSec * 0.6))));
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    // Ataque de 0.4 ms para que el arranque no chasquee de forma digital.
    const attack = Math.min(1, t / 0.0004);
    buffer[start + i] += Math.sin(phase) * amp * attack * Math.exp(-t / tauSec);
  }
}

function normalize(buffer, peak) {
  let max = 0;
  for (let i = 0; i < buffer.length; i++) max = Math.max(max, Math.abs(buffer[i]));
  const k = max > 0 ? peak / max : 1;
  for (let i = 0; i < buffer.length; i++) buffer[i] *= k;
}

// Silencio final con fundido para que el ultimo sample sea 0.
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

function bakeClick() {
  const buffer = new Float32Array(Math.round(0.07 * SAMPLE_RATE));
  const random = makeRandom(0x05517a);
  noiseBurst(buffer, 0, 0.55, 0.0007, 0.55, random);
  damped(buffer, 0, 1480, 0.6, 0.009, 0.04);
  damped(buffer, 0, 3990, 0.22, 0.0045, 0.02);
  damped(buffer, 0, 205, 0.38, 0.014, 0.1);
  normalize(buffer, 0.9);
  fadeTail(buffer, 0.012);
  return buffer;
}

function bakeError() {
  const buffer = new Float32Array(Math.round(0.26 * SAMPLE_RATE));
  const random = makeRandom(0x0e7707);
  [[0, 1], [0.095, 0.8]].forEach(function (hit) {
    const at = hit[0];
    const amp = hit[1];
    noiseBurst(buffer, at, 0.35 * amp, 0.0015, 0.18, random);
    damped(buffer, at, 140 - at * 100, 0.7 * amp, 0.045, 0.12);
    damped(buffer, at, 198 - at * 140, 0.45 * amp, 0.035, 0.12);
    damped(buffer, at, 610, 0.12 * amp, 0.012, 0.05);
  });
  normalize(buffer, 0.85);
  fadeTail(buffer, 0.03);
  return buffer;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
writeWav(path.join(OUT_DIR, "button_click.wav"), bakeClick());
writeWav(path.join(OUT_DIR, "button_error.wav"), bakeError());
console.log("Sonidos de interfaz generados en " + path.relative(process.cwd(), OUT_DIR));
