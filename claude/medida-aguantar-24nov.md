# Comprar para aguantarlo: lo medido (24 nov 2026)

Aviso de Domy (24 nov, 07:48, con captura): «No puede ser que la app te descarte jugadores que están subiendo millones».
Tenía 324 M de saldo y en «Mirados y descartados» le salían Bartra (39,5 M, +3,6 % al día) y Pepelu (58,4 M, +1,8 %).
La cuenta de la app era correcta para lo que miraba (revender ANTES de la jornada: pagando el +16,9 % que gana en su liga,
en 3 días Bartra valdría 43,30 M, −2,89 M), pero era el único horizonte que miraba. Era el pendiente (96): «comprar
pensando en venderlo después de la jornada». Con Bartra, además, el propio texto decía «Para tenerlo, sí» dentro de la
lista de descartados.

## Con qué se midió

`node .github/ia/medir-aguantar.mjs` (el histórico de valor de los 882 jugadores de LaLiga, un punto por día desde el 29
de junio; se miran los días desde mediados de septiembre). 5.002 casos (324 jugadores) de un jugador que ese día subía
más de un 0,8 % al día, con la subida diaria calculada como en `proyectar` de motor.js.

## 1. La proyección del motor casa con lo que pasó

Mediana de lo que sube (proyección → real):

| | 3 d | 7 d | 10 d | 14 d |
|---|---|---|---|---|
| Todos (5.002) | 4,9 → 4,5 % | 9,4 → 9,8 % | 11,3 → 12,8 % | 12,6 → 14,3 % |
| De 30 M o más (1.464) | 4,9 → 4,6 % | 8,8 → 9,0 % | 10,3 → 10,8 % | 11,2 → 10,6 % |
| De 30 M o más y +2,5 % al día o más, como Bartra (413) | 8,3 → 7,3 % | 15,2 → 15,9 % | 17,9 → 22,1 % | 20,2 → 27,6 % |
| De 30 M o más y +1,3-2,3 % al día, como Pepelu (611) | 4,6 → 3,9 % | 8,3 → 7,2 % | 9,9 → 8,6 % | 11,1 → 7,5 % |

El freno (un 15 % menos cada día) no se toca: a 7 días clava la mediana. Con los que suben muy fuerte se queda corto a
10-14 días (va por el lado prudente) y con los que suben menos de un 2,3 % se pasa algo.

## 2. Pagar la prima de la liga y aguantarlo

Se paga el valor más una prima y se sale como hace la app con lo comprado para revender (`M.aguantaReventa`): se vende
el primer día que baja más de un 1 %, o que deja de subir valiendo ya más de lo pagado, o a los 12 días. De 10 M o más y
con 2 o más días subiendo (2.485 casos). No cuenta lo que LaLiga suele dar de más al vender.

| Prima | Regla de la app (se recupera en 7 d o menos y +2,5 % a los 10) | Se recupera en 8-10 d | No se recupera en 10 d |
|---|---|---|---|
| +13 % | 711 casos: gana el 84 %, mediana +14,1 %, p10 −5,8 % | 263: gana el 62 %, mediana +2,8 % | 1.485: gana el 39 %, mediana −3,3 % |
| +15,5 % | 496: gana el 85 %, mediana +15,4 %, p10 −4,8 % | 244: gana el 65 %, mediana +4,5 % | 1.745: gana el 37 %, mediana −4,5 % |
| +17 % | 409: gana el 83 %, mediana +15,0 %, p10 −6,0 % | 192: gana el 66 %, mediana +4,9 % | 1.884: gana el 35 %, mediana −5,2 % |

Ojo con el tamaño: los 409-496 casos de la regla salen de 42-50 jugadores y 51-61 rachas distintas (el mismo jugador
cuenta varios días seguidos). Contando solo el primer día de cada racha: gana el 84-89 %, mediana +21 %, p10 entre −1,5 y
−4 %. Es una temporada; repetir la medida en enero.

## Lo que sale de aquí

- A los de la primera columna el plan les puja para aguantarlos (`M.aguantar`, paso «Para aguantarlo»), solo pagando con
  el saldo (con deuda habría que venderlo antes de la jornada y a esa puja no sale). Cuenta para los «2 a la vez».
- Los de 8-10 días se quedan en «Mirados» (ganan poco y uno de cada tres pierde) y ya no dicen «para tenerlo, sí».
- Los de la tercera columna (Pepelu) siguen descartados: la app tenía razón.
- Con el caso de Domy: Bartra recupera en 7 días → al plan (en 10 días, unos +1,6 M según la proyección; lo medido para
  los que suben un 3 % o más pagando un +16,9 %: gana el 80 % a 10 días, mediana +6,7 %). Pepelu, descartado.
