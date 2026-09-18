# FX_ARCHITECTURE.md

Documento maestro del sistema de FX de **Ossuary Reels**.

Mantenido por: Claude Code, en su rol de Director Técnico de FX y Arte.
Arquitecto del juego: Codex (no posee el sistema de FX, pero cualquier punto de conexión hacia `game.js`/`bonus-feature.js` requiere su aprobación).
Última actualización: 2026-06-25, tras Fase FX-5 Paso 1.

Este documento describe el estado real del sistema de FX en el momento de escribirlo. Cada sección distingue explícitamente **Implementado** de **Diseñado / planeado, no implementado todavía**. Si este documento entra en conflicto con el código, el código manda — pero avisa antes de asumir que el documento está desactualizado.

---

## 1. Filosofía del sistema

### Objetivos

- Cualquier efecto visual debe poder añadirse, moverse, reescalarse o sustituirse **sin tocar `game.js` ni lógica de juego**.
- El juego no sabe qué FX existen. Solo emite eventos semánticos (`"bonus:lock-updated"`, `"debug:skull-eyes-on"`, ...). Qué pasa con esos eventos es responsabilidad exclusiva del sistema de FX.
- Ningún efecto depende de otro. Activar/desactivar un efecto nunca requiere que otro efecto exista o esté en un estado concreto.
- Añadir un efecto nuevo del mismo tipo técnico que uno existente (por ejemplo, otro efecto CSS) no debe requerir un archivo JS nuevo — solo una entrada de configuración.
- Cambiar la tecnología de un efecto (CSS → WebM, Canvas → SVG) no debe cambiar su `id`, su `scope`, ni las reglas que lo activan.

### Problemas que evita

- FX hardcodeados dentro de `game.js` (lo que CLAUDE_AGENT.md llama "game.js growth risk" y "no usar overlays/hacks").
- Lógica repetida de "si N costillas bloqueadas entonces X" desperdigada en múltiples archivos.
- Coordenadas de posición duplicadas entre `layout.config.js` (geometría real, propiedad de Codex) y el sistema visual.
- Acoplamiento entre tecnología de renderizado y lógica de cuándo se dispara un efecto.
- Uso de Remotion o WebGL "porque están disponibles" en vez de porque el efecto concreto los necesita.

### Responsabilidades del sistema de FX

- Recibir eventos semánticos del juego.
- Decidir, mediante reglas declarativas, qué efectos activar/desactivar y con qué scope.
- Resolver dónde debe colocarse un efecto (anchors) y en qué capa visual vive.
- Gestionar el ciclo de vida (mount/activate/deactivate/dispose) de cada efecto.
- Ofrecer una API pública estable (`window.OssuaryFX`) para que el juego (o la consola de debug) dispare eventos y consulte estado.

### Lo que el sistema de FX NUNCA hace

- No calcula RNG, RTP, probabilidades ni resultados de spin.
- No decide si un bonus se activa, falla o se completa — solo reacciona a que ese estado cambió.
- No muta `state.reels`, `state.balance`, ni ningún estado de juego.
- No conoce geometría de reels por valor propio: si necesita una posición de reel, la deriva en tiempo de ejecución desde `layout.config.js`, nunca la copia.
- No decide la arquitectura de `game.js`/`bonus-feature.js`/`spin-engine.js`/`outcome-engine.js`/`reel-model.js`. Esos archivos son propiedad de Codex.

---

## 2. Arquitectura completa

### Módulos (estado: Implementado salvo donde se indique)

```
src/fx/
├─ fx-event-bus.js              Pub/sub generico: on / off / emit
├─ fx-registry.js                Alta de efectos + estado activo/scope
├─ fx-director.js                 Ensambla window.OssuaryFX; aplica reglas
├─ fx-position-resolver.js       Anchor -> {xPercent, yPercent}
├─ effect-factory.js              Lee fx-effects.config.js, construye y registra efectos
├─ players/
│  └─ css-fx-player.js           Player generico para type:"css"
├─ effects/
│  └─ glow/eyes-glow-test.fx.js  Efecto de prueba (legacy, ver seccion 9bis/migracion)
└─ debug/                        Vacio. Planeado, no implementado (ver seccion 11)

src/config/
├─ fx-rules.config.js            CUANDO se activa/desactiva un efecto
├─ fx-effects.config.js          QUE es un efecto y DONDE vive (capas + efectos)
└─ fx-anchors.config.js          Anchors decorativos manuales
```

### Cómo se comunican

```
game.js (orquestador)
   │  window.OssuaryFX.trigger(eventName, payload)
   ▼
fx-director.js
   │  1. bus.emit(eventName, payload)        -> cualquier listener crudo se entera
   │  2. lee window.OSSUARY_FX_RULES
   │  3. para cada regla cuyo .event === eventName y .when(payload) sea true (o no exista):
   │       - rule.activate   -> activate(effectId, rule.params)
   │       - rule.deactivate -> deactivate(effectId)
   │       - rule.deactivateScope -> deactivateScope(scope)
   ▼
fx-registry.js
   │  busca el effectDef registrado bajo ese id
   ▼
effectDef.mount() / .activate() / .deactivate()
   │  (si type:"css", esto es css-fx-player.js, que a su vez llama a)
   ▼
fx-position-resolver.js
        resuelve el anchor declarado -> posiciona el DOM en #slotStage
```

`fx-director.js` no contiene ningún `if` que mencione un `id` de efecto o un nombre de scope concreto. Toda la lógica "de negocio" (qué activa qué, con qué condición) vive en datos (`fx-rules.config.js`), no en código.

### Flujo real de un evento, de punta a punta (ejemplo implementado)

1. El jugador (o un escenario de debug) provoca que una costilla se bloquee.
2. `game.js#applyBonusLocks(...)` aplica el lock real sobre `state.reels` y llama a `emitBonusLockUpdated()`.
3. `emitBonusLockUpdated()` calcula el payload desde el estado real de los reels y llama:
   ```js
   window.OssuaryFX.trigger("bonus:lock-updated", {
     lockedCount, lockedReels, lockedRibCount, sternumLocked
   });
   ```
4. `fx-director.js#trigger` emite el evento en el bus y recorre `OSSUARY_FX_RULES` buscando reglas con `event === "bonus:lock-updated"`.
5. **Estado actual:** no existe todavía ninguna regla para ese evento (`fx-rules.config.js` solo tiene reglas para `debug:skull-eyes-on`/`debug:skull-eyes-off`). El evento se emite correctamente pero no dispara ningún efecto visual aún. Esto está verificado y es intencional — la fase de conexión de reglas reales de bonus es posterior.

### Flujo de un evento de debug (implementado y verificado end-to-end)

```js
OssuaryFX.trigger("debug:skull-eyes-on")
```
→ coincide con la regla `{ event: "debug:skull-eyes-on", activate: "eyes-glow-test", params: { scope: "debug-session" } }` → `activate("eyes-glow-test", { scope: "debug-session" })` → el efecto se monta (si no lo estaba) y se activa.

---

## 3. Sistema de eventos

### Implementado

- Transporte: `window.OssuaryFXEventBus` — `on(event, handler)`, `off(event, handler)`, `emit(event, payload)`. No sabe nada de juego ni de FX; es infraestructura pura, reutilizable para cualquier otro propósito de pub/sub si hiciera falta.
- Entrada pública: `window.OssuaryFX.trigger(eventName, payload)` — único punto por el que el juego debe emitir eventos.

### Convención de nombres

`<dominio>:<hecho>`, en kebab-case, dominio en minúsculas:

| Patrón | Ejemplo real | Ejemplo planeado |
|---|---|---|
| `bonus:<hecho>` | `bonus:lock-updated` (implementado) | `bonus:start`, `bonus:end` |
| `superbonus:<hecho>` | — | `superbonus:start`, `superbonus:end` |
| `debug:<hecho>` | `debug:skull-eyes-on`, `debug:skull-eyes-off` (implementados) | — |
| `spin:<hecho>` | — | `spin:start`, `spin:finish` (no conectados todavía) |

No se usan camelCase ni snake_case para nombres de evento. El bus no normaliza ni valida nombres — la convención es disciplina del equipo, no una restricción de código.

### Payload — eventos implementados

`bonus:lock-updated`:
```js
{
  lockedCount: number,     // total de reels bloqueados (ribs + sternum)
  lockedReels: string[],   // ids de todos los reels bloqueados
  lockedRibCount: number,  // solo reel.type === "rib"
  sternumLocked: boolean   // true si algun reel.type === "sternum" esta bloqueado
}
```
Calculado siempre desde el estado real de `state.reels`, nunca desde la intención lógica de `bonus-feature.js` (que puede no coincidir 1:1 con lo aplicado visualmente — ver `lockMismatch` en `game.js`).

`debug:skull-eyes-on` / `debug:skull-eyes-off`: sin payload (no lo necesitan).

### Cómo deben evolucionar los payloads

- Los payloads son objetos planos, sin anidar estado de juego completo (nunca pasar `state` ni `reels` enteros — solo los valores derivados que un efecto pueda necesitar).
- Añadir un campo nuevo a un payload existente es seguro (los `when()` de las reglas existentes simplemente lo ignorarán si no lo usan).
- Quitar o renombrar un campo existente es un cambio de contrato: hay que revisar todas las reglas en `fx-rules.config.js` que lean ese campo en su `when()`.
- Un evento nuevo no necesita aprobación de Codex si se emite únicamente desde dentro de la zona de FX (por ejemplo, un evento sintético de debug). Sí necesita aprobación si su punto de emisión está dentro de `game.js` o `bonus-feature.js` (ver sección 9 de `CLAUDE_AGENT.md`).

---

## 4. Sistema de efectos

### Contrato común (Implementado)

Todo efecto, sea cual sea su tecnología, expone el mismo contrato al registrarse en `fx-registry.js`:

```js
{
  id: string,
  mount(): void,        // prepara DOM/canvas/video una vez, perezoso (solo al primer activate)
  activate(params): void,
  deactivate(): void,
  dispose(): void        // no usado todavia por el director; reservado para limpieza total
}
```

### Tipos soportados y cuándo usar cada uno

| Tecnología | Estado | Cuándo usarla |
|---|---|---|
| **CSS** | Implementado (`css-fx-player.js`) | Glows, pulsos, fades, transiciones de opacidad/escala. Cualquier efecto donde la "forma" es fija y solo cambia intensidad/visibilidad. Barato, sin asset pesado, GPU-friendly si solo se anima `opacity`/`transform`. |
| **Canvas 2D** | Diseñado, no implementado | Partículas cuya cantidad/posición depende del estado del juego en tiempo real (ej. partículas verdes que escalan con el número de costillas bloqueadas). No se puede pre-renderizar razonablemente porque el número de variantes es abierto. |
| **SVG** | Diseñado, no implementado | Formas vectoriales animables por trazo (rayos, energía, líneas que se dibujan). Nítido a cualquier resolución, ligero, ideal para algo recurrente y sutil. |
| **WebM Alpha (vídeo)** | Diseñado, no implementado | Secuencias complejas, realistas, deterministas: humo, niebla, fuego. Se renderiza una vez (a mano o vía Remotion) y se reproduce barato. No usar para nada cuya cantidad/posición varíe por jugada. |
| **Remotion** | Diseñado, no implementado (ver sección 9) | NO es una tecnología de runtime. Es la herramienta para producir el asset WebM Alpha de secuencias coreografiadas y deterministas (intro de bonus, ráfaga de SUPER BONUS). El resultado de Remotion es un archivo de vídeo; Remotion mismo nunca se ejecuta en el navegador del jugador. |
| **Spritesheet** | Diseñado, no implementado | Loops cortos de pocos frames con movimiento repetitivo (parpadeo de vela). Más barato que vídeo para este caso concreto. |
| **PNG animado (APNG)** | Desaconsejado | Casi siempre superado en peso/rendimiento por spritesheet+CSS o WebM. Mantener solo como fallback de último recurso, no como elección por defecto. |
| **WebGL** | No usar de entrada (ver sección 13) | Reservado para un efecto concreto que lo justifique explícitamente (distorsión de calor, shader complejo). Añade gestión de contexto/pérdida de contexto; no es el valor por defecto de este proyecto. |

### Cómo se añade un efecto de un tipo ya soportado (CSS)

1. Añadir una entrada a `window.OSSUARY_FX_EFFECTS` en `fx-effects.config.js` (ver sección 7).
2. Añadir una clase `.fx-visual--<id>` en `style.css` con el aspecto visual (gradiente, animación).
3. Cero archivos JS nuevos. `effect-factory.js` lo registra automáticamente al cargar.

### Cómo se añade un efecto de un tipo NO soportado todavía (ej. el primer efecto Canvas)

1. Crear el player nuevo, ej. `src/fx/players/canvas-particle-player.js`, que exponga `create(entry) → {mount, activate, deactivate, dispose}`.
2. Añadir un `case "canvas":` en `buildPlayerForType` dentro de `effect-factory.js`.
3. A partir de ahí, cualquier efecto `canvas` futuro es solo configuración — el mismo patrón que CSS.

---

## 5. Sistema de capas

Implementado en `window.OSSUARY_FX_LAYERS` (`fx-effects.config.js`). Orden de fondo a frente:

| Capa | z-index por defecto | Qué vive aquí |
|---|---|---|
| `background-fx` | 0 | Efectos detrás de todo, a nivel del fondo de la escena. |
| `ambient-fx` | 1 | Atmósfera general: humo ambiental, niebla, embers — por delante del fondo, por detrás de la estructura. |
| `structure-back-fx` | 2 | Brillos/auras detrás de la estructura ósea (ej. resplandor detrás de una costilla). |
| `structure-front-fx` | 3 | Detalles encima de la estructura pero por detrás del área jugable (ej. ojos de la calavera brillando). |
| `reel-fx` | 4 | Efectos asociados a la zona de reels en general, sin ser un lock concreto. |
| `lock-fx` | 5 | Glow/feedback de una costilla o sternum bloqueado individualmente. |
| `bonus-fx` | 6 | Partículas y FX de ambientación durante BONUS/SUPER BONUS, por encima de los locks individuales. |
| `ui-fx` | 7 | Efectos ligados a elementos de UI (pulso en readouts, etc.), por encima del área de juego. |
| `fullscreen-fx` | 8 | Flashes/transiciones a pantalla completa (ej. ráfaga de SUPER BONUS). Capa más alta de FX. |

`zIndex` por capa es solo el valor **por defecto**: cualquier efecto puede sobreescribirlo con su propio campo `zIndex` en `fx-effects.config.js` si necesita una excepción puntual. Todos los elementos de FX llevan `pointer-events: none`, así que el z-index nunca puede bloquear un clic de UI, solo afecta el orden visual.

---

## 6. Sistema de anchors

Implementado en `fx-position-resolver.js#resolveAnchor(anchorId)`. Devuelve siempre `{ xPercent, yPercent }` relativo a `#slotStage`.

### Cómo se resuelven (orden de búsqueda)

1. **Anchors manuales** — se busca `anchorId` en `window.OSSUARY_FX_ANCHORS` (`fx-anchors.config.js`). Si existe, se usa directamente.
2. **Anchors de rib** — si no es manual, se busca `anchorId` dentro de `window.OSSUARY_LAYOUT_CONFIG.RIB_LAYOUT` (array de costillas). Si se encuentra, se calcula el centro del bounding box de todas sus `cells` (min/max de `x, y, x+w, y+h`) y se convierte a porcentaje dividiendo por `IMAGE_REFERENCE.width/height`.
3. **Anchor de sternum** — si `anchorId === STERNUM_LAYOUT.id` ("sternum"), mismo cálculo de bounding box sobre `STERNUM_LAYOUT.cells`.
4. **Fallback** — si nada coincide, se devuelve `{50, 50}` (centro del stage) y se emite un `console.warn`. Nunca lanza una excepción.

### Por qué se derivan en vez de duplicarse

`layout.config.js` es un archivo crítico, propiedad de Codex, con reglas estrictas de no-edición. Si copiáramos las coordenadas de cada costilla a un archivo de FX, cualquier ajuste de geometría futuro (Codex recalibrando una costilla) dejaría los anchors de FX desincronizados sin que nadie lo note. Al derivarlos en tiempo de ejecución, **layout.config.js sigue siendo la única fuente de verdad** y el sistema de FX solo lo lee, nunca lo escribe ni lo cachea de forma persistente.

### Anchors manuales existentes (`fx-anchors.config.js`)

| Anchor | Posición | Uso previsto |
|---|---|---|
| `skull-top-eyes` | `{50, 18}` | Ojos de la calavera (decorativo, no es geometría de reel) |
| `skull-bottom` | `{50, 38}` | Parte baja de la calavera |
| `full-screen` | `{50, 50}` | Efectos a pantalla completa (centro nominal, el propio efecto cubre todo el viewport) |
| `background` | `{50, 50}` | Capa de fondo genérica |
| `foreground` | `{50, 50}` | Capa de frente genérica |

### Anchors derivados disponibles (sin configuración adicional)

Cualquier `id` presente en `RIB_LAYOUT` (`rib1`, `rib2-left`, `rib2-right`, `rib3-left`, `rib3-right`, `rib4-left`, `rib4-right`, `rib5-left`, `rib5-right`) y `"sternum"` (de `STERNUM_LAYOUT`) funcionan como anchor sin necesidad de añadirlos a `fx-anchors.config.js`.

---

## 7. Configuración declarativa

### `fx-effects.config.js` — QUÉ es un efecto y DÓNDE vive

Contiene:
- `window.OSSUARY_FX_LAYERS` — mapa capa → z-index por defecto.
- `window.OSSUARY_FX_EFFECTS` — array de entradas, una por efecto:

```js
{
  id: string,                 // unico, kebab-case
  type: "css" | "webm-alpha" | "canvas" | "svg" | "remotion-export",
  assetPath: string | null,   // ruta del asset si type lo requiere
  anchor: string,              // id resuelto por fx-position-resolver
  offset: { x: number, y: number },  // ajuste fino en % sobre el anchor
  scale: number,
  opacity: number,
  blendMode: string,           // valor CSS de mix-blend-mode
  layer: string,                // una de las 9 capas de la seccion 5
  zIndex: number | null,        // null = usa el default de la capa
  loop: boolean,
  duration: number | null,      // ms, solo relevante si loop:false
  scope: string | null,         // scope por defecto si se activa sin params
  responsive: { hideBelowWidth: number | null, scaleWithStage: boolean },
  enabled: boolean
}
```

**Nunca debe contener:** nombres de eventos de juego, condiciones de cuándo activarse, referencias a `state` de juego, lógica de negocio de bonus. Si una entrada necesita saber "cuándo" se activa, esa lógica no va aquí — va en `fx-rules.config.js`.

### `fx-rules.config.js` — CUÁNDO se activa/desactiva un efecto

```js
{
  event: string,                          // debe coincidir con el nombre emitido por OssuaryFX.trigger
  when: (payload) => boolean,             // opcional; si se omite, la regla siempre aplica
  activate: string | undefined,           // effectId a activar
  params: object | undefined,             // pasado tal cual a activate(effectId, params)
  deactivate: string | undefined,         // effectId a desactivar
  deactivateScope: string | undefined     // desactiva todos los efectos de ese scope
}
```

**Nunca debe contener:** posiciones, assets, escalas, colores, ni ninguna propiedad visual. Una regla no sabe ni le importa qué aspecto tiene el efecto que activa — eso es responsabilidad exclusiva de `fx-effects.config.js` + su player.

### Cómo se conectan entre sí

El único punto de unión entre ambos archivos es el `id`/`effectId` como string. Ninguno importa al otro. `fx-director.js` es el que, al recibir un evento, consulta `fx-rules.config.js` para decidir qué `id` activar, y ese `id` ya fue registrado previamente por `effect-factory.js` a partir de `fx-effects.config.js`.

---

## 8. Organización de carpetas

```
assets/
└─ fx/                          (a crear cuando exista el primer asset real de FX)
   ├─ smoke/                    WebM alpha de humo/niebla
   ├─ particles/                Spritesheets si algun efecto canvas los usa como textura
   ├─ glow/                     Recursos de apoyo para glows (si los CSS puros no bastan)
   ├─ energy/                   Rayos/energia
   └─ video_alpha/               Salida renderizada desde remotion/

src/fx/
├─ fx-event-bus.js
├─ fx-registry.js
├─ fx-director.js
├─ fx-position-resolver.js
├─ effect-factory.js
├─ players/                     Un archivo por tecnologia de renderizado (css, webm-alpha, canvas, svg...)
│  └─ css-fx-player.js
├─ effects/                     Efectos legacy escritos a mano (ver migracion, seccion 9bis)
│  └─ glow/eyes-glow-test.fx.js
└─ debug/                       Planeado: fx-debug-panel.js (ver seccion 11)

src/config/
├─ fx-rules.config.js           CUANDO
├─ fx-effects.config.js         QUE / DONDE (capas + efectos)
└─ fx-anchors.config.js         Anchors decorativos manuales

remotion/                       (a crear cuando exista la primera composicion)
├─ src/compositions/
├─ remotion.config.ts
└─ package.json
```

Regla de oro: **un archivo nuevo en `src/fx/` o `src/config/` solo se justifica cuando se introduce una tecnología nueva (un player) o una categoría de configuración nueva.** Añadir efectos del mismo tipo es siempre edición de configuración, nunca un archivo nuevo.

---

## 9. Pipeline de Remotion

**Estado: diseñado, no implementado.** No existe todavía carpeta `remotion/` ni ninguna composición.

### Rol de Remotion en este proyecto

Remotion es una herramienta de producción **offline**. No se ejecuta en el navegador del jugador, no se añade como dependencia del runtime, y no aparece en `index.html`. Su única salida útil para el juego es un archivo de vídeo (WebM con canal alfa) que el `webm-alpha-player` (futuro) consume igual que cualquier otro asset.

### Cuándo usarla

Solo para secuencias **deterministas y coreografiadas**: intro de bonus, ráfaga de SUPER BONUS, transiciones complejas diseñadas fotograma a fotograma. Nunca para algo cuya cantidad/posición varía según el estado del juego (eso es Canvas).

### Cómo crear una composición (flujo previsto)

1. Crear/editar una composición en `remotion/src/compositions/<Nombre>.tsx`.
2. Iterar visualmente con `npx remotion preview` dentro de `remotion/`.
3. Definir duración, fps y dimensiones acordes al área del efecto en el juego (no necesariamente todo el stage).

### Cómo exportarla

```bash
npx remotion render <Composition> out/<nombre>.webm --codec vp9 --pixel-format yuva420p
```
`yuva420p` es lo que preserva el canal alfa en VP9/WebM. El resultado se copia a `assets/fx/video_alpha/<nombre>.webm`.

### Cómo integrarla en el juego

1. En `fx-effects.config.js`, crear o editar una entrada con `type: "webm-alpha"` y `assetPath: "assets/fx/video_alpha/<nombre>.webm"`.
2. Asegurarse de que existe (en su momento) el player `src/fx/players/webm-alpha-player.js`, registrado en `effect-factory.js` bajo `case "webm-alpha":`.
3. El resto del pipeline (anchors, capas, reglas, scope) funciona exactamente igual que para un efecto CSS — ese es el punto de la arquitectura.

### Cómo sustituir un efecto existente por una versión Remotion

Cambiar `type` y `assetPath` en su entrada de `fx-effects.config.js`. El `id` no cambia, así que ninguna regla de `fx-rules.config.js` necesita tocarse.

### Cómo eliminarlo

Quitar la entrada de `fx-effects.config.js` (o `enabled: false`) y, opcionalmente, borrar el `.webm` de `assets/fx/video_alpha/` (no automático — borrado manual deliberado).

### Riesgo conocido a validar antes de la primera implementación real

WebM con alfa (VP9, `yuva420p`) funciona en Chrome/Edge/Firefox. Safari no lo soporta de forma fiable. Antes de depender de esto en producción, hay que decidir si Safari/iOS es un target real del juego y, si lo es, diseñar un fallback (degradar a CSS o a un frame estático) mediante feature-detection en el futuro `webm-alpha-player.js`.

---

## 10. Rendimiento

### Buenas prácticas ya aplicadas

- `css-fx-player.js` anima únicamente `opacity` (vía `is-active`) y `transform` (escala/centrado vía variable CSS `--fx-scale`) — ambas son propiedades que el navegador puede animar en el compositor sin recalcular layout. Nunca se anima `top`/`left` continuamente (se fijan una vez al montar).
- Todos los elementos de FX llevan `pointer-events: none` — nunca interfieren con hit-testing de UI/reels, sin importar el z-index.
- El registro de efectos (`fx-registry.js`) monta cada efecto de forma perezosa: `mount()` solo se llama la primera vez que se activa, no al cargar la página.

### Buenas prácticas pendientes de aplicar cuando lleguen los players pesados

- **Canvas:** un único `requestAnimationFrame` compartido entre todos los efectos canvas activos, nunca un `rAF` por efecto.
- **WebM:** pool de elementos `<video>` reutilizados; nunca crear/destruir un `<video>` por activación. Precarga perezosa (solo al primer uso real), con prefetch oportunista cuando una fase lo hace probable (ej. precargar FX de bonus en cuanto empieza `"COLLECTING_RIBS"`).
- Límite máximo de efectos concurrentes con prioridad si se excede presupuesto.
- Pausar todo en `document.hidden` (cambio de pestaña).
- Respetar `prefers-reduced-motion` (desactivar animaciones decorativas, no las que comunican información de estado).

### Qué evitar

- WebGL por defecto (gestión de contexto y pérdida de contexto añaden complejidad que no se justifica todavía).
- PNG animado como elección por defecto (ver tabla de la sección 4).
- Animar propiedades que disparan layout/paint (`width`, `height`, `top`, `left` en bucle).
- Vídeo para efectos cuya forma/cantidad varía dinámicamente (eso es Canvas, no vídeo).
- Canvas para efectos estáticos o de aspecto fijo (eso es CSS, más barato).

### Resumen de decisión rápida

| Si el efecto... | Usa |
|---|---|
| Es una forma fija que solo cambia opacidad/escala | CSS |
| Necesita una cantidad/posición que varía con el estado del juego | Canvas |
| Es una secuencia realista, pre-diseñada, siempre igual | WebM Alpha (posiblemente vía Remotion) |
| Es una forma vectorial recurrente y sutil | SVG |

---

## 11. Herramientas de debug

### Implementado (vía consola, sin panel dedicado todavía)

```js
// API publica
OssuaryFX.trigger(eventName, payload)
OssuaryFX.activate(effectId, params)
OssuaryFX.deactivate(effectId)
OssuaryFX.deactivateScope(scope)
OssuaryFX.listActive()

// Inspeccion de bajo nivel
OssuaryFXEventBus.on(eventName, handler)   // escuchar cualquier evento crudo, util para depurar payloads
OssuaryFXRegistry.all()                     // ids de todos los efectos registrados
OssuaryFXRegistry.listActive()              // [{id, scope, params}, ...]

// Posicionamiento
OssuaryFXPositionResolver.resolveAnchor(anchorId)  // probar a que % resuelve un anchor

// Re-registro tras editar config
OssuaryFXEffectFactory.registerEffectsFromConfig()
```

### Cómo probar un efecto

```js
OssuaryFX.activate("eyes-glow-test")
OssuaryFX.deactivate("eyes-glow-test")
OssuaryFX.trigger("debug:skull-eyes-on")   // via regla declarativa
OssuaryFX.trigger("debug:skull-eyes-off")
```

### Cómo inspeccionar posiciones

```js
OssuaryFXPositionResolver.resolveAnchor("rib1")
OssuaryFXPositionResolver.resolveAnchor("skull-top-eyes")
```

### Cómo activar/desactivar scopes

```js
OssuaryFX.deactivateScope("debug-session")
```

### Planeado, no implementado: `src/fx/debug/fx-debug-panel.js`

Pensado para envolver lo anterior en comandos más cómodos, siguiendo el mismo patrón que `window.OssuaryBonusDebug` ya existente en el juego:

```js
OssuaryFXDebug.previewAnchor(anchorId)                    // resalta visualmente el punto del anchor
OssuaryFXDebug.setEffectPosition(effectId, { x, y })      // override temporal en runtime, no persiste a disco
OssuaryFXDebug.reloadEffectConfig()                        // re-registra efectos tras editar config + recargar
OssuaryFXDebug.listRules()                                  // vuelca OSSUARY_FX_RULES legible
```

---

## 12. Convenciones

| Categoría | Convención | Ejemplo |
|---|---|---|
| `id` de efecto | kebab-case, descriptivo, sin prefijo de tecnología | `eyes-glow-test`, `rib-smoke` |
| Nombre de evento | `dominio:hecho`, kebab-case | `bonus:lock-updated`, `debug:skull-eyes-on` |
| `scope` | kebab-case, normalmente `<contexto>-session` | `debug-session`, `bonus-session` |
| Nombre de capa | siempre termina en `-fx` | `lock-fx`, `fullscreen-fx` |
| Nombre de anchor | kebab-case; los de reel coinciden 1:1 con los ids de `layout.config.js` | `skull-top-eyes`, `rib2-left` |
| Archivo de efecto legacy (a mano) | `<id>.fx.js` dentro de `src/fx/effects/<categoria>/` | `eyes-glow-test.fx.js` |
| Archivo de player | `<tecnologia>-fx-player.js` o `<tecnologia>-player.js` dentro de `src/fx/players/` | `css-fx-player.js` |
| Asset de FX | agrupado por categoría bajo `assets/fx/<categoria>/` | `assets/fx/smoke/rib-smoke.webm` |
| Carpetas | inglés, snake/kebab según ya exista en el proyecto (`src/`, `assets/`) | — |

---

## 13. Futuras ampliaciones

El punto de extensión único y obligatorio es **`effect-factory.js#buildPlayerForType`**. Todo lo demás (registry, director, rules, anchors, layers) ya es agnóstico a la tecnología.

### Cómo añadir un nuevo tipo de player (patrón general)

1. Crear `src/fx/players/<tecnologia>-player.js` exponiendo `create(entry) → { mount, activate, deactivate, dispose }`.
2. Añadir un `case "<tecnologia>":` en `buildPlayerForType`.
3. Documentar en la tabla de la sección 4 cuándo usarlo.
4. No se toca `fx-director.js`, `fx-registry.js`, `fx-event-bus.js`, `fx-rules.config.js`, ni `fx-position-resolver.js`.

### Cómo añadir WebGL

Mismo patrón: `src/fx/players/webgl-player.js`. Consideraciones extra (no genéricas a otros players): gestionar pérdida de contexto (`webglcontextlost`/`restored`), limitar a un único `<canvas>` WebGL compartido si se usa para más de un efecto (los contextos WebGL son caros), y justificar por qué el efecto concreto no puede hacerse en Canvas 2D o CSS antes de introducirlo (ver tabla de decisión, sección 10).

### Cómo añadir Spine (animación esquelética 2D)

Mismo patrón: `src/fx/players/spine-player.js`, que envolvería el runtime de Spine (`pixi-spine` o el runtime oficial) detrás del mismo contrato `mount/activate/deactivate/dispose`. El `assetPath` en `fx-effects.config.js` apuntaría al atlas/skeleton de Spine. Añade una dependencia externa nueva — requiere aprobación antes de introducirla, no solo de implementarla.

### Cómo añadir shaders (post-procesado)

Si es un shader aplicado a un efecto Canvas/WebGL puntual, vive dentro de ese player, no como sistema aparte. Si es un shader de pantalla completa (post-proceso global, ej. distorsión de calor durante SUPER BONUS), se modelaría como un efecto más en la capa `fullscreen-fx`, con su propio player (`src/fx/players/shader-player.js`) — nunca acoplado al renderizado de reels real.

### Cómo añadir sistemas nuevos sin romper la arquitectura existente

Regla general: si el cambio que se te ocurre toca `fx-director.js`, `fx-registry.js` o `fx-event-bus.js`, probablemente estás intentando meter lógica de negocio donde no va — esos tres archivos deben seguir siendo agnósticos para siempre. Si el cambio solo añade un archivo en `players/` y un `case` nuevo en `effect-factory.js`, vas por el camino correcto.

---

## Apéndice: estado de implementación a fecha de este documento

| Pieza | Estado |
|---|---|
| `fx-event-bus.js`, `fx-registry.js`, `fx-director.js` | Implementado |
| `window.OssuaryFX` (trigger/activate/deactivate/deactivateScope/listActive) | Implementado |
| `fx-rules.config.js` con reglas reales | Solo reglas de debug (`debug:skull-eyes-on/off`). Sin reglas de bonus todavía. |
| Evento real de juego conectado | Solo `bonus:lock-updated` (emitido desde `game.js`). Sin reglas que reaccionen a él todavía. |
| `fx-effects.config.js`, `fx-anchors.config.js`, `fx-position-resolver.js` | Implementado |
| `css-fx-player.js`, `effect-factory.js` | Implementado (solo soporta `type: "css"`) |
| `eyes-glow-test` | Implementado como archivo manual (`eyes-glow-test.fx.js`). Migración a configuración declarativa pendiente (Paso 2 de FX-5). |
| `webm-alpha-player.js`, `canvas-particle-player.js`, `svg-fx-player.js` | No implementado |
| `remotion/` (carpeta, composiciones, export) | No implementado |
| `src/fx/debug/fx-debug-panel.js` | No implementado |
| `bonus:start`, `bonus:end`, `superbonus:start`, `superbonus:end` | No implementado/conectado |
