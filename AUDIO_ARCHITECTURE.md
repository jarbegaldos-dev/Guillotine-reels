# AUDIO_ARCHITECTURE.md

Documento maestro del Audio Framework de **Ossuary Reels**.

Mantenido por: Claude Code.
Arquitecto del juego: Codex (no posee el Audio Framework, pero cualquier punto de conexion hacia `game.js`/`bonus-feature.js`/`controls.js` requiere su aprobacion si cambia logica de juego).

Este documento sigue el mismo formato que `FX_ARCHITECTURE.md`: distingue **Implementado** de **Diseñado / planeado, no implementado**. Si entra en conflicto con el codigo, el codigo manda.

---

## 1. Filosofia

- El motor de audio es independiente del juego: no conoce RNG, RTP, combinaciones, locks, ni geometria de reels.
- El juego nunca llama `play()` directamente. Solo emite eventos semanticos via `window.OssuaryAudio.trigger(eventName, payload)`.
- Que sonido(s) se disparan ante un evento es responsabilidad exclusiva de `audio-rules.config.js` (dato, no codigo).
- Que es un sonido (archivo, bus, volumen, pool, fades...) vive exclusivamente en `audio-sounds.config.js`.
- Anadir un sonido nuevo de un tipo ya soportado nunca requiere un archivo JS nuevo, solo una entrada de configuracion.
- El framework esta pensado para reutilizarse en cualquier slot futura: ningun modulo de `src/audio/` importa nada de `game.js`, `src/core/`, `src/bonus/` ni `src/render/`.

## 2. Arquitectura (Implementado salvo donde se indique)

```
src/audio/
├─ audio-event-bus.js              Pub/sub generico, independiente del de FX
├─ audio-engine.js                  Nucleo Web Audio: preload/play/stop/fade/duck/pool/cleanup
├─ audio-bus-manager.js             Buses semanticos: volumen/mute/solo/prioridad
├─ audio-director.js                Ensambla window.OssuaryAudio; aplica reglas
├─ perf/audio-performance-monitor.js  Muestreo de voces activas, sin afectar el hot path
├─ debug/audio-debug-panel.js        window.OssuaryAudioDebug
└─ adaptive/adaptive-music-controller.js  Disenado, NO implementado (Fase 7)

src/config/
├─ audio-buses.config.js            QUE buses existen y su volumen/limite por defecto
├─ audio-sounds.config.js           QUE es cada sonido y DONDE vive (bus/categoria/archivo)
└─ audio-rules.config.js            CUANDO se dispara un sonido (evento -> id)
```

### Flujo de un evento

```
game.js / controls.js
   │  window.OssuaryAudio.trigger(eventName, payload)
   ▼
audio-director.js
   │  1. audio-event-bus.emit(eventName, payload)  -> listeners crudos
   │  2. recorre OSSUARY_AUDIO_RULES
   │       para cada regla cuyo .event === eventName y .when(payload) (si existe):
   │         engine.play(rule.play) / engine.stop(...) / stopGroup(...) / stopChannel(...)
   ▼
audio-engine.js
        decodifica/cachea el buffer, aplica pool/cooldown/prioridad/fades,
        conecta BufferSource -> GainNode de voz -> GainNode de bus -> master
```

`audio-director.js` no contiene ningun `if` que mencione un id de sonido o de bus concreto: toda la logica de negocio vive en datos, igual que `fx-director.js`.

## 3. Buses (Implementado)

Declarados en `audio-buses.config.js`: `MASTER`, `MUSIC`, `AMBIENCE`, `UI`, `BUTTONS`, `REELS`, `SYMBOLS`, `BONUS`, `RESPINS`, `BIGWIN`, `VOICE`, `DEBUG`.

Cada bus tiene volumen base, mute, solo, limite de voces simultaneas y prioridad. `audio-bus-manager.js` es la unica capa que debe tocar estos valores; ningun otro modulo lee `OSSUARY_AUDIO_BUSES` directamente salvo para listar metadatos en debug.

## 4. Sonidos (Implementado)

Cada entrada de `audio-sounds.config.js` declara: `id, category, file, bus, volume, priority, loop, preload, cooldown, fade, pool, playbackRate, pitch, delay, weight, tags, enabled`.

`enabled: false` registra el sonido (las reglas y el evento ya funcionan) pero nunca lo reproduce: es el estado de la mayoria de sonidos de gameplay ahora mismo, a la espera de assets finales. El unico sonido real cargado es `debug-skull-eyes-activation` (`assets/audio/skull_eyes_activation.ogg`).

Para anadir un sonido final: poner `enabled: true` y la ruta correcta. Ningun otro archivo necesita cambios.

## 5. Eventos conectados (Implementado)

Emitidos desde `game.js` / `src/ui/controls.js`, guardados con `if (window.OssuaryAudio)` (mismo patron que `OssuaryFX`):

| Evento | Origen | Payload |
|---|---|---|
| `button_click` | `controls.js` (todos los botones) | `{}` |
| `spin_started` | `game.js#startSpin` | `{ spinType }` |
| `spin_finished` | `game.js#finishSpin` | `{ spinType, win, winMultiple }` |
| `bonus_lock` | `game.js#applyBonusLocks` | `{ reelId, reelType }` |
| `bonus_started` / `super_bonus` | `game.js#handleBonusNextAction` | `{ modePendingType }` |
| `bonus_completed` | `game.js#handleBonusNextAction` | `{ bonusWinToPay }` |
| `bonus_failed` | `game.js#handleBonusNextAction` | `{}` |
| `bonus_multiplier_levelup` | `game.js#applyBonusHandFrame` (contador de la caja de manos completa fase y el multiplicador sube) | `{ bladeMultiplier }` |
| `bonus_multiplier_stuck_blade` | `game.js#playBonusMultiplierRiseToBlade` (`stickAndCleanup`, el badge termina de volar y se pega a la cuchilla) | `{ bladeMultiplier }` |

`winMultiple = win / bet`. Las reglas de tier (`win-small` .. `win-jackpot`) leen ese valor; ajustar los umbrales es un cambio de dato en `audio-rules.config.js`, no de codigo.

### Eventos preparados pero no emitidos todavia desde el juego

`reel_started`, `reel_stopped`, `button_error`, `button_disabled`, `respin_started`, `respin_finished`, `bonus_lock` (rama sternum ya cubierta por el mismo emisor), `future_feature`, `jackpot`. Las reglas y sonidos placeholder ya existen; conectarlos es anadir una llamada `trigger(...)` guardada en el punto de juego correspondiente, igual que las ya existentes — requiere aprobacion si el punto de emision esta dentro de `game.js`.

## 6. Performance (Implementado)

- Web Audio API (no `<audio>` tags): fades/ducking via automatizacion de `GainNode`, sin pops/clicks.
- Pool por sonido (`def.pool`): al superar el limite se roba la voz mas antigua (`stealOldestVoice`), nunca se acumulan voces indefinidamente.
- Limite global de voces (`MAX_GLOBAL_VOICES = 48`): sonidos de baja prioridad se descartan en silencio si el presupuesto esta lleno.
- Cooldown por sonido: anti-spam sin necesidad de logica en el llamador.
- `cleanup()` detiene y desconecta todas las voces activas; no hay fuga de `AudioBufferSourceNode` porque cada uno se desconecta en `onended` o al completarse su fade-out.
- `audio-performance-monitor.js` muestrea cada segundo sin asignar objetos en el hot path de `play()`.
- `document.visibilitychange` pausa/reanuda el `AudioContext` completo al cambiar de pestaña.

## 7. Developer Tools (Implementado)

```js
OssuaryAudioDebug.list()
OssuaryAudioDebug.play(id, overrides)
OssuaryAudioDebug.stop(id, fadeMs)
OssuaryAudioDebug.stopAll()
OssuaryAudioDebug.mute(busId?)      // sin busId = todos
OssuaryAudioDebug.unmute(busId?)
OssuaryAudioDebug.channels()
OssuaryAudioDebug.playing()
OssuaryAudioDebug.memory()
OssuaryAudioDebug.performance()
OssuaryAudioDebug.stats()
OssuaryAudioDebug.printState()
OssuaryAudioDebug.simulateEvent(eventName, payload)
```

## 8. Stress test (Fase 10 — verificado en este ciclo de trabajo)

Ejecutado via consola/preview contra el runtime real:

- `preload()` + `play()` del unico asset real (`debug-skull-eyes-activation`): carga y suena sin error.
- 50x `simulateEvent("button_click")` consecutivos: sin fugas, `globalVoiceCount` vuelve a 0 (sonido placeholder deshabilitado, no-op correcto).
- 20x `simulateEvent("spin_finished", { winMultiple: random*80 })`: cubre las 5 reglas de tier sin colisiones.
- `simulateEvent("bonus_lock", ...)`, `muteAll()`, `unmuteAll()`, `stopAll()`: sin excepciones.
- Spin real via `#spinBtn` (ciclo completo de juego con animaciones de victoria, locks y combo engine activos): sin errores de consola, `OssuaryAudio.snapshot()` consistente tras finalizar.
- Asset faltante / sonido deshabilitado: `play()` devuelve `null` en silencio, nunca lanza excepcion ni bloquea `game.js`.

No probado todavia (requiere hardware/perfil movil real, fuera del alcance de este ciclo): desbloqueo de audio en iOS Safari tras gesto, 1000 spins reales encadenados, 100 bonus reales encadenados.

## 9. Adaptive Audio — Fase 7 (Disenado, NO implementado)

`src/audio/adaptive/adaptive-music-controller.js` expone el contrato (`registerLayer`, `setIntensity`, `setVolatilityProfile`, `setTension`, `dispose`) como funciones que solo loguean "no implementado". Implementarlo de verdad:

- Debe suscribirse via `OssuaryAudioEventBus`, nunca leer `state` de juego directamente.
- Debe reproducir/crossfadear exclusivamente via `OssuaryAudioEngine`, nunca crear su propio `AudioContext`.
- Cubre: musica por capas, tension/heartbeat, ambiente procedural, audio por volatilidad/multiplicador/jackpot.

## 10. Future Layer — Fase 11 (Disenado, NO implementado)

Mismo patron que la tabla de tecnologias de `FX_ARCHITECTURE.md` seccion 4: el unico punto de extension obligatorio para un tipo de fuente de audio nuevo es un archivo en `src/audio/players/` (carpeta reservada, vacia) + un `case` en un futuro `audio-source-factory.js` si se necesitara soportar streaming/Atmos/Spine de audio. Por ahora todo sonido es un buffer decodificado por `audio-engine.js`; no existe todavia esa capa de "players" porque un solo tipo de fuente cubre el alcance actual.

Conceptos reservados, sin arquitectura de codigo todavia (solo nombrados aqui para que un futuro ciclo no tenga que inventarlos desde cero):

- Voice Over / Narrador: bus `VOICE` ya reservado con `limit: 1` (exclusividad de voz).
- IA adaptativa: se apoyaria en `adaptive-music-controller.js`.
- Audio 3D / Dolby Atmos / audio espacial: requeriria `PannerNode` por voz en `audio-engine.js#play`; el contrato de `play(soundId, overrides)` ya acepta overrides arbitrarios, asi que anadir `{ pan: {x,y,z} }` no rompe llamadas existentes.
- Vibracion sincronizada: API del navegador (`navigator.vibrate`) podria dispararse desde una regla nueva en `audio-rules.config.js` (`vibrate: true`), sin tocar el engine.
- Streaming de musica / packs descargables / temas alternativos / eventos estacionales: cambiarian `file` en `audio-sounds.config.js` o anadirian sets de config alternables; el contrato de sonido ya soporta esto sin cambios de codigo.
- Localizacion por idioma (VO): un `id` de sonido podria resolver a distintos `file` segun idioma activo via una capa de resolucion delante de `preload()`/`play()`, todavia no escrita.
- Plugins futuros: el patron "config + un `case` nuevo" usado en FX (`buildPlayerForType`) es el modelo a replicar si algun dia se necesita mas de un tipo de fuente de audio.

## 11. Auditoria inicial (Fase 1, hallazgos)

- No existia ningun sistema de audio antes de este ciclo. Unico rastro: el asset `assets/audio/skull_eyes_activation.ogg`, sin codigo que lo reprodujera.
- El sistema de FX (`FX_ARCHITECTURE.md`) ya resuelve el mismo problema de arquitectura (config declarativa + bus de eventos + director sin logica de negocio) para efectos visuales; el Audio Framework replica deliberadamente ese patron en vez de inventar uno nuevo, para mantener una unica filosofia arquitectonica en el proyecto.
- Puntos de integracion identificados y conectados: `game.js#applyBonusLocks`, `game.js#startSpin`, `game.js#finishSpin`, `game.js#handleBonusNextAction`, `src/ui/controls.js` (todos los botones).
- No se detectaron duplicaciones ni hooks de audio previos que migrar.

## 12. Reglas no negociables (heredadas de PROJECT_RULES.md / CLAUDE_AGENT.md)

- No tocar RNG, RTP, combinaciones, strips, outcome engine, bonus logic, locks, render, WebGL, FX visuales, animaciones ni UI existente mas alla de anadir un `trigger()` guardado.
- Cualquier punto de emision de evento de audio dentro de `game.js`/`bonus-feature.js` es, por definicion, una linea nueva ahi: documentar siempre que se anada una.
- Nunca lanzar excepciones por assets faltantes: silencio + warning en consola es el comportamiento correcto, igual que el `console.warn` de `fx-position-resolver.js` ante un anchor desconocido.
