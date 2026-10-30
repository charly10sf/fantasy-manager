# El bloqueo de LaLiga a Cloudflare (24 oct 2026)

## Qué pasa

Con partidos de LaLiga, las operadoras españolas (por orden judicial a petición de LaLiga) cortan muchas IP de Cloudflare para frenar la piratería. Cae justo en fin de semana y por la tarde-noche: cuando más se usa Directo.

- fantasymanagerapp.com resolvía a 188.114.96.5 y 188.114.97.5 (Cloudflare). El 24 oct desde la red de Carlos: ERR_CONNECTION_TIMED_OUT hacia las 19:00 y las 20:40, con partidos. Desde fuera de España (Actions de GitHub) contestaba bien.
- El Worker (fantasy-manager.fantasymanager-web-app.workers.dev) también es Cloudflare: es probable que caiga a la vez. No se ha podido comprobar desde aquí.
- El correo (Email Routing, MX) no se ve afectado de la misma forma.

## A quién le afecta

- **App de Android**: casi nada. La web va dentro del APK y habla con LaLiga directamente. Lo que falla durante el bloqueo: AlDia no baja la web nueva (solo mira el dominio; reintenta después), y /hola, los avisos de Fallo y los códigos de /vincular (Worker). app.json y limites.json ya prueban GitHub si el dominio no contesta.
- **Web (iPhone, ordenador)**: mucho. Antes del 25 oct, durante los partidos no abría fantasymanagerapp.com, y en cualquier dirección los datos de LaLiga iban por el Worker (/p y /img), así que la web se quedaba sin datos.

## Hecho

**Punto 1 (25 oct, 2:15): el dominio, en GitHub Pages.** A @ → 185.199.108-111.153, www → charly10sf.github.io, DNS only; Enforce HTTPS. web.yml lleva app.json, el APK y los ads.txt. Cloudflare Pages queda de respaldo en fantasy-manager-61v.pages.dev.

**Punto 2 (30 oct, 13:57, versión 0.6.10d): un segundo intermediario fuera de Cloudflare.**

- Código: repo privado charly10sf/fantasy-manager-proxy, un solo archivo `main.ts` (Deno, sin dependencias). Hace lo mismo que /p e /img del Worker, con los mismos ORIGENES y PERMITIDOS (si se cambian en worker/src/index.js, cambiarlos también ahí). Solo atiende a la web de Fantasy Manager (cabecera Origin) y solo pasa a los sitios permitidos: no es un proxy abierto. No guarda nada.
- Alojamiento: Deno Deploy (console.deno.com), organización `fantasy-manager`, app enlazada a ese repo (sin preset, Dynamic, entrypoint `main.ts`; cada push a su `main` se publica solo). La montó Carlos con su cuenta de GitHub dando permiso solo a ese repo. Es solo para Fantasy Manager: nada de GrowFolio ahí. Gratis: 1 M de peticiones al mes en el plan gratis, y solo se usa cuando el Worker falla.
- Dirección: https://fantasy-manager-proxy-nzzmze4kphaa.fantasy-manager.deno.net (en `PROXY2_PUBLICO`, web/js/puente.js). Si se cambia el nombre de la app en Deno, cambia la dirección y hay que actualizar esa constante. Su raíz contesta `{"ok":true,"app":"Fantasy Manager","proxy":"deno"}`.
- Cómo lo usa la web (`porWorker` en puente.js): pide primero al Worker; si no se puede conectar con él, o a los 7 s no ha contestado y su raíz tampoco en 4 s (no es que LaLiga vaya lenta, es que no se llega al Worker), pide a Deno y vale la primera respuesta buena. El Worker queda por caído 10 minutos (se guarda: aguanta una recarga) y mientras todo va por Deno; luego se vuelve a probar el Worker. Las imágenes (/img) igual.
- Lo que no cambia: los avisos de Fallo, el código de /vincular, /hola, /uso y /caras siguen solo en el Worker, porque necesitan su almacén (KV). Con el bloqueo, esas cosas no irán, pero los datos de LaLiga sí.
- Privacidad: la política dice que, si el primero no contesta, los datos pasan por otro igual en Deno Deploy que tampoco guarda nada.
- Probado con servidores falsos en local: Worker lento pero vivo (se queda con el Worker), Worker cerrado (Deno al momento), Worker que no contesta nada, como un bloqueo (Deno a los 11 s y luego al instante) y los dos caídos (error normal). **Sin ver todavía que Deno llegue a LaLiga de verdad**: el entorno de Claude bloquea esas llamadas.

## Qué falta

- Verlo con un partido de verdad: en Ajustes de la web, el diagnóstico tiene la línea «Intermediario», que dice si los datos van por el Worker o por Deno (cuántas veces pasó a Deno, cuándo y por qué). Un aviso de Fallo mandado en ese momento la trae. Con un partido en juego y la web cargando con «Deno», funciona.
- Probar si por Deno también salen las noticias de la web (Google Noticias da 503 a todo lo que pasa por el Worker).
- No es seguro al 100 %: Deno no está en Cloudflare, que es lo que cortan, pero no se puede garantizar que nunca caiga en un bloqueo. Comprobar el bloqueo en directo: https://bandaancha.eu/bloqueos-futbol avisa de los rangos bloqueados.

## Opciones que se barajaron (lo decidió Carlos)

1. La web y el dominio, servidos por GitHub Pages (hecho): sus IP, 185.199.108-111.153, no las bloquean. Gratis mientras el repo sea público; con el repo privado, GitHub Pages pide GitHub Pro (unos 4 € al mes). charly10sf.github.io/fantasy-manager redirige solo al dominio.
2. Un segundo proxy fuera de Cloudflare para /p y /img (hecho, en Deno Deploy; la alternativa era Vercel).
3. Mientras no estuvo: a los de iPhone, la dirección de GitHub y que no usen «Llevarme».
