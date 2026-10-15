# Ossuary Reels

A dark-fantasy web slot game, designed and developed independently by **Jon Arbe** as a game design portfolio piece. (Earlier builds were published as "Guillotine Reels".)

**Play it in the browser:** https://jarbegaldos-dev.github.io/Guillotine-reels/

> ⚠️ This is a design/development prototype, not a commercial product. It is not licensed for gambling or real-money use; all credits are play money.

## What this is

A browser slot built from scratch around a ribcage-shaped machine: independent rib reels, blades that cut symbols, crows that turn into multipliers, a chest with a gamble wheel and the Execution Bonus. It explores mechanic design, math/paytable thinking and audio-visual feedback for high-impact moments.

## Features

- **Ribcage board** — a top reel (rib1), four split ribs (rib2–rib5) and the sternum, evaluated as a 5-column grid with 173 paylines (3, 4 or 5 of a kind from the left; Wild substitutes).
- **Blades and crows** — a small blade drops and cuts the symbols below it. Cut crows perch above the machine and stack multipliers (a golden crow adds ×10, ×25 or ×50). A skeleton can knock a crow down with a stone: its column turns into multiplier Wilds and it awards a free spin.
- **Raven Bonus** — a chain of automatic free spins: every crow that falls adds another spin, and perched crows keep stacking.
- **Chest and wheel** — cut symbols fill the chest; when it opens, collect or gamble on an 11-slot wheel (bonus game, ×0 or ×25).
- **Execution Bonus** — a giant guillotine on rib1 starts a respin chain that must lock rib2 and rib3. Inside, poor, noble and rich skeletons chain across the ribs and the sternum decides: guillotine (hands), scythe (heads) or cross. The multiplier grows with the hand crate, up to ×100.
- **Buy Bonus** — Execution Bonus (100× bet), Raven Bonus (25×) and Chest Gamble (21×).
- **Win presentation** — paylines revealed one by one from the smallest to the largest win, a Big Win counter synced to the drum hits of the music (up to a ×20,000 Max Win banner) and a bonus summary screen.
- **HUD** — custom black-and-gold HUD (hourglass spin control, clover menu, ledger), turbo, autoplay, quick stop, bet selector, game rules and paytable, sound settings, loading screen and a responsive desktop/mobile layout.
- **Adaptive audio** — music per mode (base game, bonus, wheel), anticipation, impact stingers and player volume controls.

The paytable is still a development version: the target RTP is 98% and the math is not balanced yet. A **DEBUG** button (top right) stays in this beta to force features and wins.

## Tech stack

- Vanilla JavaScript (no framework) — modular structure under `src/` (`core`, `render`, `fx`, `audio`, `bonus`, `math`, `ui`, `config`, `ruleta`, `scene`, `debug`)
- Plain HTML/CSS for layout and presentation (`index.html`, `style.css`, `src/ui/*.css`)
- A minimal Node.js static server for local development (`local-server.js`)
- Node scripts in `tools/`: runtime validation plus the bake scripts that generate derived art and sounds (symbol depth and motion blur, smoke masks, gold letters, UI sounds)

No build step is required — the game runs as static files.

## Running locally

Requirements: Node.js installed.

```bash
npm install
npm start
```

Then open http://127.0.0.1:8000/ (add `?skipintro` to skip the loading screen).

To validate the runtime without playing:

```bash
npm test
```

## Project structure

```
index.html              Entry point / DOM shell
style.css               Visual styling for scene, reels, UI, effects
game.js                 Main runtime / game loop
src/
  core/                 Core game/state logic, RNG, outcomes, payments
  render/               Rendering of reels, symbols and giants
  fx/                   Visual effects (cuts, crows, chest, bonus hits)
  audio/                Music and SFX playback, adaptive audio
  bonus/                Bonus feature logic
  math/                 Paytable / payline / RTP-related logic
  ui/                   HUD, menu, rules, loading screen, counters
  ruleta/               Chest/wheel feature
  scene/                Scene composition and layering
  config/               Declarative configuration (symbols, strips, audio, FX, layout)
  debug/                DEBUG panel and debug tools
assets/                 Art, audio and video assets used by the game
docs/                   Reference diagrams (e.g. payline map)
tools/                  Validation and asset bake scripts
```

## Design documentation

Design and technical reference documents used during development:

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — module structure and runtime organization
- [`ART_BIBLE.md`](ART_BIBLE.md) — visual/art direction reference
- [`AUDIO_ARCHITECTURE.md`](AUDIO_ARCHITECTURE.md) — music/SFX system design
- [`FX_ARCHITECTURE.md`](FX_ARCHITECTURE.md) — visual effects system design
- [`PAYLINES_AUDIT.md`](PAYLINES_AUDIT.md) — payline network design and audit notes
- [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) — development checkpoints and status

## Current status

Playable beta (October 2026): every feature listed above is implemented and playable. Next: math balancing and lighter assets for faster loading.

## About

Built by **Jon Arbe**, a game designer based in Tokyo, Japan. The project demonstrates slot mechanic design, math/RTP thinking and audio-visual feedback design.
