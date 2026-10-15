# Ossuary Reels — Art Bible

**Guía de dirección artística.** Qué debe sentirse, qué se busca y qué evita el usuario. No es técnica: el *dónde* está en `CLAUDE_AGENT.md` y el inventario en `docs/ART_STATUS.md`.

| | |
|---|---|
| Estado | v0.2: rellenado el 2026-10-08 con las decisiones del usuario registradas en `PROJECT_STATE.md` y su historial (julio a octubre de 2026) |
| Regla | Cada punto sale de algo que el usuario pidió, aprobó o rechazó. Lo que no se ha decidido se marca como *sin definir* |

---

## 1. Filosofía visual

- **Dark fantasy de cripta**, no casino. Una máquina de tortura de madera vieja, hierro oxidado, cadenas y huesos, bajo una luna fría, con fuego y sangre. Un verdugo encapuchado preside desde arriba.
- **Lo físico manda**: las cosas pesan, cuelgan, caen y se balancean. Cuerdas con tensión, guillotinas que se mecen al caer, cuervos que caen muertos por su columna, cabezas que salen despedidas. Cuando algo "se ve de mentira", se rehace (cuerdas de la guillotina, julio de 2026).
- **Sutileza en lo ambiental, impacto en los momentos**: humo, luz y profundidad apenas se notan; los premios, los cortes y el BIG WIN sí golpean.
- **Sin efectos alrededor del contorno de los símbolos.** Es la regla más repetida: filos de luz, brillos fríos, sombras y halos los hacían parecer "grises y difuminados" (octubre de 2026).

## 2. Paleta

- **HUD** (desde 2026-10-14): negro y oro (`#d4ae55`) en las piezas; letra normal (Arial), sin fuente especial; cifras de BALANCE/BET/WIN en amarillo chillon (`#ffd91a`) sobre un recuadro transparente tirando a marron. Silueta propia para todas las slots del usuario: reloj de arena (SPIN en la cintura; de pie en escritorio, tumbado en movil) y trebol de cuatro corazones que se abre en X. Simple, sin recargar (el usuario rechazo arena, cristal y pilares de hueso). Rojo en el Execution Bonus. El BUY BONUS es el platano.
- **Oro cincelado** para cifras y rótulos importantes: los números del contador BIG WIN y sus letras (PLAY, FREE SPIN · 3 CHANCES). Los botones de pantallas especiales usan esa misma letra.
- **Rojo sangre** para las líneas de pago y el cartel MAX WIN.
- **Luz de luna fría** (gris azulado) para el humo de los símbolos y el relleno frío de la escena. **Fuego cálido** desde abajo.
- **Azul oscuro** para la luz de energía que viaja de la costilla a la calavera al bloquearse un bonus. El **verde** se retiró: ni ojos verdes en la calavera ni marcas verdes en las costillas (julio de 2026).
- Bonus: fondo de fuego; el contador BIG WIN, en negro con tinte carmesí, brasas y niebla rojiza.

## 3. Materiales

Madera vieja y oscura (rodillos hundidos, cepos, cofre), hierro oxidado (marcos, botón PLAY de las free spins con marco de hierro), hueso, oro (monedas, coronas, manos del esqueleto rico) y sangre. *Sin definir*: piedra, magia y fuego espectral como materiales propios.

## 4. Símbolos

- Arte del usuario, con **profundidad horneada** (bisel con luz de arriba a la izquierda y canto abajo a la derecha) al **25%** de la versión fuerte: el usuario la quiso suave.
- Sin filtros en vivo ni capas encima.
- **Cuervo dorado** (pedido por el usuario, 2026-10-09): el mismo cuervo pasado a oro (`tools/bake-golden-crow.js`), que viene ya dorado en la secuencia del rodillo (nunca se vuelve dorado de golpe). Un **25% más grande** que los demás símbolos en cualquier casilla, también girando ("más épico", 2026-10-09). Con el rodillo parado, **reluce y se mueve un poco**: balanceo suave, pulso de luz fuerte, dos destellos que cruzan el oro dentro de la silueta y estrellas de luz que titilan, sin halo alrededor. Posado y al morir, el mismo vídeo y arte con filtro dorado.
- **Los que pagan**: una vibración corta y seca y un solo destello que deja un filo cálido tenue mientras dura la línea. Nada en bucle (octubre de 2026).
- Gigantes del bonus: solo la imagen, sin borde ni brillo de caja (rib1, julio de 2026).

## 5. Humo y niebla

- **Detrás de cada símbolo, alrededor y moviéndose con él**: no repartido por la ventana, que quedaba entre los símbolos.
- **Irregular y disperso**: jirones que a veces llegan al vecino o le pasan un poco por encima. **Nunca un círculo** ("parece una linterna").
- **En todas direcciones y distinto en cada símbolo** (4-5 animaciones por símbolo, para que no se vea cíclico).
- Muy sutil. Al usuario le encanta esa sutileza.
- También detrás de los esqueletos y cepos del bonus, y como neblina detrás del botón PLAY de las free spins.

## 6. Iluminación

- Una sola luz para la escena: **luna fría arriba a la izquierda** (la del fondo) y **fuego cálido de relleno desde abajo**.
- **Profundidad de la máquina**: rodillos hundidos (madera más oscura hacia los bordes y bajo el marco), marco con bisel y sombra, fondo algo desenfocado y más oscuro.
- Rechazado:
  - una luz de "tambor" por ventana (oscurecía los extremos de las casillas, donde hay cosas que deben verse);
  - un reflejo metálico que recorría el marco;
  - sombras oscuras bajo los símbolos.

## 7. Premios grandes (contador BIG WIN)

- **Dark fantasy, nunca "casino dorado".**
- **Círculo** detrás del número, con haces regulares, brasa redonda, onda, niebla, latido y brasas. El usuario lo prefirió a una versión irregular.
- En el círculo, **símbolos macabros**: calavera, daga, luna creciente, huesos cruzados, ojo, ataúd y reloj de arena. **Sin runas.**
- **Reliquias** del propio arte (cuervos, cuervo muerto, calaveras, huesos, hoz) girando en espiral lenta alrededor del número. Cuervos que cruzan, con graznidos graves.
- **Sin rótulo "BIG WIN"** ni recuadro: solo el número, con cifras de oro y separadores dorados.
- La intensidad crece poco a poco con el premio, sin saltos bruscos, y la entrada es suave.
- **Ritmo según el premio** (2026-10-09): los premios pequeños (10, 20, 40 € con apuesta 1) se hacían pesados. Ahora el contador solo se alarga cuando el premio lo merece, y con música el número siempre termina en un golpe de la canción.
- Al final, el cuervo se posa sobre el número. Con la ganancia máxima cae un cuervo muerto gigante y "MAX WIN" se escribe con sangre en una tabla.

## 8. Botones y pantallas

- Sencillos y muy estéticos. Para el botón de las free spins se rechazaron dos versiones recargadas: una placa de oro con rubíes y huesos, y otra de madera y hierro con remaches.
- Sin huesos decorativos en los botones.
- Letras de oro del juego para PLAY y los títulos; el hover se queda centrado; al pulsar hay un estallido.
- Interfaz de menús, reglas y avisos: el negro y oro del HUD (`--hud-yellow`), con títulos en la fuente del juego (Moria Citadel).

## 9. Movimiento

- Físico, sin animaciones enlatadas. Lo que va en un rodillo se mueve con el rodillo (su arranque, su muelle y su recorte en el borde), no con una animación aparte y un fundido. Por eso se rehízo la salida de las puertas del esqueleto (julio de 2026).
- Fluido: tirones o "teletransportes" se tratan como bugs (doble cuchilla, salto del multiplicador al pegarse a la guillotina).
- **El usuario quiere ver el movimiento**: no se apagan animaciones por `prefers-reduced-motion`, que su Windows tiene activo.

## 10. Costillas, esternón y ojos

- La caja torácica es la máquina: las costillas son los rodillos y el esternón el rodillo central. Al completar las costillas del bonus, la guillotina cae y se abre el Execution Bonus.
- Los ojos de la calavera (efecto verde) están retirados del juego. *Sin definir*: qué representan y si vuelven en el SUPER BONUS.

## 11. SUPER BONUS

*Sin definir.* El modo está desactivado y no tiene arte.

## 12. Principios

**Rompe la identidad visual**:

- cualquier cosa alrededor del contorno de los símbolos;
- el dorado de casino;
- las runas;
- los rótulos genéricos ("BIG WIN");
- los adornos recargados;
- el verde de energía;
- los círculos de luz perfectos tras los símbolos;
- lo que parece falso o enlatado.

**Pertenece a Ossuary Reels**: madera, hierro, hueso, sangre, cuervos, luna y fuego, con movimiento con peso, humo sutil e impactos secos.
