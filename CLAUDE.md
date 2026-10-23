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
  - motor.js: cálculos (valor, inercia, cláusulas, mercado, qué vende cada rival).
  - ia.js: plan del día y chat con Gemini (clave gratuita de cada usuario).
  - app.js: arranque, acciones, tutorial, actualizaciones solas.
  - vistas.js: pestañas. hojas.js: fichas de jugador y rival, Ajustes, diagnóstico.
  - limite.js: cuenta atrás, minutos por día y funciones bloqueadas. comunes.js: piezas compartidas (candados, calendario, rachas).
  - tour.js: tutorial. version.js: versión y novedades. soporte.js: llamadas al Worker. puente.js: puente con Android.
- `web/limites.json`: apertura (`abre`, `mensajeApertura`), `minutos`, `sinLimite`, `bloqueadas`, `todoAbierto`. La app lo lee de raw de main y la web de Pages, con 6 h de caché.
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
