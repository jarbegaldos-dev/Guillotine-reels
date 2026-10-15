#!/usr/bin/env node
"use strict";

// Genera el icono de la pestana (favicon) y el de "anadir a inicio" desde el
// logo del juego: la calavera de la guillotina con su marco y la sangre.
//
//   node tools/bake-favicon.js
//
// Salida: assets/ui/favicon.png (64x64) y assets/ui/apple-touch-icon.png
// (180x180). Si cambia el logo, volver a ejecutarlo.

const path = require("path");
const { Jimp } = require("jimp");

const ROOT = path.join(__dirname, "..");
const LOGO = path.join(ROOT, "assets", "ui", "ossuary-reels-logo.png");
// Recorte cuadrado sobre la guillotina del logo (1180x573): la calavera en
// su hueco, el marco a los lados y las gotas de sangre debajo. Sin la "S".
const CROP = { x: 20, y: 228, w: 258, h: 258 };

async function main() {
  const logo = await Jimp.read(LOGO);
  const square = logo.clone().crop(CROP);
  await square.clone().resize({ w: 64, h: 64 }).write(path.join(ROOT, "assets", "ui", "favicon.png"));
  await square.clone().resize({ w: 180, h: 180 }).write(path.join(ROOT, "assets", "ui", "apple-touch-icon.png"));
  console.log("Iconos generados en assets/ui (favicon.png, apple-touch-icon.png)");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
