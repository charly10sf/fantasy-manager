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
- Caídas y novedades: un jugador solo, en su tweet con el formato de Carrasco; varios, en un tweet agrupado por lo que pasa, sin lista de paréntesis («❌ Se caen por lesión Lemar en el Elche y M. Román en el Celta», «✅ Vuelven Valverde al Real Madrid y Sadiq al Valencia»), con una cabecera que ya cuenta la noticia y la media solo del que más pesa (`lib/agrupar.mjs`; Carlos, 3 nov 12:06). Sin repetir: caídas deja fuera a quien ya salió en caídas de esa jornada o en novedades de las últimas 24 h (`cubiertos()` del registro, que lo saca de las claves), y entre un tweet de novedades y uno de caídas pasan al menos `separacionBajasMin` (75) minutos. Los cambios de novedades que no salen (topes, separación) quedan pendientes en el registro (`novedadesPend`) hasta 36 h. Prueba sin red: `node bot/prueba/bajas-ejemplo.mjs`.
- Noticias de prensa (`tipos/noticias.mjs`, Carlos, 2-3 nov): lee los RSS de MARCA, AS, Mundo Deportivo y SPORT (`lib/prensa.mjs`) y se queda con las noticias nuevas que nombran a un jugador que importa (media de 4 o más, o 10 M o más) y hablan de lesión, entrenamiento, convocatoria o alta. Gemini (`lib/gemini.mjs`, secreto `GEMINI_API_KEY`, clave solo del bot; los modelos salen de la lista de la clave, alternando flash y lite porque los flash dan 503 a menudo) las clasifica (lesión, molestias, descartado, vuelve o nada; lo que solo afecta a Champions, Copa o selección no cuenta) y escribe una frase, el motivo y el plazo con palabras propias; el bot tira lo que copia 6 palabras seguidas de la noticia, lleva cifras que no están en ella, nombra a un medio o no nombra al jugador, y entonces usa una plantilla. Regla de las dos fuentes: sale si lo comunica el club, si lo cuentan dos medios, o un medio y además LaLiga Fantasy (tocado; para una vuelta, «ok» desde hace menos de 72 h) o la lista de lesionados dicen lo mismo. Lo que ya salía así en LaLiga desde 48 h antes no es noticia. Un tweet por jugador con el formato de Carrasco y la fuente con nombre («🗞️ Lo cuentan AS y MARCA»), de 9 a 23 h (`horasNoticias`), 2 por ejecución como mucho, 30 min entre noticias y 45 con caídas y novedades (`separaciones`). Sin repetir: noticias no repite lo de novedades o caídas, y novedades y caídas no repiten lo que ya contó la prensa. Gemini solo se pregunta por noticias nuevas (las vistas se guardan en el registro, `noticias.vistas`), en lotes de 20, 2 por ejecución, 90 s como mucho y 60 preguntas al día (`geminiDia`). En el registro (repo público) no se guardan titulares ni entradillas, solo lo sacado. Sin la clave no hace nada. Prueba sin red: `node bot/prueba/noticias-ejemplo.mjs`.
- Sancionados y apercibidos (`tipos/sancionados.mjs`, cola de Carlos del 3 nov): de la jornada que viene, cuando la anterior ha acabado, de 9 a 23 h (`horasSancionados`) y cuando faltan menos de 54 h para el primer partido (`sancionadosAntesHoras`; con jornada de viernes, desde el miércoles por la tarde). Sancionados: los que LaLiga da por sancionados y pesan en el fantasy (titular habitual, 3 o más de media o 8 M o más), con el motivo de la página de sancionados de las webs de previas (`lib/disciplina.mjs`: roja directa, cinco amarillas o «3/4» de una sanción larga) o, si no casa, el de su ficha. Apercibidos: titulares habituales con cuatro amarillas, con dos fuentes (la página de apercibidos y la ficha de LaLiga, que tiene que contar 4, 9, 14…). Un tweet de cada (más si los sancionados no caben), 60 min entre ellos, tope 3 por jornada, tarjeta de bajas (carta si es uno). Sin repetir con caídas ni con novedades de sanción; caídas, novedades y noticias tampoco repiten a los de este tipo. Prueba sin red: `node bot/prueba/sancionados-ejemplo.mjs`.
- Lloros Fantasy (`tipos/lloros.mjs`, cola de Carlos del 3 nov): al acabar la jornada (4 h después del último saque, de 9 a 23 h, `horasLloros`), un tweet con los que se quedan sin la portería a cero por muy poco. Reglas sacadas de 4.072 fichas de jornada (`bot/prueba/puntos-sondeo.mjs`): la portería a cero da 4, 3, 2 o 1 (portero, defensa, centrocampista, delantero) y solo con 60 minutos o más sin que le cuenten un gol; jugar menos de 60 da 1 punto y 60 o más, 2. Casos: se queda en 50-59 minutos con su equipo sin encajar en todo el partido (pierde la bonificación y un punto por jugar), o juega 60 o más y su equipo solo encaja un gol, a partir del 85' (minuto de ESPN). Solo porteros, defensas y centrocampistas con 3 o más de media u 5 M o más, sin rojas. Tope 1 por jornada; si no hay ninguno, no sale nada. Prueba sin red: `node bot/prueba/lloros-ejemplo.mjs`.
- Textos pulidos por Gemini (`lib/pulir.mjs`, Carlos, 3 nov 17:52): antes de publicar, los tweets de `final`, `mvp`, `resumen`, `caidas`, `novedades` y `previa` que van a salir en la ejecución se mandan a Gemini en una sola pregunta por tipo para que los reescriba más humanos con la guía de estilo. Solo cambia la forma: cada línea pulida se compara con la de la plantilla (mismo número de líneas y en el mismo orden, mismo emoji, mismas cifras, mismos jugadores y equipos, mismas palabras de estado: lesión, baja, duda, sanción, vuelve, titular, ciclo, gol, plazos…, con sinónimos como «se cae» = «baja»), la última línea con «Fantasy» se queda igual, sin palabras nuevas con mayúscula, sin emojis nuevos fuera de la guía, sin @, #, enlaces ni primera persona, y el validador de siempre. Lo que no pasa sale con la plantilla; si Gemini no contesta, también. `pulir` en config.json: `tipos`, `porDia` (40 preguntas, contador `pulido` en el registro) y `segundos` (45). El directo y el mercado no se pulen (prisa y formato de lista). En el resumen de cada ejecución sale la plantilla debajo del pulido. Sin registro guardado (simulacro del cron) no gasta cupo; `--pulir=1` lo fuerza. Prueba sin red: `node bot/prueba/pulir-ejemplo.mjs`.
- Noticias de la competición (`tipos/liga.mjs`, Carlos, 4 nov 13:01): suspensiones, aplazamientos, cambios de horario y partidos a puerta cerrada de Primera (la jornada entera o un partido), con los mismos feeds que las noticias de jugadores (una sola lectura por ejecución, `noticiasPrensaUnaVez`). Gemini dice qué pasa, si se estudia, está confirmado o se descarta, la jornada, los clubes y si hay un fallecimiento detrás (tono sobrio: sin 🚨 ni líneas de fantasy). Dos medios o uno oficial; «se estudia» sale como tal y la decisión sale después en otro tweet; lo que se estudiaba ya no sale si ya salió la decisión. De 8 a 24 h (`horasLiga`), 1 por ejecución, tope 6 por jornada, 20 preguntas a Gemini al día (`ligaGeminiDia`). Sin tarjeta. Prueba sin red: `node bot/prueba/liga-ejemplo.mjs`.
- El motivo de cada baja (Carlos, 3 nov 13:15: «no puedes poner "aparece como lesionado en LaLiga Fantasy" y ya está»): `lib/partes.mjs` lee la lista de lesionados de las webs de previas (lesión, desde cuándo y lo que se espera: «duda para la jornada N», «baja hasta…», «disponible») y saca el motivo de una sanción de la ficha de LaLiga (roja o quinta amarilla en la última jornada). Un tweet de uno solo lo cuenta («⚠️ Rotura fibrilar en el aductor desde el 1 de noviembre / 🗓️ No se le espera hasta finales de noviembre»); los agrupados, el del que más pesa (`detalle` de lib/agrupar.mjs). Publicando, un lesionado sin parte no sale todavía: espera a que lo haya (en novedades queda pendiente hasta 36 h). Nunca se nombra la web.
- El % de titularidad de la previa, las caídas y las sorpresas de los onces lleva el once probable de las webs de previas como la app (0,5; `lib/ff.mjs`; `onceProbable` en config.json). Una duda de LaLiga se publica si la web también la da (segunda fuente).
- El mercado no usa esto todavía (lo lleva otra sesión). Las respuestas de Telegram siguen igual.

### Cómo se escriben (2 nov, noche)

- Los tweets de partido (`directo`, `final`, `mvp`) no llevan «LaLiga Fantasy J..» en la cabecera: llevan el marcador del momento de la jugada
  (reconstruido de los `details` de ESPN, solo si cuadra con el marcador final; si no, el actual y un texto sin relato) y una frase de cómo
  ha sido (`lib/relato.mjs`, `tipos/directo.mjs`, `relato()` en `tipos/final.mjs`).
- El cierre «Fantasy Manager · enlace en la bio» va solo en `final` y `mercado` (Carlos, 2 nov 23:11). El resto va sin cierre (`sinCierre` en `lib/texto.mjs`).
  «fantasy» ya no es obligatoria (Carlos, 4 nov 13:00): las etiquetas la llevan cuando encaja y nunca se añade #LaLigaFantasy de relleno. Las respuestas de Telegram para los clubes siguen con cierre.
- **Puntos DAZN** (`lib/dazn.mjs`): llegan después del final del partido. `final`, `mvp`, `resumen`, los tweets de `directo` de un partido ya acabado y las
  respuestas de Telegram esperan a que los jugadores que más puntúan del partido tengan `marca_points` en su ficha (player/{id}); si pasan
  `daznEsperaHoras` (6, en `config.json`) desde el saque sin verlo, salen igual.

## Tarjetas con imagen (encendidas desde el 2 nov)

Tarjetas de 1200x675, estilo «noche» (el elegido por Carlos el 2 nov). Desde el 3 nov, las que hablan de UN jugador concreto (la de
jugador y la de bajas o novedades de uno solo) van en carta de coleccionista (diseño propio, `lib/carta.mjs`, letra Barlow
Condensed), con el metal según su valor de mercado: leyenda 90 M o más, oro 35-90 M, plata 10-35 M, bronce el resto. Las primeras fueron la de **final** (escudos, marcador y los 3 mejores y los 3
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

Sin enlaces; «fantasy» cuando encaje (no es obligatoria); 280 caracteres (el validador cuenta como X, emojis = 2); cada número del texto tiene que estar en los
datos; topes por tipo y jornada (el `mvp` cuenta aparte), 25 al día y 4 por ejecución (`config.json`); nunca responde ni da likes; nada de la liga privada.

## Telegram (avisos para Carlos)

`bot/telegram.mjs`, en el mismo workflow, justo después del paso de X. Hace falta crear los secretos `TELEGRAM_BOT_TOKEN` y
`TELEGRAM_CHAT_ID` (el bot de @BotFather y el id del chat privado con él); sin ellos no se ejecuta. Funciona aunque `BOT_MODO` sea
`simulacro` (`parado` también lo para). Tiene su propio registro, `telegram.json`, en la rama `bot-estado`.

- **Respuestas para los clubes.** X no deja responder por API a quien no te ha mencionado antes y el bot de X nunca responde, así que
  las respuestas las pone Carlos a mano. Al acabar cada partido (de las últimas 10 h) el bot le manda un mensaje con una respuesta por
  club, en `<code>` para copiarla con un toque: marcador y mejor jugador del club con sus puntos oficiales de LaLiga, con textos
  distintos para quien gana, quien pierde y el empate (si el perdedor no tiene a nadie con puntos positivos, una frase sin dato).
  Cada texto pasa por el mismo validador que los tuits (280, sin enlaces, números que estén en los datos). Si LaLiga aún no
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
