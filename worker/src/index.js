/*
 * El Worker de Fantasy Manager (Cloudflare).
 *
 * La versión web no puede hablar directamente con LaLiga, futbolfantasy, Understat, Sofascore ni Google Noticias:
 * el navegador corta las llamadas a otra web que no lo permite (CORS). En la app de Android eso lo hace la parte
 * nativa; en la web lo hace este Worker:
 *
 *   POST /p              la petición a uno de los sitios permitidos. Va en las cabeceras x-u (la dirección), x-m (el
 *                        método) y x-h (las cabeceras en JSON), y el cuerpo tal cual. Contesta siempre 200 con lo que
 *                        responde el sitio, su estado en x-s (0 si no ha contestado) y su tipo en x-t.
 *   GET  /img?u=…        una imagen de LaLiga, para poder mirar sus píxeles.
 *   POST /vincular       la app deja aquí su sesión y recibe un código de 8 letras que dura 10 minutos.
 *   POST /vincular/usar  la web cambia ese código (una sola vez) por la sesión.
 *
 * No guarda nada más: las sesiones de los códigos se borran al usarse o a los 10 minutos.
 */

const PERMITIDOS = new Set([
  'fantasy-api.llt-services.com', 'api-fantasy.llt-services.com', 'assets-fantasy.llt-services.com', 'login.laliga.es',
  'www.futbolfantasy.com', 'futbolfantasy.com', 'understat.com', 'www.understat.com', 'api.sofascore.com', 'www.sofascore.com', 'news.google.com',
]);
const ORIGENES = [/^https:\/\/charly10sf\.github\.io$/, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^https:\/\/appassets\.androidplatform\.net$/];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const DURA = 600; // lo que dura un código, en segundos
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I, que se confunden

/** las cabeceras para el navegador; null si la página que llama no es la de Fantasy Manager */
function cors(origen) {
  if (origen && !ORIGENES.some((r) => r.test(origen))) return null;
  return {
    'Access-Control-Allow-Origin': origen || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-u, x-m, x-h',
    'Access-Control-Expose-Headers': 'x-s, x-t',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (x, estado, c) => new Response(JSON.stringify(x), { status: estado, headers: { ...c, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const sinRespuesta = (m, c) => new Response(m, { status: 200, headers: { ...c, 'x-s': '0', 'x-t': '', 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

/** la dirección, si es https y de un sitio permitido */
function destinoDe(u) {
  let d;
  try { d = new URL(u || ''); } catch (e) { return null; }
  return d.protocol === 'https:' && PERMITIDOS.has(d.hostname) ? d : null;
}

async function pasar(req, c) {
  const d = destinoDe(req.headers.get('x-u'));
  if (!d) return sinRespuesta(`Sitio no permitido: ${req.headers.get('x-u') || '(nada)'}`, c);
  const m = (req.headers.get('x-m') || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(m)) return sinRespuesta(`Método no permitido: ${m}`, c);
  let h = {};
  try { h = JSON.parse(req.headers.get('x-h') || '{}') || {}; } catch (e) { h = {}; }
  const cab = new Headers();
  for (const [k, v] of Object.entries(h)) if (typeof v === 'string' && !/^(host|content-length|connection|cookie|accept-encoding)$/i.test(k)) cab.set(k, v);
  if (!cab.has('user-agent')) cab.set('user-agent', UA);
  const cuerpo = m === 'GET' ? undefined : await req.arrayBuffer();
  let r;
  try {
    r = await fetch(d.toString(), { method: m, headers: cab, body: cuerpo && cuerpo.byteLength ? cuerpo : undefined, redirect: 'follow' });
  } catch (e) {
    return sinRespuesta(String((e && e.message) || e || 'sin respuesta'), c);
  }
  // el cuerpo pasa tal cual, sin leerlo (las páginas de futbolfantasy pesan varios megas)
  return new Response(r.body, { status: 200, headers: { ...c, 'x-s': String(r.status), 'x-t': r.headers.get('content-type') || '', 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

async function imagen(url, c) {
  const d = destinoDe(url.searchParams.get('u'));
  if (!d) return new Response('Sitio no permitido', { status: 403, headers: c });
  const r = await fetch(d.toString(), { headers: { 'user-agent': UA }, cf: { cacheTtl: 86400, cacheEverything: true } });
  return new Response(r.body, { status: r.status, headers: { ...c, 'content-type': r.headers.get('content-type') || 'image/png', 'cache-control': 'public, max-age=86400' } });
}

/* ---------- los códigos para entrar en el ordenador ---------- */
// En el almacén KV si está (VINCULOS); si no, en la caché del Worker (vale si el móvil y el ordenador llegan al
// mismo centro de Cloudflare, que es lo normal estando en la misma ciudad).
const claveCache = (cod) => new Request(`https://vinculos.fantasy-manager.invalid/${cod}`);
async function guardarVinculo(env, cod, valor) {
  if (env.VINCULOS) return env.VINCULOS.put(`v:${cod}`, valor, { expirationTtl: DURA });
  return caches.default.put(claveCache(cod), new Response(valor, { headers: { 'cache-control': `max-age=${DURA}` } }));
}
async function leerVinculo(env, cod) {
  if (env.VINCULOS) return env.VINCULOS.get(`v:${cod}`);
  const r = await caches.default.match(claveCache(cod));
  return r ? r.text() : null;
}
async function borrarVinculo(env, cod) {
  if (env.VINCULOS) return env.VINCULOS.delete(`v:${cod}`);
  return caches.default.delete(claveCache(cod));
}
function nuevoCodigo() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => ALFABETO[x % ALFABETO.length]).join('');
}

async function vincular(req, env, c) {
  const txt = await req.text();
  if (txt.length > 60000) return json({ e: 'Demasiados datos' }, 413, c);
  let j;
  try { j = JSON.parse(txt); } catch (e) { return json({ e: 'No es JSON' }, 400, c); }
  if (!j || !j.sesion || !(j.sesion.renovar || j.sesion.token)) return json({ e: 'Falta la sesión de LaLiga' }, 400, c);
  const cod = nuevoCodigo();
  await guardarVinculo(env, cod, JSON.stringify({ ...j, t: Date.now() }));
  return json({ codigo: cod, caduca: Date.now() + DURA * 1000 }, 200, c);
}

async function usar(req, env, c) {
  let j;
  try { j = await req.json(); } catch (e) { return json({ e: 'No es JSON' }, 400, c); }
  const cod = String((j && j.codigo) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cod.length !== 8) return json({ e: 'El código tiene 8 letras y números' }, 400, c);
  const v = await leerVinculo(env, cod);
  if (!v) return json({ e: 'Ese código no existe o ha caducado (dura 10 minutos). Pide otro en la app.' }, 404, c);
  await borrarVinculo(env, cod);
  return json(JSON.parse(v), 200, c);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const c = cors(req.headers.get('Origin'));
    if (!c) return new Response('Origen no permitido', { status: 403 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
    try {
      if (url.pathname === '/p' && req.method === 'POST') return await pasar(req, c);
      if (url.pathname === '/img' && req.method === 'GET') return await imagen(url, c);
      if (url.pathname === '/vincular' && req.method === 'POST') return await vincular(req, env, c);
      if (url.pathname === '/vincular/usar' && req.method === 'POST') return await usar(req, env, c);
      if (url.pathname === '/') return json({ ok: true, app: 'Fantasy Manager', kv: !!env.VINCULOS }, 200, c);
      return json({ e: 'No existe' }, 404, c);
    } catch (e) {
      return json({ e: String((e && e.message) || e) }, 500, c);
    }
  },
};
