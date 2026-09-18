# Ossuary Reels Project Roadmap

Official project state source.

Last updated: 2026-06-26

## Status Legend

- `LOCKED`: Not approved or blocked by a dependency.
- `PENDING`: Approved direction exists, but the checkpoint has not started.
- `IN PROGRESS`: Current active checkpoint or phase.
- `COMPLETE`: Implemented and reported.

## Current Checkpoint

- Current checkpoint: `Math Engine Program - Complete`
- Owner: Codex
- Status: `COMPLETE`
- Approval required before starting: no
- Reason: el usuario aprobó un programa nuevo de 10 fases. Las Fases 1-10 ya quedaron completadas.

## Math Engine Program

| Phase | Status | Objective |
| --- | --- | --- |
| Fase 1 | COMPLETE | Fuente única del generador de rutas y validación exacta de trayectorias. |
| Fase 2 | COMPLETE | Extraer evaluador de símbolos sin premios. |
| Fase 3 | COMPLETE | Resolver conflictos de combinaciones compartidas. |
| Fase 4 | COMPLETE | Crear arquitectura de paytable configurable. |
| Fase 5 | COMPLETE | Crear dry payout engine. |
| Fase 6 | COMPLETE | Crear win resolver configurable. |
| Fase 7 | COMPLETE | Preparar arquitectura futura de mecánicas. |
| Fase 8 | COMPLETE | Preparar simulation engine independiente. |
| Fase 9 | COMPLETE | Preparar framework RTP/EV/volatilidad. |
| Fase 10 | COMPLETE | Crear developer tools del motor matemático. |

## Stable Project State

- BONUS NORMAL lock system is stable.
- RIB_BONUS giant locks work.
- STERNUM_BONUS is separate from ribs.
- 5 locked ribs = `BONUS_MODE_PENDING`.
- 5 locked ribs + sternum = `SUPER_BONUS_MODE_PENDING`.
- Automatic respin collecting has been validated.
- Internal bonus game is not implemented and remains blocked.
- Claude visual/FX work is separate from Codex core architecture work.

## Phase Overview

| Phase | Owner | Status | Objective | Dependencies |
| --- | --- | --- | --- | --- |
| Phase 0 - Modular Runtime Foundation | Codex | COMPLETE | Preserve current game while extracting runtime modules, config, render, UI, debug, and scene boundaries. | None |
| Phase 1 - Symbol/RNG/Strip Architecture | Codex | IN PROGRESS | Make symbol generation reproducible, injectable, and automation-friendly without changing probabilities or visuals. | Phase 0 |
| Phase 2 - Paytable and Win Evaluation | Codex | LOCKED | Move payout rules into a clear paytable contract and structured win evaluator. | Phase 1 |
| Phase 3 - Future Bonus Session Architecture | Codex | LOCKED | Define handoff contract for future bonus modes without implementing internal bonus gameplay. | Phase 1, preferably Phase 2 |
| Phase 4 - Internal Bonus Game | Codex | LOCKED | Implement the actual internal bonus mode after session architecture is approved. | Phase 3 approval |
| Phase 5 - Visual/FX Polish and Asset Integration | Claude | IN PROGRESS | Eye FX, general FX, smoke, particles, lighting, animation polish, and asset integration. | Codex-owned data contracts where needed |
| Phase 6 - Automation and Regression Harness | Codex | PENDING | Build repeatable checks for RNG, strips, payouts, bonus locks, and browser flow. | Phase 1.4, then expands after Phase 2/3 |
| Phase 7 - Release Stabilization | Codex | LOCKED | Final integration, regression validation, cleanup, and release readiness. | Core phases and visual handoff complete |

## Phase 0 - Modular Runtime Foundation

Owner: Codex

Status: `COMPLETE`

Objective:

- Keep the existing game working while moving from single-file prototype toward modular runtime boundaries.

Completed checkpoints:

- Extracted config ownership into `src/config/*`.
- Extracted core modules:
  - `src/core/game-state.js`
  - `src/core/reel-model.js`
  - `src/core/outcome-engine.js`
  - `src/core/bonus-triggers.js`
  - `src/core/spin-engine.js`
  - `src/core/payout-engine.js`
- Extracted bonus modules:
  - `src/bonus/bonus-lock-manager.js`
  - `src/bonus/bonus-feature.js`
- Extracted render modules:
  - `src/render/symbol-renderer.js`
  - `src/render/reel-renderer.js`
  - `src/render/giant-symbol-renderer.js`
  - `src/render/reel-texture-renderer.js`
- Extracted UI/debug modules:
  - `src/ui/controls.js`
  - `src/ui/readouts.js`
  - `src/debug/debug-panel.js`
- Established `game.js` as runtime orchestrator.

Dependencies:

- None.

## Phase 1 - Symbol/RNG/Strip Architecture

Owner: Codex

Status: `IN PROGRESS`

Objective:

- Create an explicit, testable symbol generation architecture.
- Keep current probabilities, symbols, spin behavior, and visual behavior unchanged.
- Prepare deterministic automation and future strip-based outcome tests.

Checkpoints:

| Checkpoint | Status | Objective | Notes |
| --- | --- | --- | --- |
| Phase 1.1 - RNG contract / rng-engine | COMPLETE | Encapsulate `Math.random()` behind an injectable RNG contract. | `src/core/rng-engine.js` created; `outcome-engine` consumes injected RNG. |
| Phase 1.2 - Reel strip contract/config | COMPLETE | Add passive reel strip config reflecting current weighted symbol behavior. | `src/config/reel-strips.config.js` created with `active: false`. |
| Phase 1.3 - Connect outcome-engine with RNG/strips | COMPLETE | Make `outcome-engine` read from the strip contract while preserving exact current behavior. | `outcome-engine` now resolves normal symbols from `OSSUARY_REEL_STRIP_CONFIG`; probabilities and visible symbols preserved. |
| Phase 1.4 - Deterministic/debug mode for tests | PENDING | Add controlled deterministic/debug support for repeatable outcome validation. | Should use RNG/strip contracts from 1.1-1.3. |

Dependencies:

- Depends on Phase 0.
- Phase 1.3 depends on Phase 1.1 and Phase 1.2.
- Phase 1.4 depends on Phase 1.3.

Validation expectations:

- JavaScript syntax validation after edits.
- Contract checks for RNG and strips.
- Local server validation, not `file://`.
- Prefer real browser/game flow when runtime behavior changes.

## Phase 2 - Paytable and Win Evaluation

Owner: Codex

Status: `LOCKED`

Objective:

- Replace hardcoded payout logic with an explicit paytable contract.
- Produce structured win results while preserving current payout behavior initially.

Planned checkpoints:

- Phase 2.1 - Paytable config contract.
- Phase 2.2 - Structured payout result shape.
- Phase 2.3 - Connect payout engine to paytable config.
- Phase 2.4 - Debug/automation checks for known symbol outcomes.

Dependencies:

- Locked until Phase 1 is complete.

Restrictions:

- Do not change RTP, volatility, payout values, or pay behavior unless explicitly approved.
- Do not touch Claude visual/FX work.

## Phase 3 - Future Bonus Session Architecture

Owner: Codex

Status: `LOCKED`

Objective:

- Define the future bonus session handoff contract without implementing the internal bonus game.
- Preserve current stable lock collection and pending bonus states.

Planned checkpoints:

- Phase 3.1 - Bonus pending payload contract.
- Phase 3.2 - Session boundary module.
- Phase 3.3 - Debug inspection for pending normal/super bonus payloads.
- Phase 3.4 - Reset/return-to-base contract validation.

Dependencies:

- Locked until Phase 1 is complete.
- Preferably after Phase 2, unless a bonus handoff document is needed earlier.

Restrictions:

- Do not implement internal bonus gameplay.
- Do not add free spins, multipliers, RTP, volatility modes, or new bonus math.
- Do not touch FX/scene/CSS/assets.

## Phase 4 - Internal Bonus Game

Owner: Codex

Status: `LOCKED`

Objective:

- Implement the future internal bonus mode after the session architecture has been approved.

Planned checkpoints:

- Not planned yet.

Dependencies:

- Locked until Phase 3 is complete and human-approved.

Restrictions:

- No work in this phase until explicitly approved.

## Phase 5 - Visual/FX Polish and Asset Integration

Owner: Claude

Status: `IN PROGRESS`

Objective:

- Own visual implementation work:
  - Eye FX.
  - General FX.
  - Smoke.
  - Particles.
  - Lighting.
  - Animation polish.
  - Asset integration.

Known active areas:

- `src/fx/*`
- `src/config/fx-*.config.js`
- `src/scene/*` where visual orchestration is involved.
- `style.css`
- `assets/*`

Dependencies:

- Depends on Codex-defined runtime contracts where visual work needs gameplay events or stable IDs.

Restrictions:

- Claude must not touch RNG, bonus rules, lock logic, state machine, paytable math, respins logic, or core game rules.
- Codex must not touch this phase unless explicitly approved for non-visual integration.

## Phase 6 - Automation and Regression Harness

Owner: Codex

Status: `PENDING`

Objective:

- Create repeatable validation for architecture and gameplay invariants.

Planned checkpoints:

- Phase 6.1 - RNG/strip contract checks.
- Phase 6.2 - Bonus lock scenario checks.
- Phase 6.3 - Paytable known-result checks.
- Phase 6.4 - Browser smoke flow checks through local server.

Dependencies:

- Phase 1.4 for deterministic outcome control.
- Expands after Phase 2 and Phase 3.

Restrictions:

- Test harness must not change game behavior.
- Use local server, not `file://`, for browser validation.

## Phase 7 - Release Stabilization

Owner: Codex

Status: `LOCKED`

Objective:

- Final integration, regression validation, documentation cleanup, and release readiness.

Planned checkpoints:

- Phase 7.1 - Runtime dependency and script order audit.
- Phase 7.2 - Cross-phase regression pass.
- Phase 7.3 - Documentation and handoff cleanup.
- Phase 7.4 - Final browser validation pass.

Dependencies:

- Locked until core architecture and visual handoff are complete.

## Architect Workflow

From now on, Codex should work this way:

1. Read `AGENTS.md`.
2. Read `PROJECT_ROADMAP.md`.
3. Identify the next checkpoint permitted by:
   - current phase status,
   - dependencies,
   - ownership,
   - human approval state,
   - Claude/Codex boundaries.
4. Before modifying files, state:
   - goal,
   - files expected to be touched,
   - risk of conflict with Claude work.
5. Implement only the next permitted checkpoint.
6. Validate the checkpoint:
   - syntax checks for edited JavaScript,
   - local server for browser/runtime validation when behavior changes,
   - real browser/game flow when possible.
7. Update `PROJECT_ROADMAP.md`.
8. Update `CODEX_REPORT.md`.
9. Stop and wait for human approval before continuing to the next checkpoint.

If a checkpoint touches runtime behavior, Codex must not claim stable without real integration validation.
