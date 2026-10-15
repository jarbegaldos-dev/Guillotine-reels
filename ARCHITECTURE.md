# Ossuary Reels Architecture

Current architecture of the runtime (reviewed 2026-10-08). If this document and
the code disagree, the code wins and this file gets fixed. What the game does
(mechanics) is summarised in `PROJECT_STATE.md` → *Estado actual*; the
player-facing rules are in `src/ui/rules-screen.js`.

## Runtime shape

- Plain browser JavaScript, no bundler: every module is an IIFE that publishes
  a `window.Ossuary*` global (or a `window.OSSUARY_*` config object).
- `index.html` declares the DOM shell (stage, scene layers, reel layer,
  structure overlay, HUD, menu, loading screen) and loads every script in
  order. **`index.html` is the source of truth for script order**;
  `tools/validate-runtime.js` checks that the scripts exist and that the
  important dependencies load before their consumers.
- `game.js` (~8.4k lines) is the orchestrator: it creates the shared `state`,
  instantiates the modules with hooks and owns the spin lifecycle and the
  bonus/blade/crow sequences. New gameplay logic should go into modules, not
  into `game.js` (see `PROJECT_RULES.md`).
- Styles: `style.css` (game, scene, FX, HUD), `src/ui/responsive-layout.css`
  (layout modes) and `src/ui/game-ui.css` (menu, rules, notices, loading
  screen). Loaded in that order.
- Served by `local-server.js` (Node, `Cache-Control: no-store` on purpose so
  edited assets always reload). Start with `npm start` or
  `ABRIR_OSSUARY_REELS.bat`.

## Folders

| Folder | Contents |
|---|---|
| `src/config/` | Data-only configuration: layout, spin timing, symbols and bonus weights, bonus modes, strips, paytable (`DEV_ONLY`), combo, scene layers, FX, audio. |
| `src/core/` | Game state, RNG, reel model, outcome engine, spin engine (motion), bonus trigger detection, combination engine, payout and payment engines. |
| `src/math/` | Math engine: path registry, symbol evaluator, conflict resolver, paytable engine, dry payout, win resolver, mechanics registry, simulation and RTP framework, debug tools. |
| `src/bonus/` | Bonus collecting (`bonus-feature.js`, `bonus-lock-manager.js`), Execution Bonus runtime (`bonus-mode-runtime.js`: chances, restore, completion) and the lock handoff into bonus mode. |
| `src/render/` | Reel DOM and continuous tracks, symbol rendering (with resident art cache), giant symbol strips, reel textures, bonus landing physics/weight, symbol win animations. |
| `src/fx/` | Declarative FX system (director, registry, players, position resolver) and the self-contained visual sequences: small blade cut, skeleton door + stone, crow perch/death. |
| `src/ruleta/` | Chest counter, chest opening video and the Chest Gamble wheel. |
| `src/scene/` | Scene layers from `scene.config.js` (backgrounds, structure, chest) and scene FX. The DEBUG panel is `src/debug/debug-menu.js`. |
| `src/ui/` | HUD controls, readouts, BIG WIN counter, gold number/letter font, responsive layout, audio settings, menu, rules screen, loading screen. |
| `src/audio/` | Audio Framework: engine, buses, director, event bus, adaptive music, perf monitor, debug API. |
| `src/debug/` | Debug APIs and offline simulators (not part of gameplay). |
| `assets/` | Images, video, audio and fonts only. Inventory: `docs/ART_STATUS.md`. |
| `tools/` | `validate-runtime.js` (`npm test`) and bake scripts for generated assets (symbol depth, smoke masks, gold letters, UI sounds, favicon, chroma despill). |
| `_backups/`, `_snapshots/`, `_unused_assets/`, `experiments/` | Never loaded by the runtime. |

## Board and paylines

- Reels: `rib1` (top, 3 cells), `rib2`–`rib5` split into `-left`/`-right`
  halves (2 cells each), `sternum` (centre, 3 cells). Positions and sizes:
  `src/config/layout.config.js` (do not edit without approval).
- For paying, the board is a 5-column grid: `game.js#OSSUARY_BOARD_COLUMNS`.
  `paylineNetRoutes` builds every path that starts in column 0 and steps one
  column right, straight or one row up/down: 173 full 5-column paths.
  3+ matching symbols (WILD substitutes) from column 0 pay; prefixes of a longer
  win are removed (`dedupeWinningLines`), diverging paths pay separately.
- The payline board is evaluated after the blade sequence: cut cells are empty
  (`smallBladeCutCellIds`) and dead-crow cells are WILD with the crow's
  multiplier (`deadCrowWildByCellId`). Payouts: `mathEngine.resolveBoard` with
  `OSSUARY_DEV_PAYTABLE_CONFIG`; amount = payout × total bet.

## Spin lifecycle (game.js)

1. `startSpin` (button, keyboard, autoplay, buy option or bonus chain): charges
   the bet unless it is a free spin, clears last spin presentation, and
   `prepareReelStops` asks `outcome-engine` for the final symbols (strips +
   RNG; bonus-mode branch for the Execution Bonus; blade caps/floors and the
   forced purchase outcomes are applied here).
2. `updateSpinFrame` (rAF) moves every reel with `spin-engine` (acceleration,
   cruise, staggered stops, settle). Turbo runs the game clock ×2.5.
3. `stopReel` per reel: final render, giant symbol sync, landing FX/audio,
   inline rib1 bonus continuation.
4. `finishSpin`: bonus result (`bonus-feature.onSpinFinished`, or
   `resolveBonusModeFreeSpinResult` inside the Execution Bonus), then the
   small blade sequence (cut → crow perch → skeleton door → stone → dead
   crow), then `revealWinAndFinish` (payline evaluation, blood paylines,
   `settleSpinPayment` through `payment-engine`, BIG WIN counter for ≥10× bet).
5. `handleBonusNextAction`: respins of the collecting chain, Execution Bonus
   intro (video + PLAY), guillotine/scythe cuts, end of bonus; then the chest
   (`OssuaryRuletaGame.startPendingSequence`) and `scheduleAutoSpin`.

## Public globals worth knowing

| Global | Purpose |
|---|---|
| `OssuaryAudio` | Audio entry point: `trigger(event, payload)` plus bus/master controls. |
| `OssuaryAudioSettings` | Player sound settings (music, effects, mute; saved in the browser). |
| `OssuaryFX` | FX entry point (`trigger`). |
| `OssuaryRuletaGame` | Chest counter and Chest Gamble (`isActive`, `debug.*`). |
| `OssuaryRulesScreen`, `OssuaryLoadingScreen` | Rules screen and loading screen. |
| `OssuaryGameSpeed` | Turbo-aware timing helper for modules. |
| `OssuaryResponsiveLayout` | Layout mode and measurements (`state()`, `refresh()`). |
| `OssuarySymbolRenderer.preloadArt` | Resident (decoded, in-memory) symbol art. |
| `OssuaryBonusDebug`, `OssuaryPaymentDebug`, `OssuarySmallBladeDebug`, `OssuaryPaylineOverlayDebug`, `OssuaryDebugPreview`, `OssuaryAudioDebug`, `OssuaryFXDebug`, `OssuaryMathDebugTools` | Console debug APIs. |

## Ownership

Who may edit which folder: `AGENTS.md` and `AGENT_TASKS.md`. Math/RNG/bonus
rules: Codex. Visual FX, audio and HUD/UI presentation: Claude. An explicit
request from the user overrides the split.
