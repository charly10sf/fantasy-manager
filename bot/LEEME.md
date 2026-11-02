# Bot de la cuenta de X

Genera tweets de LaLiga Fantasy con datos reales (API de LaLiga sin token, ESPN), los valida y, solo si se le dice, los publica.
Sin dependencias (Node 22). Plan, tono, topes y coste: `claude/bot-x.md` del proyecto «Fantasy Manager» en claude.ai.

## Cómo corre

`.github/workflows/bot.yml`, cada 15 minutos. Según la variable de repositorio `BOT_MODO`:
- sin ella o `simulacro`: genera y valida, y enseña los tweets en el resumen de cada ejecución (pestaña Actions). No publica.
- `publicar`: publica de verdad y apunta lo publicado en la rama `bot-estado` (`registro.json`) para no repetir.
- `parado`: no hace nada (el interruptor de emergencia: se cambia desde el móvil en Settings > Secrets and variables > Actions > Variables).

Para pasar a publicar: crear los cuatro secretos `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` (las claves
OAuth 1.0a de la app en console.x.com, sin pegarlas nunca en un chat), lanzar «Bot X» a mano con «comprobar» marcado (prueba las
claves sin publicar) y, si sale bien, poner `BOT_MODO` = `publicar`.

## Qué publica hoy

`resumen` (mejores y peores de la jornada, al acabar), `final` (cada partido al acabar, solo los empezados en las últimas 10 h),
`caidas` (lesionados y sancionados habituales de la jornada que viene, al acabar la actual o antes de que empiece; las dudas, no, hasta
tener una segunda fuente). Las caídas solo se publican de 9 a 21 h (Madrid, `horasCaidas` en `config.json`). Si X responde «duplicado» (403) se apunta como publicado y se sigue; cualquier otro error de X para esa ejecución. `directo` está hecho pero no se programa hasta ver el sondeo del partido en directo.

## Tarjetas con imagen (apagadas por defecto)

Dos tarjetas de 1200x675, estilo «noche» (el elegido por Carlos el 2 nov): la de **final** (escudos, marcador y los 3 mejores y los 3
peores de cada equipo con su cara y sus puntos oficiales; «peores» = los que menos puntúan de los que jugaron 30' o más, con los
minutos de la ficha de cada jugador, porque stats/week no los trae) y la de **jugador** (cara, escudo, puntos de la jornada, total,
media, últimas 5 jornadas y valor de los últimos 60 días con el cambio en 30). La de final va en el tweet `final`; la de jugador, en
un tweet `mvp` aparte por partido (tope 10 por jornada) y en los dobletes y tripletes de `directo`.

- Se encienden en `config.json`: `"tarjetas": { "final": true, "jugador": true }`. Con las dos a false el bot hace lo mismo que sin
  esto (ni instala nada ni genera el tweet `mvp`).
- Código: `lib/tarjetas.mjs` (dibujo SVG y PNG con @resvg/resvg-js, fuente Inter en `fuentes/`), `lib/datos-tarjetas.mjs` (datos de la
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
