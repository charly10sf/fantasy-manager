/* Fantasy Manager: lo mínimo para que la web y el PWA del iPhone abran sin red (revisión total, M11).

   - La página (index.html o «/»): primero la red, con 4 s de margen; sin red o si no contesta, la guardada. Así una
     versión nueva llega en cuanto hay conexión (cache-first aquí obligaba a abrir una vez la vieja tras cada versión).
   - Los módulos, el CSS, las fuentes y las imágenes de la web: primero lo guardado. En producción cada módulo y el CSS
     llevan su huella en la dirección (?v=, paquete.py): una versión nueva pide direcciones nuevas y nunca se mezcla
     con la vieja. Lo que va sin huella se sirve guardado y se pone al día por detrás.
   - Los datos (la API de LaLiga, el Worker, paquete.json, limites.json, app.json…): siempre por la red, sin tocarlos.
   - Dentro de la app de Android no se registra (lo sirve AlDia desde el APK).
   Al guardar una dirección con huella nueva se borran las de huella vieja del mismo archivo: la caché no crece. */
const CACHE = 'fm-web-1';
const NUNCA = /\.(json|sig|apk|txt|xml)$/i;
const ESTATICO = /\.(js|css|woff2|png|svg|jpg|webp|ico)$/i;

self.addEventListener('install', (e) => {
  // lo justo para abrir sin red la primera vez; el resto se guarda según se usa
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'manifest.webmanifest'])).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('fm-web-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const conTiempo = (p, ms) => new Promise((ok, mal) => { const t = setTimeout(() => mal(new Error('lento')), ms); p.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); }); });

async function guardar(req, res) {
  if (!res || !res.ok || res.type !== 'basic') return;
  const c = await caches.open(CACHE);
  const u = new URL(req.url);
  if (u.searchParams.has('v')) {
    // la misma ruta con otra huella sobra
    for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) await c.delete(k); }
  }
  await c.put(req, res);
}

async function pagina(e) {
  const c = await caches.open(CACHE);
  // la página se guarda siempre como «./» (sin ?v= ni #): es la misma la abras como la abras
  const clave = new URL('./', self.registration.scope).href;
  try {
    const res = await conTiempo(fetch(e.request), 4000);
    if (res && res.ok) c.put(clave, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const g = (await c.match(clave)) || (await c.match(e.request, { ignoreSearch: true }));
    if (g) return g;
    throw err;
  }
}

async function estatico(e) {
  const req = e.request;
  const g = await caches.match(req);
  const conHuella = new URL(req.url).searchParams.has('v');
  if (g && conHuella) return g;
  const red = fetch(req).then((res) => { guardar(req, res.clone()).catch(() => {}); return res; });
  if (g) { e.waitUntil(red.catch(() => {})); return g; }
  return red;
}

// la página manda la lista de sus módulos (el mapa de importaciones): se guardan también los que aún no se han usado
// (tutorial, QR…), para que sin red se abran igual
self.addEventListener('message', (e) => {
  const urls = e.data && e.data.tipo === 'guardar' && Array.isArray(e.data.urls) ? e.data.urls : null;
  if (!urls) return;
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const x of urls.slice(0, 120)) {
      try {
        const u = new URL(x, self.registration.scope);
        if (u.origin !== self.location.origin || !ESTATICO.test(u.pathname) || (await c.match(u.href))) continue;
        const res = await fetch(u.href);
        await guardar(new Request(u.href), res);
      } catch (err) { /* sin red: ya se guardará al usarlo */ }
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // solo la app (la raíz o index.html); las páginas públicas (privacidad, guías…) van por la red como siempre. (Al
    // recargar, la petición viene con cache: 'reload': da igual, la red va primero y sin red sale la guardada)
    const rel = u.pathname.slice(new URL(self.registration.scope).pathname.length);
    if (rel === '' || rel === 'index.html') e.respondWith(pagina(e));
    return;
  }
  // recargarWeb pide la página y los módulos con cache: 'reload' para saltarse lo guardado: que vayan a la red
  if (req.cache === 'reload' || req.cache === 'no-store') return;
  if (NUNCA.test(u.pathname) || !ESTATICO.test(u.pathname)) return;
  if (u.pathname.endsWith('/sw.js')) return;
  e.respondWith(estatico(e));
});
