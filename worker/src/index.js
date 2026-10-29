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
 *   Los avisos de fallos (con la sesión de LaLiga en Authorization, para saber quién es; el token no se guarda):
 *   POST /fallos              manda un aviso: { texto, diag, app, equipo, liga, capturas: [data:image/…] (hasta 3) }
 *   GET  /fallos/mios         los avisos de quien llama, con su respuesta (y si es el dueño, admin: true)
 *   POST /fallos/visto        { id }: ha leído la respuesta
 *   GET  /fallos/todos        (el dueño) todos los avisos, resumidos
 *   GET  /fallos/uno?id=…     (el dueño) un aviso entero, con su diagnóstico
 *   POST /fallos/responder    (el dueño) { id, respuesta }
 *   GET  /fallos/captura?id=…&n=0  una captura de un aviso ({ img: data:image/… }): el dueño, o quien lo mandó
 *   El dueño es la cuenta de LaLiga cuyo número está en ADMINS (lo pone la Action desde el secreto FM_ADMINS).
 *
 *   POST /uso                 { seg }: suma esos segundos al tiempo de hoy de quien llama (hora de Madrid) y devuelve el
 *                             total, para que el límite diario de minutos cuente igual en la app y en la web.
 *
 *   Quién usa la app (para que el dueño vea quién de su liga la tiene y quién está dentro):
 *   POST /hola                { v, canal, app, liga, equipo }: la app avisa de que está abierta (al abrirla y cada 10
 *                             minutos a la vista). Se apunta como mucho cada 9 minutos por cuenta.
 *   GET  /hola/todos          (el dueño) cada cuenta con su nombre, equipo, versión, primera y última vez y sus minutos
 *                             de hoy. Se borra a los 90 días sin abrir la app.
 *
 * Las sesiones de los códigos se borran al usarse o a los 10 minutos. Los avisos se quedan 180 días.
 */

const PERMITIDOS = new Set([
  'fantasy-api.llt-services.com', 'api-fantasy.llt-services.com', 'assets-fantasy.llt-services.com', 'login.laliga.es',
  'www.futbolfantasy.com', 'futbolfantasy.com', 'understat.com', 'www.understat.com', 'api.sofascore.com', 'www.sofascore.com', 'news.google.com',
]);
// la web: su dominio (y su dirección de Cloudflare Pages) y, mientras dura la mudanza, la de GitHub Pages
const ORIGENES = [/^https:\/\/(www\.)?fantasymanagerapp\.com$/, /^https:\/\/([a-z0-9-]+\.)?fantasy-manager(-[a-z0-9]+)?\.pages\.dev$/, /^https:\/\/charly10sf\.github\.io$/, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^https:\/\/appassets\.androidplatform\.net$/];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const DURA = 600; // lo que dura un código, en segundos
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I, que se confunden

/** las cabeceras para el navegador; null si la página que llama no es la de Fantasy Manager */
function cors(origen) {
  if (origen && !ORIGENES.some((r) => r.test(origen))) return null;
  return {
    'Access-Control-Allow-Origin': origen || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-u, x-m, x-h',
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
// Si el almacén falla (por ejemplo, gastadas las escrituras gratis del día), el código va a la caché: así los de iPhone
// pueden seguir entrando (revisión del 29 oct; antes la petición daba error)
async function guardarVinculo(env, cod, valor) {
  if (env.VINCULOS) { try { return await env.VINCULOS.put(`v:${cod}`, valor, { expirationTtl: DURA }); } catch (e) { /* a la caché */ } }
  return caches.default.put(claveCache(cod), new Response(valor, { headers: { 'cache-control': `max-age=${DURA}` } }));
}
async function leerVinculo(env, cod) {
  if (env.VINCULOS) { try { const v = await env.VINCULOS.get(`v:${cod}`); if (v != null) return v; } catch (e) { /* a la caché */ } }
  const r = await caches.default.match(claveCache(cod));
  return r ? r.text() : null;
}
async function borrarVinculo(env, cod) {
  if (env.VINCULOS) { try { await env.VINCULOS.delete(`v:${cod}`); } catch (e) { /* nada */ } }
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

/* ---------- los avisos de fallos ---------- */
// Van en el mismo almacén KV que los códigos, con la clave f:<cuenta>:<id> (así se listan los de cada uno) y un
// resumen en los metadatos (para listarlos todos sin leerlos uno a uno). Si no hay almacén, no hay avisos.
const VIVE = 180 * 86400; // lo que se guarda un aviso, en segundos
const MAX_TEXTO = 4000, MAX_RESPUESTA = 2000, MAX_DIAG = 40000, AL_DIA = 15;
// las capturas van aparte, una por clave (fc:<id>:<n>), para que la lista de avisos no las tenga que leer
// (la app las manda ya reducidas, unos 150-300 KB cada una; solo se mira el principio: el plan gratis de Workers da
// 10 ms de CPU por petición y recorrer megas con una expresión regular se los come)
const MAX_CAPTURAS = 3, MAX_CAPTURA = 700000;
const esCaptura = (x) => typeof x === 'string' && x.length <= MAX_CAPTURA && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]/.test(x.slice(0, 40));
const adminsDe = (env) => String(env.ADMINS || '').split(/[\s,;]+/).filter(Boolean);

/** quién llama, comprobado con LaLiga ({ uid, nombre }); se recuerda 10 minutos por sesión */
// (también en la memoria del Worker: caches.default no guarda nada en *.workers.dev, y sin esto cada petición
// preguntaba a LaLiga quién es, uno o dos segundos más)
const QUIEN = new Map();
async function quienEs(req) {
  const tk = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (tk.length < 20) return null;
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tk)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const m = QUIEN.get(h);
  if (m && Date.now() - m.t < 10 * 60e3) return m.u;
  const u = await quienEsLaLiga(tk, h);
  if (u) { if (QUIEN.size > 2000) QUIEN.clear(); QUIEN.set(h, { t: Date.now(), u }); }
  return u;
}
async function quienEsLaLiga(tk, h) {
  const clave = new Request(`https://quien.fantasy-manager.invalid/${h}`);
  const g = await caches.default.match(clave);
  if (g) return g.json();
  let r;
  try {
    r = await fetch('https://fantasy-api.llt-services.com/api/v4/user/me?x-lang=es', { headers: { Authorization: `Bearer ${tk}`, 'x-app': '2', 'x-lang': 'es', Accept: 'application/json', 'user-agent': UA } });
  } catch (e) { return null; }
  if (!r.ok) return null;
  let j = null;
  try { j = await r.json(); } catch (e) { return null; }
  const d = j && j.data && typeof j.data === 'object' ? j.data : j || {};
  const uid = String(d.id ?? d.userId ?? d.managerId ?? '');
  if (!uid) return null;
  const u = { uid, nombre: String(d.managerName || d.displayName || d.username || d.name || '').slice(0, 60) };
  await caches.default.put(clave, new Response(JSON.stringify(u), { headers: { 'cache-control': 'max-age=600' } }));
  return u;
}
const corta = (x, n) => String(x == null ? '' : x).slice(0, n);
const resumen = (f) => ({ t: f.t, quien: corta(f.quien, 40), equipo: corta(f.equipo, 40), txt: corta(f.texto.replace(/\s+/g, ' '), 90), r: f.respondida || 0, v: f.vista ? 1 : 0, c: f.capturas || 0 });
async function guardarFallo(env, f) {
  await env.VINCULOS.put(`f:${f.uid}:${f.id}`, JSON.stringify(f), { expirationTtl: VIVE, metadata: resumen(f) });
}
async function listar(env, prefijo, max = 1000) {
  const out = [];
  let cursor;
  do {
    const l = await env.VINCULOS.list({ prefix: prefijo, cursor, limit: 1000 });
    out.push(...l.keys);
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor && out.length < max);
  return out;
}
/** un aviso por su id (de quien sea, para el dueño; de quien llama, para los demás) */
async function buscarFallo(env, u, id, admin) {
  if (!/^[a-z0-9]{6,40}$/.test(String(id || ''))) return null;
  if (!admin) { const v = await env.VINCULOS.get(`f:${u.uid}:${id}`); return v ? JSON.parse(v) : null; }
  const k = (await listar(env, 'f:')).find((x) => x.name.endsWith(`:${id}`));
  if (!k) return null;
  const v = await env.VINCULOS.get(k.name);
  return v ? JSON.parse(v) : null;
}
const sinDiag = ({ diag, uid, ...f }) => f;

async function fallos(req, env, c, ruta) {
  if (!env.VINCULOS) return json({ e: 'El servidor no tiene dónde guardar los avisos' }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga para mandar avisos', sesion: true }, 401, c);
  const admin = adminsDe(env).includes(u.uid);
  const cuerpo = req.method === 'POST' ? await req.json().catch(() => null) : null;

  if (ruta === '/fallos' && req.method === 'POST') {
    const texto = corta(cuerpo && cuerpo.texto, MAX_TEXTO).trim();
    if (!texto) return json({ e: 'Cuenta qué ha pasado' }, 400, c);
    const mios = await listar(env, `f:${u.uid}:`);
    const hoy = Date.now() - 86400e3;
    if (mios.filter((k) => k.metadata && k.metadata.t > hoy).length >= AL_DIA) return json({ e: `Como mucho ${AL_DIA} avisos al día` }, 429, c);
    const id = Date.now().toString(36) + [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(36)).join('').slice(0, 6);
    const caps = (Array.isArray(cuerpo.capturas) ? cuerpo.capturas : []).filter(esCaptura).slice(0, MAX_CAPTURAS);
    const f = {
      id, t: Date.now(), uid: u.uid, quien: u.nombre, equipo: corta(cuerpo.equipo, 60), liga: corta(cuerpo.liga, 60),
      texto, diag: corta(cuerpo.diag, MAX_DIAG), app: corta(cuerpo.app, 120), respuesta: null, respondida: null, vista: true,
      capturas: caps.length,
    };
    // primero las capturas: si el aviso se guarda, ya están
    for (let n = 0; n < caps.length; n++) await env.VINCULOS.put(`fc:${id}:${n}`, caps[n], { expirationTtl: VIVE });
    await guardarFallo(env, f);
    return json({ ok: true, id }, 200, c);
  }
  if (ruta === '/fallos/mios' && req.method === 'GET') {
    const ks = (await listar(env, `f:${u.uid}:`)).sort((a, b) => (b.metadata?.t || 0) - (a.metadata?.t || 0)).slice(0, 30);
    const lista = (await Promise.all(ks.map((k) => env.VINCULOS.get(k.name)))).filter(Boolean).map((v) => sinDiag(JSON.parse(v)));
    let pendientes = null;
    if (admin) pendientes = (await listar(env, 'f:')).filter((k) => k.metadata && !k.metadata.r).length;
    return json({ lista, admin, pendientes, yo: u.uid }, 200, c);
  }
  if (ruta === '/fallos/visto' && req.method === 'POST') {
    const f = await buscarFallo(env, u, cuerpo && cuerpo.id, false);
    if (!f) return json({ e: 'No existe' }, 404, c);
    if (!f.vista) { f.vista = true; await guardarFallo(env, f); }
    return json({ ok: true }, 200, c);
  }
  if (ruta === '/fallos/captura' && req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    const n = Number(q.get('n'));
    const f = await buscarFallo(env, u, q.get('id'), admin);
    if (!f || !Number.isInteger(n) || n < 0 || n >= (f.capturas || 0)) return json({ e: 'No existe' }, 404, c);
    const img = await env.VINCULOS.get(`fc:${f.id}:${n}`);
    if (!img) return json({ e: 'Esa captura ya no está' }, 404, c);
    return json({ img }, 200, c);
  }
  if (!admin) return json({ e: 'Solo para el dueño de la app' }, 403, c);
  if (ruta === '/fallos/todos' && req.method === 'GET') {
    const ks = (await listar(env, 'f:')).sort((a, b) => (b.metadata?.t || 0) - (a.metadata?.t || 0)).slice(0, 200);
    return json({ lista: ks.map((k) => ({ id: k.name.split(':').pop(), ...(k.metadata || {}) })) }, 200, c);
  }
  if (ruta === '/fallos/uno' && req.method === 'GET') {
    const f = await buscarFallo(env, u, new URL(req.url).searchParams.get('id'), true);
    if (!f) return json({ e: 'No existe' }, 404, c);
    const { uid, ...resto } = f;
    return json(resto, 200, c);
  }
  if (ruta === '/fallos/responder' && req.method === 'POST') {
    const respuesta = corta(cuerpo && cuerpo.respuesta, MAX_RESPUESTA).trim();
    if (!respuesta) return json({ e: 'Escribe la respuesta' }, 400, c);
    const f = await buscarFallo(env, u, cuerpo && cuerpo.id, true);
    if (!f) return json({ e: 'No existe' }, 404, c);
    f.respuesta = respuesta; f.respondida = Date.now(); f.vista = false; f.por = u.nombre;
    await guardarFallo(env, f);
    return json({ ok: true }, 200, c);
  }
  return json({ e: 'No existe' }, 404, c);
}

/* ---------- el tiempo de uso de hoy, por cuenta (para el límite diario de minutos) ---------- */
const hoyMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
async function uso(req, env, c) {
  if (!env.VINCULOS) return json({ e: 'Sin almacén' }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga', sesion: true }, 401, c);
  const cuerpo = await req.json().catch(() => ({}));
  const mas = Math.max(0, Math.min(120, Math.round(Number(cuerpo && cuerpo.seg) || 0)));
  const dia = hoyMadrid(), k = `u:${u.uid}:${dia}`;
  const antes = Number(await env.VINCULOS.get(k)) || 0;
  const seg = antes + mas;
  // (si el almacén no deja escribir, se sigue: el tiempo de uso no es para tanto)
  if (mas) { try { await env.VINCULOS.put(k, String(seg), { expirationTtl: 3 * 86400 }); } catch (e) { /* nada */ } }
  return json({ dia, seg }, 200, c);
}

/* ---------- quién usa la app ---------- */
const VIVE_HOLA = 90 * 86400;
async function hola(req, env, c, ruta) {
  if (!env.VINCULOS) return json({ e: 'Sin almacén' }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga', sesion: true }, 401, c);
  if (ruta === '/hola' && req.method === 'POST') {
    const b = await req.json().catch(() => ({})) || {};
    const k = `p:${u.uid}`;
    const ya = await env.VINCULOS.getWithMetadata(k);
    const m = ya && ya.metadata ? ya.metadata : null;
    const ahora = Date.now();
    const nuevo = {
      uid: u.uid, nombre: corta(u.nombre, 40), equipo: corta(b.equipo, 40), liga: corta(b.liga, 20), v: corta(b.v, 12),
      canal: corta(b.canal, 8), app: Math.max(0, Math.round(Number(b.app) || 0)),
      primera: (m && m.primera) || ahora, ultima: ahora, n: ((m && m.n) || 0) + 1,
    };
    // (Cloudflare deja unas mil escrituras al día gratis y las comparte con los códigos de entrar y los avisos: cada cuenta,
    // como mucho una por hora, salvo que cambie la versión o el equipo; alternar app y web ya no escribe cada vez, y si
    // el almacén no deja, se sigue sin más; revisión del 29 oct)
    const cambia = !m || m.v !== nuevo.v || m.equipo !== nuevo.equipo;
    if (!m || cambia || ahora - (m.ultima || 0) > 60 * 60e3) { try { await env.VINCULOS.put(k, '1', { expirationTtl: VIVE_HOLA, metadata: nuevo }); } catch (e) { /* nada */ } }
    return json({ ok: true }, 200, c);
  }
  if (!adminsDe(env).includes(u.uid)) return json({ e: 'Solo para el dueño de la app' }, 403, c);
  if (ruta === '/hola/todos' && req.method === 'GET') {
    const dia = hoyMadrid();
    const ks = (await listar(env, 'p:', 500)).filter((k) => k.metadata);
    const seg = await Promise.all(ks.slice(0, 100).map((k) => env.VINCULOS.get(`u:${k.metadata.uid}:${dia}`)));
    const lista = ks.map((k, i) => ({ ...k.metadata, segHoy: Number(seg[i]) || 0 })).sort((a, b) => b.ultima - a.ultima);
    return json({ lista, ahora: Date.now() }, 200, c);
  }
  return json({ e: 'No existe' }, 404, c);
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
      if (url.pathname === '/fallos' || url.pathname.startsWith('/fallos/')) return await fallos(req, env, c, url.pathname);
      if (url.pathname === '/uso' && req.method === 'POST') return await uso(req, env, c);
      if (url.pathname === '/hola' || url.pathname === '/hola/todos') return await hola(req, env, c, url.pathname);
      if (url.pathname === '/') return json({ ok: true, app: 'Fantasy Manager', kv: !!env.VINCULOS, avisos: !!env.VINCULOS, dueno: adminsDe(env).length > 0 }, 200, c);
      return json({ e: 'No existe' }, 404, c);
    } catch (e) {
      return json({ e: String((e && e.message) || e) }, 500, c);
    }
  },
};
