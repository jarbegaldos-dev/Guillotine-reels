#!/usr/bin/env node
"use strict";

// Genera por sintesis el golpe de los premios (assets/audio/fx/win_hit.wav):
// la escalera de las lineas de pago (game.js#planWinningPaylineLadder) dispara
// uno por linea, cada uno mas alto de tono (audio-rules: `payline_note`).
//
// Golpe SECO, sin notas que canten ni cola: un tambor de piel apagado (thump
// grave con el chasquido de la piel) y una piedra que choca (toc corto y
// denso de resonancias inarmonicas que mueren en milisegundos). Solo dos
// rebotes muy bajos de una sala de piedra.
//
//   node tools/bake-win-notes.js            (el wav del juego)
//   node tools/bake-win-notes.js --preview  (ademas tmp_win_ladder_preview.wav:
//                                            escaleras de 3, 4 y 5 lineas con
//                                            el tambor solo, la piedra sola y
//                                            los dos juntos, que es el del juego)
//
// Ruido con semilla fija: el resultado es siempre el mismo.

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "assets", "audio", "fx");

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

// Modo resonante amortiguado; el tono arranca `bend` por encima y cae (piel
// que se destensa tras el golpe).
function mode(buffer, freq, amp, tauSec, opts) {
  const o = opts || {};
  const bend = o.bend || 0;
  const bendTau = o.bendTau || 0.01;
  const attackSec = o.attack || 0.0008;
  const length = Math.min(buffer.length, Math.round(tauSec * 9 * SAMPLE_RATE));
  let phase = o.phase || 0;
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const f = freq * (1 + bend * Math.exp(-t / bendTau));
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const attack = Math.min(1, t / attackSec);
    buffer[i] += Math.sin(phase) * amp * attack * Math.exp(-t / tauSec);
  }
}

// Rafaga de ruido: paso bajo de un polo (lowpass 0..1) o, con highpass, lo
// que queda por encima de ese paso bajo.
function noiseBurst(buffer, amp, tauSec, lowpass, random, highpass) {
  const length = Math.min(buffer.length, Math.round(tauSec * 8 * SAMPLE_RATE));
  let lp = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const n = random() * 2 - 1;
    lp += (n - lp) * lowpass;
    buffer[i] += (highpass ? n - lp : lp) * amp * Math.exp(-t / tauSec);
  }
}

// Ruido por un paso banda (filtro de estado variable): resonancia de casco.
function bandNoise(buffer, freq, q, amp, tauSec, random) {
  const length = Math.min(buffer.length, Math.round(tauSec * 8 * SAMPLE_RATE));
  const f = 2 * Math.sin((Math.PI * freq) / SAMPLE_RATE);
  const damp = 1 / q;
  let low = 0;
  let band = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const high = (random() * 2 - 1) - low - damp * band;
    band += f * high;
    low += f * band;
    buffer[i] += band * amp * Math.exp(-t / tauSec);
  }
}

function saturate(buffer, drive) {
  const k = Math.tanh(drive);
  for (let i = 0; i < buffer.length; i++) buffer[i] = Math.tanh(buffer[i] * drive) / k;
}

function normalize(buffer, peak) {
  let max = 0;
  for (let i = 0; i < buffer.length; i++) max = Math.max(max, Math.abs(buffer[i]));
  const k = max > 0 ? peak / max : 1;
  for (let i = 0; i < buffer.length; i++) buffer[i] *= k;
  return buffer;
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

// Dos rebotes bajos y apagados (sala de piedra), sin cola de reverb.
function stoneRoom(buffer, taps) {
  const out = Float32Array.from(buffer);
  taps.forEach(([ms, gain]) => {
    const d = Math.round((ms / 1000) * SAMPLE_RATE);
    let lp = 0;
    for (let i = d; i < out.length; i++) {
      lp += (buffer[i - d] - lp) * 0.25;
      out[i] += lp * gain;
    }
  });
  return out;
}

// Tambor de piel apagado: modos de membrana que mueren enseguida, el tono cae
// tras el golpe y el chasquido de la piel.
const DRUM_HZ = 92;
const DRUM_MODES = [
  [1, 1, 0.07],
  [1.59, 0.35, 0.03],
  [2.14, 0.15, 0.018]
];

function bakeDryDrum() {
  const buffer = new Float32Array(Math.round(0.4 * SAMPLE_RATE));
  const random = makeRandom(0xd2a3);
  DRUM_MODES.forEach(([ratio, amp, tau]) => {
    mode(buffer, DRUM_HZ * ratio, amp, tau, { bend: 0.45, bendTau: 0.008, attack: 0.001 });
  });
  noiseBurst(buffer, 0.6, 0.004, 0.2, random); // la piel
  normalize(buffer, 1);
  saturate(buffer, 1.6);
  return normalize(buffer, 1);
}

// Piedra contra piedra: un toc de ruido por paso banda y resonancias
// inarmonicas muy cortas (nada que se quede sonando).
const STONE_MODES = [
  [1050, 0.25, 0.012],
  [1730, 0.18, 0.008],
  [2600, 0.12, 0.006],
  [3900, 0.06, 0.004]
];

function bakeStone() {
  const buffer = new Float32Array(Math.round(0.4 * SAMPLE_RATE));
  const random = makeRandom(0x5701e);
  bandNoise(buffer, 1100, 2, 1.2, 0.006, random);
  STONE_MODES.forEach(([hz, amp, tau]) => mode(buffer, hz, amp, tau, { bend: 0.02, bendTau: 0.003 }));
  noiseBurst(buffer, 0.3, 0.0012, 0.4, random, true); // el canto que golpea
  normalize(buffer, 1);
  saturate(buffer, 1.3);
  return normalize(buffer, 1);
}

function finish(buffer) {
  const roomed = stoneRoom(buffer, [[11, 0.12], [23, 0.06]]);
  normalize(roomed, 0.9);
  fadeTail(roomed, 0.05);
  return roomed;
}

function mix(a, b, ga, gb) {
  const out = new Float32Array(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = (a[i] || 0) * ga + (b[i] || 0) * gb;
  return out;
}

// La escalera sube con un exponente: misma cuenta que audio-rules
// (`payline_note`): la nota de la escala, a 3/4 de paso (un golpe seco subido
// dos octavas ya no suena a golpe).
const PITCH_EXP = 0.75;

// Escucha previa fuera del juego: escaleras de 3, 4 y 5 lineas con el mismo
// reparto que el juego (170 ms entre golpes, menor pentatonica, la ultima mas
// fuerte), para cada sonido de la lista.
function bakePreview(sounds) {
  const steps = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
  const ladders = [3, 4, 5];
  const out = new Float32Array(Math.round((sounds.length * ladders.length * 1.4 + 1) * SAMPLE_RATE));
  const mixIn = (src, at, rate, gain) => {
    const start = Math.round(at * SAMPLE_RATE);
    for (let i = 0; start + i < out.length; i++) {
      const pos = i * rate;
      const j = Math.floor(pos);
      if (j + 1 >= src.length) break;
      out[start + i] += (src[j] + (src[j + 1] - src[j]) * (pos - j)) * gain;
    }
  };
  let t = 0.2;
  sounds.forEach((sound) => {
    ladders.forEach((count) => {
      for (let rank = 0; rank < count; rank++) {
        const pitch = Math.pow(2, (steps[rank] * PITCH_EXP) / 12);
        mixIn(sound, t + rank * 0.17, pitch, rank === count - 1 && count > 1 ? 1.3 : 1);
      }
      t += 1.2;
    });
    t += 0.6;
  });
  return normalize(out, 0.8);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const drum = bakeDryDrum();
const stone = bakeStone();
const hit = finish(mix(drum, stone, 0.8, 0.45));
writeWav(path.join(OUT_DIR, "win_hit.wav"), hit);
console.log("Golpe de premio generado en assets/audio/fx/win_hit.wav");
if (process.argv.includes("--preview")) {
  writeWav(path.join(ROOT, "tmp_win_ladder_preview.wav"), bakePreview([finish(drum), finish(stone), hit]));
  console.log("Escucha previa en tmp_win_ladder_preview.wav (tambor, piedra, los dos)");
}
