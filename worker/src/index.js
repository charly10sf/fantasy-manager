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
 *   POST /qr/dejar       { id, sesion, … }: la app ha escaneado el QR del ordenador y deja ahí su sesión (0.6.12).
 *   GET  /qr/esperar?id= el ordenador pregunta cada 2 s si ya está; la sesión se da una sola vez (204 mientras no).
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
 *                             total, para que el límite diario de minutos cuente igual en la app y en la web. Desde la
 *                             0.7t lo manda todo el mundo (con límite, cada minuto; sin límite, cada 5 minutos o al
 *                             salir), para que el dueño vea en «Quién usa la app» cuánto tiempo pasa cada uno al día.
 *
 *   Quién usa la app (para que el dueño vea quién de su liga la tiene y quién está dentro):
 *   POST /hola                { v, canal, app, liga, equipo }: la app avisa de que está abierta (al abrirla y cada 10
 *                             minutos a la vista). Se apunta como mucho cada 9 minutos por cuenta.
 *   GET  /hola/todos          (el dueño) cada cuenta con su nombre, equipo, versión, primera y última vez, sus segundos
 *                             de hoy (segHoy) y, de los que han entrado en los últimos 7 días, los de cada uno de esos
 *                             días (segDias: { 'AAAA-MM-DD': seg }, solo los días con algo). Se borra a los 90 días sin abrir la app. Además, `registro`: todas las cuentas
 *                             que han entrado alguna vez (r:<uid>, sin nombre ni equipo; se borra a los 400 días sin abrir la app), para contar
 *                             usuarios. /hola contesta { ok, admin } (admin: si quien llama es el dueño).
 *
 * Las sesiones de los códigos se borran al usarse o a los 10 minutos. Los avisos se quedan 180 días.
 */

const PERMITIDOS = new Set([
  'fantasy-api.llt-services.com', 'api-fantasy.llt-services.com', 'assets-fantasy.llt-services.com', 'login.laliga.es',
  'www.futbolfantasy.com', 'futbolfantasy.com', 'understat.com', 'www.understat.com', 'api.sofascore.com', 'www.sofascore.com', 'news.google.com',
]);
// la web: su dominio (y su dirección de Cloudflare Pages, con las vistas previas de las ramas web-…) y, mientras dura la
// mudanza, la de GitHub Pages. La de Pages va fijada al proyecto de Carlos: antes valía cualquier fantasy-manager-<algo>,
// que lo puede crear cualquiera (revisión total, A4). Ojo: Origin se pone a mano fuera del navegador; lo que de verdad
// frena es lo que deja pasar reglaDe() a cada sitio.
const ORIGENES = [/^https:\/\/(www\.)?fantasymanagerapp\.com$/, /^https:\/\/([a-z0-9-]+\.)?fantasy-manager-61v\.pages\.dev$/, /^https:\/\/charly10sf\.github\.io$/, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^https:\/\/appassets\.androidplatform\.net$/];
// qué se deja hacer en cada sitio (revisión total, A4; lo mismo en main.ts del intermediario de Deno):
//   login.laliga.es: solo POST al token (entrar y renovar la sesión, auth.js);
//   la API de LaLiga: solo GET a /api/ (y /stats/, las estadísticas de la jornada, api.js) con la sesión, salvo las dos
//     listas que pide sin sesión la liga de ejemplo (caras-demo.js);
//   el resto (futbolfantasy, Understat, SofaScore, Google Noticias, las imágenes): solo GET.
// Nunca con puerto ni usuario en la dirección.
const LOGIN_TOKEN = '/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token';
const API_LALIGA = new Set(['fantasy-api.llt-services.com', 'api-fantasy.llt-services.com']);
const LALIGA_SIN_SESION = new Set(['/api/v1/competition/1/players', '/api/v3/teams-master']);
const IMAGENES = 'assets-fantasy.llt-services.com';
/** null si se deja; si no, el motivo */
export function reglaDe(d, m, cab) {
  if (d.port || d.username || d.password) return 'Dirección no permitida (puerto o usuario)';
  const h = d.hostname;
  if (h === 'login.laliga.es') return m === 'POST' && d.pathname === LOGIN_TOKEN ? null : 'En login.laliga.es solo se pide la sesión';
  if (API_LALIGA.has(h)) {
    if (m !== 'GET') return `En ${h} solo se lee (GET)`;
    if (!/^\/(api|stats)\//.test(d.pathname)) return `En ${h} solo /api/`;
    const auth = (cab && cab.get('authorization')) || '';
    if (!/^Bearer\s+\S{20,}/i.test(auth) && !LALIGA_SIN_SESION.has(d.pathname)) return `En ${h}, con tu sesión`;
    return null;
  }
  return m === 'GET' ? null : `En ${h} solo se lee (GET)`;
}
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

/**
 * fetch que solo sigue las redirecciones a sitios permitidos (hasta 4) y que reglaDe() deja; una a otro sitio se
 * devuelve tal cual. `vale(url, metodo)`: si se deja seguir a esa dirección.
 */
async function traer(d, op, vale = () => true) {
  let u = d;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u.toString(), { ...op, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(r.status)) return r;
    let sig = null;
    try { sig = destinoDe(new URL(r.headers.get('location') || '', u).toString()); } catch (e) { sig = null; }
    // (un 303, o un 301/302 de un POST, sigue como GET y sin cuerpo, como haría el navegador)
    const op2 = r.status === 303 || ((r.status === 301 || r.status === 302) && op.method && op.method !== 'GET') ? { ...op, method: 'GET', body: undefined } : op;
    if (!sig || !vale(sig, (op2.method || 'GET').toUpperCase())) return r;
    u = sig;
    op = op2;
  }
  return new Response('Demasiadas redirecciones', { status: 508 });
}

async function pasar(req, c) {
  const d = destinoDe(req.headers.get('x-u'));
  if (!d) return sinRespuesta(`Sitio no permitido: ${req.headers.get('x-u') || '(nada)'}`, c);
  const m = (req.headers.get('x-m') || 'GET').toUpperCase();
  if (!['GET', 'POST'].includes(m)) return sinRespuesta(`Método no permitido: ${m}`, c);
  let h = {};
  try { h = JSON.parse(req.headers.get('x-h') || '{}') || {}; } catch (e) { h = {}; }
  const cab = new Headers();
  for (const [k, v] of Object.entries(h)) if (typeof v === 'string' && !/^(host|content-length|connection|cookie|accept-encoding)$/i.test(k)) cab.set(k, v);
  if (!cab.has('user-agent')) cab.set('user-agent', UA);
  const no = reglaDe(d, m, cab);
  if (no) return sinRespuesta(no, c);
  const cuerpo = m === 'GET' ? undefined : await req.arrayBuffer();
  let r;
  try {
    r = await traer(d, { method: m, headers: cab, body: cuerpo && cuerpo.byteLength ? cuerpo : undefined }, (u, m2) => !reglaDe(u, m2, cab));
  } catch (e) {
    return sinRespuesta(String((e && e.message) || e || 'sin respuesta'), c);
  }
  // el cuerpo pasa tal cual, sin leerlo (las páginas de futbolfantasy pesan varios megas)
  return new Response(r.body, { status: 200, headers: { ...c, 'x-s': String(r.status), 'x-t': r.headers.get('content-type') || '', 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

// /img: solo las imágenes de LaLiga (caras y escudos) y solo si de verdad es una imagen (antes servía cualquier cosa,
// también HTML, con caché pública de un día; revisión total, A4)
const esImagenLaLiga = (d) => d.hostname === IMAGENES && !d.port && !d.username && !d.password;
async function imagen(url, c) {
  const d = destinoDe(url.searchParams.get('u'));
  if (!d || !esImagenLaLiga(d)) return new Response('Sitio no permitido', { status: 403, headers: c });
  const r = await traer(d, { headers: { 'user-agent': UA }, cf: { cacheTtl: 86400, cacheEverything: true } }, esImagenLaLiga);
  const tipo = r.headers.get('content-type') || '';
  if (!r.ok || !/^image\//i.test(tipo)) {
    if (r.body) await r.body.cancel().catch(() => {});
    return new Response(r.ok ? 'No es una imagen' : `La imagen no está (${r.status})`, { status: r.ok ? 415 : r.status >= 300 && r.status < 400 ? 502 : r.status, headers: { ...c, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return new Response(r.body, { status: 200, headers: { ...c, 'content-type': tipo, 'cache-control': 'public, max-age=86400' } });
}

/* ---------- frenos: que nadie agote las escrituras gratis del KV (revisión total, C1) ---------- */
// El plan gratis de KV da unas mil escrituras al día para todo, y POST /vincular no pide sesión: unas mil peticiones
// anónimas lo cerraban para todos hasta el día siguiente. Dos niveles:
//   por minuto: el binding de Rate Limiting de Cloudflare (FRENO_ESCRIBIR y FRENO_LEER en wrangler.toml; entra en el
//     plan gratis, pero cuenta por centro de Cloudflare y es aproximado) y, además o si no está, un contador en la
//     memoria del Worker;
//   por día: en el Durable Object Emparejar (el del QR), que ve lo mismo desde todos los centros; sin él, en memoria.
// Por IP en /vincular, /qr y /fallos (en IPv6, por su /64: cada conexión de casa tiene millones), y por cuenta en
// /uso y /hola.
const MEM = new Map();
function contarMem(clave, max) {
  const n = (MEM.get(clave) || 0) + 1;
  if (MEM.size > 20000) MEM.clear();
  MEM.set(clave, n);
  return n <= max;
}
export function ipDe(req) {
  const ip = String(req.headers.get('cf-connecting-ip') || '').trim().toLowerCase();
  if (!ip.includes(':')) return ip || 'sin-ip';
  const [a, b = ''] = ip.split('::');
  const A = a ? a.split(':') : [], B = ip.includes('::') && b ? b.split(':') : [];
  const todo = ip.includes('::') ? [...A, ...Array(Math.max(0, 8 - A.length - B.length)).fill('0'), ...B] : A;
  return `${todo.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
/** cabe una más este minuto (freno: 'FRENO_ESCRIBIR' o 'FRENO_LEER') */
async function cabeAhora(env, freno, clave, max) {
  const b = env[freno];
  if (b && typeof b.limit === 'function') {
    try { const { success } = await b.limit({ key: clave }); if (!success) return false; } catch (e) { /* al de memoria */ }
  }
  return contarMem(`m|${Math.floor(Date.now() / 60e3)}|${clave}`, max);
}
/** cabe una más hoy (día de Madrid) */
async function cabeHoy(env, clave, max) {
  const dia = hoyMadrid();
  if (env.QR) {
    try {
      const r = await env.QR.get(env.QR.idFromName(`freno|${dia}|${clave}`)).fetch('https://freno/contar', { method: 'POST', body: String(max) });
      if (r.status === 200 || r.status === 429) return r.status === 200;
    } catch (e) { /* al de memoria */ }
  }
  return contarMem(`d|${dia}|${clave}`, max);
}
const demasiadas = (c, cuando = 'en un minuto') => json({ e: `Demasiadas peticiones seguidas. Vuelve a probar ${cuando}.` }, 429, c);
// lo que se deja: por IP y minuto, por IP y día, y entre todos al día
export const FRENOS = {
  vincular: { min: 6, dia: 20, todos: 300 }, usar: { min: 10 }, qrDejar: { min: 6, dia: 20 }, qrEsperar: { min: 45 },
  fallos: { min: 30 }, falloNuevo: { min: 5, dia: 10 }, uso: { min: 6 }, hola: { min: 6 },
};
async function frenoIP(req, env, c, nombre) {
  const f = FRENOS[nombre], ip = ipDe(req);
  if (!(await cabeAhora(env, f.min > 6 ? 'FRENO_LEER' : 'FRENO_ESCRIBIR', `${nombre}|${ip}`, f.min))) return demasiadas(c);
  if (f.dia && !(await cabeHoy(env, `${nombre}|${ip}`, f.dia))) return demasiadas(c, 'mañana');
  if (f.todos && !(await cabeHoy(env, `${nombre}|todos`, f.todos))) return json({ e: 'El servidor de la web ha llegado hoy a su tope de códigos. Usa el QR (Ajustes → Abrir en el ordenador) o vuelve a probar mañana.' }, 503, c);
  return null;
}
// cuando el KV no deja escribir (gastado el cupo del día), un 503 que se entienda en vez de un 500
const esKVLleno = (e) => /limit exceeded|too many|KV put\(\) limit/i.test(String((e && e.message) || e));
const KV_LLENO = 'El servidor de la web ha llegado hoy a su tope de guardar datos. Vuelve a probar mañana.';

/* ---------- los códigos para entrar en el ordenador ---------- */
// En el almacén KV (VINCULOS). Antes, sin almacén o si fallaba, iban a la caché del Worker, pero en *.workers.dev la
// caché no guarda nada: se entregaba un código que nunca funcionaba (revisión total, C1). Ahora, 503 claro.
class SinSitio extends Error {}
async function guardarVinculo(env, cod, valor) {
  if (!env.VINCULOS) throw new SinSitio('El servidor de la web no puede guardar el código ahora. Usa el QR (Ajustes → Abrir en el ordenador).');
  try { await env.VINCULOS.put(`v:${cod}`, valor, { expirationTtl: DURA }); } catch (e) {
    throw new SinSitio(esKVLleno(e) ? 'El servidor de la web ha llegado hoy a su tope de códigos. Usa el QR (Ajustes → Abrir en el ordenador) o vuelve a probar mañana.' : 'El servidor de la web no puede guardar el código ahora. Vuelve a probar en un rato o usa el QR.');
  }
}
async function leerVinculo(env, cod) {
  if (!env.VINCULOS) return null;
  try { return await env.VINCULOS.get(`v:${cod}`); } catch (e) { return null; }
}
async function borrarVinculo(env, cod) {
  if (env.VINCULOS) { try { await env.VINCULOS.delete(`v:${cod}`); } catch (e) { /* nada: caduca solo a los 10 min */ } }
}
// el formato de antes de la 0.7a (la sesión sin cerrar): se quita cuando nadie use la app por debajo de la 0.7a
// (FORMATO_VIEJO = "no" en wrangler.toml; revisión total, C6)
const formatoViejo = (env) => String(env.FORMATO_VIEJO || 'si') !== 'no';
/** lo que manda la app ya cerrado (web/js/sobre.js): «v1.<iv>.<cifrado>» en base64url */
const idCerrado = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{43}$/.test(x);
const cifValido = (x) => typeof x === 'string' && x.length <= 60000 && /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{20,}$/.test(x);
function nuevoCodigo() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => ALFABETO[x % ALFABETO.length]).join('');
}

async function vincular(req, env, c) {
  const txt = await req.text();
  if (txt.length > 60000) return json({ e: 'Demasiados datos' }, 413, c);
  let j;
  try { j = JSON.parse(txt); } catch (e) { return json({ e: 'No es JSON' }, 400, c); }
  // (desde la 0.7a: la app manda lo suyo cerrado y un id que sale de un código que pone ella y que el servidor no ve:
  // del id no se saca la clave; web/js/sobre.js)
  try {
    if (j && typeof j.cif === 'string') {
      if (!cifValido(j.cif) || !idCerrado(j.id)) return json({ e: 'Lo cerrado no vale' }, 400, c);
      if (await leerVinculo(env, j.id)) return json({ e: 'Ese código ya está cogido', otro: true }, 409, c);
      await guardarVinculo(env, j.id, JSON.stringify({ cif: j.cif, t: Date.now() }));
      return json({ ok: true, caduca: Date.now() + DURA * 1000 }, 200, c);
    }
    if (!formatoViejo(env)) return json({ e: 'Esta versión de la app ya no puede abrir la sesión en otro dispositivo. Actualiza la app.' }, 400, c);
    if (!j || !j.sesion || !(j.sesion.renovar || j.sesion.token)) return json({ e: 'Falta la sesión de LaLiga' }, 400, c);
    const cod = nuevoCodigo();
    await guardarVinculo(env, cod, JSON.stringify({ ...j, t: Date.now() }));
    return json({ codigo: cod, caduca: Date.now() + DURA * 1000 }, 200, c);
  } catch (e) {
    if (e instanceof SinSitio) return json({ e: e.message, lleno: true }, 503, c);
    throw e;
  }
}

async function usar(req, env, c) {
  let j;
  try { j = await req.json(); } catch (e) { return json({ e: 'No es JSON' }, 400, c); }
  // lo cerrado (0.7a) se pide por su id; lo de antes, por el código
  const cod = j && idCerrado(j.id) ? j.id : String((j && j.codigo) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cod.length !== 8 && cod.length !== 43) return json({ e: 'El código tiene 8 letras y números' }, 400, c);
  const v = await leerVinculo(env, cod);
  if (!v) return json({ e: 'Ese código no existe o ha caducado (dura 10 minutos). Pide otro en la app.' }, 404, c);
  await borrarVinculo(env, cod);
  return json(JSON.parse(v), 200, c);
}

/* ---------- el QR para entrar en el ordenador (0.6.12) ---------- */
// El ordenador enseña un QR con un id al azar (128 bits) y pregunta cada 2 s; la app lo escanea y deja su sesión con
// ese id. Va en un Durable Object (uno por id), que ve al momento lo que se acaba de guardar: en el KV, el ordenador
// podía tardar hasta un minuto en verlo si el móvil y él llegan a centros de Cloudflare distintos, porque el KV guarda
// también los «no está». Sin el objeto (si Cloudflare no dejó crearlo al publicar), va por el KV.
const idQR = (x) => (typeof x === 'string' && /^[A-Za-z0-9_-]{22,64}$/.test(x) ? x : null);

export class Emparejar {
  constructor(estado) { this.estado = estado; }
  async fetch(req) {
    const st = this.estado.storage;
    // los frenos por día (cabeHoy): un objeto por clave y día, que se borra solo a las 30 h
    if (new URL(req.url).pathname === '/contar') {
      const max = Number(await req.text()) || 0;
      const n = (Number(await st.get('n')) || 0) + 1;
      if (n > max) return new Response(String(n - 1), { status: 429 });
      await st.put('n', n);
      if (n === 1) await st.setAlarm(Date.now() + 30 * 3600e3);
      return new Response(String(n), { status: 200 });
    }
    if (req.method === 'PUT') {
      if (await st.get('d')) return new Response('ya', { status: 409 });
      await st.put({ d: await req.text(), t: Date.now() });
      await st.setAlarm(Date.now() + DURA * 1000);
      return new Response('ok');
    }
    const t = await st.get('t');
    if (!t) return new Response(null, { status: 204 });
    const d = await st.get('d');
    await st.deleteAll();
    if (Date.now() - t > DURA * 1000) return new Response(null, { status: 204 });
    return new Response(d, { status: 200 });
  }
  async alarm() { await this.estado.storage.deleteAll(); }
}

async function qrDejar(req, env, c) {
  const txt = await req.text();
  if (txt.length > 60000) return json({ e: 'Demasiados datos' }, 413, c);
  let j;
  try { j = JSON.parse(txt); } catch (e) { return json({ e: 'No es JSON' }, 400, c); }
  const id = idQR(j && j.id);
  if (!id) return json({ e: 'Ese QR no es de Fantasy Manager' }, 400, c);
  const cerrado = typeof j.cif === 'string';
  if (cerrado && !cifValido(j.cif)) return json({ e: 'Lo cerrado no vale' }, 400, c);
  if (!cerrado && !formatoViejo(env)) return json({ e: 'Esta versión de la app ya no puede abrir la sesión en el ordenador. Actualiza la app.' }, 400, c);
  if (!cerrado && (!j.sesion || !(j.sesion.renovar || j.sesion.token))) return json({ e: 'Falta la sesión de LaLiga' }, 400, c);
  const { id: _, ...datos } = cerrado ? { id, cif: j.cif } : j;
  const valor = JSON.stringify({ ...datos, t: Date.now() });
  if (env.QR) {
    const r = await env.QR.get(env.QR.idFromName(id)).fetch('https://qr/', { method: 'PUT', body: valor });
    if (r.status === 409) return json({ e: 'Ese QR ya se ha usado. Pide otro en el ordenador.' }, 409, c);
    return json({ ok: true }, 200, c);
  }
  if (!env.VINCULOS) return json({ e: 'El servidor de la web no puede guardar el QR ahora. Usa el código de 8 letras.' }, 503, c);
  try { await env.VINCULOS.put(`q:${id}`, valor, { expirationTtl: DURA }); } catch (e) {
    return json({ e: esKVLleno(e) ? KV_LLENO : 'El servidor de la web no puede guardar el QR ahora. Vuelve a probar en un rato.', lleno: true }, 503, c);
  }
  return json({ ok: true }, 200, c);
}

async function qrEsperar(url, env, c) {
  const id = idQR(url.searchParams.get('id'));
  if (!id) return json({ e: 'Falta el QR' }, 400, c);
  let v = null;
  if (env.QR) {
    const r = await env.QR.get(env.QR.idFromName(id)).fetch('https://qr/');
    if (r.status === 200) v = await r.text();
  } else if (env.VINCULOS) {
    v = await env.VINCULOS.get(`q:${id}`);
    if (v) await env.VINCULOS.delete(`q:${id}`);
  }
  if (!v) return new Response(null, { status: 204, headers: { ...c, 'cache-control': 'no-store' } });
  return new Response(v, { status: 200, headers: { ...c, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

/* ---------- los avisos de fallos ---------- */
// Van en el mismo almacén KV que los códigos, con la clave f:<cuenta>:<id> (así se listan los de cada uno) y un
// resumen en los metadatos (para listarlos todos sin leerlos uno a uno). Si no hay almacén, no hay avisos.
const VIVE = 180 * 86400; // lo que se guarda un aviso, en segundos
// (5 avisos al día por cuenta y capturas de hasta 350 KB: antes, 15 y 700 KB, y una cuenta podía meter 32 MB al día durante
// 180 días, el GB del plan gratis en un mes; revisión total, C1)
export const MAX_TEXTO = 4000, MAX_RESPUESTA = 2000, MAX_DIAG = 40000, AL_DIA = 5;
// las capturas van aparte, una por clave (fc:<id>:<n>), para que la lista de avisos no las tenga que leer
// (la app las manda ya reducidas, por debajo de 340 KB desde la 0.7z (fotos.js); solo se mira el principio: el plan
// gratis de Workers da 10 ms de CPU por petición y recorrer megas con una expresión regular se los come)
export const MAX_CAPTURAS = 3, MAX_CAPTURA = 350000;
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
  // la foto del perfil: LaLiga solo se la da a cada uno (a los demás, la genérica); se guarda con /hola y la ven los de su
  // liga que usan la app (/caras, 0.6.9a)
  const av = String(d.avatar || d.profileImage || '');
  const foto = /^https:\/\/[^\s"'<>]{8,380}$/.test(av) && !/default\.(png|jpe?g|svg|webp)(\?|$)/i.test(av) ? av : '';
  const u = { uid, nombre: String(d.managerName || d.displayName || d.username || d.name || '').slice(0, 60), foto };
  await caches.default.put(clave, new Response(JSON.stringify(u), { headers: { 'cache-control': 'max-age=600' } }));
  return u;
}
/** los ids de los mánagers de una liga, pedidos a LaLiga con la sesión de quien llama (null si no es suya); 30 min */
const MIEMBROS = new Map();
async function miembros(req, liga) {
  const tk = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const k = `${tk.slice(-24)}|${liga}`;
  const g = MIEMBROS.get(k);
  if (g && Date.now() - g.t < 30 * 60e3) return g.ids;
  let r;
  try {
    r = await fetch(`https://fantasy-api.llt-services.com/api/v1/competition/1/leagues/${liga}/standing?x-lang=es`, { headers: { Authorization: `Bearer ${tk}`, 'x-app': '2', 'x-lang': 'es', Accept: 'application/json', 'user-agent': UA } });
  } catch (e) { return null; }
  if (!r.ok) return null;
  let j = null;
  try { j = await r.json(); } catch (e) { return null; }
  const l = Array.isArray(j) ? j : (j && (Array.isArray(j.data) ? j.data : Array.isArray(j.elements) ? j.elements : null)) || [];
  const ids = [...new Set(l.map((e) => { const t = (e && e.team) || {}; const m = t.manager || (e && e.manager) || {}; return String(m.id ?? t.managerId ?? (e && e.managerId) ?? ''); }).filter((x) => /^\d+$/.test(x)))];
  if (!ids.length) return null;
  if (MIEMBROS.size > 2000) MIEMBROS.clear();
  MIEMBROS.set(k, { t: Date.now(), ids });
  return ids;
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
export const MAX_USO = 600, VIVE_USO = 9 * 86400;
/** los n días hasta hoy (hoy el primero), en AAAA-MM-DD, contados desde el día de Madrid (sin líos con el cambio de hora) */
export function diasAtras(hoy, n) {
  const t = new Date(`${hoy}T12:00:00Z`), out = [];
  for (let i = 0; i < n; i++) { out.push(t.toISOString().slice(0, 10)); t.setUTCDate(t.getUTCDate() - 1); }
  return out;
}
// Como mucho una escritura cada 4 minutos por cuenta y día (revisión total, C1: antes escribía en cada llamada, y los
// que tienen límite la mandan cada minuto). Lo que llega entre medias se suma en la memoria del Worker y entra en la
// siguiente escritura; si esa llamada cae en otro Worker, se pierde ese rato, que no es para tanto.
export const USO_CADA = 240;
const PEND_USO = new Map();
async function uso(req, env, c) {
  if (!env.VINCULOS) return json({ e: 'Sin almacén' }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga', sesion: true }, 401, c);
  if (!(await cabeAhora(env, 'FRENO_ESCRIBIR', `uso|${u.uid}`, FRENOS.uso.min))) return demasiadas(c);
  const cuerpo = await req.json().catch(() => ({}));
  // (hasta 10 minutos de golpe: los que no tienen límite mandan lo de 5 minutos, o lo que quedó al salir)
  const mas = Math.max(0, Math.min(MAX_USO, Math.round(Number(cuerpo && cuerpo.seg) || 0)));
  const dia = hoyMadrid(), k = `u:${u.uid}:${dia}`;
  const ya = await env.VINCULOS.getWithMetadata(k);
  const antes = Number(ya && ya.value) || 0, ultima = Number(ya && ya.metadata && ya.metadata.t) || 0;
  const pend = (PEND_USO.get(k) || 0) + mas;
  // un día tiene 86 400 segundos: más de eso es que alguien manda de más
  const seg = Math.min(86400, antes + pend);
  if (PEND_USO.size > 5000) PEND_USO.clear();
  // se guarda 9 días: el dueño ve hoy, ayer y la media de los 7 últimos
  if (pend && Date.now() - ultima >= USO_CADA * 1000) {
    // (si el almacén no deja escribir, se sigue: el tiempo de uso no es para tanto)
    try { await env.VINCULOS.put(k, String(seg), { expirationTtl: VIVE_USO, metadata: { t: Date.now() } }); PEND_USO.delete(k); } catch (e) { PEND_USO.set(k, pend); }
  } else if (pend) PEND_USO.set(k, pend);
  return json({ dia, seg }, 200, c);
}

/* ---------- borrar mis datos (fase 0 del roadmap: Play y el RGPD) ---------- */
/**
 * borra todo lo que el servidor guarda de quien llama: su ficha de /hola (p:), su registro (r:), sus minutos de uso
 * (u:) y sus avisos de fallo (f:) con sus capturas (fc:). Lo de pasar la sesión al ordenador (v:, q:) ya se borra
 * solo a los 10 minutos. Si sigue usando la app, se vuelve a apuntar que la usa (eso lo explica la app).
 */
const BORRADOS = new Map();
async function borrarMios(req, env, c) {
  if (!env.VINCULOS) return json({ e: 'Sin almacén' }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga para saber qué datos son tuyos', sesion: true }, 401, c);
  // como mucho una vez por minuto por cuenta: listar y borrar gastan del cupo gratis de todos
  const ya = BORRADOS.get(u.uid);
  if (ya && Date.now() - ya < 60e3) return json({ e: 'Ya está borrado. Si quieres repetirlo, espera un minuto.' }, 429, c);
  if (BORRADOS.size > 2000) BORRADOS.clear();
  BORRADOS.set(u.uid, Date.now());
  const claves = [`p:${u.uid}`, `r:${u.uid}`];
  for (const k of await listar(env, `u:${u.uid}:`)) claves.push(k.name);
  let avisos = 0;
  for (const k of await listar(env, `f:${u.uid}:`)) {
    avisos++;
    claves.push(k.name);
    const id = k.name.slice(`f:${u.uid}:`.length);
    const nc = k.metadata && Number.isFinite(k.metadata.c) ? Math.min(MAX_CAPTURAS, k.metadata.c) : MAX_CAPTURAS;
    for (let n = 0; n < nc; n++) claves.push(`fc:${id}:${n}`);
  }
  let fallidas = 0;
  for (const k of claves) { try { await env.VINCULOS.delete(k); } catch (e) { fallidas++; } }
  if (fallidas) return json({ e: `No se han podido borrar ${fallidas} de ${claves.length} cosas. Vuelve a probar en un rato.` }, 503, c);
  return json({ ok: true, avisos, claves: claves.length }, 200, c);
}

/* ---------- quién usa la app ---------- */
const VIVE_HOLA = 90 * 86400, VIVE_REGISTRO = 400 * 86400;
// cambios de versión, equipo o foto que se apuntan al momento, por cuenta y día (el resto espera a la escritura de cada hora)
export const CAMBIOS_DIA = 3;
const CANALES = new Set(['github', 'play', 'web']);
/**
 * la ficha de cada cuenta que ha entrado alguna vez (r:<uid>), para contar usuarios: se borra a los 400 días sin abrir la
 * app (cada escritura vuelve a contar los 400 días; antes no caducaba nunca: revisión total, M1) y no lleva nombre ni
 * equipo, solo { uid, primera, ultima, canales: 'github,web', dias: días distintos con la app abierta }. Se escribe
 * como mucho una vez al día por cuenta (o si entra desde un sitio nuevo): las escrituras gratis de KV son unas mil al día.
 */
/* lo que hace cada cuenta (web/js/eventos.js): cuántas veces por día; aquí se suma por semanas (la clave es el lunes)
   y en total. Solo números: ni qué jugador ni qué liga. */
const EVENTOS = new Set(['p', 'q', 'b', 't', 'l', 'e', 'v', 'c', 'n', 'i', 'a', 'A', 'f', 'F']);
function limpiarEventos(ev) {
  const out = {};
  if (!ev || typeof ev !== 'object') return out;
  for (const [d, cs] of Object.entries(ev).slice(0, 15)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !cs || typeof cs !== 'object') continue;
    for (const [k, n] of Object.entries(cs)) {
      const v = Math.round(Number(n));
      if (EVENTOS.has(k) && v > 0 && v <= 500) (out[d] || (out[d] = {}))[k] = v;
    }
  }
  return out;
}
const lunesDe = (d) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
function sumarEventos(r, ev) {
  const sem = { ...((r && r.ev) || {}) }, tot = { ...((r && r.tot) || {}) };
  for (const [d, cs] of Object.entries(ev)) {
    const l = lunesDe(d), x = { ...(sem[l] || {}) };
    for (const [k, n] of Object.entries(cs)) { x[k] = (x[k] || 0) + n; tot[k] = (tot[k] || 0) + n; }
    sem[l] = x;
  }
  // las 6 semanas últimas (los metadatos del almacén no pasan de 1 KB)
  const quedan = Object.keys(sem).sort().slice(-6);
  return { ev: Object.fromEntries(quedan.map((l) => [l, sem[l]])), tot };
}
/** devuelve true si ha sumado los eventos que traía (si no, la app los vuelve a mandar en el siguiente saludo) */
async function registrar(env, uid, canal, primera, ahora, evIn = null) {
  try {
    const k = `r:${uid}`, dia = hoyMadrid();
    const ya = await env.VINCULOS.getWithMetadata(k);
    const r = ya && ya.metadata ? ya.metadata : null;
    const cs = new Set(String((r && r.canales) || '').split(',').filter(Boolean));
    const nuevoCanal = CANALES.has(canal) && !cs.has(canal);
    const ev = limpiarEventos(evIn);
    const hayEv = Object.keys(ev).length > 0;
    // una vez al día, o con eventos si hace 12 horas o más de la última (como mucho dos escrituras al día por cuenta)
    if (r && r.dia === dia && !nuevoCanal && !(hayEv && ahora - (r.ultima || 0) >= 12 * 3600e3)) return false;
    if (CANALES.has(canal)) cs.add(canal);
    const ficha = { uid, primera: Math.min((r && r.primera) || primera, primera), ultima: ahora, dia, canales: [...cs].join(','), dias: ((r && r.dias) || 0) + (r && r.dia === dia ? 0 : 1) };
    const s = sumarEventos(r, ev);
    if (Object.keys(s.tot).length) { ficha.ev = s.ev; ficha.tot = s.tot; }
    while (JSON.stringify(ficha).length > 1000 && ficha.ev && Object.keys(ficha.ev).length > 1) delete ficha.ev[Object.keys(ficha.ev).sort()[0]];
    await env.VINCULOS.put(k, '1', { metadata: ficha, expirationTtl: VIVE_REGISTRO });
    return hayEv;
  } catch (e) { return false; /* nada: si el almacén no deja, se sigue */ }
}
async function hola(req, env, c, ruta) {
  if (!env.VINCULOS) return json({ e: 'Sin almacén' }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga', sesion: true }, 401, c);
  if (ruta === '/hola' && req.method === 'POST') {
    if (!(await cabeAhora(env, 'FRENO_ESCRIBIR', `hola|${u.uid}`, FRENOS.hola.min))) return demasiadas(c);
    const b = await req.json().catch(() => ({})) || {};
    const k = `p:${u.uid}`;
    const ya = await env.VINCULOS.getWithMetadata(k);
    const m = ya && ya.metadata ? ya.metadata : null;
    const ahora = Date.now();
    const nuevo = {
      uid: u.uid, nombre: corta(u.nombre, 40), equipo: corta(b.equipo, 40), liga: corta(b.liga, 20), v: corta(b.v, 12),
      canal: corta(b.canal, 8), app: Math.max(0, Math.round(Number(b.app) || 0)),
      primera: (m && m.primera) || ahora, ultima: ahora, n: ((m && m.n) || 0) + 1,
      foto: u.foto || '',
    };
    // (Cloudflare deja unas mil escrituras al día gratis y las comparte con los códigos de entrar y los avisos: cada cuenta,
    // como mucho una por hora, salvo que cambie la versión o el equipo; alternar app y web ya no escribe cada vez, y si
    // el almacén no deja, se sigue sin más; revisión del 29 oct)
    // (y los cambios, como mucho CAMBIOS_DIA al día por cuenta: antes, alternar la versión escribía cada vez; revisión
    // total, C1. Con más, el cambio entra en la escritura de cada hora)
    const cambia = !!m && (m.v !== nuevo.v || m.equipo !== nuevo.equipo || (m.foto || '') !== nuevo.foto);
    const dia = hoyMadrid(), cambiosHoy = m && m.dc === dia ? Number(m.nc) || 0 : 0;
    const cabeCambio = cambia && cambiosHoy < CAMBIOS_DIA;
    if (cambiosHoy || cabeCambio) { nuevo.dc = dia; nuevo.nc = cambiosHoy + (cabeCambio ? 1 : 0); }
    if (!m || cabeCambio || ahora - (m.ultima || 0) > 60 * 60e3) { try { await env.VINCULOS.put(k, '1', { expirationTtl: VIVE_HOLA, metadata: nuevo }); } catch (e) { /* nada */ } }
    const evOk = await registrar(env, u.uid, nuevo.canal, (m && m.primera) || ahora, ahora, b.ev);
    // (admin: para que la web enseñe al dueño «Quién usa la app» sin haber abierto antes los avisos de fallo)
    return json({ ok: true, admin: adminsDe(env).includes(u.uid), ev: evOk }, 200, c);
  }
  // las fotos de los de tu liga que usan la app: que la liga es tuya lo dice LaLiga (su clasificación, pedida con tu
  // sesión), y de ahí salen también quiénes están; de cada uno, la foto que guardó /hola. Nada de lo que mande la app
  if (ruta === '/caras' && req.method === 'GET') {
    const liga = new URL(req.url).searchParams.get('liga') || '';
    if (!/^\d{1,20}$/.test(liga)) return json({ e: 'Liga no válida' }, 400, c);
    const ids = await miembros(req, liga);
    // (LaLiga da la clasificación de cualquier liga a quien la pida: que quien llama esté en ella lo mira el Worker;
    // revisión total, C6)
    if (!ids || !ids.includes(String(u.uid))) return json({ e: 'Esa liga no es tuya' }, 403, c);
    const caras = {};
    await Promise.all(ids.slice(0, 40).map(async (id) => {
      try { const x = await env.VINCULOS.getWithMetadata(`p:${id}`); const f = x && x.metadata && x.metadata.foto; if (f) caras[id] = f; } catch (e) { /* nada */ }
    }));
    return json({ caras }, 200, c);
  }
  if (!adminsDe(env).includes(u.uid)) return json({ e: 'Solo para el dueño de la app' }, 403, c);
  if (ruta === '/hola/todos' && req.method === 'GET') {
    const dia = hoyMadrid();
    const ks = (await listar(env, 'p:', 500)).filter((k) => k.metadata);
    ks.sort((a, b) => (b.metadata.ultima || 0) - (a.metadata.ultima || 0));
    // hoy, de los 100 últimos; los 6 días de antes, solo de los 40 últimos que han entrado esta semana (cada lectura
    // cuenta para el tope de operaciones por petición del plan gratis, que es de mil)
    const dias = diasAtras(dia, 7), hace7 = Date.now() - 7 * 86400e3;
    const segDe = (uid, d) => env.VINCULOS.get(`u:${uid}:${d}`).then((v) => Math.min(86400, (Number(v) || 0) + (PEND_USO.get(`u:${uid}:${d}`) || 0))).catch(() => 0);
    const usos = await Promise.all(ks.map(async (k, i) => {
      if (i >= 100) return {};
      const semana = i < 40 && (k.metadata.ultima || 0) >= hace7;
      const vals = await Promise.all((semana ? dias : [dia]).map((d) => segDe(k.metadata.uid, d)));
      const o = {};
      (semana ? dias : [dia]).forEach((d, j) => { if (vals[j]) o[d] = vals[j]; });
      return o;
    }));
    const lista = ks.map((k, i) => ({ ...k.metadata, segHoy: usos[i][dia] || 0, segDias: usos[i] }));
    // todas las cuentas que han entrado alguna vez: la ficha de r:, y quien aún no la tiene (no ha abierto la app desde
    // que existe), con lo de p:
    const reg = new Map((await listar(env, 'r:', 5000)).filter((k) => k.metadata).map((k) => [String(k.metadata.uid), k.metadata]));
    for (const x of lista) {
      const r = reg.get(String(x.uid));
      if (!r) reg.set(String(x.uid), { uid: x.uid, primera: x.primera, ultima: x.ultima, canales: x.canal || '', dias: 0 });
      else if ((x.ultima || 0) > (r.ultima || 0)) reg.set(String(x.uid), { ...r, ultima: x.ultima });
    }
    return json({ lista, registro: [...reg.values()], ahora: Date.now(), dias }, 200, c);
  }
  return json({ e: 'No existe' }, 404, c);
}

// El reloj del bot de X: el cron de GitHub Actions no dispara (2 nov, 0 ejecuciones por schedule), así que este Worker,
// con su cron de wrangler.toml, lanza «Bot X» en main cada 5 min con la API de GitHub. Token de grano fino solo para
// este repo con Actions: lectura y escritura, en el secreto BOT_DISPATCH_TOKEN (lo pone worker.yml). Sin él, no hace nada.
// Si ya hay una ejecución en marcha, la nueva espera (concurrency bot-x en bot.yml): no se pisan.
const BOT_FLUJO = 'https://api.github.com/repos/charly10sf/fantasy-manager/actions/workflows/bot.yml/dispatches';

// El mercado de cada noche (3 nov, Carlos: «a las 0:16/0:17»): LaLiga actualiza los valores hacia las 00:15 de Madrid y Analítica
// y FútbolFantasy lo publican a las 00:16-00:17. Con el cron de 5 min salía a las 00:20-00:25, así que de 00:13 a 00:30 se lanza
// cada minuto solo el mercado (el bot ya mira si ha llegado el valor del día y si ya se publicó). En los minutos múltiplos de 5
// ya corre la ejecución normal, que también lo hace. El cron va en UTC y cubre las dos franjas (verano e invierno).
export const CRON_MERCADO = '13-30 22,23 * * *';
const HM = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' });
export function tocaMercado(t) {
  const [h, m] = HM.format(new Date(t)).split(':').map(Number);
  return h === 0 && m >= 13 && m <= 30 && m % 5 !== 0;
}

export async function lanzarBot(env, pedir = fetch, inputs = null) {
  const token = env.BOT_DISPATCH_TOKEN;
  if (!token) return { ok: false, motivo: 'sin BOT_DISPATCH_TOKEN' };
  const r = await pedir(BOT_FLUJO, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'fantasy-manager-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(inputs ? { ref: 'main', inputs } : { ref: 'main' }),
  });
  if (r.status === 204) return { ok: true };
  // el error de GitHub sin el token (no lo lleva, pero por si acaso se corta y se limpia)
  const texto = (await r.text().catch(() => '')).replaceAll(token, '***').slice(0, 300);
  throw new Error(`GitHub contestó ${r.status} al lanzar «Bot X»: ${texto}`);
}

// qué freno por IP lleva cada ruta (FRENOS)
const FRENO_RUTA = {
  'POST /vincular': 'vincular', 'POST /vincular/usar': 'usar', 'POST /qr/dejar': 'qrDejar', 'GET /qr/esperar': 'qrEsperar', 'POST /fallos': 'falloNuevo',
};

export default {
  async scheduled(evento, env, ctx) {
    let inputs = null;
    if (evento.cron === CRON_MERCADO) {
      if (!tocaMercado(evento.scheduledTime)) return;
      inputs = { tipos: 'mercado' };
    }
    ctx.waitUntil(lanzarBot(env, fetch, inputs).then((r) => { if (!r.ok) console.log('Bot X no lanzado:', r.motivo); }));
  },

  async fetch(req, env) {
    const url = new URL(req.url);
    const c = cors(req.headers.get('Origin'));
    if (!c) return new Response('Origen no permitido', { status: 403 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
    // el proxy (/p) y las imágenes (/img) solo para la web de Fantasy Manager: el navegador siempre manda de qué página
    // viene; sin ella (un script, curl) no se pasa nada (revisión del 23 oct: era un proxy abierto a LaLiga)
    if ((url.pathname === '/p' || url.pathname === '/img') && !req.headers.get('Origin')) return new Response('Solo para la web de Fantasy Manager', { status: 403, headers: c });
    try {
      const freno = FRENO_RUTA[`${req.method} ${url.pathname}`] || (url.pathname.startsWith('/fallos') ? 'fallos' : null);
      if (freno) { const no = await frenoIP(req, env, c, freno); if (no) return no; }
      if (url.pathname === '/p' && req.method === 'POST') return await pasar(req, c);
      if (url.pathname === '/img' && req.method === 'GET') return await imagen(url, c);
      if (url.pathname === '/vincular' && req.method === 'POST') return await vincular(req, env, c);
      if (url.pathname === '/vincular/usar' && req.method === 'POST') return await usar(req, env, c);
      if (url.pathname === '/qr/dejar' && req.method === 'POST') return await qrDejar(req, env, c);
      if (url.pathname === '/qr/esperar' && req.method === 'GET') return await qrEsperar(url, env, c);
      if (url.pathname === '/fallos' || url.pathname.startsWith('/fallos/')) return await fallos(req, env, c, url.pathname);
      if (url.pathname === '/uso' && req.method === 'POST') return await uso(req, env, c);
      if (url.pathname === '/borrar' && req.method === 'POST') return await borrarMios(req, env, c);
      if (url.pathname === '/hola' || url.pathname === '/hola/todos' || url.pathname === '/caras') return await hola(req, env, c, url.pathname);
      if (url.pathname === '/') return json({ ok: true, app: 'Fantasy Manager', kv: !!env.VINCULOS, qr: env.QR ? 'objeto' : env.VINCULOS ? 'kv' : 'no', avisos: !!env.VINCULOS, dueno: adminsDe(env).length > 0 }, 200, c);
      return json({ e: 'No existe' }, 404, c);
    } catch (e) {
      if (esKVLleno(e)) return json({ e: KV_LLENO, lleno: true }, 503, c);
      return json({ e: String((e && e.message) || e) }, 500, c);
    }
  },
};
