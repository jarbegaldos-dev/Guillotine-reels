# Auditoría visual de líneas de pago — Ossuary Reels

> **Documento histórico (1 de julio de 2026).** Describe el sistema de rutas
> anterior. Desde el 9 de julio de 2026 las líneas son la red de **173
> caminos de 5 columnas** que salen de la columna izquierda
> (`game.js#paylineNetRoutes`, rejilla `game.js#OSSUARY_BOARD_COLUMNS`). El
> sistema actual está en `ARCHITECTURE.md` (*Board and paylines*) y el que ve
> el jugador en la pantalla de reglas (`src/ui/rules-screen.js`).

> **ACTUALIZACIÓN (aplicada):** se corrigió el motor para que **solo
> `rib3-1` sea el origen absoluto** de cualquier combinación normal. El
> análisis original (260 rutas, múltiples orígenes) queda abajo como
> referencia histórica del problema; la sección final documenta el estado
> corregido y validado.

Generado por análisis (sin modificar código en su origen). Datos extraídos
ejecutando `src/math/combination-path-registry.js` real contra la geometría
real de `src/config/layout.config.js` (script temporal, fuera del proyecto).

## 1. Geometría real → columnas

El registro de rutas no usa "paylines" dibujadas a mano. Agrupa las 24 celdas
jugables en **7 columnas** según su posición X real:

```
col0  col1      col2      col3        col4      col5      col6
                                       
                rib1-1    rib1-2      rib1-3
      rib2-1    rib2-2    sternum-1   rib2-3    rib2-4
rib3-1 rib3-2   rib3-3    sternum-2   rib3-4    rib3-5    rib3-6
      rib4-1    rib4-2    sternum-3   rib4-3    rib4-4
      rib5-1    rib5-2               rib5-3    rib5-4
```

Filas (por Y real): **A**=rib1, **B**=rib2/sternum-1, **C**=rib3/sternum-2,
**D**=rib4/sternum-3, **E**=rib5.

```
        c0      c1      c2        c3         c4      c5      c6
A:                    rib1-1    rib1-2               
B:            rib2-1  rib2-2    sternum-1  rib2-3   rib2-4
C:    rib3-1  rib3-2  rib3-3    sternum-2  rib3-4   rib3-5  rib3-6
D:            rib4-1  rib4-2    sternum-3  rib4-3   rib4-4
E:            rib5-1  rib5-2               rib5-3   rib5-4
```

Una "ruta" = elegir **una sola celda por columna**, sin repetir reel, columna
siempre creciente (nunca salta hacia atrás, nunca se repite).

## 2. Cuántas líneas existen ahora mismo

- **260 rutas totales** generadas por `generateRoutes()`.
- Por longitud: `3→37`, `4→94`, `5→94`, `6→32`, `7→3`.
- Las 260 tienen un conjunto de celdas **distinto** entre sí (no hay dos rutas
  con exactamente las mismas 3-7 celdas).
- Pero si se ignora **qué celda de sternum** se usó (sternum-1/2/3 son la
  misma "fila" visual), solo hay **170 corredores geométricos distintos**.
  Las otras **90 son variantes redundantes** que solo cambian el sternum
  usado, no la forma de la línea.

## 3. Ejemplos numerados y por qué son válidos

| # | Tipo | Celdas reales | Filas | Por qué es válida |
|---|------|----------------|-------|---------------------|
| L1 | **Recta** (corta) | `rib2-2, sternum-1, rib2-3` (id 230) | B→B→B | misma fila en las 3 columnas, columna siempre crece, reels distintos (rib2-left, sternum, rib2-right) |
| L2 | **Diagonal** | `rib1-2, rib2-3, rib3-5` (id 226) | A→B→C | desciende una fila por columna, sin sternón, sin repetir reel |
| L3 | **Zigzag** (la más larga, 7) | `rib3-1, rib4-1, rib5-2, sternum-2, rib4-3, rib5-4, rib3-6` (id 1) | C→D→E→C→D→E→C | sube y baja de fila en cada paso pero la columna siempre avanza +1 |
| L4 | **Con esternón** | `rib2-1, rib3-3, sternum-1, rib2-3, rib3-5` (id 41) | B→C→B→B→C | usa sternum-1 como bisagra central; el esternón NUNCA es la primera ni la última celda (regla explícita del código) |
| L5 | **Larga** (máx. 7) | `rib3-1, rib2-1, rib1-1, sternum-1, rib3-4, rib2-4` (id 9, longitud 6) y los 3 de longitud 7 (ids 1-3) | — | toca una celda de cada una de las 7 columnas, una sola vez por reel |
| L6 | **Corta** (mín. 3) | `rib1-1, sternum-1, rib2-3` (id 224) | A→B→B | longitud mínima permitida (`MIN_PATH_LENGTH = 3`) |

```
Esquema de L3 (zigzag id 1), sobre la rejilla:

        c0      c1      c2      c3         c4      c5      c6
A:                                                             
B:                                                            
C:    [rib3-1]                          [sternum-2]                    [rib3-6]
D:            [rib4-1]                            [rib4-3]            
E:                    [rib5-2]                              [rib5-4]  
```

## 4. Símbolos por línea (ejemplo con tablero real)

Si el tablero tuviera `ANCIENT_GOLD_COIN` en `rib1-2, rib2-3, rib3-5`, la
línea **L2 (diagonal, id 226)** sería ganadora con longitud 3. Si además
`rib2-4` también fuera `ANCIENT_GOLD_COIN`, entonces la ruta **id 227**
(`rib1-3, rib2-4, rib3-6`, otra diagonal igual de forma pero un escalón más a
la derecha) también pagaría — **dos rutas distintas, pero visualmente
"la misma diagonal" en otra posición**.

## 5. Por qué existen 260 rutas

El generador no diseñó 260 líneas a mano: hace una **búsqueda combinatoria**
columna por columna. Desde cada celda de inicio (columnas 0-5), explora
recursivamente todas las celdas de la columna siguiente cuya fila esté a
máximo ±1 de la fila más cercana, sin repetir reel, hasta longitud 7. Como
varias columnas tienen 4-5 celdas (varios reels comparten esa posición X), el
árbol de combinaciones crece rápido → 260 combinaciones válidas distintas.

## 6. Rutas únicas reales vs. variaciones redundantes

- **170 corredores únicos** (forma geométrica distinta: misma secuencia de
  reels).
- **90 rutas son variaciones redundantes**: idéntico corredor, solo cambia
  cuál de las 3 celdas de sternum se usa como bisagra. Ejemplo (mismo
  corredor, 3 variantes):
  - id 5: `..., sternum-2, rib4-3, rib5-4, rib3-6`
  - id 6: `..., sternum-3, rib4-3, rib5-4, rib3-6`
  - (corredor `rib2-left>rib3-left>sternum>rib4-right>rib5-right>rib3-right`)

## 7. ¿Los símbolos normales solo pagan en cadena continua izq→der?

**Sí, confirmado por el código y por los datos:**
- `nextCells()` solo mira la columna siguiente (`columnIndex + 1`) — nunca
  salta columnas.
- Verificación ejecutada sobre las 260 rutas: **0 pasos** donde la columna no
  aumenta estrictamente.
- `winningPrefix()` en `combination-symbol-evaluator.js` corta la cadena en
  cuanto aparece un símbolo distinto, excluido o vacío — es un prefijo
  continuo desde la primera celda de la ruta.

## 8. ¿Existen rutas que permitan...?

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| Saltar símbolos/columnas | **No** | `nextCells` solo avanza a `columnIndex+1`; nunca columnIndex+2 |
| Cambiar de dirección (retroceder columna) | **No** | 0 de 260 rutas tiene una columna que no aumente |
| Reutilizar la misma posición varias veces en una ruta | **No** | `isValidRoute` exige reels distintos (`Set(reelId).size === route.length`); cada celda pertenece a un solo reel |
| Pagar la misma combinación visual más de una vez | **Sí, indirectamente** | No es un bug de una ruta individual: es el `SHARE_POLICY = "allow_all"` del conflict resolver (ver auditoría anterior). Varias de las 260 rutas comparten casi todas sus celdas (la misma línea visual ganadora) y **todas se pagan por separado** en vez de quedarse con una sola. |

## 9. Rutas "incorrectas"

No hay ninguna ruta individual mal construida: las 260 cumplen geometría,
no-repetición y dirección única. **El problema no está en una ruta concreta,
sino en el conjunto**: los 90 pares/tríos de rutas que comparten corredor
(sección 6) y, sobre todo, el hecho de que el resolver de conflictos acepte
**todas** las rutas solapadas como ganadoras independientes. Ejemplo concreto
de un grupo problemático si todas pagaran a la vez (mismo corredor, mismo
premio visual, 3 cobros):

- id 5 — `rib2-1, rib3-3, sternum-2, rib4-3, rib5-4, rib3-6`
- id 6 — `rib2-1, rib3-3, sternum-3, rib4-3, rib5-4, rib3-6`
- (más sus 14 variantes hermanas del mismo corredor, ids 4-20)

Esto confirma el diagnóstico de la Fase 1: el riesgo real no es la
geometría de las rutas (que es correcta), sino la falta de deduplicación al
resolver pagos.

---

## 10. CORRECCIÓN APLICADA — START único en `rib3-1`

Regla definitiva aprobada: **solo `rib3-1` (rib3-left, casilla 1) puede
iniciar una combinación normal.** Ninguna otra celda puede ser origen.

Cambio aplicado en `src/math/combination-path-registry.js`:
`generateRoutes()` ya no arranca el recorrido (`walk`) desde todas las
celdas de las columnas 0-5; arranca **únicamente** desde las celdas de la
columna 0 (que en esta geometría es exactamente `rib3-1`).

**Antes / después:**

| Métrica | Antes | Después |
|---|---|---|
| Total rutas | 260 | **26** |
| Longitud 3 | 37 | **2** |
| Longitud 4 | 94 | **0** (ver nota) |
| Longitud 5 | 94 | **8** |
| Longitud 6 | 32 | **13** |
| Longitud 7 | 3 | **3** |
| Orígenes distintos | 14 celdas distintas | **1 (`rib3-1`)** |

**Nota sobre longitud 4:** con árbol de conexiones real (±1 fila, sin
reutilizar reel), no existe ninguna cadena de longitud 4 que nazca en
`rib3-1`. Desde `rib3-1` solo hay dos primeras conexiones (`rib2-1` arriba,
`rib4-1` abajo); la columna 3 solo ofrece el esternón (que nunca puede ser
la última celda) o `rib1-2` (que siempre choca con un reel ya usado). Toda
cadena se corta en 3 o se alarga a 5. Esto es geometría real, no un error
del cambio.

**Validaciones ejecutadas (con tablero simulado, símbolos `MONEDA`/`ROCA`):**

1. START incompatible (`rib3-1 = RIB_BONUS`) → **0 combinaciones ganadoras.**
2. Cadena de 3 (`rib3-1, rib2-1, rib1-1 = MONEDA`) → **paga.**
3. Ramificación (`rib3-1, rib4-1, rib5-2` = MONEDA, ambos `sternum-2` y
   `sternum-3` = MONEDA) → **ambas ramas pagan de forma independiente.**
4. Rama rota (`rib2-1` branch corta en `rib1-1 = ROCA`) + rama válida
   (`rib4-1` branch sigue) → **la rama rota no paga, la válida sí.**
5. Combinación que arranca en medio del tablero (`rib2-1, rib1-1,
   sternum-1 = MONEDA`, pero `rib3-1 = ROCA`) → **0 pagos** (ya no se
   reconoce como ganadora, confirma que el origen único se respeta).

`SHARE_POLICY` se mantiene en `"allow_all"` a propósito: la ramificación
legítima (regla 8-9 del Connection Win Engine) sigue pagando varias ramas
del mismo origen cuando ambas son válidas; ya no hay rutas con orígenes
falsos que inflaran el total.

Tests del proyecto (`npm test` / `tools/validate-runtime.js`) actualizados
para reflejar el nuevo contrato: 26 rutas, conteos por longitud, y
verificación explícita de que toda ruta empieza en `rib3-1`.

---

## 11. Ramificación válida arriba/centro/abajo

**Regla confirmada:** si desde la última celda válida de una cadena existen
3 conexiones posibles a la columna siguiente (derecha-arriba, derecha,
derecha-abajo), y la conexión central se rompe por símbolo distinto
(no Wild, no compatible), las conexiones diagonales (arriba y/o abajo) deben
seguir evaluándose y pagando **de forma independiente**, siempre que su
símbolo sea igual o Wild.

### Ejemplo ASCII (punto de ramificación real del motor)

```
prefijo: rib3-1 -> rib4-1 -> rib5-2 -> sternum-2
                                          |
                         +----------------+----------------+
                    arriba: rib2-3   centro: rib3-4   abajo: rib4-3
```

### Caso probado (tablero simulado, sin tocar el motor real)

- Prefijo `rib3-1, rib4-1, rib5-2, sternum-2` = `HUESO`
- `rib2-3` (arriba) = `HUESO`
- `rib3-4` (centro) = `MONEDA` ← rompe la cadena
- `rib4-3` (abajo) = `HUESO`
- Resto del tablero = `ROCA` (neutral, sin interferencia)

### Resultado esperado

- Rama arriba (`..., rib2-3`): debe pagar `HUESO` longitud 5.
- Rama centro (`..., rib3-4`): no debe pagar (símbolo distinto, rompe ahí).
- Rama abajo (`..., rib4-3`): debe pagar `HUESO` longitud 5.
- Total: 2 pagos independientes, ninguno por el centro.

### Resultado real del evaluador (`combination-symbol-evaluator.js`)

```
symbol HUESO len 5  cells rib3-1,rib4-1,rib5-2,sternum-2,rib2-3   (arriba, paga)
symbol HUESO len 5  cells rib3-1,rib4-1,rib5-2,sternum-2,rib4-3   (abajo, paga)
(ninguna combinación ganadora contiene rib3-4)                    (centro, no paga)
```

Coincide exactamente con el resultado esperado.

### Conclusión

El motor actual (post-corrección START único, 26 rutas) **ya cumple esta
regla sin necesidad de cambios**. Cada rama geométrica es una ruta
precomputada independiente en `combination-path-registry.js`, y
`evaluateRoutes()`/`winningPrefix()` evalúa cada ruta de forma aislada, sin
estado compartido entre rutas. Que la rama central se rompa por símbolo no
afecta en absoluto a la evaluación ni al pago de las ramas hermanas
(arriba/abajo). **No se requiere ningún cambio de código.**

## 12. CORRECCIÓN APLICADA — START único movido a `rib3-2` (rib3 reducido a 2 celdas)

Una tarea posterior (layout, Claude) redujo `rib3` de 3 a 2 celdas por lado,
eliminando `rib3-1` (la celda que hasta entonces era, por pura geometría, la
única ocupante de la columna 0 y por tanto el START único aprobado en la
sección 10). Al desaparecer esa celda, `tools/validate-runtime.js` empezó a
fallar (12 asserts de geometría/rutas) porque la columna 0 pasó a fusionarse
con la siguiente: 4 celdas distintas (`rib2-1`, `rib3-2`, `rib4-1`, `rib5-1`)
quedaban ahora en la misma columna geométrica, perdiendo el origen único (se
generaban 120 rutas desde 4 orígenes distintos, longitud máxima 5).

**Decisión aprobada por el usuario:** mantener la regla de "1 solo origen
posible", pero ya no por geometría (rib3-2 comparte columna con otras 3
celdas) sino por **regla explícita de configuración**: nueva clave
`START_CELL_ID: "rib3-2"` en `src/config/combo.config.js`, consumida en
`combination-path-registry.js#generateRoutes()` para filtrar las celdas de
inicio de la columna 0 a únicamente esa (si no está definida, el
comportamiento es idéntico al anterior — compatibilidad hacia atrás para
cualquier otro consumidor sintético del registro).

**Números nuevos (geometría de 5 columnas, no 7):**

| | Antes (rib3-1, 7 columnas) | Ahora (rib3-2, 5 columnas) |
|---|---|---|
| Columnas | 7 | 5 |
| Rutas totales | 26 | 35 |
| Longitud mínima/máxima | 3 / 7 | 3 / 5 |
| Longitud 3 | 2 | 1 |
| Longitud 4 | 0 (prohibida) | 13 |
| Longitud 5 | 8 | 21 |
| Longitud 6 | 13 | — (ya no existe, faltan columnas) |
| Longitud 7 | 3 | — (ya no existe, faltan columnas) |
| Orígenes distintos | 1 (`rib3-1`) | 1 (`rib3-2`) |

`tools/validate-runtime.js` actualizado a estos valores exactos (incluyendo
el `fakeBoard` de prueba del evaluador, reconstruido sobre una ruta real de
longitud 5 en vez de la antigua de longitud 7 que ya no existe). El test
sintético de sustitución de WILD (`substituteState`, tablero aislado sin
relación con el layout real) pasa `START_CELL_ID: null` explícitamente para
no heredar la restricción del tablero real, ya que sus celdas (`left-1`,
`mid-1`, ...) nunca podrían satisfacerla.

No se tocó RNG, RTP de símbolos individuales, paytable, bonus, locks, audio
ni FX — únicamente la construcción de rutas de combinación (motor de
paylines) y su validación. `npm test` OK (82 archivos JS, 81 scripts
runtime). Verificado en navegador real: spin manual sin errores de consola,
render normal.
