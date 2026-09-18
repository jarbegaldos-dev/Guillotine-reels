# Ossuary Reels Architecture

## Current Goal

Ossuary Reels is being migrated from a single-file prototype into a modular web slot project. The current priority is stability: keep the existing visual result and behavior while separating configuration and preparing safe delegation.

## Active Runtime Files

- `index.html`: static DOM shell and script loading order.
- `style.css`: current visual styling for scene, reels, UI, debug, and responsive behavior.
- `game.js`: runtime orchestrator. It wires state, core modules, render modules, UI modules, scene FX, and spin lifecycle.
- `src/scene/scene-manager.js`: runtime scene layer creation and visual debug layer panel.
- `src/scene/scene-fx.js`: scene layer visibility/motion helpers and bonus FX activation.
- `src/render/reel-texture-renderer.js`: decorative reel texture layer synchronized with reel motion.
- `assets/symbols/symbol-assets.js`: symbol art registry.
- `src/config/*.config.js`: extracted configuration loaded before `game.js`.

## Config Modules

- `src/config/layout.config.js`: fixed image reference, rib reel layout, sternum layout.
- `src/config/spin.config.js`: spin timing, speed, easing parameters, giant-strip render constants, bet steps.
- `src/config/symbols.config.js`: symbol pools, bonus trigger symbol groups, debug trigger tests.
- `src/config/scene.config.js`: scene layers, texture assets, bonus FX mappings, scene CSS state classes.

## Extracted Runtime Modules

- `src/core/game-state.js`: initial state and state reset helpers.
- `src/core/reel-model.js`: reel creation and reel motion reset helpers.
- `src/core/outcome-engine.js`: symbol and giant-symbol outcome preparation.
- `src/core/bonus-triggers.js`: BONUS and SUPER BONUS trigger detection only.
- `src/core/spin-engine.js`: reel movement, easing, braking, spring settle, and continuity.
- `src/render/reel-renderer.js`: reel lane DOM rendering.
- `src/render/symbol-renderer.js`: normal symbol DOM rendering.
- `src/render/giant-symbol-renderer.js`: giant symbol strip rendering.
- `src/ui/controls.js`: UI control bindings.
- `src/ui/readouts.js`: balance, bet, win, and status readouts.
- `src/debug/debug-panel.js`: gameplay/debug test bindings.
- `src/debug/bonus-runtime-debug.js`: bonus simulations, lock inspection, and
  integrated bonus debug scenarios. This keeps debug-only orchestration out of
  `game.js`.

## Development Support

- `package.json`: dependency-free project commands.
- `npm run start`: starts the local server on `127.0.0.1:8000`.
- `npm test`: validates active JavaScript syntax, runtime script existence and
  order, exported debug contracts, and normal/super bonus integration contracts.
- `tools/validate-runtime.js`: implementation of the validation command.
- `.gitignore`: excludes local agent settings, generated snapshot frames, logs,
  dependencies, and Remotion render output from future Git noise.

## Planned Module Boundaries

- `src/core/`: game state, reel model, spin engine, trigger detection.
- `src/render/`: reel DOM, symbol DOM, giant symbol strips, texture renderer.
- `src/scene/`: background, ambient, bonus FX, visual layer orchestration.
- `src/ui/`: controls, readouts, menus, input bindings.
- `src/debug/`: debug panel, forced tests, geometry overlays.
- `src/config/`: data-only configuration.
- `assets/`: image/audio/static assets only.
- `experiments/`: inactive prototypes that must not be loaded by default.
- `_backups/legacy-root/`: old root-level backups kept for recovery only; never loaded by runtime.

## Inactive Prototypes

- `experiments/special-reel.prototype.js`: old special reel prototype. It is intentionally not loaded by `index.html`.

## Current Constraints

- Geometry is locked unless explicitly requested.
- Spin behavior is locked except when the user asks for reel motion tuning.
- Bonus gameplay is not implemented yet. Current scope is trigger detection only.
- Giant symbols must remain real strip symbols, not overlays.
- Normal and giant symbols must continue using the existing IDs.
