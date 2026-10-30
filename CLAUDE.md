# Fantasy Manager — cómo trabajamos

Léelo entero antes de tocar el código. En el proyecto de Claude «Fantasy Manager» está claude/ESTADO.md (dónde estamos y qué falta); viene cargado con el proyecto, igual que su claude/COMO-TRABAJAMOS.md, que solo remite a este archivo. Las cuentas del negocio (viabilidad) las guarda Carlos en un doc privado suyo: no van al repo porque es público. El resto está en la carpeta claude/ de este repo y se abre solo cuando hace falta: versiones/0.X.md (lo pendiente de cada versión), historial.md (lo hecho y el detalle largo de cada módulo), cerrar-version.md y BLOQUEO-LALIGA.md.

Repo: charly10sf/fantasy-manager (público). En un chat nuevo hay que añadirlo con acceso de escritura y clonarlo.

## Reglas de Carlos

- No se publica nada sin su OK en su último mensaje («Sí», «Publica»…). Un push a main es publicar: sale la web en GitHub Pages, el APK y app.json. Lo que no está publicado va a la rama `pendiente` con `git push -q -f origin HEAD:refs/heads/pendiente` (si `pendiente` es la base del trabajo, basta un push normal, sin -f; el -f lo puede frenar el entorno, así que mejor partir de `pendiente`).
- Un solo chat trabajando a la vez: `pendiente` se sube con -f y version.js lo tocan todas las versiones, así que dos chats a la vez se pisan.
- Para cerrar una versión, lee claude/cerrar-version.md.
- El token de Cloudflare y el Account ID no se piden ni se pegan en el chat.
- Ninguna clave de firma, keystore ni contraseña entra en el repo (es público). La clave de subida a Google Play vive solo como secretos de Actions, `SUBIDA_P12` (el .p12 en base64) y `SUBIDA_CLAVE` (su contraseña); la Action la deja en `RUNNER_TEMP`. La genera Carlos en su ordenador: ni la Action ni Claude crean ni guardan claves. Salvedad: `android/firma.p12` (la del APK de la liga, cifrada con ANDROID_CLAVE) ya está en el repo; no se toca sin hablarlo con Carlos.
- Fantasy Manager y GrowFolio van del todo separados: ni código, ni cuentas, ni Cloudflare compartidos.
- Ceñirse al roadmap. Lo nuevo que salga va a versiones posteriores.
- Respuestas en español informal, directas y con números.
- El enlace del APK (https://github.com/charly10sf/fantasy-manager/releases/download/app/fantasy-manager.apk) solo se le pasa a Carlos cuando cambia la parte Android (huella nativa nueva: hace falta instalarlo); si solo cambia la web, le llega sola. Lo decidió él el 25 oct.
- Carlos no quiere publicar lo que no esté comprobado que funciona (30 oct: se quitó probar la foto de cada rival con su id).

## Cómo está montada

- Dónde se sirve: la web, AlDia, app.json y el APK van primero a fantasymanagerapp.com y, si no contesta, a GitHub. El dominio lo sirve GitHub Pages desde el 25 oct (con partidos las operadoras cortan las IP de Cloudflare: claude/BLOQUEO-LALIGA.md); Cloudflare Pages queda de respaldo en https://fantasy-manager-61v.pages.dev. ads.txt y app-ads.txt van en web/. El «apk» de app.json sigue en GitHub porque las apps de antes solo se actualizan desde ahí. Antes de poner el repo privado, lee «La mudanza al dominio» en claude/historial.md.
- El detalle de cada módulo (funciones, por qué está así y desde qué versión) está en claude/historial.md, «Detalle por módulo». Léelo antes de tocar ese módulo.

### web/: la app entera, módulos JS sin compilación

- motor.js: cálculos (valor, inercia, cláusulas, mercado, qué vende cada rival, puntos esperados con el rival). Reglas de LaLiga: una cláusula solo se paga con saldo; el margen de deuda (`pujaMax`) solo vale para pujar o comprar en el mercado; nadie puede clausular en las 24 h antes del primer partido de la jornada y se reabren a esa hora (`M.vedas`, `M.vedaAhora`); cuando el valor pasa la cláusula, LaLiga la sube sola hasta el valor (no es una subida pagada: `M.blindaPagada`). Que te clausulen a uno a su valor es regalarlo; el blindaje justo no pasa de lo que se paga en la liga por una cláusula (p90 de los clausulazos) y no compensa si cuesta más de 1/4 de su valor. Piezas que salen en todas partes: `M.partidazo`, `M.interes`, `M.salida`, `M.titularidad`, `M.radar`, `M.perfil`, `M.recienCambiado`/`M.dueno` y `fuerzaContra`.
- externas.js: lo de fuera de LaLiga: onces probables y confirmados (futbolfantasy, `onceFF`; SofaScore da 403 desde la web y el móvil de Carlos), noticias (Google Noticias, que por el Worker da 503), Understat y SofaScore.
- vivo.js: la jornada en directo (puntos, estado y marcador, onces); los puntos entran con `M.ponerVivo` sin rehacer el motor. directo.js: la pestaña Directo (la sexta) y la ficha de un partido (hoja 'p'). Nada del directo en Hoy, lo pidió Carlos.
- clubes.js: la pestaña Clubes (la séptima) y la ficha de un club (hoja 'c'). `EUROPA` (la competición europea de cada club) va a mano y vale hasta el 1 jul 2027: cambiarlo cada verano.
- jornadas.js: Equipo → Jornadas. favoritos.js: Mercado → Favoritos.
- ia.js: plan del día y chat con Gemini (clave gratuita de cada usuario; clave.js es la guía para sacarla, valen las que empiezan por «AQ.» y por «AIza»). `cuadrarPlan` comprueba y corrige lo que propone la IA; `preguntar` lleva los tiempos, el relevo entre modelos y las pausas. operaciones.js: la lista de operaciones que se pueden hacer hoy (P-, M-, T-, C-, A-, V-, B-): la IA solo recomienda de ahí.
- app.js: arranque, acciones, tutorial, actualizaciones solas, fichas apiladas (`S.pila`, «‹ Volver») y segundo plano (`programarFondo`). fondo.js: lo que se avisa con la app cerrada. avisos.js: las alarmas del móvil.
- datos.js: baja todo lo de tu liga y lo guarda (la foto del momento D y el histórico H). api.js: la API de LaLiga (no es pública) y la página de mercado de futbolfantasy; reintenta lo que falla por la conexión. normalizar.js: pasa sus respuestas a un modelo propio. auth.js: la entrada con la cuenta de LaLiga (OAuth2 con PKCE).
- vistas.js: pestañas. hojas.js: fichas de jugador y rival, Ajustes, diagnóstico. comunes.js: piezas compartidas (candados, calendario, rachas, cromos, caras, colores de los clubes). graficos.js: los gráficos en SVG. limite.js: cuenta atrás, minutos por día y funciones bloqueadas.
- tour.js: tutorial. version.js: versión y novedades; presentacion.js las enseña y dibujos.js lleva sus dibujos. soporte.js: llamadas al Worker. puente.js: puente con Android, `despues` (un reloj que no se retrasa con la página oculta: los tiempos van con él, no con setTimeout) y `porWorker` (Worker y, si no contesta, el intermediario de Deno).
- util.js: `LS` y los formateadores de fecha, creados una vez. anuncios-web.js: AdSense, solo en el navegador. demo.js: la liga de ejemplo. aprende.js: compara lo esperado con lo que sacó cada jugador. errores.js, fotos.js, caras.js y texto.js: errores explicados, fotos del chat, encuadre de caras y markdown.
- La app no enseña como fuente el nombre de futbolfantasy, Analítica Fantasy, Jornada Perfecta, Comuniate, Biwenger, Futmondo, SofaScore ni Understat (`esWebFantasy`, `sinWebs`); el diagnóstico sí.

### web/limites.json

Lo que se cambia sin sacar versión. La app lo lee de raw de main y la web de Pages, con 6 h de caché.

- Claves: `abre`, `mensajeApertura`, `ligas`, `minutosLiga`, `minutos`, `equipos`, `extra`, `sinLimite`, `bloqueadas`, `todoAbierto`, `anunciosWeb`, `anunciosWebDueno` y `top` (opcional: si no está, 2 usos y 60 min).
- La cuenta atrás y los minutos, solo para las cuentas con alguna liga de `ligas` (ahora «Maulazzos»). `minutosLiga` está a 0 desde el 24 oct (sin límite). `minutos` está a 0 porque las versiones viejas se congelaban al contar el tiempo. `equipos` da minutos a un equipo concreto sea cual sea su liga, y `extra`, minutos de más a un equipo un día concreto.
- `bloqueadas`: las funciones top (dineroRivales, quienPaga, inercia, ventasRivales, perfilRival), cerradas para todos menos `todoAbierto`. En `play` se abren con bonificados (cuántos y cuánto, en `top` y limite.js). Sin plan de pago, solo anuncios.
- `sinLimite` y `todoAbierto` van por id de cuenta (667015), nunca por nombre de equipo: un nombre lo puede copiar cualquiera.
- `anunciosWeb` a false apaga AdSense en la web para todos; `anunciosWebDueno` deja a Carlos verlos de prueba.

### android/

- WebView que sirve web/ desde el APK. AlDia.java baja la web nueva de Pages si la parte Android no ha cambiado (comparando huellas) y vuelve a la del APK si la nueva no arranca.
- Sabores `github` (la liga, sin anuncios) y `play` (Google Play). Solo `play` lleva AdMob (`src/play/.../Anuncios.java`: consentimiento de la UE, banner bajo la web y bonificado; en `src/github`, un stub) y no lleva el servicio en primer plano (Google pide justificarlo con un vídeo). `fm.anunciosReales` en android/gradle.properties: true, anuncios de verdad; false, bloques de prueba de Google.
- Que nadie de la liga ni los testers toquen anuncios: AdMob cierra cuentas por clics propios.
- Play Console: play/ficha.md y play/prueba-cerrada.md.

### worker/

- Cloudflare Worker con KV VINCULOS. Rutas /p (proxy a LaLiga), /img, /vincular (código para abrir en otro dispositivo), /fallos (avisos de fallo con respuesta), /hola (quién usa la app) y /caras (las fotos de los de tu liga que usan la app). ADMINS = 667015 (Carlos) en wrangler.toml.
- /p e /img solo responden si la petición trae un `Origin` de `ORIGENES` y solo siguen redirecciones a sitios de `PERMITIDOS`. Si se cambian, cambiarlos también en el intermediario de Deno (repo charly10sf/fantasy-manager-proxy, `main.ts`; cada push a su `main` se publica solo).
- Las escrituras gratis de KV (unas mil al día) se comparten entre todo.

### .github/

- android.yml (compila en main y pendiente, publica APK y app.json solo desde main; desde pendiente deja el APK de GitHub en la pre-release `prueba`, enlace directo para probarlo en el móvil: https://github.com/charly10sf/fantasy-manager/releases/download/prueba/fantasy-manager-prueba.apk; lo pidió Carlos el 31 oct), web.yml (GitHub Pages), dominio.yml (el respaldo en Cloudflare Pages, al acabar «Web» y «App Android» en main), worker.yml y fallos.yml (a mano: lee y contesta los avisos de Fallo).
- paquete.py genera paquete.json con las huellas y pone en web/index.html cada módulo con su huella (`js/x.js?v=…`): en el repo index.html va sin huellas, se ponen al publicar.

## Avisos de Fallo

Revisarlos antes de cada versión y contestar solo con lo ya publicado. También llegan por «Copiar para Claude» en la app (solo Carlos) o por captura.

1. Añadir a la sesión el repo privado charly10sf/fantasy-manager-avisos (lectura) y clonarlo.
2. `gh workflow run fallos.yml -R charly10sf/fantasy-manager --ref main -f llave="$(node .github/fallos-leer.mjs llave)"`
3. Al acabar, `git -C <clon> fetch -q origin main && git -C <clon> reset -q --hard FETCH_HEAD` (la rama se rehace cada vez: pull falla) y `CAPTURAS=<carpeta> node .github/fallos-leer.mjs leer <clon>/fallos.enc` (DIAG=1 para el diagnóstico). Las capturas se miran con Read. Nada de esto se pega en el chat ni en el repo público.
4. Contestar: la misma Action con `-f respuestas='[{"buscar":"trozo del principio del aviso","por":"Claude · Fantasy Manager","respuesta":"…"}]'` (o `"id"` si se tiene). Solo los sin contestar; las respuestas se ven en la Action: nada personal. Se comprueba con las anotaciones del job (`gh api repos/charly10sf/fantasy-manager/check-runs/<job>/annotations`): «N contestados ahora».

## Publicar (solo con su OK)

1. Poner la hora en la entrada de version.js: `TZ=Europe/Madrid date +%H:%M`.
2. Commit con los trailers de Claude.
3. `git pull -q --rebase origin main && git push -q origin HEAD:main`.
4. Esperar las Actions «Web» y «App Android» (y «Worker» si cambia worker/).
5. `git pull` (la Action sube app.json), subir también a `pendiente` y comprobar https://fantasymanagerapp.com/paquete.json (GitHub Pages; github.io redirige ahí) y, tras la Action «Dominio», el respaldo https://fantasy-manager-61v.pages.dev/paquete.json.

Si cambia algo en android/app/src cambia la huella nativa y los móviles necesitan el APK nuevo. Si no, la web les llega sola.

## Probar

- Rendimiento: Playwright con `Emulation.setCPUThrottlingRate` (×4 o ×6) y el perfilador de CDP sobre `analizar`. Nada de crear formateadores de fecha (`toLocale…` con zona horaria, `new Intl.DateTimeFormat`) dentro de bucles: van creados una vez en util.js (`diaDe` guarda el día por hora).
- `python3 -m http.server 8765` dentro de web/ y Playwright con el Chromium que ya trae el entorno.
- Para salir de la demo en pruebas: interceptar app.js y cambiar `demo: enDemo() };` por `demo: false };`.
- `localStorage['fm-worker']` simula la web; el user agent, Android o iPhone.
- El intermediario: `localStorage['fm-proxy2']` (y `fm-worker`) con servidores falsos (vivo y lento, cerrado, agujero negro).
- `node --check` no ve todos los errores de sintaxis de un módulo: probar siempre en el navegador (index.html avisa si app.js no arranca en 20 s).
- El tutorial se salta con `localStorage['fm-tour'] = '1'`. Si sale la cuenta atrás, interceptar limites.json con un `abre` pasado.
- La liga de ejemplo no trae partidazos: para probar `M.partidazo`, sustituirlo en la página (`S.M.partidazo = …`) y volver a llamar a `S.M.interes`.
- El plan de la IA sin clave: guardar en la demo un plan falso con `modelo` (`LS.set(K('planes'), [P])` importando util.js y datos.js), recargar y mirar `S.plan` (`avisoAlin`, `alineacion`, `ops`); `mejorarAlin` y `cuadrarPlan` se exportan de ia.js. Con `S.M.ppEsperado` sustituido se fuerzan los casos.
