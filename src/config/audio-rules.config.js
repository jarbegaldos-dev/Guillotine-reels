(function () {
  "use strict";

  window.OSSUARY_AUDIO_RULES = [
    { event: "button_click", play: "ui-button-click" },
    // Boton CONTINUAR de la entrada de las free spins: golpe de hierro al estallar.
    { event: "bonus_intro_start_pressed", play: "bonus-multiplier-stick-blade", params: { pitch: 0.82, volume: 1, priority: 80 } },
    // SPIN o compra sin saldo suficiente (src/ui/controls.js).
    { event: "button_error", play: "ui-button-error" },

    { event: "spin_started", play: "reel-spin-start" },
    { event: "reel_started", play: "reel-mechanism-start" },
    { event: "reel_stopped", play: "reel-stop" },
    { event: "spin_finished", stop: "reel-spin-start" },
    { event: "bonus_reels_spin_started", play: "reel-spin-start" },
    { event: "bonus_reels_mechanism_started", play: "reel-mechanism-start" },
    { event: "bonus_reel_stopped", play: "reel-stop" },
    { event: "bonus_reels_spin_finished", stop: "reel-spin-start" },
    { event: "bonus_mode_spin_silence", stop: "reel-spin-start" },
    { event: "bonus_mode_spin_silence", stop: "reel-mechanism-start" },
    { event: "bonus_mode_spin_silence", stop: "rib1-bonus-respin-loop" },
    { event: "bonus_mode_spin_silence", stop: "small-blade-tremble" },
    { event: "bonus_mode_spin_silence", stop: "small-blade-fall" },

    { event: "bonus_symbol_landed_rib23", play: "bonus-symbol-impact" },
    // Cadena completa (src/fx/bonus-entry-hit.js): golpe grave de hierro y piedra.
    { event: "bonus_entry_hit", play: "bonus-symbol-impact", params: { pitch: 0.62, volume: 1, priority: 90 } },
    { event: "bonus_entry_hit", play: "crow-stone-hit", params: { pitch: 0.55, volume: 0.9, priority: 90 } },
    { event: "small_blade_tremble_started", play: "small-blade-tremble" },
    { event: "small_blade_tremble_stopped", stop: "small-blade-tremble", fadeMs: 45 },
    { event: "small_blade_fall_started", play: "small-blade-fall" },
    { event: "small_blade_fall_stopped", stop: "small-blade-fall", fadeMs: 55 },
    { event: "rib1_blade_fall", play: "rib1-blade-fall" },
    { event: "rib1_bonus_respin_started", play: "rib1-bonus-respin-loop" },
    { event: "bonus_hand_cut", play: "bonus-hand-cut" },
    { event: "guadana_neck_line_started", play: "guadana-neck-line" },
    { event: "guadana_neck_line_stopped", stop: "guadana-neck-line", fadeMs: 30 },
    { event: "guadana_neck_cut", play: "guadana-neck-cut" },
    { event: "bonus_sternum_blade_triggered", play: "bonus-rope-pull" },
    { event: "bonus_candle_light", play: "bonus-candle-light" },
    { event: "bonus_multiplier_levelup", play: "bonus-multiplier-levelup" },
    { event: "bonus_multiplier_stuck_blade", play: "bonus-multiplier-stick-blade" },
    { event: "bonus_mode_started", play: "rib1-blade-fall" },
    { event: "bonus_mode_started", play: "rib1-bonus-respin-loop" },
    { event: "bonus_mode_completed", stop: "rib1-bonus-respin-loop", fadeMs: 160 },
    { event: "bonus_completed", stop: "rib1-bonus-respin-loop", fadeMs: 160 },
    { event: "bonus_failed", stop: "rib1-bonus-respin-loop", fadeMs: 160 },

    { event: "crow_stone_hit", play: "crow-stone-hit" },
    { event: "crow_perch", play: "crow-perch" },
    { event: "payline_shown", play: "payline-win" },
    // Escalera de las lineas de pago (game.js#planWinningPaylineLadder): un golpe
    // seco por linea, cada uno mas alto. Sube 3/4 de la nota de la escala (un
    // golpe subido dos octavas ya no suena a golpe; misma cuenta en
    // tools/bake-win-notes.js). `accent`: la ultima de la escalera, mas fuerte.
    { event: "payline_note", play: "win-hit", params: function (p) { return { pitch: Math.pow(p.pitch || 1, 0.75), volume: 0.36 * (p.accent ? 1.3 : 1), priority: 62 }; } },
    // Cofre del Ruleta Game (src/fx/chest-tension.js): meneo cuando esta casi
    // lleno o lleno, aviso ALMOST FULL y golpe de CHEST FULL.
    { event: "chest_rattle", play: "chest-rattle" },
    { event: "chest_almost_full", play: "chest-rattle", params: { pitch: 0.8, volume: 0.7, priority: 70 } },
    { event: "chest_almost_full", play: "bonus-multiplier-levelup", params: { pitch: 0.85, volume: 0.55, priority: 70 } },
    { event: "chest_full", play: "bonus-symbol-impact", params: { pitch: 0.82, volume: 0.85, priority: 78 } },
    { event: "chest_full", play: "bonus-multiplier-levelup", params: { pitch: 1.05, volume: 0.8, priority: 78 } },
    // Lleno, un premio que no basta: amaga con abrirse (golpe de madera y hierro).
    { event: "chest_tease", play: "chest-rattle", params: { pitch: 0.66, volume: 0.8, priority: 72, maxDurationMs: 700 } },
    { event: "chest_tease", play: "bonus-symbol-impact", params: { pitch: 0.7, volume: 0.6, priority: 72 } },
    { event: "big_win_counter_counting_started", play: "big-win-counter-loop" },
    { event: "big_win_counter_counting_stopped", stop: "big-win-counter-loop", fadeMs: 0 },
    { event: "big_win_counter_pause", play: "big-win-counter-pause" },
    { event: "big_win_counter_beat", play: "big-win-counter-pause" },
    { event: "big_win_counter_completed", play: "big-win-counter-pause" },
    { event: "big_win_counter_epic_started", play: "big-win-counter-epic" },
    // Graznidos de cuervo del contador BIG WIN (dark fantasy, 2026-10-06): al
    // entrar la musica (con los cuervos que cruzan) y cuando el cuervo se posa
    // sobre el numero final. Mas graves y lentos que el original (pitch < 1) y
    // sin su silencio inicial (offsetMs 230).
    { event: "big_win_counter_epic_started", play: "crow-perch", params: { pitch: 0.84, offsetMs: 230, volume: 1, priority: 80 } },
    { event: "big_win_counter_crow_perched", play: "crow-perch", params: { pitch: 0.8, offsetMs: 230, volume: 1, priority: 80 } },
    // Ganancia maxima: el cuervo muerto grande golpea el suelo bajo las cifras.
    { event: "big_win_counter_dead_crow_landed", play: "crow-stone-hit", params: { pitch: 0.78, volume: 1, priority: 82 } },
    // ...y "MAX WIN" se escribe con sangre en el cartel (trazo de las lineas de pago).
    { event: "big_win_counter_max_win_written", play: "payline-win", params: { pitch: 0.85, volume: 1.2, priority: 82 } },
    { event: "big_win_counter_hidden", stop: "big-win-counter-loop", fadeMs: 0 },
    { event: "big_win_counter_hidden", stop: "big-win-counter-epic", fadeMs: 180 },

    // Cuervo dorado (game.js): para un rodillo con un cuervo dorado (subida de
    // nivel del bonus). Raven Bonus: la piedra gana otra tirada (la cerilla de las
    // oportunidades del bonus + un graznido grave).
    { event: "golden_crow_landed", play: "bonus-multiplier-levelup", params: { volume: 1, priority: 80 } },
    { event: "golden_crow_perched", play: "bonus-multiplier-levelup", params: { pitch: 1.15, volume: 1, priority: 82 } },
    { event: "raven_free_spin", play: "bonus-candle-light", params: { volume: 0.9, priority: 78 } },
    { event: "raven_free_spin", play: "crow-perch", params: { pitch: 0.86, offsetMs: 230, volume: 0.9, priority: 78 } },

    // Anticipacion de la cadena del Execution Bonus (game.js): mientras se
    // hacen esperar las mitades que pueden completarla, latidos y un zumbido
    // que sube (tools/bake-stone-sounds.js).
    { event: "bonus_chain_anticipation", play: "stone-tension" },
    { event: "bonus_chain_anticipation_end", stop: "stone-tension", fadeMs: 120 },
    // ...y si no completa la cadena: golpe sordo y grave.
    { event: "bonus_chain_near_miss", play: "bonus-symbol-impact", params: { pitch: 0.55, volume: 0.75, priority: 77 } },

    { event: "debug:skull-eyes-on", play: "debug-skull-eyes-activation" }
  ];
})();
