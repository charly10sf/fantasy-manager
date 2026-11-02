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

## Reglas

Sin enlaces; «fantasy» en todos; 280 caracteres (el validador cuenta como X, emojis = 2); cada número del texto tiene que estar en los
datos; topes por tipo y jornada, 25 al día y 4 por ejecución (`config.json`); nunca responde ni da likes; nada de la liga privada.

## Pruebas

`node bot/prueba/firma.mjs` (firma OAuth). En la rama `pruebas-fuentes`, «Bot simulacro» prueba todo contra un servidor falso de X.
`node bot/ejecutar.mjs --modo=simulacro` desde un entorno con red.
