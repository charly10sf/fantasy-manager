# Los puntos del último partido y la subida: lo medido (24 nov 2026)

Pregunta de Carlos (24 nov, 13:43, con la tarjeta de Bartra «Para aguantarlo · +1,67 M»): «no es lo mismo un jugador que
va subiendo 2 millones cada día y en las últimas 3 jornadas ha hecho 15, 14 y 16 que uno que en la última ha hecho 5».
La cuenta de aguantar y revender (`proyectar` de motor.js) solo miraba el valor: la subida de los últimos 7 días,
frenándose un 15 % cada día. Los puntos solo entraban en la inercia (`efectoPartido`, el día del partido y el siguiente).

## Con qué se midió

`node .github/ia/medir-puntos.mjs` (usa el histórico de valor que baja `medir-aguantar.mjs` y los puntos de cada partido de
`/stats/v1/competition/1/stats/week/N`, con su fecha; todo sin token). Toda LaLiga, jornadas 1-14, días desde el 15 de
septiembre: 3.930 días de 311 jugadores que subían más de un 0,8 % al día. Para cada uno, lo que pasó a 3, 7 y 10 días
menos lo que decía `proyectar`, según los puntos del último partido y los días desde él (0 = el día del partido, con el
valor aún de antes; 1 = el día siguiente).

## 1. Un mal partido frena; uno bueno empuja, pero cada vez menos

Lo que pasó menos lo proyectado, de media, a 7 días (puntos porcentuales):

| Último partido | 0-1 días después | 2 días | 3-6 días |
|---|---|---|---|
| 1 punto o menos | −8,9 | −7,2 | −5,8 |
| 2-4 puntos | −4,9 | −2,7 | −1,9 |
| 5-7 puntos | +8,3 | +7,5 | +3,4 |
| 10 o más | +18,6 | +15,4 | +6,1 |

Por valor del jugador, lo de menos es parecido (de 30 M para arriba, con 1 punto o menos, −8,5 a 7 días).
Lo de más NO se aguanta: tras 5 puntos o más, +15 % a 7 días con las jornadas 1-7 y +8 % con las 8-14.

## 2. La caída frente a los partidos de antes (15, 14, 16 y luego 5)

Con los mismos puntos en el último, el que venía de hacer muchos sube menos que el que venía de hacer pocos (con 5-7 en
el último: +2,1 a 7 días si venía de 9 o más de media, +8,2 si venía de menos de 5). Pero con 5 puntos o más se queda
más o menos en lo que dice `proyectar` (los 26 casos de hacer 5 o más cayendo 6 o más frente a su media: entre −2 y +2 a
7 días): le quita el empujón, no le frena. Con 4 o menos, que viniera de muchos o pocos sale al revés en cada mitad de la
temporada. Así que no se cuenta aparte: lo que frena es hacer 4 puntos o menos.

El caso de Carlos tal cual (venía de 10 o más de media y hace 7 o más menos): 28 casos de 10 jugadores, −2,8 a 7 días.

## 3. Qué entra en el motor y por qué

Solo lo de menos (`FRENO_PARTIDO` y `frenoTras` en motor.js, `M.malPartido`): 4 puntos o menos en un partido de los 6
últimos días resta lo de la tabla a 3, 7 y 10 días (en línea entre medias, lo de 10 más allá; nunca por debajo de un 3 %
menos de lo que vale). Lo usan `proyectar` (revender, aguantar, lo que vuelve de lo pagado de más al fichar para el once,
y el radar de los que vuelven) y `M.tener` (en cuántos días se recupera lo pagado de más).

Probado aprendiendo la tabla con una mitad de la temporada y mirando la otra, en los dos sentidos:

| | error a 7 días | regla de aguantar (prima +15,5 %): ganan | los que quita: ganan |
|---|---|---|---|
| aprende 1-7, prueba 8-14 | 7,5 → 6,8 | 81 % → 85 % (242 → 208 casos) | 56 % (mediana +2,4 %) |
| aprende 8-14, prueba 1-7 | 10,3 → 8,6 | 88 % → 95 % (242 → 172) | 70 % (mediana +6,9 %) |

Con prima +13 % y +17 %, lo mismo (los que quita ganan el 49-72 %; los que quedan, el 82-96 %).

Lo de más, sumado igual, empeora: el error a 10 días pasa de 13,3 a 14,3 y la regla de aguantar coge el triple de
casos, y los que añade ganan solo el 56 %. Se queda fuera.

## Con el caso de Bartra (prueba: .github/ia/caso-aguantar.mjs, escenas «malo» y «bueno»)

Subiendo un 4 % al día y con 1 punto ayer, lo pagado de más (6,81 M) tarda 20 días en recuperarse en vez de 5: no va al
plan y «Mirados y descartados» dice «Hizo 1 punto en su último partido y eso frena su subida: …». Con 7 puntos, igual que
sin partido.

Es una temporada y una sola liga de datos (LaLiga entera, pero los mismos días): repetir la medida en enero, junto con la
de aguantar.
