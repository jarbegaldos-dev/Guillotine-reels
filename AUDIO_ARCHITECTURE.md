# AUDIO_ARCHITECTURE.md

Documento maestro del audio de **Ossuary Reels**. Lo mantiene Claude Code. Revisado el 2026-10-08 contra el código; si choca con él, manda el código.

---

## 1. Filosofía

- El motor de audio no sabe nada del juego: ni RNG, ni pagos, ni locks, ni geometría.
- El juego no llama a `play()`: emite eventos con `window.OssuaryAudio.trigger(evento, payload)`.
- Qué suena con cada evento está en `src/config/audio-rules.config.js`; qué es cada sonido (archivo, bus, volumen, bucle...) en `src/config/audio-sounds.config.js`. Añadir un sonido es tocar configuración, no código.
- Ningún módulo de `src/audio/` importa nada de `game.js`, `src/core/`, `src/bonus/` ni `src/render/`.
- Excepciones a propósito (llaman a `OssuaryAudio.play`/`stop` directamente): el tic de la ruleta (`ruleta-game.js`, `reel-stop` a bajo volumen y tono alto), el recuento de la ruleta (`big-win-counter-pause` corto) y el salto con clic del contador BIG WIN (vuelve a situar la música épica).

## 2. Archivos

```
src/audio/
├─ audio-event-bus.js                 Pub/sub genérico (independiente del de FX)
├─ audio-engine.js                     Web Audio: precarga, play/stop, fades, ducking, pools, master
├─ audio-bus-manager.js                Buses: volumen base, mute, solo, prioridad
├─ audio-director.js                   window.OssuaryAudio: aplica las reglas
├─ adaptive/adaptive-music-controller.js  Música por modo (normal, bonus, ruleta)
├─ perf/audio-performance-monitor.js   Muestreo de voces activas
└─ debug/audio-debug-panel.js          window.OssuaryAudioDebug

src/config/
├─ audio-buses.config.js               Buses y su volumen por defecto
├─ audio-sounds.config.js              Sonidos
└─ audio-rules.config.js               Evento → play/stop

src/ui/audio-settings.js               Ajustes del jugador (música, efectos, silencio)
tools/bake-ui-sounds.js                Genera los sonidos de interfaz (clic y error)
```

### Flujo de un evento

```
game.js / controls.js / FX / ruleta
   │  window.OssuaryAudio.trigger(evento, payload)
   ▼
audio-director.js
   │  1. audio-event-bus.emit(evento)  → oyentes (p. ej. la música adaptativa)
   │  2. reglas de audio-rules.config.js con ese evento (y su .when, si lo hay)
   ▼
audio-engine.js
   │  BufferSource → ganancia de la voz → ganancia del bus → master → salida
```

## 3. Buses

`MASTER`, `MUSIC`, `AMBIENCE`, `UI`, `BUTTONS`, `REELS`, `SYMBOLS`, `BONUS`, `RESPINS`, `BIGWIN`, `VOICE`, `DEBUG` (`audio-buses.config.js`). Con sonidos hoy: `MUSIC`, `BUTTONS`, `REELS`, `SYMBOLS`, `BONUS`, `BIGWIN` y `DEBUG`.

## 4. Ajustes del jugador

`src/ui/audio-settings.js` (`window.OssuaryAudioSettings`), desde el menú central:

- **MUSIC** escala el bus `MUSIC`; **EFFECTS**, el resto de buses. Cada bus queda en su volumen del config multiplicado por el ajuste.
- **SOUND ON/OFF** (también el ala de volumen del HUD) pone a 0 la ganancia master, así el ducking de la música no lo deshace.
- Se guardan en el navegador (`localStorage`, clave `ossuaryReels.audioSettings.v1`).
- Los vídeos con sonido propio no pasan por Web Audio: la entrada de las free spins, la puerta del esqueleto y el vídeo del cofre. Se marcan al empezar a sonar y siguen el volumen de efectos y el silencio.

## 5. Música

`adaptive-music-controller.js` escucha el bus de eventos:

- **normal** con el primer gesto (clic, toque o tecla; con la pantalla de carga, el PLAY) y al volver de un bonus o de la ruleta;
- **bonus** con `bonus_started` / `super_bonus` (también escucha `bonus_mode_started`, que hoy no se emite);
- **ruleta** con `ruleta_started`; al cerrar, `ruleta_closed` vuelve a normal o a bonus.
- Se suspende con `rib1_bonus_respin_started` mientras dura la cadena de respins de las costillas y se reanuda al decidirse.
- La entrada de las free spins baja la música un 75% mientras suena su vídeo (`OssuaryAudio.duck("MUSIC")`).

## 6. Sonidos y eventos

| Sonido | Bus | Volumen | Archivo (`assets/audio/`) | Suena con / se para con |
|---|---|---|---|---|
| `ui-button-click` | BUTTONS | 0.33 | `ui/button_click.wav` | `button_click` (todos los botones) |
| `ui-button-error` | BUTTONS | 0.35 | `ui/button_error.wav` | `button_error` (SPIN o compra sin saldo, autoplay parado) |
| `reel-mechanism-start` | REELS | 0.5 | `reels/reel_mechanism_start.wav` | `reel_started`, `bonus_reels_mechanism_started` |
| `reel-spin-start` | REELS | 0.22 (bucle) | `reels/spin_start.wav` | `spin_started`, `bonus_reels_spin_started` / para: `spin_finished`, `bonus_reels_spin_finished` |
| `reel-stop` | REELS | 0.4 | `reels/reel_stop.wav` | `reel_stopped`, `bonus_reel_stopped` |
| `music-normal`, `music-bonus`, `music-ruleta` | MUSIC | 0.55 / 0.6 / 0.62 (bucle) | `music/*.wav` | Música adaptativa (sección 5) |
| `rib1-blade-fall` | BONUS | 0.95 | `bonus/rib1_blade_fall.mp3` | `rib1_blade_fall` |
| `rib1-bonus-respin-loop` | BONUS | 0.9 (bucle) | `bonus/rib1_bonus_respin_loop.wav` | `rib1_bonus_respin_started` / para: `bonus_mode_completed`, `bonus_completed`, `bonus_failed` |
| `bonus-symbol-impact` | BONUS | 0.95 | `bonus/bonus_symbol_impact.mp3` | `bonus_symbol_landed_rib23` |
| `bonus-rope-pull` | BONUS | 0.95 | `bonus/tirar_cuerda.wav` | `bonus_sternum_blade_triggered` |
| `bonus-hand-cut` | BONUS | 0.95 | `bonus/manos_cortandose.wav` | `bonus_hand_cut` |
| `bonus-candle-light` | BONUS | 0.78 | `bonus/cerilla.mp3` | `bonus_candle_light`; `raven_free_spin` (tirada gratis del Raven Bonus, con un graznido grave de `crow-perch`) |
| `bonus-multiplier-levelup` | BONUS | 0.9 | `bonus/bonus_multiplier_levelup.mp3` | `bonus_multiplier_levelup`; `golden_crow_landed` (para un rodillo con un cuervo dorado) |
| `bonus-multiplier-stick-blade` | BONUS | 0.9 | `bonus/bonus_multiplier_stick_blade.mp3` | `bonus_multiplier_stuck_blade`, `bonus_intro_start_pressed` (PLAY de las free spins, tono 0.82) |
| `guadana-neck-line` | BONUS | 0.95 (bucle) | `bonus/guadana_neck_line.mp3` | `guadana_neck_line_started` / para: `guadana_neck_line_stopped` |
| `guadana-neck-cut` | BONUS | 0.98 | `bonus/guadana_neck_cut.mp3` | `guadana_neck_cut` |
| `small-blade-tremble` | SYMBOLS | 0.82 (bucle) | `fx/small_blade_tremble.mp3` | `small_blade_tremble_started` / para: `small_blade_tremble_stopped` |
| `small-blade-fall` | SYMBOLS | 0.9 (bucle) | `fx/small_blade_fall.mp3` | `small_blade_fall_started` / para: `small_blade_fall_stopped` |
| `crow-perch` | SYMBOLS | 0.9 | `fx/cuervo_posarse.mp3` | `crow_perch`; graznidos del contador BIG WIN (`big_win_counter_epic_started`, `big_win_counter_crow_perched`) |
| `crow-stone-hit` | SYMBOLS | 0.95 | `fx/cuervo_golpe.wav` | `crow_stone_hit`; `big_win_counter_dead_crow_landed` |
| `payline-win` | SYMBOLS | 1.4 | `fx/linea_pago.mp3` | `payline_shown`; `big_win_counter_max_win_written` |
| `big-win-counter-loop` | BIGWIN | 0.9 (bucle) | `fx/big_win_counter_loop.wav` | `big_win_counter_counting_started` / para: `big_win_counter_counting_stopped`, `big_win_counter_hidden` |
| `big-win-counter-epic` | BIGWIN | 1 | `fx/big_win_counter_epic.wav` | `big_win_counter_epic_started` / para: `big_win_counter_hidden` |
| `big-win-counter-pause` | BIGWIN | 0.95 | `fx/big_win_counter_pause.mp3` | `big_win_counter_pause`, `big_win_counter_beat`, `big_win_counter_completed` |
| `debug-skull-eyes-activation` | DEBUG | 1 | `skull_eyes_activation.ogg` | `debug:skull-eyes-on` (solo debug) |

Más eventos que solo escucha la música adaptativa: `spin_started`, `spin_finished`, `bonus_started`, `super_bonus`, `bonus_completed`, `bonus_failed`, `bonus_mode_completed`, `ruleta_started`, `ruleta_closed`.

**Reglas sin emisor** (están en el config pero ningún código emite el evento hoy, así que no hacen nada): `bonus_mode_started` (caída de la guillotina y bucle de respin) y `bonus_mode_spin_silence` (corta los bucles de rodillos y cuchillas). Quedaron de un flujo anterior del bonus.

**Retirados el 2026-10-08** (no tenían archivo y su función ya la cubre otro sonido): `bonus-lock`, `bonus-started`, `bonus-completed`, `bonus-failed`, `win-small` … `win-jackpot` (premios por tramos y jackpot), y las reglas `jackpot` y `button_disabled`.

## 7. Mezcla

- Se mide en dB RMS efectivos: RMS del archivo × volumen del sonido × volumen del bus. La referencia es `music-normal`, a unos −21/−23 dB efectivos. Un sonido 20 dB por debajo de la música no se oye (les pasaba a los rodillos hasta septiembre).
- Medido en el juego el 2026-10-08 (AnalyserNode en cada bus, ventana de 46 ms): música −23.4 dB, clic −26.5 dB, error −19.4 dB.
- Cómo medir sin oír nada: en la consola, `OssuaryAudioEngine.getBusGain("BUS")` → conectar un `AnalyserNode` → RMS de `getFloatTimeDomainData` mientras se dispara el evento con `OssuaryAudio.trigger(...)`.
- Picos: `bonus-symbol-impact`, `bonus-rope-pull` y `big-win-counter-epic` ya llegan a ~0 dB efectivos; con la música debajo pueden sumar por encima de 1.0.
- El contador BIG WIN está sincronizado con `big_win_counter_epic.wav` (120 BPM, un platillo cada 4 s): el número aterriza en 4.235, 8.215 o 12.235 s (30 ms después de los platillos, medidos por la subida de agudos con ventana de 5 ms) según el premio, y el espectáculo completo en 15.78 s. Por encima de x25 la música arranca con el contador; desde x500, al llegar a x25. En turbo los tramos con música no se aceleran (usan la mitad de compases). Si se recodifica ese archivo (MP3/AAC añaden un pequeño retraso al principio), hay que volver a medirlo.

## 8. Rendimiento y peso

- Web Audio, no etiquetas `<audio>`. Pools por sonido, límite global de 48 voces, cooldown por sonido, `cleanup()` sin fugas.
- `visibilitychange` suspende y reanuda el `AudioContext` al cambiar de pestaña.
- Los sonidos con `preload: true` se descodifican al arrancar. La pantalla de carga los espera.
- **Peso**: 55 MB de WAV (las tres músicas, el épico del BIG WIN y el bucle de respin). Comprimir (OGG/Opus o MP3) bajaría unas 10 veces la descarga inicial; ver la nota de sincronía en la sección 7.

## 9. Herramientas

```js
OssuaryAudioDebug.list() / play(id, overrides) / stop(id, fadeMs) / stopAll()
OssuaryAudioDebug.mute(busId?) / unmute(busId?) / channels() / playing()
OssuaryAudioDebug.memory() / performance() / stats() / printState()
OssuaryAudioDebug.simulateEvent(evento, payload)
OssuaryAudio.snapshot()          // contexto, sonidos cargados, voces activas
OssuaryAudioSettings.get()       // ajustes del jugador
```

## 10. Sin hacer

- Capas de música por intensidad o tensión: `adaptive-music-controller.js` conserva `registerLayer`, `setIntensity`, `setVolatilityProfile` y `setTension` como contrato sin implementar.
- Pendiente probar el desbloqueo de audio en iOS Safari.

## 11. Reglas

- No tocar RNG, pagos, locks ni lógica de juego para añadir sonido: solo emitir un evento con `if (window.OssuaryAudio)` en el punto exacto. Si es dentro de `game.js`, se documenta.
- Un asset que falta no puede romper nada: `play()` devuelve `null` en silencio y la precarga avisa por consola.
