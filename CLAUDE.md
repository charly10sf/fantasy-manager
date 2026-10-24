# Fantasy Manager — cómo trabajamos

Léelo entero antes de tocar el código. El estado del día y el roadmap están en el proyecto de Claude «Fantasy Manager» (claude/COMO-TRABAJAMOS.md y claude/ROADMAP-versiones.md). Si cambias algo de aquí, cámbialo también allí.

Repo: charly10sf/fantasy-manager (público).

La mudanza al dominio (desde la 0.6.0): la web, AlDia, app.json y el APK van primero a fantasymanagerapp.com y, si no contesta, a GitHub. La web de GitHub Pages sigue igual con una banda para llevarse la cuenta (`mudarse`, un código de /vincular en `#codigo=`). El «apk» de app.json sigue en GitHub porque las apps de antes solo se actualizan desde ahí. Antes de poner el repo privado: que nadie tenga una app anterior a la 0.6.0, cambiar ese «apk» al del dominio (dominio.yml) y quitar GitHub Pages.

## Reglas de Carlos

- No se publica nada sin su OK en su último mensaje («Sí», «Publica»…). Un push a main es publicar: sale la web en GitHub Pages, el APK y app.json. Lo que no está publicado va a la rama `pendiente` con `git push -q -f origin HEAD:refs/heads/pendiente`.
- Un solo chat trabajando a la vez: `pendiente` se sube con -f y version.js lo tocan todas las versiones, así que dos chats a la vez se pisan.
- Versiones: algo nuevo sube el número (0.4.5); los parches y cosas leves llevan letra (0.4.4e). Cada una con su entrada en NOVEDADES (web/js/version.js), con fecha y hora de Madrid.
- A quien acaba de llegar no le salen novedades de versión, solo el tutorial. Si al abrir hay más de 6 novedades pendientes, salen solo las 5 principales (presentacion.js).
- El token de Cloudflare y el Account ID no se piden ni se pegan en el chat.
- Fantasy Manager y GrowFolio van del todo separados: ni código, ni cuentas, ni Cloudflare compartidos.
- Ceñirse al roadmap. Lo nuevo que salga va a versiones posteriores.
- Respuestas en español informal, directas y con números.

## Cómo está hecha

- `web/`: la app entera, módulos JS sin compilación.
  - motor.js: cálculos (valor, inercia, cláusulas, mercado, qué vende cada rival). Reglas de LaLiga y de cómo se juega: que te clausulen a uno a su valor es regalarlo (pierdes sus puntos y lo que sube, venderlo a LaLiga daría más y reponerlo cuesta más); el blindaje justo no pasa de lo que se paga en la liga por una cláusula (p90 de los clausulazos) y no compensa si cuesta más de 1/4 de su valor. Cuando el valor de un jugador pasa su cláusula, LaLiga la sube sola hasta el valor (eso no es una subida pagada: `M.blindaPagada`); una cláusula solo se paga con saldo (no se puede clausular quedándose en negativo); el margen de deuda (`pujaMax`) solo vale para pujar o comprar en el mercado. Incluye el cierre de cláusulas de LaLiga: nadie puede clausular en las 24 h antes del primer partido de la jornada y se reabren a esa hora (`M.vedas`, `M.vedaAhora`; cada ficha lleva `veda` y `protegidoHasta` ya es la hora en que de verdad se puede pagar).
  - externas.js: lo de fuera de LaLiga: onces probables (futbolfantasy), noticias, Understat, SofaScore y las alineaciones confirmadas (SofaScore, `/event/{id}/lineups` con `confirmed`; se piden de los partidos que empiezan en menos de 75 min, y con la app abierta cada 3 min mientras falte alguna). El % de titular de las listas sale de `M.titularidad` (motor.js), y con la alineación confirmada manda ella.
  - vivo.js: los datos de la jornada en directo (puntos de cada jugador y estado y marcador de cada partido de `/stats/v1/competition/1/stats/week/{n}`, con `/calendar?weekNumber={n}` para el estado y el marcador si no vienen: `partidosDe`, `jornadaStats`; tu once de `/teams/{id}/lineup`, el de un rival de `/teams/{id}/lineup/week/{n}` y los puntos de cada equipo de `livePoints` en `/leagues/{liga}/standing`, o de `/standing/{n}`; si las estadísticas no responden, `weekPoints` de `/players`). Con la jornada en juego, cada 2 min, y cada minuto en Directo o con la ficha de un partido abierta. Los puntos nuevos entran con `M.ponerVivo` sin rehacer el motor. Una lectura GET que falla por la conexión se prueba otra vez (api.js). `M.puntosVivo(pid)` solo da puntos si su partido ya ha empezado.
  - directo.js: la pestaña Directo (la sexta, entre Equipo y Rivales): los partidos con marcador y estado (el minuto es aproximado, desde la hora de inicio: LaLiga solo da la parte), tus jugadores en cada uno, lo que llevas y tu puesto en la jornada, la clasificación de la jornada con cuántos le quedan a cada rival (pide los onces de todos, como mucho cada 3 min), tu once de LaLiga; la ficha de un partido (hoja 'p', `n:id`) con cada equipo en su campo (los que han jugado, con sus puntos, de quién es cada uno arriba a la izquierda y gol o tarjeta arriba a la derecha; con minutos, los 11 que más han jugado y «Entraron» debajo; sin minutos ni alineación confirmada, todos en el campo; antes de empezar, el once probable con la formación gratis que más suma) y las jugadas de SofaScore si deja (`jugadasSofa` en externas.js; desde el móvil de Carlos SofaScore da 403); y el bloque «Jornada N» de la ficha de un jugador (`#vivo-j`). Los puntos en directo también salen en Equipo («Tu once» con `directo: true`), en las listas, en Rivales y en la ficha de cada rival; nada en Hoy, lo pidió Carlos.
  - ia.js: plan del día y chat con Gemini (clave gratuita de cada usuario). Los dos piensan en «low» (con «medium» tardaba minutos); el chat lleva un contexto corto (`contexto(..., { chat: true })`) y busca en Google solo si hace falta.
  - app.js: arranque, acciones, tutorial, actualizaciones solas.
  - vistas.js: pestañas. hojas.js: fichas de jugador y rival, Ajustes, diagnóstico.
  - limite.js: cuenta atrás, minutos por día y funciones bloqueadas. comunes.js: piezas compartidas (candados, calendario, rachas).
  - tour.js: tutorial. version.js: versión y novedades. soporte.js: llamadas al Worker. puente.js: puente con Android.
  - clave.js: la guía para sacar la clave de Gemini en AI Studio (pasos con esquemas, pegar y probar sola). Las claves nuevas de Google empiezan por «AQ.» y las de antes por «AIza»: valen las dos.
- `web/limites.json`: apertura (`abre`, `mensajeApertura`), `ligas`, `minutosLiga`, `minutos`, `equipos`, `sinLimite`, `bloqueadas`, `todoAbierto`. La cuenta atrás y los minutos son solo para las cuentas con alguna liga de `ligas` (por nombre o id; ahora «Maulazzos»); las demás, sin límite. Lo bloqueado (`bloqueadas`: dineroRivales, quienPaga, inercia, ventasRivales), para todos menos `todoAbierto`. `minutosLiga` (40 desde el 23 oct: 10 + 30 que pidió Carlos) es lo que leen las versiones desde la 0.5.0b; `minutos` está a 0 porque las anteriores tenían un fallo que congelaba la app al contar el tiempo: cuando nadie tenga una versión vieja, se puede volver a poner igual. `sinLimite` y `todoAbierto` van por id de cuenta (667015), no por nombre de equipo: un nombre lo puede copiar cualquiera. La app lo lee de raw de main y la web de Pages, con 6 h de caché (la guardada sin `ligas` se vuelve a leer).
- `android/`: WebView que sirve web/ desde el APK. AlDia.java baja la web nueva de Pages si la parte Android no ha cambiado (comparando huellas) y vuelve a la del APK si la nueva no arranca. Sabores `github` (la liga, sin anuncios) y `play` (Google Play). Solo `play` lleva AdMob (play-services-ads 25.5.0 y UMP 4.0.0, con Guava para compilar junto a WorkManager): `src/play/.../Anuncios.java` hace el consentimiento de la UE al abrir, el banner adaptativo bajo la web, con 12 dp de aire y otro color (su hueco se reserva en cuanto arranca AdMob para que las pestañas no salten; la web dice si se ve con `nativo.banner`: en todas las pestañas menos Pregunta y nunca en la carga, la entrada ni la pantalla del límite, `body.limitado` y el evento `limite-cambia`; con el teclado, sin hueco) y el bonificado (`nativo.verAnuncio('plan')` → `anuncioVisto`; si se cierra la ventana mientras carga, `nativo.cancelarAnuncio`; caduca a los 50 min); en `src/github` es un stub. Lo revisó un agente aparte el 24 oct (hueco fijo, pantallas sin salida, cancelar, pantalla recreada, ancho al girar, reintentos solo a la vista). «Pedir otro plan» a la IA: 3 al día gratis y luego con bonificado, solo en `play` (`pedirOtroPlan` en app.js; si no hay anuncio, va gratis). `fm.anunciosReales` en android/gradle.properties: false = bloques de prueba de Google (prueba cerrada); true = los de verdad, para producción. `play` no lleva el servicio en primer plano (Trabajo): Google pide justificarlo con un vídeo. La Action compila también el APK de `play` y lo deja con el AAB en el artefacto; los permisos de los dos APK, en permisos.txt de la rama android-registro. Lo de Play Console: play/ficha.md y play/prueba-cerrada.md.
- `worker/`: Cloudflare Worker con KV VINCULOS. Rutas /p (proxy a LaLiga), /img, /vincular (código para abrir en otro dispositivo), /fallos (avisos de fallo con respuesta), /hola (quién usa la app). ADMINS = 667015 (Carlos) en wrangler.toml.
- `.github/`: android.yml (compila en main y pendiente, publica APK y app.json solo desde main), web.yml (GitHub Pages), dominio.yml (Cloudflare Pages en https://fantasymanagerapp.com, proyecto fantasy-manager, también https://fantasy-manager-61v.pages.dev: siempre sube lo de main, al acabar «Web» y «App Android» en main; con app.json, el APK en /descargas/ y app-ads.txt), worker.yml. paquete.py genera paquete.json con las huellas. fallos.yml (a mano): lee y contesta los avisos de Fallo del KV.

## Los avisos de Fallo (revisarlos antes de cada versión)

- Llegan por el botón «Copiar para Claude» de la app (Fallo, solo Carlos), que los copia con su diagnóstico, o por captura. El artefacto de la Action no se puede bajar desde aquí (blob.core.windows.net bloqueado).
- Contestar uno: `gh workflow run fallos.yml -R charly10sf/fantasy-manager --ref main -f llave="$(node .github/fallos-leer.mjs llave)" -f respuestas='[{"buscar":"trozo del principio del aviso","por":"Claude · Fantasy Manager","respuesta":"…"}]'` (o `"id"` si se tiene). Solo los sin contestar; las respuestas se ven en la Action: nada personal. Se comprueba con las anotaciones del job (`gh api repos/charly10sf/fantasy-manager/check-runs/<job>/annotations`): «N contestados ahora».
- Contestar solo con lo ya publicado.
- La respuesta le llega a quien lo mandó en una notificación (Android): mientras tiene un aviso sin contestar (o el dueño, avisos pendientes), `programarFondo` pide una pasada en segundo plano cada 40 min, y si la liga se miró hace menos de 2,5 h y no ha cambiado el mercado, esa pasada solo mira los avisos (`avisosDeFallos`). La notificación abre la bandeja (`#fallos`). En la web, solo con ella abierta (cada 10 min).

## Publicar (solo con su OK)

1. Poner la hora en la entrada de version.js: `TZ=Europe/Madrid date +%H:%M`.
2. Commit con los trailers de Claude.
3. `git pull -q --rebase origin main && git push -q origin HEAD:main`.
4. Esperar las Actions «Web» y «App Android» (y «Worker» si cambia worker/).
5. `git pull` (la Action sube app.json), subir también a `pendiente` y comprobar https://charly10sf.github.io/fantasy-manager/paquete.json y, tras la Action «Dominio», https://fantasy-manager-61v.pages.dev/paquete.json (el mismo que fantasymanagerapp.com; WebFetch no lee el dominio por su robots).

Si cambia algo en android/app/src cambia la huella nativa y los móviles necesitan el APK nuevo. Si no, la web les llega sola.

## Probar

- Rendimiento: Playwright con `Emulation.setCPUThrottlingRate` (×4 o ×6) y el perfilador de CDP sobre `analizar`. Nada de crear formateadores de fecha (`toLocale…` con zona horaria, `new Intl.DateTimeFormat`) dentro de bucles: van creados una vez en util.js (`diaDe` guarda el día por hora).
- `python3 -m http.server 8765` dentro de web/ y Playwright con el Chromium que ya trae el entorno.
- Para salir de la demo en pruebas: interceptar app.js y cambiar `demo: enDemo() };` por `demo: false };`.
- `localStorage['fm-worker']` simula la web; el user agent, Android o iPhone.
