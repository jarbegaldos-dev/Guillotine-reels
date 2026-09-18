# Guillotine Reels (Ossuary Reels)

A dark-fantasy web slot game prototype, designed and developed independently by **Jon Arbe** as a game design portfolio piece.

> ⚠️ This is a design/development prototype, not a commercial product. It is not licensed for gambling or real-money use.

## What this is

Guillotine Reels (internal codename "Ossuary Reels") is a browser-based slot machine built from scratch to explore mechanic design, math/paytable balancing, and audio-visual feedback for high-impact win moments in a gothic/dark-fantasy setting.

## Core systems

- **Reels & paylines** — custom reel strips with an extended payline network (173 lines) built around a fan-shaped board layout, tuned toward a target RTP of ~98%.
- **Bonus features** — a chest/wheel bonus ("ruleta") with its own reward flow, plus bonus symbol triggers (rib cage symbols) with dedicated impact animations and audio.
- **Big Win presentation** — a counter/celebration sequence synced to hand-timed beats in the win music track, so the number count-up lands on the drum hits.
- **FX & scene layering** — layered visual effects (blade cuts, glow states, scene transitions) driven by configuration files rather than hardcoded per-symbol logic.
- **Adaptive audio** — music and one-shot SFX react to game state (base game, bonus, wheel) with crossfades and impact stingers tied to specific gameplay events.

## Tech stack

- Vanilla JavaScript (no framework) — modular structure under `src/` (`core`, `render`, `fx`, `audio`, `bonus`, `math`, `ui`, `config`, `ruleta`, `scene`, `debug`)
- Plain HTML/CSS for layout and presentation (`index.html`, `style.css`)
- A minimal Node.js static server for local development (`local-server.js`)
- A small validation script (`tools/validate-runtime.js`) that syntax-checks the JS runtime

No build step is required — the game runs as static files served locally.

## Running locally

Requirements: Node.js installed.

```bash
npm install
npm start
```

This starts a local static server (see `local-server.js` for the port) serving `index.html`. Open it in a browser to play.

To validate the JS files without running the game:

```bash
npm run validate
```

## Project structure

```
index.html              Entry point / DOM shell
style.css               Visual styling for scene, reels, UI, effects
game.js                 Main runtime / game loop
src/
  core/                 Core game/state logic
  render/                Rendering of reels and scene
  fx/                    Visual effects (cuts, glows, transitions)
  audio/                 Music and SFX playback/adaptive audio
  bonus/                 Bonus feature logic
  math/                  Paytable / payline / RTP-related logic
  ui/                    HUD, counters, controls
  ruleta/                Chest/wheel bonus feature
  scene/                 Scene composition and layering
  config/                Declarative configuration for symbols, paylines, animations, spins
assets/                  Art, audio and video assets used by the game
docs/                    Reference diagrams (e.g. payline map)
tools/                   Development/validation scripts
```

## Design documentation

This repository includes the design/technical reference documents used during development, kept for anyone reviewing the project as a portfolio piece:

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — module structure and runtime organization
- [`ART_BIBLE.md`](ART_BIBLE.md) — visual/art direction reference
- [`AUDIO_ARCHITECTURE.md`](AUDIO_ARCHITECTURE.md) — music/SFX system design
- [`FX_ARCHITECTURE.md`](FX_ARCHITECTURE.md) — visual effects system design
- [`PAYLINES_AUDIT.md`](PAYLINES_AUDIT.md) — payline network design and audit notes
- [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) — development checkpoints and status

## Current status

Active solo-developed prototype. Core reels, paylines, bonus chest/wheel feature, big-win presentation, and adaptive audio are implemented and playable; balancing and polish are ongoing.

## About

Built by **Jon Arbe**, an aspiring game designer based in Tokyo, Japan, as part of a game design portfolio. This project is used to demonstrate slot mechanic design, math/RTP thinking, and audio-visual feedback design.
