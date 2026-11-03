# Bot de la cuenta de X

Genera tweets de LaLiga Fantasy con datos reales (API de LaLiga sin token, ESPN), los valida y, solo si se le dice, los publica.
Sin dependencias (Node 22). Plan, tono, topes y coste: `claude/bot-x.md` del proyecto «Fantasy Manager» en claude.ai.

## Cómo corre

`.github/workflows/bot.yml`, cada 5 minutos: lo lanza el cron del Worker de Cloudflare (`scheduled` en `worker/src/index.js`, con el secreto `BOT_DISPATCH_TOKEN`), porque el schedule de GitHub no disparaba; el de 15 min de bot.yml queda de respaldo. Según la variable de repositorio `BOT_MODO`:
- sin ella o `simulacro`: genera y valida, y enseña los tweets en el resumen de cada ejecución (pestaña Actions). No publica.
- `publicar`: publica de verdad y apunta lo publicado en la rama `bot-estado` (`registro.json`) para no repetir.
- `parado`: no hace nada (el interruptor de emergencia: se cambia desde el móvil en Settings > Secrets and variables > Actions > Variables).

Para pasar a publicar: crear los cuatro secretos `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` (las claves
OAuth 1.0a de la app en console.x.com, sin pegarlas nunca en un chat), lanzar «Bot X» a mano con «comprobar» marcado (prueba las
claves sin publicar) y, si sale bien, poner `BOT_MODO` = `publicar`.

## Qué publica hoy

`resumen` (mejores y peores de la jornada, al acabar), `final` (cada partido al acabar, solo los empezados en las últimas 10 h),
`directo` (cada gol con su asistente y los puntos fantasy, rojas y penaltis fallados, de los partidos de hoy empezados hace menos
de 3 h; el término medio de Domy, aceptado por Carlos el 2 nov), `mvp` (el MVP de cada partido con su tarjeta), `caidas` (lesionados y sancionados habituales de la jornada que viene, al acabar la actual o antes de que empiece; las dudas, no, hasta
tener una segunda fuente), `mercado` (cada noche, tras la actualización de valores de hacia las 00:15, de 0 a 1 h y, si esa noche falla, de 8 a 12 h: un tweet con la tarjeta del top 5 que sube y baja), `previa` (posibles onces de cada partido con el % de titularidad de la app, de 36 h a 3 h antes, de 9 a 23 h; `lib/onces.mjs`), `onces` (onces confirmados en cuanto ESPN los publica, con las sorpresas frente al posible once) y `novedades` (cambios de estado en LaLiga Fantasy de los jugadores que importan: lesionado, sancionado, vuelve; de 9 a 23 h; el estado anterior se guarda en el registro, `estados`). El resumen de la jornada, la previa y los onces llevan tarjeta (`svgResumen` y `svgOnces` en `lib/tarjetas.mjs`). Las caídas solo se publican de 9 a 21 h (Madrid, `horasCaidas` en `config.json`). Horas de silencio de 1 a 8 h (`horasSilencio`): no sale nada salvo el directo y el mercado; lo pendiente sale a partir de las 8 (`ventanaFinalHoras` = 13 para que el final y el MVP de un partido de las 21 h aguanten). Si X responde «duplicado» (403) se apunta como publicado y se sigue; cualquier otro error de X para esa ejecución. Con el cron de 5 min del Worker, los goles salen con hasta 5 min de retraso (más lo que tarde la Action, ~30 s).

### Cómo se escriben (3 nov: tweets más humanos)

Guía completa en `claude/estilo-tweets.md` del proyecto (sale de leer 297 tweets de @JoseCarrasco_98, @AnaliticaLaLiga y @futbol_fantasy).
Las piezas comunes están en `lib/redactar.mjs`:
- Una idea por línea, con una línea en blanco entre ideas y el emoji solo como etiqueta delante (🚨 noticia, ⚠️ detalle, ‼️ el dato que
  cambia algo, ⁉️ duda, ✅ buena noticia, ❌ baja, 📍 marcador, 📊 puntos). `tweet(cab, ideas)` arma el texto y, si no cabe en 280, quita
  primero las ideas de menos `prio`.
- Frase corta de sujeto, verbo y dato; la segunda vez que sale un jugador, por su puesto (`segunda`: «el delantero»).
- Las dudas, con palabras según el % (`enPalabras`) y el número al lado.
- Jornada y rival en la etiqueta final («❌ Baja Fantasy para la jornada 12 contra el Valencia»; `proximoPartido` y `paraLa`).
- Caídas y novedades con el formato de Carrasco: un tweet por jugador (o por equipo, si tiene varios) cuando son pocos, en lista si son muchos.
- El mercado no usa esto todavía (lo lleva otra sesión). Las respuestas de Telegram siguen igual.

### Cómo se escriben (2 nov, noche)

- Los tweets de partido (`directo`, `final`, `mvp`) no llevan «LaLiga Fantasy J..» en la cabecera: llevan el marcador del momento de la jugada
  (reconstruido de los `details` de ESPN, solo si cuadra con el marcador final; si no, el actual y un texto sin relato) y una frase de cómo
  ha sido (`lib/relato.mjs`, `tipos/directo.mjs`, `relato()` en `tipos/final.mjs`).
- El cierre «Fantasy Manager · enlace en la bio» va solo en `final` y `mercado` (Carlos, 2 nov 23:11). El resto lleva la palabra «fantasy» en el texto o, si no la
  lleva, cierra con #LaLigaFantasy (`sinCierre` en `lib/texto.mjs`). Las respuestas de Telegram para los clubes siguen con cierre.
- **Puntos DAZN** (`lib/dazn.mjs`): llegan después del final del partido. `final`, `mvp`, `resumen`, los tweets de `directo` de un partido ya acabado y las
  respuestas de Telegram esperan a que los jugadores que más puntúan del partido tengan `marca_points` en su ficha (player/{id}); si pasan
  `daznEsperaHoras` (6, en `config.json`) desde el saque sin verlo, salen igual.

## Tarjetas con imagen (encendidas desde el 2 nov)

Tarjetas de 1200x675, estilo «carta» desde el 3 nov (letra Barlow Condensed y titulares en dorado; antes, «noche»). La carta de
coleccionista (diseño propio) solo va cuando la tarjeta es de UN jugador (jugador, y bajas o novedades de uno solo; con varios, fichas), con el metal según su valor de mercado:
leyenda 90 M o más, oro 35-90 M, plata 10-35 M, bronce el resto (`METALES` en lib/tarjetas.mjs). Las primeras fueron la de **final** (escudos, marcador y los 3 mejores y los 3
peores de cada equipo con su cara y sus puntos oficiales; «peores» = los que menos puntúan de los que jugaron 30' o más, con los
minutos de la ficha de cada jugador, porque stats/week no los trae) y la de **jugador** (cara, escudo, puntos de la jornada, total,
media, últimas 5 jornadas y valor de los últimos 30 días con su cambio). La de final va en el tweet `final`; la de jugador, en
un tweet `mvp` aparte por partido (tope 10 por jornada) y, en `directo`, una por cada jugador implicado (goleador, asistente, expulsado, el que falla el penalti; hasta 4 por tweet).

- Se encienden en `config.json`: `"tarjetas": { "final": true, "jugador": true }`. Con las dos a false el bot hace lo mismo que sin
  esto (ni instala nada ni genera el tweet `mvp`).
- Código: `lib/tarjetas.mjs` (dibujo SVG y PNG con @resvg/resvg-js, fuentes Inter y Barlow Condensed, OFL, en `fuentes/`), `lib/datos-tarjetas.mjs` (datos de la
  API de LaLiga sin token: stats/week, player/{id} y player/{id}/market-value; fotos y escudos PNG de assets-fantasy),
  `lib/con-tarjetas.mjs` (qué tarjeta lleva cada tweet), `tipos/mvp.mjs`, y `subirImagen` en `lib/x.mjs` (POST /2/media/upload con
  la imagen en base64, categoría tweet_image; el tweet lleva luego `media.media_ids`).
- Validador (`validarTarjeta` en `lib/validar.mjs`): cada cifra y cada palabra escrita en la imagen tiene que salir de los datos crudos
  de LaLiga o de la lista de palabras fijas; la que no pasa no sale. Si una tarjeta no pasa o X rechaza la subida, el tweet del final
  sale sin imagen y el del MVP no sale; tras un rechazo de subida no se vuelve a intentar en esa ejecución.
- En Actions, la instalación (`npm ci --prefix bot`) solo corre con alguna tarjeta encendida, y las PNG de cada ejecución quedan como
  artefacto `tarjetas-<id>` 7 días.

## Reglas

Sin enlaces; «fantasy» en todos; 280 caracteres (el validador cuenta como X, emojis = 2); cada número del texto tiene que estar en los
datos; topes por tipo y jornada (el `mvp` cuenta aparte), 25 al día y 4 por ejecución (`config.json`); nunca responde ni da likes; nada de la liga privada.

## Telegram (avisos para Carlos)

`bot/telegram.mjs`, en el mismo workflow, justo después del paso de X. Hace falta crear los secretos `TELEGRAM_BOT_TOKEN` y
`TELEGRAM_CHAT_ID` (el bot de @BotFather y el id del chat privado con él); sin ellos no se ejecuta. Funciona aunque `BOT_MODO` sea
`simulacro` (`parado` también lo para). Tiene su propio registro, `telegram.json`, en la rama `bot-estado`.

- **Respuestas para los clubes.** X no deja responder por API a quien no te ha mencionado antes y el bot de X nunca responde, así que
  las respuestas las pone Carlos a mano. Al acabar cada partido (de las últimas 10 h) el bot le manda un mensaje con una respuesta por
  club, en `<code>` para copiarla con un toque: marcador y mejor jugador del club con sus puntos oficiales de LaLiga, con textos
  distintos para quien gana, quien pierde y el empate (si el perdedor no tiene a nadie con puntos positivos, una frase sin dato).
  Cada texto pasa por el mismo validador que los tuits (280, «fantasy», sin enlaces, números que estén en los datos). Si LaLiga aún no
  ha puesto los puntos (menos de 12 jugadores con algo distinto de 0), espera a la siguiente ejecución. Máximo 10 por jornada, 20 al
  día y 5 por ejecución (`telegram` en `config.json`).
- **Cuentas de los clubes.** `telegram.cuentasX` de `config.json` lleva la cuenta de X en español de los 20 clubes de la 26/27 (comprobadas
  el 2 nov 2026 en su perfil de X; la clave es el nombre corto de los tweets) y el mensaje la enseña junto al club. Si cambia un club de
  categoría o de cuenta, se edita ahí. Celta, Deportivo y Espanyol publican sobre todo en gallego o catalán: no tienen otra cuenta en español.
- **Aviso de fallo.** Si falla un paso del workflow, un mensaje con el enlace a la ejecución (máximo 3 al día, `avisosDia`).
- El token va en la URL de la API de Telegram: el bot lo borra de cualquier error que escriba en el registro.

## Pruebas

`node bot/prueba/firma.mjs` (firma OAuth). En la rama `pruebas-fuentes`, «Bot simulacro» prueba todo contra un servidor falso de X.
`node bot/ejecutar.mjs --modo=simulacro` desde un entorno con red.

Telegram, sin red: `node bot/prueba/telegram-falso.mjs &` y
`TELEGRAM_API_BASE=http://127.0.0.1:8788 TELEGRAM_BOT_TOKEN=TOKENFALSO TELEGRAM_CHAT_ID=12345 node bot/telegram.mjs --datos=partidos.json --estado=/tmp/telegram.json`
con un `partidos.json` de la forma `{"semana": 11, "stats": [...]}` (los `stats` de `stats/week/{n}`). `--simulacro=1` enseña los
mensajes sin mandarlos. Con red, `node bot/telegram.mjs --simulacro=1` los saca con datos reales.

Tarjetas: `cd bot && npm ci`, y `node bot/prueba/tarjetas-ejemplo.mjs --jornada=11 --salida=tarjetas` (con red) o con
`--datos=<carpeta>` (sin red, una jornada guardada; formato en el propio archivo). De punta a punta sin red: `DATOS=<carpeta> node
bot/prueba/laliga-falsa.mjs &` y `GUARDAR=/tmp/subidas node bot/prueba/servidor-falso.mjs &` (`SUBIDA_FALLA=1` para probar el
rechazo), y una copia de `bot/` con el host de `lib/laliga.mjs` cambiado a http://127.0.0.1:8789 y las tarjetas encendidas:
`X_API_BASE=http://127.0.0.1:8787 X_API_KEY=a X_API_SECRET=b X_ACCESS_TOKEN=c X_ACCESS_TOKEN_SECRET=d node bot/ejecutar.mjs
--modo=publicar --ventanas=0 --tipos=final,mvp --estado=/tmp/registro.json`. En simulacro, `--tarjetas=1` las dibuja aunque estén
apagadas.
