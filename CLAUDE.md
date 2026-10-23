# Fantasy Manager — cómo trabajamos

Léelo entero antes de tocar el código. El estado del día y el roadmap están en el proyecto de Claude «Fantasy Manager» (claude/COMO-TRABAJAMOS.md y claude/ROADMAP-versiones.md). Si cambias algo de aquí, cámbialo también allí.

Repo: charly10sf/fantasy-manager (público).

## Reglas de Carlos

- No se publica nada sin su OK en su último mensaje («Sí», «Publica»…). Un push a main es publicar: sale la web en GitHub Pages, el APK y app.json. Lo que no está publicado va a la rama `pendiente` con `git push -q -f origin HEAD:refs/heads/pendiente`.
- Un solo chat trabajando a la vez: `pendiente` se sube con -f y version.js lo tocan todas las versiones, así que dos chats a la vez se pisan.
- Versiones: algo nuevo sube el número (0.4.5); los parches y cosas leves llevan letra (0.4.4e). Cada una con su entrada en NOVEDADES (web/js/version.js), con fecha y hora de Madrid.
- A quien acaba de llegar no le salen novedades de versión, solo el tutorial.
- El token de Cloudflare y el Account ID no se piden ni se pegan en el chat.
- Fantasy Manager y GrowFolio van del todo separados: ni código, ni cuentas, ni Cloudflare compartidos.
- Ceñirse al roadmap. Lo nuevo que salga va a versiones posteriores.
- Respuestas en español informal, directas y con números.

## Cómo está hecha

- `web/`: la app entera, módulos JS sin compilación.
  - motor.js: cálculos (valor, inercia, cláusulas, mercado, qué vende cada rival). Regla de LaLiga: una cláusula solo se paga con saldo (no se puede clausular quedándose en negativo); el margen de deuda (`pujaMax`) solo vale para pujar o comprar en el mercado. Incluye el cierre de cláusulas de LaLiga: nadie puede clausular en las 24 h antes del primer partido de la jornada y se reabren a esa hora (`M.vedas`, `M.vedaAhora`; cada ficha lleva `veda` y `protegidoHasta` ya es la hora en que de verdad se puede pagar).
  - externas.js: lo de fuera de LaLiga: onces probables (futbolfantasy), noticias, Understat, SofaScore y las alineaciones confirmadas (SofaScore, `/event/{id}/lineups` con `confirmed`; se piden de los partidos que empiezan en menos de 75 min, y con la app abierta cada 3 min mientras falte alguna). El % de titular de las listas sale de `M.titularidad` (motor.js), y con la alineación confirmada manda ella.
  - ia.js: plan del día y chat con Gemini (clave gratuita de cada usuario). Los dos piensan en «low» (con «medium» tardaba minutos); el chat lleva un contexto corto (`contexto(..., { chat: true })`) y busca en Google solo si hace falta.
  - app.js: arranque, acciones, tutorial, actualizaciones solas.
  - vistas.js: pestañas. hojas.js: fichas de jugador y rival, Ajustes, diagnóstico.
  - limite.js: cuenta atrás, minutos por día y funciones bloqueadas. comunes.js: piezas compartidas (candados, calendario, rachas).
  - tour.js: tutorial. version.js: versión y novedades. soporte.js: llamadas al Worker. puente.js: puente con Android.
  - clave.js: la guía para sacar la clave de Gemini en AI Studio (pasos con esquemas, pegar y probar sola). Las claves nuevas de Google empiezan por «AQ.» y las de antes por «AIza»: valen las dos.
- `web/limites.json`: apertura (`abre`, `mensajeApertura`), `ligas`, `minutosLiga`, `minutos`, `equipos`, `sinLimite`, `bloqueadas`, `todoAbierto`. La cuenta atrás y los minutos son solo para las cuentas con alguna liga de `ligas` (por nombre o id; ahora «Maulazzos»); las demás, sin límite. Lo bloqueado (`bloqueadas`: dineroRivales, quienPaga, inercia, ventasRivales), para todos menos `todoAbierto`. `minutosLiga` (40 desde el 23 oct: 10 + 30 que pidió Carlos) es lo que leen las versiones desde la 0.5.0b; `minutos` está a 0 porque las anteriores tenían un fallo que congelaba la app al contar el tiempo: cuando nadie tenga una versión vieja, se puede volver a poner igual. `sinLimite` y `todoAbierto` van por id de cuenta (667015), no por nombre de equipo: un nombre lo puede copiar cualquiera. La app lo lee de raw de main y la web de Pages, con 6 h de caché (la guardada sin `ligas` se vuelve a leer).
- `android/`: WebView que sirve web/ desde el APK. AlDia.java baja la web nueva de Pages si la parte Android no ha cambiado (comparando huellas) y vuelve a la del APK si la nueva no arranca. Sabores `github` (la liga) y `play`.
- `worker/`: Cloudflare Worker con KV VINCULOS. Rutas /p (proxy a LaLiga), /img, /vincular (código para abrir en otro dispositivo), /fallos (avisos de fallo con respuesta), /hola (quién usa la app). ADMINS = 667015 (Carlos) en wrangler.toml.
- `.github/`: android.yml (compila en main y pendiente, publica APK y app.json solo desde main), web.yml (Pages), worker.yml. paquete.py genera paquete.json con las huellas.

## Publicar (solo con su OK)

1. Poner la hora en la entrada de version.js: `TZ=Europe/Madrid date +%H:%M`.
2. Commit con los trailers de Claude.
3. `git pull -q --rebase origin main && git push -q origin HEAD:main`.
4. Esperar las Actions «Web» y «App Android» (y «Worker» si cambia worker/).
5. `git pull` (la Action sube app.json), subir también a `pendiente` y comprobar https://charly10sf.github.io/fantasy-manager/paquete.json.

Si cambia algo en android/app/src cambia la huella nativa y los móviles necesitan el APK nuevo. Si no, la web les llega sola.

## Probar

- `python3 -m http.server 8765` dentro de web/ y Playwright con el Chromium que ya trae el entorno.
- Para salir de la demo en pruebas: interceptar app.js y cambiar `demo: enDemo() };` por `demo: false };`.
- `localStorage['fm-worker']` simula la web; el user agent, Android o iPhone.
