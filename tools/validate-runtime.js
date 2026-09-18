"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function collectJavaScript(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScript(fullPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

function validateSyntax() {
  const files = [
    path.join(root, "game.js"),
    path.join(root, "local-server.js"),
    path.join(root, "assets", "symbols", "symbol-assets.js"),
    ...collectJavaScript(path.join(root, "src"))
  ];

  files.forEach((filePath) => {
    const result = spawnSync(process.execPath, ["--check", filePath], {
      encoding: "utf8"
    });
    if (result.status !== 0) {
      fail(`Sintaxis inválida en ${relative(filePath)}: ${result.stderr.trim()}`);
    }
  });

  return files.length;
}

function validateScriptOrder() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1].split("?")[0]);
  const positions = new Map(scripts.map((script, index) => [script, index]));

  scripts.forEach((script) => {
    if (/^(?:https?:)?\/\//.test(script)) return;
    const filePath = path.join(root, ...script.split("/"));
    if (!fs.existsSync(filePath)) fail(`Script inexistente cargado por index.html: ${script}`);
  });

  const duplicates = scripts.filter((script, index) => scripts.indexOf(script) !== index);
  if (duplicates.length) fail(`Scripts duplicados en index.html: ${Array.from(new Set(duplicates)).join(", ")}`);

  [
    ["src/bonus/bonus-lock-manager.js", "src/bonus/bonus-feature.js"],
    ["src/bonus/bonus-feature.js", "game.js"],
    ["src/bonus/bonus-mode-lock-handoff.js", "game.js"],
    ["src/core/rng-engine.js", "src/core/outcome-engine.js"],
    ["src/math/combination-path-registry.js", "src/core/combo-engine.js"],
    ["src/math/combination-symbol-evaluator.js", "src/core/combo-evaluator.js"],
    ["src/math/combination-conflict-resolver.js", "src/core/payout-engine.js"],
    ["src/math/symbol-catalog.js", "src/math/paytable-engine.js"],
    ["src/math/paytable-engine.js", "src/math/dry-payout-engine.js"],
    ["src/math/dry-payout-engine.js", "src/math/win-resolver.js"],
    ["src/math/win-resolver.js", "src/math/mechanics-registry.js"],
    ["src/math/mechanics-registry.js", "src/math/simulation-engine.js"],
    ["src/math/simulation-engine.js", "src/math/rtp-framework.js"],
    ["src/math/rtp-framework.js", "src/math/math-engine.js"],
    ["src/math/math-engine.js", "src/math/math-debug-tools.js"],
    ["src/config/paytable.dev.config.js", "game.js"],
    ["src/core/payment-engine.js", "game.js"],
    ["src/ui/big-win-counter.js", "game.js"],
    ["src/debug/payment-debug.js", "game.js"],
    ["src/core/combo-engine.js", "src/core/payout-engine.js"],
    ["src/core/combo-evaluator.js", "game.js"],
    ["src/config/combo.config.js", "game.js"],
    ["src/core/outcome-engine.js", "game.js"],
    ["src/debug/debug-panel.js", "game.js"],
    ["src/debug/bonus-runtime-debug.js", "game.js"],
    ["src/render/reel-renderer.js", "game.js"],
    ["game.js", "src/render/reel-texture-renderer.js"],
    ["src/fx/fx-event-bus.js", "src/fx/fx-director.js"],
    ["src/config/fx-effects.config.js", "src/fx/effect-factory.js"]
  ].forEach(([dependency, consumer]) => {
    if (!positions.has(dependency)) fail(`Falta dependencia en index.html: ${dependency}`);
    if (!positions.has(consumer)) fail(`Falta consumidor en index.html: ${consumer}`);
    if (positions.has(dependency) && positions.has(consumer) && positions.get(dependency) > positions.get(consumer)) {
      fail(`Orden incorrecto en index.html: ${dependency} debe cargar antes que ${consumer}`);
    }
  });

  return scripts.length;
}

function loadInto(context, projectPath) {
  const filename = path.join(root, ...projectPath.split("/"));
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
}

function validateBonusDebugContract() {
  const quietConsole = {
    info() {},
    table() {},
    warn() {},
    error() {}
  };
  const context = vm.createContext({
    window: {},
    console: quietConsole
  });

  loadInto(context, "src/bonus/bonus-lock-manager.js");
  loadInto(context, "src/bonus/bonus-feature.js");
  loadInto(context, "src/debug/bonus-runtime-debug.js");

  const state = {
    reels: [],
    sternumReel: null,
    gameStatus: "IDLE",
    currentSpinType: "BASE"
  };
  const bonusFeature = context.window.OssuaryBonusFeature.create({
    state,
    hooks: {}
  });
  const debug = context.window.OssuaryBonusRuntimeDebug.create({
    state,
    bonusFeature,
    ribBonusReels: new Set(["rib1", "rib2-left", "rib2-right", "rib3-left", "rib3-right"]),
    sternumGiantSymbol: "STERNUM_BONUS",
    idleState: "IDLE",
    hooks: {
      render() {},
      setGameStatus(status) {
        state.gameStatus = status;
      },
      applyBonusLocks() {},
      clearBonusLocks() {}
    }
  });

  [
    "runScenario",
    "runIntegrated",
    "reset",
    "getState",
    "lockRib",
    "lockAllRibs",
    "lockSternum",
    "clearLocks",
    "simulateNormalBonus",
    "simulateSuperBonus",
    "printState",
    "inspectRibBonusLanding",
    "inspectSternumBonusLanding",
    "inspectBonusLanding",
    "inspectLockedGiantState"
  ].forEach((method) => {
    if (typeof debug[method] !== "function") fail(`Contrato de debug incompleto: falta ${method}()`);
  });

  const scenarioResult = debug.runScenario("INITIAL_LOCK_RIB1");
  if (!scenarioResult || scenarioResult.id !== "INITIAL_LOCK_RIB1") {
    fail("El escenario INITIAL_LOCK_RIB1 no devuelve su contrato esperado");
  }

  if (context.window.OssuaryBonusRuntimeDebug.scenarios.length !== 10) {
    fail("El catálogo de escenarios integrados debe contener 10 escenarios");
  }

  const ribIds = ["rib1", "rib2-left", "rib2-right", "rib3-left", "rib3-right"];
  const makeReel = (id, type) => ({
    id,
    type,
    cells: [
      { initial: "FEMUR", effective: "FEMUR" },
      { initial: "VERTEBRA", effective: "VERTEBRA" }
    ],
    giantPool: [],
    giantSymbol: null,
    finalSymbols: [],
    locked: false,
    lockedSymbol: null,
    lockedGiantBlock: null,
    phase: "stopped"
  });
  const integratedState = {
    reels: ribIds.map((id) => makeReel(id, "rib")),
    gameStatus: "IDLE",
    currentSpinType: "BASE"
  };
  integratedState.sternumReel = makeReel("sternum", "sternum");
  integratedState.reels.push(integratedState.sternumReel);

  const integratedFeature = context.window.OssuaryBonusFeature.create({
    state: integratedState,
    hooks: {}
  });
  const clearVisualLocks = () => {
    integratedState.reels.forEach((reel) => {
      reel.locked = false;
      reel.lockedSymbol = null;
      reel.lockedGiantBlock = null;
    });
  };
  const integratedDebug = context.window.OssuaryBonusRuntimeDebug.create({
    state: integratedState,
    bonusFeature: integratedFeature,
    ribBonusReels: new Set(ribIds),
    sternumGiantSymbol: "STERNUM_BONUS",
    idleState: "IDLE",
    hooks: {
      render() {},
      setGameStatus(status) {
        integratedState.gameStatus = status;
      },
      applyBonusLocks(lockedReels, lockedSymbols) {
        (lockedReels || []).forEach((reelId) => {
          const reel = integratedState.reels.find((item) => item.id === reelId);
          if (!reel) return;
          reel.locked = true;
          reel.lockedSymbol = lockedSymbols[reelId];
          reel.lockedGiantBlock = { symbol: lockedSymbols[reelId], locked: true };
        });
      },
      clearBonusLocks: clearVisualLocks,
      prepareLockedBonusReel() {},
      inspectRibBonusLandingState() {
        return integratedState.reels
          .filter((reel) => ribIds.includes(reel.id))
          .map((reel) => ({
            reelId: reel.id,
            completedByRibBonus: reel.giantSymbol === "RIB_BONUS"
          }));
      },
      ribBonusLandingReelsFromInspection(inspection) {
        return inspection
          .filter((item) => item.completedByRibBonus)
          .map((item) => item.reelId);
      },
      inspectSternumBonusLandingState() {
        return {
          reelId: "sternum",
          completedBySternumBonus: integratedState.sternumReel.giantSymbol === "STERNUM_BONUS"
        };
      },
      sternumBonusLandingReelFromInspection(inspection) {
        return inspection.completedBySternumBonus ? inspection.reelId : null;
      },
      updateLandingInspectionWithBonusResult(inspection) {
        return inspection;
      },
      updateSternumInspectionWithBonusResult(inspection) {
        return inspection;
      },
      refreshSternumLockInspectionAfterApply() {},
      reelByIdForLock(reelId) {
        return integratedState.reels.find((reel) => reel.id === reelId);
      }
    }
  });

  const normal = integratedDebug.runIntegrated("FIVE_RIBS_NO_STERNUM");
  if (!normal || normal.finalState.phase !== "BONUS_MODE_PENDING" || normal.finalState.lockedRibCount !== 5) {
    fail("La simulación integrada de bonus normal perdió su contrato");
  }

  const superBonus = integratedDebug.runIntegrated("FIVE_RIBS_WITH_STERNUM");
  if (!superBonus || superBonus.finalState.phase !== "SUPER_BONUS_MODE_PENDING" || !superBonus.finalState.lockedSternum) {
    fail("La simulación integrada de super bonus perdió su contrato");
  }
}

function validateBonusModeLockHandoff() {
  const context = vm.createContext({
    window: {}
  });
  loadInto(context, "src/bonus/bonus-mode-lock-handoff.js");

  const reels = [
    { id: "rib1", locked: true, lockedGiantBlock: { symbol: "RIB_BONUS" } },
    { id: "rib2-left", locked: true, lockedGiantBlock: { symbol: "RIB_BONUS" } },
    { id: "rib2-right", locked: true, lockedGiantBlock: { symbol: "RIB_BONUS" } },
    { id: "rib3-left", locked: true, lockedGiantBlock: { symbol: "RIB_BONUS" } },
    { id: "rib3-right", locked: true, lockedGiantBlock: { symbol: "RIB_BONUS" } },
    { id: "rib4-left", locked: false, lockedGiantBlock: null }
  ];
  const released = [];
  const result = context.window.OssuaryBonusModeLockHandoff.prepareNormalBonusMode({
    reels,
    fixedReelId: "rib1",
    releaseLockForSpin(reel) {
      released.push(reel.id);
      reel.locked = false;
      reel.lockedGiantBlock = null;
      reel.carryGiantBlock = { symbol: "RIB_BONUS" };
    }
  });

  const expectedReleased = ["rib2-left", "rib2-right", "rib3-left", "rib3-right"];
  if (JSON.stringify(released) !== JSON.stringify(expectedReleased)) {
    fail("El handoff al Bonus Game debe liberar los locks heredados de rib2/rib3");
  }
  if (!reels[0].locked || !reels[0].lockedGiantBlock) {
    fail("El handoff al Bonus Game debe conservar rib1 como pieza fija");
  }
  if (reels.slice(1, 5).some((reel) => reel.locked || reel.lockedGiantBlock || !reel.carryGiantBlock)) {
    fail("Los BONUS heredados de rib2/rib3 deben quedar como carry animado, no como locks");
  }
  if (
    JSON.stringify(Array.from(result.releasedReels)) !== JSON.stringify(expectedReleased) ||
    JSON.stringify(Array.from(result.retainedReels)) !== JSON.stringify(["rib1"])
  ) {
    fail("El handoff al Bonus Game debe informar los locks liberados y retenidos");
  }
}

function validateComboArchitecture() {
  const context = vm.createContext({
    window: {},
    console: { info() {}, table() {}, warn() {}, error() {} }
  });

  loadInto(context, "src/config/layout.config.js");
  loadInto(context, "src/config/combo.config.js");
  loadInto(context, "src/core/game-state.js");
  loadInto(context, "src/core/reel-model.js");
  loadInto(context, "src/math/combination-path-registry.js");
  loadInto(context, "src/math/combination-symbol-evaluator.js");
  loadInto(context, "src/core/combo-engine.js");
  loadInto(context, "src/core/combo-evaluator.js");

  const state = context.window.OssuaryGameState.createInitialState();
  const layout = context.window.OSSUARY_LAYOUT_CONFIG;
  const comboConfig = context.window.OSSUARY_COMBO_CONFIG;
  const reelModel = context.window.OssuaryReelModel.create({
    layout: {
      RIB_LAYOUT: layout.RIB_LAYOUT,
      STERNUM_LAYOUT: layout.STERNUM_LAYOUT
    },
    config: {
      DECELERATION_TIME: 1,
      VISIBLE_TILE_RADIUS: 3
    },
    state,
    hooks: {
      buildFinalSymbolMap() {},
      clearGiantPool() {},
      setReelPhase() {},
      renderReel() {},
      commitVisibleSymbols() {}
    }
  });
  reelModel.buildReels();

  const comboEngine = context.window.OssuaryComboEngine.create({
    state,
    config: comboConfig
  });

  const allPaths = comboEngine.allValidPaths();
  const board = comboEngine.inspectBoard();
  const minLength = Math.min.apply(null, allPaths.map((path) => path.length));
  const maxLength = Math.max.apply(null, allPaths.map((path) => path.length));
  const uniqueKeys = new Set(allPaths.map((path) => path.map((cell) => cell.id).join("|")));
  const startColumnCellIds = ((board.columns[0] && board.columns[0].cellIds) || []).slice().sort();
  const actualStartCellIds = (board.startCellIds || []).slice().sort();
  const cellLookup = {};
  allPaths.forEach((path) => {
    path.forEach((cell) => {
      cellLookup[cell.id] = cell;
    });
  });

  if (!allPaths.length) fail("Combo engine sin trayectorias");
  if (board.columnCount !== 5) fail("La geometria debe producir 5 columnas anatomicas (rib3 con 2 celdas por lado)");
  if (minLength !== 3) fail("La longitud minima valida debe ser 3");
  if (maxLength !== 5) fail("La longitud maxima de trayectorias debe ser 5");
  if (uniqueKeys.size !== allPaths.length) fail("Existen trayectorias duplicadas");
  if (board.startPolicy !== "all_cells_in_leftmost_column") fail("La politica de inicio debe usar toda la columna mas a la izquierda");
  if (JSON.stringify(actualStartCellIds) !== JSON.stringify(startColumnCellIds)) {
    fail("Las celdas de inicio deben coincidir exactamente con la columna mas a la izquierda");
  }
  const wrongStartColumn = allPaths.some((path) => path[0].columnIndex !== 0);
  if (wrongStartColumn) fail("Toda trayectoria debe empezar en la columna mas a la izquierda");
  const missingStartCell = startColumnCellIds.some((cellId) => !allPaths.some((path) => path[0].id === cellId));
  if (missingStartCell) fail("Cada celda de la columna inicial debe generar al menos una trayectoria");

  const invalidStep = allPaths.some((path) => {
    for (let i = 1; i < path.length; i += 1) {
      const prev = path[i - 1];
      const curr = path[i];
      const columnDelta = curr.columnIndex - prev.columnIndex;
      if (columnDelta !== 1) return true;
      if (curr.reelId === prev.reelId) return true;
      const nextColumn = board.columns[curr.columnIndex];
      if (!nextColumn) return true;
      let nearestRowIndex = 0;
      let nearestDistance = Infinity;
      nextColumn.cellIds.forEach((cellId, index) => {
        const candidate = cellLookup[cellId];
        const distance = Math.abs((candidate.y + candidate.h / 2) - (prev.y + prev.h / 2));
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestRowIndex = index;
        }
      });
      const rowDelta = curr.rowIndex - nearestRowIndex;
      if (![-1, 0, 1].includes(rowDelta)) return true;
    }
    return false;
  });
  if (invalidStep) fail("Cada paso debe avanzar exactamente una columna y solo recto/diagonal");

  const reversePath = allPaths.some((path) => {
    return path.some((cell, index) => index > 0 && cell.columnIndex <= path[index - 1].columnIndex);
  });
  if (reversePath) fail("Las trayectorias solo pueden ir de izquierda a derecha");

  const expectedLengths = [3, 4, 5];
  const missingLengths = expectedLengths.filter(
    (length) => !allPaths.some((path) => path.length === length)
  );
  if (missingLengths.length) fail("Faltan longitudes de trayectorias: " + missingLengths.join(", "));

  const substituteState = {
    reels: [
      {
        id: "left",
        cells: [
          { id: "left-1", x: 0, y: 0, w: 10, h: 10, effective: "FEMUR" }
        ]
      },
      {
        id: "mid",
        cells: [
          { id: "mid-1", x: 12, y: 0, w: 10, h: 10, effective: "WILD" }
        ]
      },
      {
        id: "right",
        cells: [
          { id: "right-1", x: 24, y: 0, w: 10, h: 10, effective: "FEMUR" }
        ]
      },
      {
        id: "far-right",
        cells: [
          { id: "far-right-1", x: 36, y: 0, w: 10, h: 10, effective: "RIB_BONUS" }
        ]
      }
    ]
  };
  const substituteEngine = context.window.OssuaryComboEngine.create({
    state: substituteState,
    config: comboConfig
  });
  if (substituteEngine.inspectSymbolPaths("FEMUR").longestPath.length !== 3) {
    fail("WILD debe sustituir simbolos normales");
  }
  if (substituteEngine.inspectSymbolPaths("RIB_BONUS").longestPath.length !== 0) {
    fail("WILD no debe sustituir BONUS_RIB");
  }

  const sternumPaths = allPaths.filter((path) => path.some((cell) => cell.reelId === "sternum"));
  const brokenSternum = sternumPaths.some((path) => {
    const sternumIndex = path.findIndex((cell) => cell.reelId === "sternum");
    return sternumIndex <= 0 || sternumIndex >= path.length - 1;
  });
  if (brokenSternum) fail("El esternon solo puede aparecer en continuidad");

  const evaluator = context.window.OssuaryComboEvaluator.create({
    comboEngine,
    config: {
      NORMAL_SYMBOLS: ["FEMUR", "VERTEBRA"],
      EXCLUDED_SYMBOLS: ["RIB_BONUS", "STERNUM_BONUS"],
      WILD_SYMBOL: "WILD",
      MIN_MATCH_LENGTH: 3
    }
  });
  const fakeBoard = [
    { id: "rib3-2", symbol: "FEMUR" },
    { id: "rib2-2", symbol: "FEMUR" },
    { id: "rib1-2", symbol: "WILD" },
    { id: "rib2-3", symbol: "FEMUR" },
    { id: "rib3-5", symbol: "FEMUR" },
    { id: "rib2-1", symbol: "RIB_BONUS" },
    { id: "sternum-3", symbol: "STERNUM_BONUS" }
  ];
  const wins = evaluator.evaluateRoutes(fakeBoard, comboEngine.generateRoutes());
  if (!wins.length) fail("El evaluador de combinaciones debe detectar combinaciones fake");
  if (!wins.some((entry) => entry.symbol === "FEMUR" && entry.length === 5 && entry.wildsUsed)) {
    fail("El evaluador debe detectar la combinacion fake larga con WILD");
  }
  if (wins.some((entry) => entry.symbol === "RIB_BONUS" || entry.symbol === "STERNUM_BONUS")) {
    fail("El evaluador no debe devolver BONUS_RIB ni SUPER_BONUS");
  }

  const prefixOnly = evaluator.evaluateRoutes([
    { id: "rib3-2", symbol: "FEMUR" },
    { id: "rib4-1", symbol: "WILD" },
    { id: "rib5-2", symbol: "FEMUR" },
    { id: "sternum-2", symbol: "FEMUR" },
    { id: "rib4-3", symbol: "RIB_BONUS" }
  ], [
    [
      { id: "rib3-2", reelId: "rib3-left" },
      { id: "rib4-1", reelId: "rib4-left" },
      { id: "rib5-2", reelId: "rib5-left" },
      { id: "sternum-2", reelId: "sternum" },
      { id: "rib4-3", reelId: "rib4-right" }
    ]
  ]);
  if (!prefixOnly.length || prefixOnly[0].length !== 4) {
    fail("El evaluador debe conservar el prefijo valido antes de cortar la ruta");
  }
  if (prefixOnly[0].positions.length !== 4 || prefixOnly[0].symbols[1] !== "WILD") {
    fail("El evaluador debe reportar posiciones y wilds del prefijo ganador");
  }

  loadInto(context, "src/math/combination-conflict-resolver.js");
  const conflictResolver = context.window.OssuaryMathCombinationConflictResolver.create({
    config: {
      SHARE_POLICY: "no_shared_positions",
      PRIORITY_RULES: ["length", "fewestWilds", "routeId"]
    }
  });
  const sampleWins = [
    { id: 2, length: 4, positions: ["a", "b", "c", "d"], symbols: ["FEMUR", "WILD", "FEMUR", "FEMUR"] },
    { id: 1, length: 5, positions: ["a", "b", "c", "x", "y"], symbols: ["FEMUR", "FEMUR", "FEMUR", "FEMUR", "FEMUR"] },
    { id: 3, length: 5, positions: ["m", "n", "o", "p", "q"], symbols: ["VERTEBRA", "VERTEBRA", "VERTEBRA", "VERTEBRA", "VERTEBRA"] }
  ];
  const conflictMap = conflictResolver.detectConflicts(sampleWins);
  if (conflictMap.length !== 1 || conflictMap[0].sharedPositions.length !== 3) {
    fail("El resolver debe detectar posiciones compartidas");
  }
  const resolved = conflictResolver.resolve(sampleWins);
  if (resolved.accepted.length !== 2 || resolved.accepted[0].id !== 1 || resolved.accepted[1].id !== 3) {
    fail("El resolver debe priorizar longitud y preservar rutas no conflictivas");
  }

  const sharedWildResolver = context.window.OssuaryMathCombinationConflictResolver.create({
    config: {
      SHARE_POLICY: "no_shared_wilds"
    }
  });
  const sharedWildConflicts = sharedWildResolver.detectConflicts([
    { id: 1, length: 3, positions: ["w1", "a", "b"], symbols: ["WILD", "FEMUR", "FEMUR"] },
    { id: 2, length: 3, positions: ["w1", "c", "d"], symbols: ["WILD", "VERTEBRA", "VERTEBRA"] }
  ]);
  if (!sharedWildConflicts.length || sharedWildConflicts[0].sharedWilds[0] !== "w1") {
    fail("El resolver debe detectar wild compartido");
  }

  loadInto(context, "src/math/symbol-catalog.js");
  loadInto(context, "src/math/paytable-engine.js");
  loadInto(context, "src/math/dry-payout-engine.js");
  const paytable = context.window.OssuaryMathPaytableEngine.create();
  const catalog = paytable.catalog;
  if (!catalog.isCategory("WILD", context.window.OSSUARY_MATH_SYMBOL_CATEGORIES.WILD)) {
    fail("El catalogo debe clasificar WILD correctamente");
  }
  if (!catalog.isCategory("RIB_BONUS", context.window.OSSUARY_MATH_SYMBOL_CATEGORIES.BONUS)) {
    fail("El catalogo debe clasificar BONUS_RIB correctamente");
  }
  if (!catalog.isCategory("STERNUM_BONUS", context.window.OSSUARY_MATH_SYMBOL_CATEGORIES.SUPER_BONUS)) {
    fail("El catalogo debe clasificar SUPER_BONUS correctamente");
  }
  if (paytable.validate().some((entry) => !entry.valid)) {
    fail("La paytable debe declarar pagos 3-7 para todos los simbolos");
  }
  if (paytable.payout("FEMUR", 3) !== 0 || paytable.payout("WILD", 7) !== 0) {
    fail("La paytable base debe ser neutra hasta integrar pagos reales");
  }

  const dryPaytable = context.window.OssuaryMathPaytableEngine.create({
    symbols: [
      {
        id: "FEMUR",
        category: "NORMAL",
        payouts: { 3: 2, 4: 4, 5: 6, 6: 8, 7: 10 }
      },
      {
        id: "RIB_BONUS",
        category: "BONUS",
        payouts: { 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
      }
    ]
  });
  const dryPayout = context.window.OssuaryMathDryPayoutEngine.create({
    paytable: dryPaytable
  }).calculate([
    { id: 1, symbol: "FEMUR", length: 5, positions: ["a", "b", "c", "d", "e"], wildsUsed: true },
    { id: 2, symbol: "RIB_BONUS", length: 5, positions: ["f", "g", "h", "i", "j"], wildsUsed: false }
  ], 3);
  if (dryPayout.total !== 18 || dryPayout.payouts[0].amount !== 18 || dryPayout.payouts[1].amount !== 0) {
    fail("El dry payout engine debe calcular premios teoricos sin tocar saldo");
  }

  loadInto(context, "src/math/win-resolver.js");
  const resolverPaytable = context.window.OssuaryMathPaytableEngine.create({
    symbols: [
      { id: "FEMUR", category: "NORMAL", payouts: { 3: 2, 4: 4, 5: 6, 6: 8, 7: 10 } },
      { id: "VERTEBRA", category: "NORMAL", payouts: { 3: 1, 4: 2, 5: 3, 6: 4, 7: 5 } }
    ]
  });
  const resolver = context.window.OssuaryMathWinResolver.create({
    conflictResolver: context.window.OssuaryMathCombinationConflictResolver.create({
      config: { SHARE_POLICY: "no_shared_positions", PRIORITY_RULES: ["length", "routeId"] }
    }),
    payoutEngine: context.window.OssuaryMathDryPayoutEngine.create({
      paytable: resolverPaytable
    })
  });
  const resolvedWins = resolver.resolve({
    bet: 2,
    combinations: [
      { id: 2, symbol: "VERTEBRA", length: 4, positions: ["x", "y", "z", "t"], symbols: ["VERTEBRA", "VERTEBRA", "VERTEBRA", "VERTEBRA"] },
      { id: 1, symbol: "FEMUR", length: 5, positions: ["x", "y", "z", "u", "v"], symbols: ["FEMUR", "FEMUR", "FEMUR", "FEMUR", "FEMUR"] }
    ]
  });
  if (resolvedWins.accepted.length !== 1 || resolvedWins.accepted[0].id !== 1) {
    fail("El win resolver debe conservar solo la combinacion prioritaria en conflicto");
  }
  if (resolvedWins.total !== 12 || resolvedWins.payouts[0].amount !== 12) {
    fail("El win resolver debe sumar el premio teorico de las combinaciones aceptadas");
  }

  loadInto(context, "src/math/mechanics-registry.js");
  const mechanics = context.window.OssuaryMathMechanicsRegistry.create({
    mechanics: context.window.OSSUARY_MATH_FUTURE_MECHANICS.concat([
      {
        id: "test_multiplier",
        enabled: true,
        stages: ["beforePayout"],
        priority: 1,
        handlers: {
          beforePayout(ctx) {
            return ctx.base * 2;
          }
        }
      }
    ])
  });
  if (!mechanics.get("walking_wild") || !mechanics.get("feature_buy")) {
    fail("La arquitectura futura debe declarar mecanicas previstas");
  }
  const stageResults = mechanics.runStage("beforePayout", { base: 3 });
  if (stageResults.length !== 1 || stageResults[0].result !== 6) {
    fail("El registro de mecanicas debe ejecutar handlers por etapa");
  }

  loadInto(context, "src/math/simulation-engine.js");
  const simulator = context.window.OssuaryMathSimulationEngine.create();
  const simulation = simulator.run({
    count: 3,
    nextSpin(index) {
      if (index === 0) {
        return {
          boardState: [{ id: "a", symbol: "FEMUR" }, { id: "b", symbol: "WILD" }],
          resolved: { accepted: [{ id: 10 }], total: 12 },
          trigger: "BONUS"
        };
      }
      if (index === 1) {
        return {
          boardState: [{ id: "c", symbol: "VERTEBRA" }],
          resolved: { accepted: [], total: 0 },
          trigger: null
        };
      }
      return {
        boardState: [{ id: "d", symbol: "RIB_BONUS" }],
        resolved: { accepted: [{ id: 12 }], total: 4 },
        trigger: "SUPER_BONUS"
      };
    }
  });
  if (simulation.totalSpins !== 3 || simulation.prizeCount !== 2) {
    fail("El simulation engine debe contar spins y premios");
  }
  if (simulation.bonusCount !== 1 || simulation.superBonusCount !== 1) {
    fail("El simulation engine debe contar bonus y super bonus");
  }
  if (simulation.routeFrequency["10"] !== 1 || simulation.symbolFrequency.FEMUR !== 1) {
    fail("El simulation engine debe acumular frecuencias de rutas y simbolos");
  }

  loadInto(context, "src/math/rtp-framework.js");
  const rtpFramework = context.window.OssuaryMathRtpFramework.create();
  rtpFramework.observeSpin({ bet: 2, win: 6 });
  rtpFramework.observeSpin({ bet: 2, win: 0 });
  const rtpSnapshot = rtpFramework.snapshot();
  if (rtpSnapshot.observed.spins !== 2 || rtpSnapshot.observed.totalBet !== 4 || rtpSnapshot.observed.totalWin !== 6) {
    fail("El framework RTP debe registrar muestras sin calcular metricas finales");
  }
  if (rtpSnapshot.metrics.rtp.value !== null || rtpSnapshot.metrics.volatility.value !== null) {
    fail("El framework RTP no debe calcular metricas finales todavia");
  }

  loadInto(context, "src/math/math-engine.js");
  loadInto(context, "src/math/math-debug-tools.js");
  const mathEngine = context.window.OssuaryMathEngine.create({
    comboEngine,
    evaluatorConfig: {
      NORMAL_SYMBOLS: ["FEMUR", "VERTEBRA"],
      EXCLUDED_SYMBOLS: ["RIB_BONUS", "STERNUM_BONUS"],
      WILD_SYMBOL: "WILD",
      MIN_MATCH_LENGTH: 3
    },
    symbols: [
      { id: "FEMUR", category: "NORMAL", payouts: { 3: 2, 4: 4, 5: 6, 6: 8, 7: 10 } },
      { id: "VERTEBRA", category: "NORMAL", payouts: { 3: 1, 4: 2, 5: 3, 6: 4, 7: 5 } }
    ]
  });
  const mathResolution = mathEngine.resolveBoard(fakeBoard, 2, comboEngine.generateRoutes());
  if (!mathResolution.combinations.length || mathResolution.resolution.total <= 0) {
    fail("El math engine debe orquestar evaluacion y resolucion");
  }
  const mathDebug = context.window.OssuaryMathDebugTools.create({
    engine: mathEngine
  });
  const benchmark = mathDebug.benchmark("combo", 3, function () {
    mathEngine.evaluateBoard(fakeBoard, comboEngine.generateRoutes());
  });
  if (benchmark.elapsedMs < 0) {
    fail("Las developer tools deben medir rendimiento");
  }

}

function validatePaymentArchitecture() {
  const events = [];
  const fakeStage = {
    children: [],
    appendChild(node) {
      this.children.push(node);
    }
  };
  const fakeDocument = {
    createElement() {
      return {
        style: {},
        children: [],
        textContent: "",
        appendChild(child) {
          this.children.push(child);
        },
        setAttribute() {}
      };
    }
  };
  const context = vm.createContext({
    window: {
      setTimeout,
      clearTimeout,
      requestAnimationFrame(callback) {
        return setTimeout(() => callback(Date.now()), 0);
      },
      cancelAnimationFrame(handle) {
        clearTimeout(handle);
      }
    },
    document: fakeDocument,
    console: { info() {}, table() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout
  });
  context.window.document = fakeDocument;

  loadInto(context, "src/core/payment-engine.js");
  loadInto(context, "src/ui/big-win-counter.js");
  loadInto(context, "src/debug/payment-debug.js");

  const state = { balance: 100, lastPaidSpinId: null, lastPayment: null };
  const paymentEngine = context.window.OssuaryPaymentEngine.create({
    state,
    hooks: {
      getBalance: () => state.balance,
      setBalance: (nextBalance) => {
        state.balance = nextBalance;
      },
      emitEvent: (name, detail) => events.push({ name, detail })
    }
  });

  const firstPayment = paymentEngine.applyPayment({
    paymentId: "spin-1",
    spinId: "spin-1",
    totalWin: 12,
    bet: 2
  });
  const duplicatePayment = paymentEngine.applyPayment({
    paymentId: "spin-1",
    spinId: "spin-1",
    totalWin: 12,
    bet: 2
  });
  if (!firstPayment.applied || duplicatePayment.applied || state.balance !== 112) {
    fail("El payment engine debe pagar una sola vez por paymentId");
  }
  if (events.filter((entry) => entry.name === "payment_started").length !== 1 || events.filter((entry) => entry.name === "payment_completed").length !== 1) {
    fail("El payment engine debe emitir payment_started y payment_completed");
  }

  const bigWinEvents = [];
  const bigWinCounter = context.window.OssuaryBigWinCounter.create({
    stage: fakeStage,
    formatCurrency(amount) {
      return "€" + Number(amount).toFixed(2);
    },
    hooks: {
      emitEvent(name, detail) {
        bigWinEvents.push({ name, detail });
      }
    }
  });
  const bigWinPromise = bigWinCounter.show(15, 2);
  if (!bigWinPromise || typeof bigWinPromise.then !== "function" || !bigWinEvents.some((entry) => entry.name === "big_win_counter_started")) {
    fail("El big win counter debe iniciar y emitir su evento");
  }

  const paymentDebug = context.window.OssuaryPaymentDebugFactory.create({
    state,
    paymentEngine,
    bigWinCounter: {
      show() {
        return Promise.resolve({ ok: true });
      }
    },
    hooks: {
      currentBet: () => 2
    }
  });
  const forced = paymentDebug.forcePayment(5);
  if (!forced.applied || paymentDebug.lastPayment().totalWin !== 5) {
    fail("El debug de pagos debe permitir pagos forzados");
  }
  paymentDebug.reset();
  if (paymentEngine.getState().lastPayment !== null) {
    fail("El reset del debug de pagos debe limpiar el ultimo pago");
  }
}

function validateAudioAssetFiles() {
  const context = vm.createContext({ window: {}, console: { warn() {}, error() {} } });
  loadInto(context, "src/config/audio-sounds.config.js");
  (context.window.OSSUARY_AUDIO_SOUNDS || []).forEach((sound) => {
    if (sound.enabled === false || !sound.file) return;
    const filePath = path.join(root, ...sound.file.split("/"));
    if (!fs.existsSync(filePath)) {
      fail(`Asset de audio inexistente para ${sound.id}: ${sound.file}`);
    }
  });
}

function validatePaylineMatrixContract() {
  const columns = [
    [null, "rib2-1", "rib3-2", "rib4-1", "rib5-1"],
    ["rib1-1", "rib2-2", "rib3-3", "rib4-2", "rib5-2"],
    ["rib1-2", "sternum-1", "sternum-2", "sternum-3", null],
    ["rib1-3", "rib2-3", "rib3-4", "rib4-3", "rib5-3"],
    [null, "rib2-4", "rib3-5", "rib4-4", "rib5-4"]
  ];
  const minLen = 3;
  const positions = new Map();
  columns.forEach((column, col) => {
    column.forEach((id, row) => {
      if (id) positions.set(id, { col, row });
    });
  });

  function routeKey(route) {
    return route.join(" -> ");
  }

  function isStrict(route) {
    if (route.length < minLen) return false;
    const first = positions.get(route[0]);
    if (!first || first.col !== 0) return false;
    for (let i = 1; i < route.length; i++) {
      const prev = positions.get(route[i - 1]);
      const next = positions.get(route[i]);
      if (!prev || !next) return false;
      if (next.col !== prev.col + 1) return false;
      if (Math.abs(next.row - prev.row) > 1) return false;
    }
    return true;
  }

  function nextCellIds(col, row) {
    const nextColumn = columns[col + 1] || [];
    const ids = [];
    for (let nextRow = row - 1; nextRow <= row + 1; nextRow++) {
      const id = nextColumn[nextRow];
      if (id) ids.push(id);
    }
    return ids;
  }

  const routes = [];
  const seen = new Set();
  function save(route) {
    if (route.length < minLen) return;
    const key = routeKey(route);
    if (seen.has(key)) return;
    seen.add(key);
    routes.push(route.slice());
  }
  function walk(col, row, route) {
    save(route);
    if (col >= columns.length - 1) return;
    nextCellIds(col, row).forEach((id) => {
      const next = positions.get(id);
      if (!next || next.col !== col + 1) return;
      route.push(id);
      walk(next.col, next.row, route);
      route.pop();
    });
  }
  columns[0].forEach((id, row) => {
    if (id) walk(0, row, [id]);
  });

  const routeSet = new Set(routes.map(routeKey));
  const expectedStarts = ["rib2-1", "rib3-2", "rib4-1", "rib5-1"];
  const actualStarts = columns[0].filter(Boolean);
  if (routeKey(actualStarts) !== routeKey(expectedStarts)) {
    fail("Las lineas de pago deben empezar solo en C0: RIP2, RIP3, RIP4 y RIP5");
  }
  if (routes.some((route) => route[0] === "rib1-1" || route[0] === "rib1-2" || route[0] === "rib1-3")) {
    fail("Ninguna linea de pago puede empezar en RIP1");
  }
  routes.forEach((route) => {
    if (!isStrict(route)) {
      fail(`Ruta de pago invalida: ${routeKey(route)}`);
    }
  });

  [
    ["rib2-1", "rib1-1", "sternum-1", "rib2-3", "rib2-4"],
    ["rib2-1", "rib2-2", "sternum-2", "rib2-3"],
    ["rib4-1", "rib5-2", "sternum-3", "rib5-3", "rib5-4"]
  ].forEach((route) => {
    if (!routeSet.has(routeKey(route))) {
      fail(`Debe existir la ruta valida: ${routeKey(route)}`);
    }
  });

  [
    ["rib3-2", "rib1-1"],
    ["rib3-3", "rib1-2"],
    ["rib4-1", "rib2-2"],
    ["rib4-1", "rib1-1"],
    ["rib4-2", "rib1-2"],
    ["rib4-2", "rib1-1"],
    ["rib5-2", "rib5-4"]
  ].forEach((pair) => {
    const found = routes.some((route) => {
      for (let i = 1; i < route.length; i++) {
        if (route[i - 1] === pair[0] && route[i] === pair[1]) return true;
      }
      return false;
    });
    if (found) {
      fail(`No debe existir el salto invalido: ${routeKey(pair)}`);
    }
  });

  const immediateNext = new Map();
  routes.forEach((route) => {
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1];
      const to = route[i];
      if (!immediateNext.has(from)) immediateNext.set(from, new Set());
      immediateNext.get(from).add(to);
    }
  });
  function nextList(cellId) {
    return Array.from(immediateNext.get(cellId) || []).sort();
  }
  const rib4Casilla2Next = nextList("rib4-2");
  const expectedRib4Casilla2Next = ["sternum-2", "sternum-3"];
  if (routeKey(rib4Casilla2Next) !== routeKey(expectedRib4Casilla2Next)) {
    fail(`RIP4 casilla visual 2 solo puede ir a EST2/EST3, no a: ${routeKey(rib4Casilla2Next)}`);
  }
  const rib2Casilla2Next = nextList("rib2-2");
  const expectedRib2Casilla2Next = ["rib1-2", "sternum-1", "sternum-2"];
  if (routeKey(rib2Casilla2Next) !== routeKey(expectedRib2Casilla2Next)) {
    fail(`RIP2 casilla visual 2 solo puede ir a RIP1 visual 3/EST1/EST2, no a: ${routeKey(rib2Casilla2Next)}`);
  }

  const sternum1Next = nextList("sternum-1");
  const expectedSternum1Next = ["rib1-3", "rib2-3", "rib3-4"];
  if (routeKey(sternum1Next) !== routeKey(expectedSternum1Next)) {
    fail(`EST1 debe comportarse como la fila RIP2 en C2, no ir a: ${routeKey(sternum1Next)}`);
  }
}

const syntaxFiles = validateSyntax();
const scriptCount = validateScriptOrder();
validateBonusDebugContract();
validateBonusModeLockHandoff();
validateComboArchitecture();
validatePaymentArchitecture();
validateAudioAssetFiles();
validatePaylineMatrixContract();

if (failures.length) {
  console.error("\nValidación fallida:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Validación correcta: ${syntaxFiles} archivos JavaScript y ${scriptCount} scripts runtime.`);
}
