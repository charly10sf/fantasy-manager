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
 *   POST /hola                { v, canal, app, liga, equipo, bv, ad }: la app avisa de que está abierta (al abrirla y cada 10
 *                             minutos a la vista). Se apunta como mucho cada 9 minutos por cuenta.
 *   GET  /hola/todos          (el dueño) cada cuenta con su nombre, equipo, versión, primera y última vez, sus segundos
 *                             de hoy (segHoy) y, de los que han entrado en los últimos 7 días, los de cada uno de esos
 *                             días (segDias: { 'AAAA-MM-DD': seg }, solo los días con algo). Se borra a los 90 días sin abrir la app. Además, `registro`: todas las cuentas
 *                             que han entrado alguna vez (r:<uid>, sin nombre ni equipo; se borra a los 400 días sin abrir la app), para contar
 *                             usuarios. /hola contesta { ok, admin, bv } (admin: si quien llama es el dueño; bv: cuándo vio la
 *                             pantalla de bienvenida, si ya la vio; con `bv: true` en el cuerpo se apunta que la acaba de ver).
 *
 *   POST /plan                { pedido, tono, bloq, anuncio, alias, extra, rid }: el plan del día con la IA de Carlos (Claude), con
 *                             la sesión de LaLiga; 2 al día por cuenta y más con un anuncio bonificado, hasta 5 (planIA).
 *
 *   El dinero de los rivales, aprendido de lo que apunta la gente (0.7.13; Carlos, 15 nov: «el dinero que apuntan quiero que
 *   se use para autoalimentarse y mejorarse la app e IA, da igual la liga que sea»):
 *   POST /dinero              un apunte SIN NOMBRES NI IDS: { h, e, m, dl, dp, mov, sub, pago, val, pos, nr, est, r } (dineroDe).
 *                             Con la sesión de LaLiga (solo para frenar a quien no juega), pero no se guarda de quién es.
 *   GET  /dinero/cal          la corrección de todos (calDinero), rehecha como mucho cada 6 h. Sin sesión.
 *
 *   Lo que se paga por los libres en todas las ligas (0.7.13u; Carlos, 16 nov: «que se mejore solo, general y liga a liga»):
 *   POST /pujas               { c: [{ k, d, s, v, r, top }] } las compras de una liga, SIN NOMBRES NI IDS (compraLimpia), con la
 *                             sesión de LaLiga solo para frenar. Como mucho 80 por vez y 4 veces al día por cuenta.
 *   GET  /pujas/cal           lo pagado sobre el valor por tramo de valor y de subida (calPujas), rehecho cada 6 h. Sin sesión.
 *
 *   El semáforo de LaLiga y la entrada paso a paso (0.7.13i; Carlos, 15 nov: con 27 clics en la campaña de X no se veía
 *   a nadie entrar, y lo que pasa antes de entrar con la cuenta no llegaba al servidor):
 *   GET  /estado              { nivel: verde | amarillo | rojo, t, login, api, cuenta, entradas }: cómo van los servidores de
 *                             LaLiga (web/js/estado-laliga.js), mirado como mucho cada 2 minutos para todos. Sin sesión.
 *   POST /embudo              { p, k, o }: un paso antes de entrar (p: EMB_PASOS), desde dónde (k: EMB_CANALES) y de qué
 *                             campaña llegó a la web (o: utm_source). Sin sesión, sin ids ni nada de quién es: solo se suma
 *                             al día. Lo ve el dueño en /hola/todos (embudo).
 *
 * Las sesiones de los códigos se borran al usarse o a los 10 minutos. Los avisos se quedan 180 días.
 */

import { PRUEBAS, resultado, nivelDe } from '../../web/js/estado-laliga.js';
import { sistemaCorto, SOBRE_BLOQUEO, MAX_PEDIDO, esPedidoCorto, jsonDe, planLimpio, fuentesDe, webN, urlFuente, claveUrl } from '../../web/js/plan-sistema.js';
import { sistemaChat, esDatosChat, CHAT_MAX, TONO_CHAT, resumenRespuesta, partirDatos } from '../../web/js/chat-sistema.js';
import { cfgInvitar, invObjeto, premioActivo, limpiarCod } from './invitar.js';
import { apodosObjeto, ligaOk } from './apodos.js';

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
  // /plan, por cuenta: 3 al minuto (el cupo del día lo lleva aparte)
  plan: { min: 3 },
  // (16 nov) /pregunta, por cuenta: 6 al minuto (el cupo del día va aparte)
  pregunta: { min: 6 },
  // (19 nov) invita a un amigo, por cuenta: mirar, 20 al minuto; canjear un código o elegir rivales, 5
  invitar: { min: 20 }, canjear: { min: 5 },
  // (19 nov) los apodos, por cuenta: 20 al minuto
  apodos: { min: 20 },
  // (0.7.13) los apuntes del dinero: por IP; por cuenta van aparte (dinero)
  dinero: { min: 6, dia: 60 }, dineroCal: { min: 20 },
  // (0.7.13u) las compras de cada liga (lo pagado por los libres): por IP; por cuenta van aparte
  pujas: { min: 6, dia: 30 }, pujasCal: { min: 20 },
  // (0.7.13i) los pasos antes de entrar y el semáforo de LaLiga, sin sesión: por IP
  embudo: { min: 20, dia: 120 }, estado: { min: 30 },
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
  constructor(estado) { this.estado = estado; this.memo = {}; }
  async fetch(req) {
    const st = this.estado.storage;
    // los frenos por día (cabeHoy): un objeto por clave y día, que se borra solo a las 30 h
    const ruta = new URL(req.url).pathname;
    // (0.7.13i) el semáforo de LaLiga y la entrada paso a paso, en «embudo|todos»
    if (ruta === '/embudo/sumar' || ruta === '/embudo/leer' || ruta === '/estado') return embudoObjeto(st, ruta, req, this.memo);
    // (19 nov) invita a un amigo, todo en «inv|todos» (worker/src/invitar.js); nunca pone alarma
    if (ruta === '/inv') return new Response(JSON.stringify(await invObjeto(st, await req.json().catch(() => ({})))), { status: 200 });
    // (19 nov) los apodos de los rivales de una cuenta, en «apodos|uid» (worker/src/apodos.js); nunca pone alarma
    if (ruta === '/apodos') return new Response(JSON.stringify(await apodosObjeto(st, await req.json().catch(() => ({})))), { status: 200 });
    // el cupo de planes de una cuenta en un día (planIA): { op, gratis, max, extra } → { ok, u, x }
    if (ruta === '/plan') {
      const b = await req.json().catch(() => ({}));
      const ya = (await st.get('plan')) || {};
      const y = cupoCuenta(ya, b.op, { gratis: Number(b.gratis) || 0, max: Number(b.max) || 0, extra: !!b.extra, rid: b.rid, paso: Number(b.paso) || 1 });
      if (y.u !== (Number(ya.u) || 0) || y.x !== (Number(ya.x) || 0) || (y.r || '') !== (ya.r || '')) {
        await st.put('plan', { u: y.u, x: y.x, r: y.r || '' });
        if (!ya.u && !ya.x) await st.setAlarm(Date.now() + 30 * 3600e3);
      }
      return new Response(JSON.stringify(y), { status: 200 });
    }
    // (15 nov) el plan de un pedido (rid), para recogerlo si la app se fue a segundo plano y se cortó la conexión:
    // { op: 'leer' | 'marcha' | 'poner' | 'borrar', rid, fin } → { marcha?, fin? }. Se borra con lo demás a las 30 h
    if (ruta === '/plan/res') {
      const b = await req.json().catch(() => ({}));
      const rid = ridDe(b.rid);
      if (!rid) return new Response('{}', { status: 200 });
      const k = `res:${rid}`;
      if (b.op === 'marcha') await st.put(k, { marcha: Date.now() });
      else if (b.op === 'poner' && b.fin && typeof b.fin === 'object') await st.put(k, { fin: b.fin });
      else if (b.op === 'borrar') await st.delete(k);
      else return new Response(JSON.stringify((await st.get(k)) || {}), { status: 200 });
      if (b.op !== 'borrar' && !(await st.getAlarm())) await st.setAlarm(Date.now() + 30 * 3600e3);
      return new Response('{}', { status: 200 });
    }
    // lo gastado en planes entre todos en un día, en millonésimas de dólar: suma lo que llega y devuelve el total
    if (ruta === '/gasto') {
      const mas = Math.max(0, Number(await req.text()) || 0);
      const n = (Number(await st.get('g')) || 0) + mas;
      if (mas) { await st.put('g', n); if (n === mas) await st.setAlarm(Date.now() + 30 * 3600e3); }
      return new Response(String(n), { status: 200 });
    }
    // (0.7.13) el dinero de los rivales: lo apuntado por todos, en un solo objeto («dinero|todos»), que nunca pone alarma
    if (ruta === '/dinero/poner') {
      const b = await req.json().catch(() => null);
      if (!b || !b.k || !b.x) return new Response('mal', { status: 400 });
      await st.put(b.k, b.x);
      return new Response('ok', { status: 200 });
    }
    if (ruta === '/dinero/cal') {
      const ya = await st.get('cal');
      if (ya && Date.now() - ya.t < DINERO_CAL_CADA) return new Response(JSON.stringify(ya), { status: 200 });
      // lo de más de DINERO_DIAS días se borra (de 128 en 128, lo que deja delete)
      const limite = `r|${diaHace(DINERO_DIAS)}`;
      const viejos = [...(await st.list({ prefix: 'r|', end: limite, limit: 2000 })).keys()];
      for (let i = 0; i < viejos.length; i += 128) await st.delete(viejos.slice(i, i + 128));
      const regs = [...(await st.list({ prefix: 'r|', reverse: true, limit: DINERO_MAX })).values()];
      const cal = { ...calDinero(regs), t: Date.now() };
      await st.put('cal', cal);
      return new Response(JSON.stringify(cal), { status: 200 });
    }
    // (0.7.13u) las compras de todas las ligas, en otro objeto («pujas|todos»): de una vez, como mucho 128
    if (ruta === '/pujas/poner') {
      const b = await req.json().catch(() => null);
      if (!b || !b.xs || typeof b.xs !== 'object') return new Response('mal', { status: 400 });
      const ks = Object.keys(b.xs).slice(0, 128);
      if (ks.length) await st.put(Object.fromEntries(ks.map((k) => [k, b.xs[k]])));
      return new Response('ok', { status: 200 });
    }
    if (ruta === '/pujas/cal') {
      const ya = await st.get('cal');
      if (ya && Date.now() - ya.t < PUJAS_CAL_CADA) return new Response(JSON.stringify(ya), { status: 200 });
      const limite = `c|${diaHace(PUJAS_DIAS)}`;
      const viejos = [...(await st.list({ prefix: 'c|', end: limite, limit: 2000 })).keys()];
      for (let i = 0; i < viejos.length; i += 128) await st.delete(viejos.slice(i, i + 128));
      const regs = [...(await st.list({ prefix: 'c|', reverse: true, limit: PUJAS_MAX })).values()];
      const cal = { ...calPujas(regs), t: Date.now() };
      await st.put('cal', cal);
      return new Response(JSON.stringify(cal), { status: 200 });
    }
    if (ruta === '/contar') {
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
const FMT_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
const hoyMadrid = () => FMT_DIA.format(new Date(Date.now()));
/** el día de Madrid (AAAA-MM-DD) de un instante */
const diaMadrid = (t) => FMT_DIA.format(new Date(t));
/** muchas claves de KV de golpe: de 100 en 100 con la lectura en bloque (una operación cada 100); si el KV no la tiene,
    una a una (hasta 700, para no pasar del tope de mil operaciones por petición). Devuelve un Map clave → valor */
export async function leerEnBloque(env, claves) {
  const out = new Map();
  try {
    for (let i = 0; i < claves.length; i += 100) {
      const trozo = claves.slice(i, i + 100);
      const m = await env.VINCULOS.get(trozo);
      if (!(m instanceof Map)) throw new Error('sin lectura en bloque');
      for (const [k, v] of m) if (v != null) out.set(k, v);
    }
    return out;
  } catch (e) {
    out.clear();
    await Promise.all(claves.slice(0, 700).map((k) => env.VINCULOS.get(k).then((v) => { if (v != null) out.set(k, v); }).catch(() => {})));
    return out;
  }
}
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

/* ---------- el plan del día con la IA de Carlos (Claude), 2 al día por cuenta ---------- */
/*
 * POST /plan { pedido, tono, bloq, anuncio, alias, extra, rid }: el pedido del plan corto que arma la app (pedidoCorto de
 * web/js/ia.js, ya con alias) se le manda a Claude con la clave de Carlos (el secreto CLAUDE_PLANES) y se devuelve el plan
 * ({ plan, cupo }). Las instrucciones las arma el Worker con piezas fijas (web/js/plan-sistema.js): la app solo elige el
 * tono, qué funciones tiene cerradas y si van alias. El tope de respuesta es fijo, el pedido tiene que tener la forma del
 * plan corto y de la respuesta solo sale el plan (planLimpio): la ruta no sirve como IA gratis para otra cosa.
 * Quién llama lo dice LaLiga (quienEs, con su sesión), no la app.
 * Cupo por cuenta y día de Madrid: `gratis` planes y, con `extra: true` (la app lo manda al acabar un anuncio bonificado),
 * uno más cada vez hasta `max`, pase lo que pase. Con `rid` (id del pedido), un reintento de la app tras un corte no cuenta dos veces. Y entre todos, como mucho `topeUsdDia` dólares al día. Lo cuenta el Durable
 * Object (el de los frenos por día), no el KV: no gasta escrituras del KV. Los números, en «planes» de limites.json (con
 * los de PLANES_DEF si no se puede leer) y nunca por encima de PLAN_TOPE_USD de wrangler.toml.
 * Mientras Claude piensa (10-20 s) la respuesta va mandando espacios cada 5 s: la app de Android corta a los 30 s sin
 * recibir nada (Puente.java) y así no hace falta un APK nuevo. Por eso, con la respuesta ya empezada, los errores van con
 * estado 200 y { e } en el cuerpo.
 */
export const PLANES_DEF = { on: true, gratis: 2, max: 5, topeUsdDia: 3, web: 0, gratisWeb: 0 };
export const PLAN_MODELO = 'claude-haiku-5-5', PLAN_TOKENS = 5000;
// lo que cuesta cada millón de tokens (entrada, salida), en dólares (comprobado el 14 nov)
const PRECIOS = { 'claude-haiku-5-5': [0.1, 0.5], 'claude-sonnet-5-5': [2, 10] };
// cada búsqueda en Google, 10 $ las mil (más los tokens de lo que trae, que van con los de entrada): en millonésimas
export const USD_BUSQUEDA = 10000;
const LIMITES_URL = ['https://fantasymanagerapp.com/limites.json', 'https://raw.githubusercontent.com/charly10sf/fantasy-manager/main/web/limites.json'];
let limitesW = { t: 0, j: null };
/** limites.json (10 minutos en memoria) */
async function limitesJson() {
  if (!limitesW.j || Date.now() - limitesW.t > 10 * 60e3) {
    let j = null;
    for (const u of LIMITES_URL) {
      // (20 nov: sin tiempo máximo, si el dominio tardaba se quedaba esperando; Quién usa la app tardó 112 s) 4 s cada uno
      try { const r = await fetch(u, { cf: { cacheTtl: 300 }, signal: AbortSignal.timeout(4000) }); if (r.ok) { j = (await r.json()) || {}; break; } } catch (e) { /* el siguiente */ }
    }
    // (sin poder leerlo, lo último que se leyó; y si nunca, lo de por defecto)
    limitesW = { t: Date.now(), j: j || limitesW.j || {} };
  }
  return limitesW.j || {};
}
/** «planes» de limites.json, con sus topes */
export async function cfgPlanes(env) {
  const p = { ...PLANES_DEF, ...((await limitesJson()).planes || {}) };
  const n = (x, d, lo, hi) => { const v = Number(x); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v * 100) / 100)) : d; };
  const techo = n(env.PLAN_TOPE_USD, 10, 0, 1000);
  const gratis = Math.floor(n(p.gratis, 2, 0, 10));
  // (17 nov, Carlos, por Domy) gratisWeb: los planes gratis de quien usa la web o el iPhone, que no tienen anuncios para pedir más
  return { on: p.on !== false, gratis, max: Math.max(gratis, Math.floor(n(p.max, 5, 0, 10))), topeUsdDia: Math.min(techo, n(p.topeUsdDia, 3, 0, 1000)), modelo: String(env.PLAN_MODELO || PLAN_MODELO), web: webN(p.web), gratisWeb: Math.floor(n(p.gratisWeb, 0, 0, 10)) };
}
/** el cupo de hoy de una cuenta en el Durable Object (op: 'tomar', 'devolver' o 'mirar'); sin él, en la memoria del Worker */
const CUPO_MEM = new Map();
/** rid: el id del pedido que pone la app; si la app lo repite (se cortó la conexión y lo reintenta), no cuenta otra vez */
export const ridDe = (x) => (typeof x === 'string' && /^[a-z0-9]{8,24}$/.test(x) ? x : '');
export function cupoCuenta(x, op, { gratis, max, extra = false, rid = '', paso = 1 }) {
  const u = Number(x.u) || 0, r0 = String(x.r || ''), r = ridDe(rid);
  let e = Number(x.x) || 0;
  if (op === 'devolver') return { ok: true, u: Math.max(0, u - 1), x: e, r: '' };
  if (op === 'mirar') return { ok: true, u, x: e, r: r0 };
  // el mismo pedido otra vez (reintento tras un corte): ya se contó
  if (r && r === r0) return { ok: true, u, x: e, r: r0 };
  // un anuncio visto da un plan más, pero solo si ya no quedan de los gratis y sin pasar del máximo
  // (las preguntas del chat: cada anuncio da `paso`, 3 desde el 16 nov)
  if (extra && u >= gratis + e && gratis + e < max) e = Math.min(max - gratis, e + Math.max(1, Math.floor(Number(paso) || 1)));
  const cabe = u < Math.min(max, gratis + e);
  return { ok: cabe, u: cabe ? u + 1 : u, x: e, r: cabe ? r : r0 };
}
async function cupo(env, uid, op, c, tipo = 'plan') {
  const dia = hoyMadrid();
  const cuerpo = JSON.stringify({ op, gratis: c.gratis, max: c.max, extra: !!c.extra, rid: ridDe(c.rid), paso: c.porAnuncio || 1 });
  if (env.QR) {
    try {
      const r = await env.QR.get(env.QR.idFromName(`${tipo}|${dia}|${uid}`)).fetch('https://freno/plan', { method: 'POST', body: cuerpo });
      if (r.status === 200) return await r.json();
    } catch (e) { /* a la memoria */ }
  }
  const k = `${tipo}|${dia}|${uid}`, y = cupoCuenta(CUPO_MEM.get(k) || {}, op, { ...c, paso: c.porAnuncio || 1 });
  if (CUPO_MEM.size > 20000) CUPO_MEM.clear();
  CUPO_MEM.set(k, { u: y.u, x: y.x, r: y.r || '' });
  return y;
}
/** el plan guardado de un pedido (rid) en el Durable Object de la cuenta y el día; sin él, en la memoria del Worker */
const RES_MEM = new Map();
export const RES_MARCHA_MS = 100000;
async function resPlan(env, uid, op, rid, fin = null, tipo = 'plan') {
  rid = ridDe(rid);
  if (!rid) return {};
  const dia = hoyMadrid();
  if (env.QR) {
    try {
      const r = await env.QR.get(env.QR.idFromName(`${tipo}|${dia}|${uid}`)).fetch('https://freno/plan/res', { method: 'POST', body: JSON.stringify({ op, rid, fin }) });
      if (r.status === 200) return await r.json();
    } catch (e) { /* a la memoria */ }
  }
  const k = `${tipo}|${dia}|${uid}|${rid}`;
  if (op === 'leer') return RES_MEM.get(k) || {};
  if (RES_MEM.size > 2000) RES_MEM.clear();
  if (op === 'marcha') RES_MEM.set(k, { marcha: Date.now() });
  else if (op === 'poner') RES_MEM.set(k, { fin });
  else if (op === 'borrar') RES_MEM.delete(k);
  return {};
}
/** espera a que acabe el plan del mismo pedido que ya está en marcha (otra petición de la app, que se cortó): su resultado o null */
async function esperarRes(env, uid, rid, desde, tipo = 'plan') {
  while (Date.now() - desde < RES_MARCHA_MS) {
    await new Promise((ok) => setTimeout(ok, 2000));
    const x = await resPlan(env, uid, 'leer', rid, null, tipo);
    if (x.fin) return x.fin;
    if (!x.marcha || Date.now() - x.marcha > RES_MARCHA_MS) return null;
  }
  return null;
}
/** lo gastado hoy entre todos, en millonésimas de dólar (mas: lo que se suma) */
const GASTO_MEM = {};
async function gastoHoy(env, mas = 0, tipo = 'plan') {
  const dia = hoyMadrid();
  if (env.QR) {
    try {
      const r = await env.QR.get(env.QR.idFromName(`${tipo}|${dia}|gasto`)).fetch('https://freno/gasto', { method: 'POST', body: String(Math.max(0, Math.round(mas))) });
      if (r.status === 200) return Number(await r.text()) || 0;
    } catch (e) { /* a la memoria */ }
  }
  if (!GASTO_MEM[tipo] || GASTO_MEM[tipo].dia !== dia) GASTO_MEM[tipo] = { dia, n: 0 };
  GASTO_MEM[tipo].n += Math.max(0, Math.round(mas));
  return GASTO_MEM[tipo].n;
}
// (Carlos, 14 nov) el dueño (ADMINS) repite el plan cuantas veces quiera: sin cupo por cuenta (el tope de gasto del día
// entre todos y el freno de 3 al minuto siguen valiendo también para él)
const cupoLibre = (c) => ({ usados: 0, gratis: c.gratis, max: c.max, extras: 0, quedan: 99, masConAnuncio: true, ilimitado: true });
const cupoTxt = (c, y) => ({ usados: y.u, gratis: c.gratis, max: c.max, extras: y.x, quedan: Math.max(0, Math.min(c.max, c.gratis + y.x) - y.u), masConAnuncio: y.u < c.max });
const BLOQ = new Set(Object.keys(SOBRE_BLOQUEO));
/**
 * Lo que trae una respuesta de Claude: el texto (solo los bloques de texto: con búsqueda vienen partidos y con citas), las
 * fuentes que salieron en la búsqueda ({ u, t }, sin repetir) y las citadas.
 */
export function bloquesDe(content) {
  let texto = '';
  const vistas = [], citadas = [], ya = new Set(), yaC = new Set();
  const una = (u, t, a, s) => { const k = claveUrl(u); if (k && !s.has(k) && a.length < 40) { s.add(k); a.push({ u: urlFuente(u), t: String(t || '') }); } };
  for (const b of Array.isArray(content) ? content : []) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && typeof b.text === 'string') {
      texto += b.text;
      for (const c of Array.isArray(b.citations) ? b.citations : []) if (c && c.url) { una(c.url, c.title, citadas, yaC); una(c.url, c.title, vistas, ya); }
    } else if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r && r.type === 'web_search_result' && r.url) una(r.url, r.title, vistas, ya);
    }
  }
  return { texto, vistas, citadas };
}
/**
 * La llamada a Claude: { texto, entra, sale, fin, busquedas, vistas, citadas } o lanza un error. web: cuántas búsquedas en
 * Google puede hacer (0, sin búsqueda). Si la cuenta de Anthropic no la tiene activada, se repite sin ella (sinWeb: true).
 */
export async function llamarClaude(env, modelo, sistema, pedido, pedir = fetch, { web = 0, mensajes = null, tokens = PLAN_TOKENS, esfuerzo = 'low' } = {}) {
  // (16 nov) el chat manda la conversación entera (mensajes) y el sistema en bloques, con la parte fija en caché
  const cuerpo = { model: modelo, max_tokens: tokens, output_config: { effort: esfuerzo }, system: sistema, messages: mensajes || [{ role: 'user', content: pedido }] };
  if (webN(web)) cuerpo.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: webN(web), user_location: { type: 'approximate', country: 'ES', timezone: 'Europe/Madrid' } }];
  const acc = { texto: '', entra: 0, sale: 0, fin: '', busquedas: 0, vistas: [], citadas: [], sinWeb: false };
  let ult = '';
  // (con búsqueda, una respuesta larga puede volver a medias, «pause_turn»: se sigue desde ahí, como mucho dos veces)
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    let x = null;
    for (let n = 0; n < 3; n++) {
      let r;
      try {
        r = await pedir('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.CLAUDE_PLANES, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(100000) });
        x = await r.json().catch(() => ({}));
      } catch (e) { ult = String((e && e.message) || e); x = null; continue; }
      if (r.ok && Array.isArray(x.content)) break;
      ult = `${r.status} ${String((x.error && x.error.message) || '').slice(0, 160)}`;
      x = null;
      // (por si el modelo no conoce el esfuerzo: se quita y se repite)
      if (r.status === 400 && cuerpo.output_config && /effort|output_config/i.test(ult)) { delete cuerpo.output_config; n--; continue; }
      // (la búsqueda sin activar en la consola de Anthropic, o una versión que no conoce: sin ella, como siempre)
      if ((r.status === 400 || r.status === 403) && cuerpo.tools && /web.?search|tool/i.test(ult)) { console.log('plan: sin búsqueda:', ult); delete cuerpo.tools; acc.sinWeb = true; n--; continue; }
      if (r.status === 400 || r.status === 401 || r.status === 403 || r.status === 404) break;
      await new Promise((ok) => setTimeout(ok, r.status === 429 ? 4000 : 1500));
    }
    if (!x) break;
    const u = x.usage || {}, b = bloquesDe(x.content);
    // (lo leído de la caché cuesta una décima parte y lo que se escribe en ella, un 25 % más: se cuenta así en `entra`)
    acc.texto += b.texto; acc.entra += (u.input_tokens || 0) + Math.round((u.cache_read_input_tokens || 0) * 0.1 + (u.cache_creation_input_tokens || 0) * 1.25); acc.sale += u.output_tokens || 0; acc.fin = x.stop_reason || '';
    // (19 nov) lo leído y escrito en la caché, aparte, para medir lo que ahorra
    acc.cache = { lee: ((acc.cache && acc.cache.lee) || 0) + (u.cache_read_input_tokens || 0), escribe: ((acc.cache && acc.cache.escribe) || 0) + (u.cache_creation_input_tokens || 0), sin: ((acc.cache && acc.cache.sin) || 0) + (u.input_tokens || 0) };
    acc.busquedas += Number((u.server_tool_use || {}).web_search_requests) || 0;
    for (const [de, a] of [[b.vistas, acc.vistas], [b.citadas, acc.citadas]]) for (const f of de) if (!a.some((y) => claveUrl(y.u) === claveUrl(f.u))) a.push(f);
    if (x.stop_reason === 'pause_turn' && vuelta < 2) { cuerpo.messages = [...cuerpo.messages, { role: 'assistant', content: x.content }]; continue; }
    return acc;
  }
  if (acc.texto) return acc;
  throw new Error(`Claude: ${ult || 'sin respuesta'}`);
}
/** lo que cuesta una llamada, en millonésimas de dólar: los tokens y las búsquedas */
export const costeDe = (r, modelo) => { const [pe, ps] = PRECIOS[modelo] || PRECIOS[PLAN_MODELO]; return r.entra * pe + r.sale * ps + (r.busquedas || 0) * USD_BUSQUEDA; };
async function planIA(req, env, c, ctx) {
  const P0 = await cfgPlanes(env);
  // (17 nov) la web y el iPhone (el navegador manda Origin; la app de Android pide por su lado, sin él) no tienen anuncios con
  // los que pedir más planes: de momento, todos sus planes gratis (planes.gratisWeb de limites.json)
  let P = req.headers.get('Origin') && P0.gratisWeb > P0.gratis ? { ...P0, gratis: P0.gratisWeb, max: Math.max(P0.max, P0.gratisWeb) } : P0;
  if (!P.on) return json({ e: 'Los planes con la IA de la app están apagados ahora.', servicio: true }, 503, c);
  if (!env.CLAUDE_PLANES) return json({ e: 'El servidor todavía no tiene la IA de los planes (falta la clave CLAUDE_PLANES).', servicio: true, sinClave: true }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'No se ha podido comprobar tu cuenta de LaLiga ahora mismo. Tienes el plan de la app; vuelve a probar en un rato.' }, 401, c);
  if (!(await cabeAhora(env, 'FRENO_ESCRIBIR', `plan|${u.uid}`, FRENOS.plan.min))) return demasiadas(c);
  // (el cuerpo, con su tope antes de leerlo entero)
  const largo = Number(req.headers.get('content-length') || 0);
  if (largo > MAX_PEDIDO * 3) return json({ e: 'El pedido del plan es demasiado grande.' }, 413, c);
  const txt = await req.text();
  if (txt.length > MAX_PEDIDO * 3) return json({ e: 'El pedido del plan es demasiado grande.' }, 413, c);
  let b = null;
  try { b = JSON.parse(txt); } catch (e) { b = null; }
  if (!b || typeof b !== 'object') return json({ e: 'Pedido no válido' }, 400, c);
  if (typeof b.pedido === 'string' && b.pedido.length > MAX_PEDIDO) return json({ e: 'El pedido del plan es demasiado grande.' }, 413, c);
  if (!esPedidoCorto(b.pedido)) return json({ e: 'Eso no es un pedido del plan.' }, 400, c);
  const alias = b.alias && typeof b.alias === 'object' ? { puesto: !!b.alias.puesto, ex: !!b.alias.ex } : null;
  // (si se busca en Google lo decide el Worker, con «planes.web» de limites.json; la app no lo elige)
  const sistema = sistemaCorto({ tono: b.tono === 'serio' ? 'serio' : 'broma', bloq: (Array.isArray(b.bloq) ? b.bloq : []).filter((k) => BLOQ.has(k)), anuncio: !!b.anuncio, alias, web: P.web });
  // (15 nov) el mismo pedido otra vez (la app se fue a segundo plano y se cortó): si ya está hecho, se devuelve; si sigue
  // en marcha, se espera a ese en vez de volver a pedírselo a Claude
  const rid = ridDe(b.rid);
  const previo = rid ? await resPlan(env, u.uid, 'leer', rid) : {};
  if (previo.fin) return json(previo.fin, 200, c);
  const enMarcha = !!(previo.marcha && Date.now() - previo.marcha < RES_MARCHA_MS);
  // entre todos, el tope de gasto del día
  if (!enMarcha && (await gastoHoy(env, 0)) >= P.topeUsdDia * 1e6) return json({ e: 'La IA de los planes ha llegado hoy a su tope. Tienes el plan de la app; mañana vuelve.', servicio: true, tope: true }, 503, c);
  const libre = adminsDe(env).includes(String(u.uid));
  // (19 nov) con la semana doble de invitar a amigos, el doble de planes gratis y de máximo
  if (!libre) P = await cupoConPremio(env, u.uid, P);
  const y = libre ? { ok: true } : await cupo(env, u.uid, 'tomar', { ...P, extra: b.extra === true, rid: b.rid });
  if (!y.ok) {
    const ct = cupoTxt(P, y);
    return json({ e: ct.masConAnuncio && b.extra !== true ? `Ya has hecho tus ${Math.min(P.max, P.gratis + y.x)} planes con la IA de hoy.` : `Ya has hecho los ${P.max} planes con la IA de hoy, el máximo. Mañana tienes otros ${P.gratis}.`, cupo: ct }, 429, c);
  }
  // la respuesta, ya empezada: espacios cada 5 s mientras Claude piensa (JSON.parse se los salta)
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), enc = new TextEncoder();
  const latido = setInterval(() => { w.write(enc.encode(' ')).catch(() => {}); }, 5000);
  const t0 = Date.now();
  const trabajo = (async () => {
    let fin = enMarcha ? await esperarRes(env, u.uid, rid, Date.now()).catch(() => null) : null;
    if (fin) {
      clearInterval(latido);
      try { await w.write(enc.encode(JSON.stringify(fin))); await w.close(); } catch (e) { /* se ha ido */ }
      return;
    }
    if (rid) await resPlan(env, u.uid, 'marcha', rid).catch(() => {});
    try {
      const r = await llamarClaude(env, P.modelo, sistema, b.pedido, fetch, { web: P.web });
      const gasto = costeDe(r, P.modelo);
      ctx && ctx.waitUntil ? ctx.waitUntil(gastoHoy(env, gasto).catch(() => {})) : await gastoHoy(env, gasto).catch(() => {});
      // (las fuentes, solo las que salieron de verdad en la búsqueda: lo que la IA ponga de más se borra)
      const j = jsonDe(r.texto);
      const plan = planLimpio(j ? fuentesDe(j, r.vistas, r.citadas) : null);
      if (!plan) {
        if (!libre) await cupo(env, u.uid, 'devolver', P);
        fin = { e: `La IA ha contestado sin el formato del plan${r.fin === 'max_tokens' ? ' (se ha cortado por largo)' : ''}. Tienes el plan de la app; vuelve a probar cuando quieras (este no cuenta).`, estado: 502 };
      } else fin = { plan, cupo: libre ? cupoLibre(P) : cupoTxt(P, y), tok: { entra: r.entra, sale: r.sale, web: r.busquedas }, ms: Date.now() - t0, fin: r.fin };
      // (guardado antes de mandarlo: si la app ya no está, lo recoge al volver con el mismo rid)
      if (rid) await resPlan(env, u.uid, fin.plan ? 'poner' : 'borrar', rid, fin.plan ? fin : null).catch(() => {});
    } catch (e) {
      // (lo que no ha llegado a dar un plan no cuenta)
      if (!libre) await cupo(env, u.uid, 'devolver', P).catch(() => {});
      console.log('plan:', String((e && e.message) || e));
      if (rid) await resPlan(env, u.uid, 'borrar', rid).catch(() => {});
      fin = { e: 'La IA de los planes no contesta ahora mismo. Tienes el plan de la app; vuelve a probar en un rato (este no cuenta).', estado: 503, servicio: true };
    }
    clearInterval(latido);
    try { await w.write(enc.encode(JSON.stringify(fin))); await w.close(); } catch (e) { /* se ha ido: ya está contado */ }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(trabajo);
  return new Response(readable, { status: 200, headers: { ...c, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, no-transform' } });
}

/* ---------- las preguntas del chat con la IA de la app (16 nov) ---------- */
/*
 * POST /pregunta { datos, pregunta, hist, fotos, tono, bloq, anuncio, alias, extra, rid }. Como /plan: quién pregunta lo
 * dice LaLiga (quienEs); las instrucciones las arma el Worker con web/js/chat-sistema.js y la app solo manda los datos de su
 * liga (tienen que empezar por la cabecera de la app: esDatosChat), la conversación (los últimos 12 mensajes, sin fotos)
 * y la pregunta con sus capturas. Cupo por cuenta y día de Madrid («preguntas» de limites.json: 3 gratis y 3 más con
 * un anuncio, 6 como mucho; Carlos, 17 nov; el dueño sin cupo) y tope de gasto del día aparte del de los planes. Con `rid`, si la app se va a
 * segundo plano y se corta, al volver pide lo mismo y le llega la respuesta que ya estaba hecha, sin contar otra vez.
 * La respuesta va mandando espacios cada 5 s mientras la IA piensa (Android corta a los 30 s sin recibir nada).
 * Devuelve { texto, cupo, tok, ms } (el texto con los alias puestos: la app los quita) o { e, estado }.
 */
// (16 nov, prueba con Haiku de verdad: 40 respuestas) con 3000 tokens y esfuerzo «medium», 4 de 10 salían VACÍAS (lo que piensa
// cuenta en los tokens de salida y se los comía todos); con «low» tarda un 10 % menos y contesta igual de bien
export const PREGUNTAS_DEF = { on: true, gratis: 3, porAnuncio: 3, max: 6, topeUsdDia: 3, esfuerzo: 'low' };
export const PREGUNTA_TOKENS = 8000;
/** «preguntas» de limites.json, con sus topes */
export async function cfgPreguntas(env) {
  const p = { ...PREGUNTAS_DEF, ...((await limitesJson()).preguntas || {}) };
  const n = (x, d, lo, hi) => { const v = Number(x); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v * 100) / 100)) : d; };
  const techo = n(env.PLAN_TOPE_USD, 10, 0, 1000);
  const gratis = Math.floor(n(p.gratis, 3, 0, 100));
  return { on: p.on !== false, gratis, max: Math.max(gratis, Math.floor(n(p.max, 6, 0, 200))), porAnuncio: Math.max(1, Math.floor(n(p.porAnuncio, 3, 1, 50))), topeUsdDia: Math.min(techo, n(p.topeUsdDia, 3, 0, 1000)), modelo: String(env.PREGUNTA_MODELO || env.PLAN_MODELO || PLAN_MODELO), esfuerzo: ['low', 'medium', 'high'].includes(p.esfuerzo) ? p.esfuerzo : 'low', cacheLiga: ['siempre', 'segunda', 'no'].includes(p.cacheLiga) ? p.cacheLiga : 'siempre' };
}
const cupoTxtP = (c, y) => ({ usados: y.u, gratis: c.gratis, max: c.max, extras: y.x, porAnuncio: c.porAnuncio, quedan: Math.max(0, Math.min(c.max, c.gratis + y.x) - y.u), masConAnuncio: Math.min(c.max, c.gratis + y.x) < c.max });
const cupoLibreP = (c) => ({ usados: 0, gratis: c.gratis, max: c.max, extras: 0, porAnuncio: c.porAnuncio, quedan: 99, masConAnuncio: true, ilimitado: true });
const FOTO_B64 = /^[A-Za-z0-9+/]+={0,2}$/;
/**
 * La conversación para Claude: los mensajes de antes (solo texto) y la pregunta con sus fotos, alternando usuario y
 * asistente (dos seguidos del mismo se juntan) y empezando por el usuario. null si algo no vale.
 */
export function mensajesChat(hist, pregunta, fotos) {
  const out = [];
  const poner = (role, content) => {
    const ult = out[out.length - 1];
    if (ult && ult.role === role) { ult.content = [...(Array.isArray(ult.content) ? ult.content : [{ type: 'text', text: ult.content }]), ...(Array.isArray(content) ? content : [{ type: 'text', text: content }])]; return; }
    out.push({ role, content });
  };
  for (const m of (Array.isArray(hist) ? hist : []).slice(-CHAT_MAX.hist)) {
    if (!m || typeof m !== 'object' || typeof m.t !== 'string' || !m.t.trim()) continue;
    if (m.t.length > CHAT_MAX.mensaje) return null;
    const role = m.r === 'ia' ? 'assistant' : 'user';
    if (!out.length && role === 'assistant') continue;
    poner(role, m.t);
  }
  const fs = Array.isArray(fotos) ? fotos : [];
  if (fs.length > CHAT_MAX.fotos || fs.some((f) => typeof f !== 'string' || f.length > CHAT_MAX.foto || !FOTO_B64.test(f))) return null;
  const q = typeof pregunta === 'string' ? pregunta.trim() : '';
  if (q.length > CHAT_MAX.pregunta || (!q && !fs.length)) return null;
  poner('user', [...fs.map((d) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d } })), { type: 'text', text: q || (fs.length > 1 ? 'Mira estas capturas.' : 'Mira esta captura.') }]);
  return out;
}
/**
 * Lo que se le manda a Claude de una pregunta ya leída (b): { sistema, mensajes } o null si no vale. Lo usa también la
 * prueba con Haiku de verdad (.github/ia/chat-haiku.mjs), para preguntar exactamente lo mismo que el Worker.
 */
export function armarChat(b, { cacheLiga = 'siempre' } = {}) {
  if (!b || typeof b !== 'object' || !esDatosChat(b.datos)) return null;
  const mensajes = mensajesChat(b.hist, b.pregunta, b.fotos);
  if (!mensajes) return null;
  const alias = b.alias && typeof b.alias === 'object' ? { puesto: !!b.alias.puesto, ex: !!b.alias.ex } : null;
  const fijo = sistemaChat({ tono: TONO_CHAT[b.tono] ? b.tono : 'normal', bloq: (Array.isArray(b.bloq) ? b.bloq : []).filter((k) => BLOQ.has(k)), anuncio: !!b.anuncio, alias, fotos: (Array.isArray(b.fotos) && b.fotos.length > 0) || b.conFotos === true, web: false });
  // (la parte fija, en la caché de Anthropic: en una conversación seguida cuesta una décima parte)
  // (19 nov) y los datos de la liga también: la app los manda en dos trozos (partirDatos), lo de la liga, que no cambia en la
  // misma conversación, y lo de esta pregunta (los jugadores y rivales que nombra, el plan, la hora); lo primero, en la caché
  // Escribir en la caché cuesta un 25 % más y leerla, una décima parte: compensa si 1 de cada 4 conversaciones sigue con otra
  // pregunta en menos de 5 minutos. «preguntas.cacheLiga» de limites.json: 'siempre' (por defecto), 'segunda' (desde la
  // segunda pregunta de la conversación) o 'no'. Con la batería de chat-casos.mjs (82 % de preguntas sueltas), en seco:
  // 'siempre' +2 % en total y −53 % en las que siguen; 'segunda' −1 % y −6 %
  const { liga, pregunta } = partirDatos(b.datos);
  const enCache = !!pregunta && (cacheLiga === 'siempre' || (cacheLiga === 'segunda' && mensajes.length > 1));
  const sistema = [{ type: 'text', text: fijo, cache_control: { type: 'ephemeral' } }, enCache ? { type: 'text', text: liga, cache_control: { type: 'ephemeral' } } : { type: 'text', text: liga }];
  if (pregunta) sistema.push({ type: 'text', text: pregunta });
  return { sistema, mensajes };
}
async function preguntaIA(req, env, c, ctx) {
  let P = await cfgPreguntas(env);
  if (!P.on) return json({ e: 'Las preguntas con la IA de la app están apagadas ahora.', servicio: true }, 503, c);
  if (!env.CLAUDE_PLANES) return json({ e: 'El servidor todavía no tiene la IA de las preguntas.', servicio: true, sinClave: true }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'No se ha podido comprobar tu cuenta de LaLiga ahora mismo. Vuelve a probar en un rato.' }, 401, c);
  if (!(await cabeAhora(env, 'FRENO_ESCRIBIR', `pregunta|${u.uid}`, FRENOS.pregunta.min))) return demasiadas(c);
  const tope = CHAT_MAX.datos + CHAT_MAX.fotos * CHAT_MAX.foto + CHAT_MAX.hist * CHAT_MAX.mensaje + 20000;
  if (Number(req.headers.get('content-length') || 0) > tope * 1.2) return json({ e: 'La pregunta es demasiado grande (prueba con menos fotos).' }, 413, c);
  const txt = await req.text();
  if (txt.length > tope * 1.2) return json({ e: 'La pregunta es demasiado grande (prueba con menos fotos).' }, 413, c);
  let b = null;
  try { b = JSON.parse(txt); } catch (e) { b = null; }
  const armado = armarChat(b, { cacheLiga: P.cacheLiga });
  if (!armado) return json({ e: 'Pregunta no válida' }, 400, c);
  const { sistema, mensajes } = armado;
  const rid = ridDe(b.rid);
  const previo = rid ? await resPlan(env, u.uid, 'leer', rid, null, 'preg') : {};
  if (previo.fin) return json(previo.fin, 200, c);
  const enMarcha = !!(previo.marcha && Date.now() - previo.marcha < RES_MARCHA_MS);
  if (!enMarcha && (await gastoHoy(env, 0, 'preg')) >= P.topeUsdDia * 1e6) return json({ e: 'La IA de las preguntas ha llegado hoy a su tope. Mañana vuelve.', servicio: true, tope: true }, 503, c);
  const libre = adminsDe(env).includes(String(u.uid));
  if (!libre) P = await cupoConPremio(env, u.uid, P);
  const y = libre ? { ok: true } : await cupo(env, u.uid, 'tomar', { ...P, extra: b.extra === true, rid: b.rid }, 'preg');
  if (!y.ok) {
    const ct = cupoTxtP(P, y);
    return json({ e: ct.masConAnuncio ? `Ya has hecho tus ${Math.min(P.max, P.gratis + y.x)} preguntas de hoy.` : `Ya has hecho las ${P.max} preguntas de hoy, el máximo. Mañana tienes otras ${P.gratis}.`, cupo: ct }, 429, c);
  }
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), enc = new TextEncoder();
  const latido = setInterval(() => { w.write(enc.encode(' ')).catch(() => {}); }, 5000);
  const t0 = Date.now();
  const trabajo = (async () => {
    let fin = enMarcha ? await esperarRes(env, u.uid, rid, Date.now(), 'preg').catch(() => null) : null;
    if (!fin) {
      if (rid) await resPlan(env, u.uid, 'marcha', rid, null, 'preg').catch(() => {});
      try {
        const r = await llamarClaude(env, P.modelo, sistema, null, fetch, { mensajes, tokens: PREGUNTA_TOKENS, esfuerzo: P.esfuerzo });
        const gasto = costeDe(r, P.modelo);
        ctx && ctx.waitUntil ? ctx.waitUntil(gastoHoy(env, gasto, 'preg').catch(() => {})) : await gastoHoy(env, gasto, 'preg').catch(() => {});
        const texto = String(r.texto || '').trim();
        if (!texto) {
          if (!libre) await cupo(env, u.uid, 'devolver', P, 'preg').catch(() => {});
          fin = { e: 'La IA ha contestado vacío. Vuelve a preguntar (esta no cuenta).', estado: 502 };
        } else fin = { texto, resumen: resumenRespuesta(texto), cupo: libre ? cupoLibreP(P) : cupoTxtP(P, y), tok: { entra: r.entra, sale: r.sale }, ms: Date.now() - t0, fin: r.fin };
        if (rid) await resPlan(env, u.uid, fin.texto ? 'poner' : 'borrar', rid, fin.texto ? fin : null, 'preg').catch(() => {});
      } catch (e) {
        if (!libre) await cupo(env, u.uid, 'devolver', P, 'preg').catch(() => {});
        console.log('pregunta:', String((e && e.message) || e));
        if (rid) await resPlan(env, u.uid, 'borrar', rid, null, 'preg').catch(() => {});
        fin = { e: 'La IA no contesta ahora mismo. Vuelve a preguntar en un rato (esta no cuenta).', estado: 503, servicio: true };
      }
    }
    clearInterval(latido);
    try { await w.write(enc.encode(JSON.stringify(fin))); await w.close(); } catch (e) { /* se ha ido: ya está guardado */ }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(trabajo);
  return new Response(readable, { status: 200, headers: { ...c, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, no-transform' } });
}

/* ---------- el dinero de los rivales: aprender de lo que apunta todo el mundo (0.7.13) ---------- */
/*
 * Cuando alguien apunta lo que le ha dicho un rival que tiene, la app manda cuánto fallaba su cuenta en ese momento y el
 * contexto de la cuenta, SIN NOMBRES NI IDS de nadie: ni de quien lo manda, ni del rival, ni de la liga ni del equipo.
 *   h    huella (SHA-256, 24 hex) de liga|rival|día, hecha en el móvil: solo sirve para no contar dos veces lo mismo el mismo
 *        día (dos de la misma liga que apuntan al mismo rival). Cambia cada día, así que no une apuntes de días distintos.
 *   e    lo apuntado menos lo que daba la cuenta (v - est); m el margen de la cuenta; r la mitad del rango apuntado
 *   dl   días desde el principio de la liga; dp días de parón en medio (recompensa doble); mov y sub, movimientos y
 *        subidas de cláusula del rival; pago, si la liga es de pago; val, pos y nr: valor del equipo del rival, su puesto
 *        y cuántos equipos hay; est lo que daba la cuenta (Carlos, 15 nov: «eso y más para la IA», para afinarla después)
 * Va en el Durable Object («dinero|todos»), no en el KV (unas mil escrituras al día entre todo). Se quedan DINERO_DIAS días.
 * La sesión de LaLiga solo sirve para frenar (por cuenta y día, en el freno del día, que se borra a las 30 h): no se guarda
 * con el apunte. La corrección (calDinero) se rehace como mucho cada 6 h y la app la lee con 6 h de caché.
 */
export const DINERO_DIAS = 180, DINERO_MAX = 20000, DINERO_CAL_CADA = 6 * 3600e3, DINERO_CUENTA_DIA = 30, DINERO_TODOS_DIA = 5000;
const diaHace = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const numEn = (x, lo, hi, ent = false) => { const v = Number(x); if (!Number.isFinite(v) || v < lo || v > hi) return null; return ent ? Math.round(v) : Math.round(v / 1e3) * 1e3; };
/** un apunte limpio (lo que se guarda) o null si algo no cuadra */
export function apunteDinero(b) {
  if (!b || typeof b !== 'object' || !/^[0-9a-f]{24}$/.test(String(b.h || ''))) return null;
  const x = {
    e: numEn(b.e, -300e6, 300e6), m: numEn(b.m, 0, 200e6), r: numEn(b.r ?? 0, 0, 200e6), dl: numEn(b.dl, 0, 400, true), dp: numEn(b.dp ?? 0, 0, 400, true),
    mov: numEn(b.mov ?? 0, 0, 5000, true), sub: numEn(b.sub ?? 0, 0, 500, true), pago: b.pago === true, val: numEn(b.val ?? 0, 0, 5e9), pos: numEn(b.pos ?? 0, 0, 60, true),
    nr: numEn(b.nr ?? 0, 0, 60, true), est: numEn(b.est ?? 0, -1e9, 5e9),
  };
  if (Object.values(x).some((v) => v === null) || x.dp > x.dl + 1) return null;
  return x;
}
const cuantilD = (o, q) => { if (!o.length) return 0; const i = (o.length - 1) * q, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
const resumenE = (xs) => { const o = xs.map((x) => x.e).sort((a, b) => a - b); const r = (q) => Math.round(cuantilD(o, q) / 1e3) * 1e3; return { n: o.length, med: r(0.5), p10: r(0.1), p25: r(0.25), p75: r(0.75), p90: r(0.9) }; };
// los tramos: por días de liga (lo que más pesa: la recompensa diaria que uno coge y otro no se va sumando), por subidas
// de cláusula y por si ha habido parón en medio
export const TRAMOS_DINERO = {
  dias: [[0, 30], [30, 60], [60, 100], [100, 9999]],
  sub: [[0, 1], [1, 3], [3, 9999]],
  paron: [[0, 1], [1, 9999]],
};
/** la corrección de todos: la mediana y el reparto de lo que falla la cuenta, en total y por tramos */
export function calDinero(regs) {
  const l = (regs || []).filter((x) => x && Number.isFinite(x.e));
  const tramos = (k, campo) => TRAMOS_DINERO[k].map(([desde, hasta]) => ({ desde, hasta, ...resumenE(l.filter((x) => x[campo] >= desde && x[campo] < hasta)) }));
  return { ...resumenE(l), porDias: tramos('dias', 'dl'), porSub: tramos('sub', 'sub'), porParon: tramos('paron', 'dp') };
}
const objDinero = (env) => env.QR.get(env.QR.idFromName('dinero|todos'));
async function dineroApunte(req, env, c) {
  if (!env.QR) return json({ e: 'Sin almacén' }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga', sesion: true }, 401, c);
  if (!(await cabeAhora(env, 'FRENO_ESCRIBIR', `dinero|${u.uid}`, 6))) return demasiadas(c);
  const b = await req.json().catch(() => null);
  const x = apunteDinero(b);
  if (!x) return json({ e: 'Apunte no válido' }, 400, c);
  // por cuenta y entre todos, al día
  if (!(await cabeHoy(env, `dinero|${u.uid}`, DINERO_CUENTA_DIA))) return demasiadas(c, 'mañana');
  if (!(await cabeHoy(env, 'dinero|todos', DINERO_TODOS_DIA))) return json({ e: 'Por hoy ya está' }, 503, c);
  // uno por rival y día: el de la misma huella el mismo día se sustituye (lo último apuntado manda)
  const r = await objDinero(env).fetch('https://dinero/dinero/poner', { method: 'POST', body: JSON.stringify({ k: `r|${hoyMadrid()}|${b.h}`, x }) });
  return r.status === 200 ? json({ ok: true }, 200, c) : json({ e: 'No se ha podido guardar' }, 503, c);
}
let CAL_MEM = { t: 0, cal: null };
async function dineroCal(env, c) {
  if (!env.QR) return json({ e: 'Sin almacén' }, 503, c);
  if (!CAL_MEM.cal || Date.now() - CAL_MEM.t > 10 * 60e3) {
    const r = await objDinero(env).fetch('https://dinero/dinero/cal', { method: 'POST' });
    if (r.status !== 200) return json({ e: 'No se ha podido leer' }, 503, c);
    CAL_MEM = { t: Date.now(), cal: await r.json() };
  }
  return json(CAL_MEM.cal, 200, c);
}

/* ---------- lo que se paga por los libres del mercado en todas las ligas (0.7.13u) ---------- */
/*
 * Carlos, 16 nov: «los top o los que suben mucho se pagan bastante por encima de la media… que se mejore solo, de forma
 * general y liga a liga». La app manda una vez al día las compras a LaLiga de su liga que no ha mandado ya, SIN NOMBRES NI
 * IDS de nadie (ni del jugador, ni de quien compró, ni de la liga):
 *   k    huella (SHA-256, 24 hex) de liga|jugador|hora de la compra, hecha en el móvil: solo para que dos de la misma liga
 *        no cuenten dos veces la misma compra
 *   d    el día de la compra; s lo pagado sobre su valor (0,12 = un 12 % más); v su valor (redondeado a 10 mil);
 *   r    lo que subía al día en los 3 días de antes (null si no se sabe); top, si era de los 30 que más valen
 * Va en su Durable Object («pujas|todos») y se queda PUJAS_DIAS días desde el día de la compra. Con la sesión de LaLiga
 * solo para frenar (por cuenta y día); no se guarda de quién es. La app lo lee con /pujas/cal (6 h de caché), por tramos
 * de valor y de subida, y lo mezcla con lo de su liga cuando esta tiene pocas compras parecidas (M.pagaLiga).
 */
export const PUJAS_DIAS = 120, PUJAS_MAX = 30000, PUJAS_CAL_CADA = 6 * 3600e3, PUJAS_CUENTA_DIA = 4, PUJAS_TODOS_DIA = 4000, PUJAS_POR_VEZ = 80;
// los tramos de valor (como TRAMOS_PUJA de motor.js) y de subida al día; van en la respuesta, así que la app usa estos
export const TRAMOS_PUJAS = { v: [[0, 1e6], [1e6, 3e6], [3e6, 10e6], [10e6, 30e6], [30e6, 1e12]], r: [[-1, 0.004], [0.004, 0.012], [0.012, 1]] };
/** una compra limpia (lo que se guarda: { s, v, r, top }) o null si algo no cuadra */
export function compraLimpia(b, hoy = Date.now()) {
  if (!b || typeof b !== 'object' || !/^[0-9a-f]{24}$/.test(String(b.k || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.d || ''))) return null;
  const td = Date.parse(`${b.d}T12:00:00Z`);
  if (!Number.isFinite(td) || td > hoy + 864e5 || hoy - td > 60 * 864e5) return null;
  const s = Number(b.s), v = Number(b.v), r = b.r == null ? null : Number(b.r);
  if (!Number.isFinite(s) || s < -0.1 || s > 5 || !Number.isFinite(v) || v < 1e5 || v > 400e6) return null;
  if (r != null && (!Number.isFinite(r) || r < -0.2 || r > 0.3)) return null;
  return { s: Math.round(s * 1000) / 1000, v: Math.round(v / 1e4) * 1e4, r: r == null ? null : Math.round(r * 1e4) / 1e4, top: b.top === true };
}
const resumenS = (xs) => { const o = xs.map((x) => x.s).sort((a, b) => a - b); const q = (p) => Math.round(cuantilD(o, p) * 1000) / 1000; return { n: o.length, p10: q(0.1), p25: q(0.25), med: q(0.5), p75: q(0.75), p90: q(0.9) }; };
/** lo que se paga en todas las ligas: por tramo de valor y de subida («i|j»), por valor («i|*») y los top por subida («top|j») */
export function calPujas(regs) {
  const l = (regs || []).filter((x) => x && Number.isFinite(x.s) && Number.isFinite(x.v));
  const en = (tr, x) => tr.findIndex(([lo, hi]) => x >= lo && x < hi);
  const celdas = [];
  const poner = (k, xs) => { if (xs.length) celdas.push({ k, ...resumenS(xs) }); };
  TRAMOS_PUJAS.v.forEach((_, i) => {
    const deV = l.filter((x) => en(TRAMOS_PUJAS.v, x.v) === i);
    poner(`${i}|*`, deV);
    TRAMOS_PUJAS.r.forEach((__, j) => poner(`${i}|${j}`, deV.filter((x) => x.r != null && en(TRAMOS_PUJAS.r, x.r) === j)));
  });
  TRAMOS_PUJAS.r.forEach((_, j) => poner(`top|${j}`, l.filter((x) => x.top && x.r != null && en(TRAMOS_PUJAS.r, x.r) === j)));
  return { n: l.length, tv: TRAMOS_PUJAS.v, tr: TRAMOS_PUJAS.r, celdas };
}
const objPujas = (env) => env.QR.get(env.QR.idFromName('pujas|todos'));
async function pujasApunte(req, env, c) {
  if (!env.QR) return json({ e: 'Sin almacén' }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga', sesion: true }, 401, c);
  if (!(await cabeAhora(env, 'FRENO_ESCRIBIR', `pujas|${u.uid}`, 3))) return demasiadas(c);
  const b = await req.json().catch(() => null);
  const lista = b && Array.isArray(b.c) ? b.c.slice(0, PUJAS_POR_VEZ) : null;
  if (!lista || !lista.length) return json({ e: 'Nada que apuntar' }, 400, c);
  const xs = {};
  for (const y of lista) { const x = compraLimpia(y); if (x) xs[`c|${y.d}|${y.k}`] = x; }
  if (!Object.keys(xs).length) return json({ e: 'Compras no válidas' }, 400, c);
  if (!(await cabeHoy(env, `pujas|${u.uid}`, PUJAS_CUENTA_DIA))) return demasiadas(c, 'mañana');
  if (!(await cabeHoy(env, 'pujas|todos', PUJAS_TODOS_DIA))) return json({ e: 'Por hoy ya está' }, 503, c);
  const r = await objPujas(env).fetch('https://pujas/pujas/poner', { method: 'POST', body: JSON.stringify({ xs }) });
  return r.status === 200 ? json({ ok: true, n: Object.keys(xs).length }, 200, c) : json({ e: 'No se ha podido guardar' }, 503, c);
}
let PUJAS_MEM = { t: 0, cal: null };
async function pujasCal(env, c) {
  if (!env.QR) return json({ e: 'Sin almacén' }, 503, c);
  if (!PUJAS_MEM.cal || Date.now() - PUJAS_MEM.t > 10 * 60e3) {
    const r = await objPujas(env).fetch('https://pujas/pujas/cal', { method: 'POST' });
    if (r.status !== 200) return json({ e: 'No se ha podido leer' }, 503, c);
    PUJAS_MEM = { t: Date.now(), cal: await r.json() };
  }
  return json(PUJAS_MEM.cal, 200, c);
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
  // (19 nov) tu código de invitar y tus premios (queda solo que la cuenta ya existía, para que no valga como nueva) y tus apodos
  if (env.QR) {
    try { await invPedir(env, { op: 'borrar', uid: u.uid }); PREMIOS_MEM.delete(u.uid); } catch (e) { fallidas++; }
    try { await env.QR.get(env.QR.idFromName(`apodos|${u.uid}`)).fetch('https://freno/apodos', { method: 'POST', body: JSON.stringify({ op: 'borrar' }) }); } catch (e) { fallidas++; }
  }
  if (fallidas) return json({ e: `No se han podido borrar ${fallidas} de ${claves.length} cosas. Vuelve a probar en un rato.` }, 503, c);
  return json({ ok: true, avisos, claves: claves.length }, 200, c);
}

/* ---------- invita a un amigo (19 nov) ---------- */
/*
 * GET  /invitar            lo tuyo: tu código (si ya lo has pedido), los amigos que han entrado con él (sin quién), cuántos
 *                          cuentan para los escalones, tus premios y, si te invitaron a ti, que te invitaron. Si eres un
 *                          invitado y es otro día de Madrid que el que entraste, cuenta que has vuelto (los escalones).
 * POST /invitar/codigo     saca tu código (una vez; luego es siempre el mismo) y devuelve lo mismo que GET.
 * POST /invitar/canjear    { cod, liga }: entras con el código de otro. Solo cuentas nuevas en la app (primera vez hace
 *                          como mucho «diasCodigo» días), que nadie haya invitado antes, que no sean la misma y que estén en
 *                          esa liga (lo dice LaLiga con tu sesión).
 * POST /invitar/rivales    { i, liga, tids }: los rivales que eliges con el amigo i (como mucho «rivales», dentro de su plazo).
 * Todo en el Durable Object «inv|todos» (invitar.js); sin él, 503. Los números, en «invitar» de limites.json.
 */
const objInv = (env) => env.QR.get(env.QR.idFromName('inv|todos'));
export async function cfgInv() { return cfgInvitar(await limitesJson()); }
/** espera una promesa como mucho `ms`; si no llega, `def` (para que nada de fuera deje colgada una respuesta) */
export const conTope = (p, ms, def = null) => Promise.race([Promise.resolve(p).catch(() => def), new Promise((r) => setTimeout(() => r(def), ms))]);
async function invPedir(env, b) {
  const r = await objInv(env).fetch('https://freno/inv', { method: 'POST', body: JSON.stringify({ ...b, cfg: b.cfg || (await cfgInv()), ahora: Date.now(), dia: hoyMadrid() }) });
  return r.json();
}
/** la primera vez que se vio la cuenta en la app (KV de /hola), o 0 si nunca */
async function primeraVez(env, uid) {
  let t = 0;
  for (const k of [`r:${uid}`, `p:${uid}`]) {
    try { const x = await env.VINCULOS.getWithMetadata(k); const p = Number(x && x.metadata && x.metadata.primera) || 0; if (p && (!t || p < t)) t = p; } catch (e) { /* nada */ }
  }
  return t;
}
// los premios de cada cuenta en la memoria del Worker (5 min), para que /plan y /pregunta no le pregunten al objeto cada vez
const PREMIOS_MEM = new Map();
export async function premiosDe(env, uid) {
  const m = PREMIOS_MEM.get(uid);
  if (m && Date.now() - m.t < 5 * 60e3) return m.p;
  let p = {};
  if (env.QR) { try { const r = await invPedir(env, { op: 'estado', uid }); if (r && r.ok) p = r.premios || {}; } catch (e) { /* sin premios */ } }
  if (PREMIOS_MEM.size > 5000) PREMIOS_MEM.clear();
  PREMIOS_MEM.set(uid, { t: Date.now(), p });
  return p;
}
/** el cupo del día con la semana doble (si la tiene): gratis y máximo por dos */
export async function cupoConPremio(env, uid, P) {
  const p = await premiosDe(env, uid);
  return premioActivo({ premios: p }, 'doble') ? { ...P, gratis: P.gratis * 2, max: P.max * 2, doble: true } : P;
}
async function invitar(req, env, c, ruta) {
  if (!env.QR) return json({ e: 'Las invitaciones no están disponibles ahora.', servicio: true }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga', sesion: true }, 401, c);
  const escribe = req.method === 'POST';
  if (!(await cabeAhora(env, 'FRENO_ESCRIBIR', `inv${escribe ? 'w' : 'r'}|${u.uid}`, escribe ? FRENOS.canjear.min : FRENOS.invitar.min))) return demasiadas(c);
  const cfg = await cfgInv();
  if (ruta === '/invitar' && req.method === 'GET') return json(await invPedir(env, { op: 'estado', uid: u.uid, cfg, primera: await primeraVez(env, u.uid) }), 200, c);
  if (!escribe) return json({ e: 'No existe' }, 404, c);
  const b = (await req.json().catch(() => ({}))) || {};
  if (ruta === '/invitar/codigo') {
    if (!cfg.on) return json({ e: 'Las invitaciones están paradas ahora.' }, 503, c);
    const r = await invPedir(env, { op: 'codigo', uid: u.uid, cfg });
    return json(r, r.ok ? 200 : 503, c);
  }
  if (ruta === '/invitar/canjear') {
    const liga = String(b.liga || '');
    if (!/^\d{1,20}$/.test(liga)) return json({ e: 'Entra antes en tu liga de LaLiga Fantasy y vuelve a probar.', motivo: 'liga' }, 400, c);
    const ids = await miembros(req, liga);
    const r = await invPedir(env, { op: 'canjear', uid: u.uid, cod: limpiarCod(b.cod), enLiga: !!(ids && ids.includes(String(u.uid))), primera: await primeraVez(env, u.uid), cfg });
    if (r.ok) console.log('invitar: canjeado');
    return json(r, r.ok ? 200 : 400, c);
  }
  if (ruta === '/invitar/rivales') {
    const r = await invPedir(env, { op: 'rivales', uid: u.uid, i: Number(b.i), liga: String(b.liga || ''), tids: b.tids, cfg });
    return json(r, r.ok ? 200 : 400, c);
  }
  return json({ e: 'No existe' }, 404, c);
}

/* ---------- los apodos de los rivales en todos tus dispositivos (19 nov) ---------- */
/*
 * GET  /apodos?liga=L          los apodos de esa liga guardados con tu cuenta: { a: { tid: { v, t } } } (v vacío: borrado).
 * POST /apodos { liga, a }     junta lo que traes ({ tid: { v, t } }) con lo guardado, rival a rival (gana lo más reciente),
 *                              y devuelve lo que queda. Con la sesión de LaLiga: es tu cuenta, la del móvil y la de la web.
 * En el Durable Object de la cuenta («apodos|uid»); sin él, 503 (la app sigue con los suyos, como antes).
 */
async function apodos(req, env, c) {
  if (!env.QR) return json({ e: 'Sin almacén' }, 503, c);
  const u = await quienEs(req);
  if (!u) return json({ e: 'Hace falta tu sesión de LaLiga', sesion: true }, 401, c);
  if (!(await cabeAhora(env, 'FRENO_ESCRIBIR', `apodos|${u.uid}`, FRENOS.apodos.min))) return demasiadas(c);
  const obj = env.QR.get(env.QR.idFromName(`apodos|${u.uid}`));
  const pedir = async (b) => (await obj.fetch('https://freno/apodos', { method: 'POST', body: JSON.stringify({ ...b, ahora: Date.now() }) })).json();
  if (req.method === 'GET') {
    const liga = new URL(req.url).searchParams.get('liga') || '';
    if (!ligaOk(liga)) return json({ e: 'Liga no válida' }, 400, c);
    return json(await pedir({ op: 'leer', liga }), 200, c);
  }
  if (Number(req.headers.get('content-length') || 0) > 30000) return json({ e: 'Demasiado grande' }, 413, c);
  const txt = await req.text();
  if (txt.length > 30000) return json({ e: 'Demasiado grande' }, 413, c);
  let b = null;
  try { b = JSON.parse(txt); } catch (e) { b = null; }
  if (!b || !ligaOk(b.liga)) return json({ e: 'Liga no válida' }, 400, c);
  const r = await pedir({ op: 'juntar', liga: String(b.liga), a: b.a });
  return json(r, r.ok ? 200 : 400, c);
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
      uid: u.uid, nombre: corta(u.nombre, 40), equipo: corta(b.equipo, 40), liga: corta(b.liga, 20) || (m && m.liga) || '', v: corta(b.v, 12),
      canal: corta(b.canal, 8), app: Math.max(0, Math.round(Number(b.app) || 0)),
      primera: (m && m.primera) || ahora, ultima: ahora, n: ((m && m.n) || 0) + 1,
      foto: u.foto || '',
      // por qué no se le pone la web nueva (el último fallo de AlDia en su móvil, desde la 0.7.6)
      ...(b.ad ? { ad: corta(b.ad, 90) } : {}),
      // por qué no le carga la liga (16 nov): el tipo de error y el principio del mensaje, solo con la versión acabada en « !»
      ...(b.fc && / !$/.test(String(b.v || '')) ? { fc: corta(b.fc, 60) } : {}),
      // la pantalla de bienvenida ya vista (Carlos, 9 nov 10:20: una vez por cuenta, también en otro dispositivo): cuándo
      ...(((m && m.bv) || b.bv) ? { bv: (m && m.bv) || ahora } : {}),
    };
    // (Cloudflare deja unas mil escrituras al día gratis y las comparte con los códigos de entrar y los avisos: cada cuenta,
    // como mucho una por hora, salvo que cambie la versión o el equipo; alternar app y web ya no escribe cada vez, y si
    // el almacén no deja, se sigue sin más; revisión del 29 oct)
    // (y los cambios, como mucho CAMBIOS_DIA al día por cuenta: antes, alternar la versión escribía cada vez; revisión
    // total, C1. Con más, el cambio entra en la escritura de cada hora)
    const cambia = !!m && (m.v !== nuevo.v || m.equipo !== nuevo.equipo || (m.foto || '') !== nuevo.foto || (m.ad || '') !== (nuevo.ad || '') || (m.fc || '') !== (nuevo.fc || ''));
    // (la bienvenida vista se escribe siempre, aunque no quepan más cambios hoy: es una vez por cuenta)
    const bvNueva = !!nuevo.bv && !(m && m.bv);
    // (la liga, igual, una vez por cuenta: el primer aviso sale a veces antes de que la app tenga la liga, y sin esto se quedaba
    // «sin liga» hasta la siguiente escritura de la hora; 17 nov)
    const ligaNueva = !!nuevo.liga && !!m && !m.liga;
    const dia = hoyMadrid(), cambiosHoy = m && m.dc === dia ? Number(m.nc) || 0 : 0;
    const cabeCambio = cambia && cambiosHoy < CAMBIOS_DIA;
    if (cambiosHoy || cabeCambio) { nuevo.dc = dia; nuevo.nc = cambiosHoy + (cabeCambio ? 1 : 0); }
    if (!m || cabeCambio || bvNueva || ligaNueva || ahora - (m.ultima || 0) > 60 * 60e3) { try { await env.VINCULOS.put(k, '1', { expirationTtl: VIVE_HOLA, metadata: nuevo }); } catch (e) { /* nada */ } }
    const evOk = await registrar(env, u.uid, nuevo.canal, (m && m.primera) || ahora, ahora, b.ev);
    // (admin: para que la web enseñe al dueño «Quién usa la app» sin haber abierto antes los avisos de fallo)
    return json({ ok: true, admin: adminsDe(env).includes(u.uid), ev: evOk, ...(nuevo.bv ? { bv: nuevo.bv } : {}) }, 200, c);
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
    // (20 nov, Carlos: «de repente no me funciona esta pestaña»: tardaba 112 s con 74 cuentas y la app corta a los 20) lo
    // de fuera, con tiempo máximo, y cuánto tarda cada parte en `tiempos` (ms) para saber cuál se atasca
    const t0 = Date.now(), tiempos = {};
    const marca = (k) => { tiempos[k] = Date.now() - t0; };
    const dia = hoyMadrid();
    const ks = (await listar(env, 'p:', 20000)).filter((k) => k.metadata);
    marca('cuentas');
    ks.sort((a, b) => (b.metadata.ultima || 0) - (a.metadata.ultima || 0));
    // (19 nov, Carlos: «quiero ver exactamente cuántos han entrado, al día, cuántos nuevos y el tiempo que pasan dentro, sí
    // o sí») el tiempo de cada día, de TODAS las cuentas: hoy de todas y los 6 días de antes de las que han entrado esta
    // semana, hasta el día de su última vez (después no pudo usarla). Se leen de 100 en 100 con la lectura en bloque de
    // KV, que cuenta como UNA operación para el tope de mil por petición (antes, una a una y solo de las 40 últimas: con
    // 50+ cuentas en la semana los días de atrás salían bajos, el lunes de 27 a 20)
    const dias = diasAtras(dia, 7), hace7 = Date.now() - 7 * 86400e3;
    const aLeer = ks.map((k) => {
      if ((k.metadata.ultima || 0) < hace7) return [dia];
      const hasta = diaMadrid(k.metadata.ultima || Date.now());
      return dias.filter((d) => d === dia || d <= hasta);
    });
    const claves = [];
    ks.forEach((k, i) => aLeer[i].forEach((d) => claves.push(`u:${k.metadata.uid}:${d}`)));
    const leido = await conTope(leerEnBloque(env, claves), 8000, new Map());
    marca('usos');
    const usos = ks.map((k, i) => {
      const o = {};
      for (const d of aLeer[i]) {
        const kk = `u:${k.metadata.uid}:${d}`;
        const v = Math.min(86400, (Number(leido.get(kk)) || 0) + (PEND_USO.get(kk) || 0));
        if (v) o[d] = v;
      }
      return o;
    });
    const lista = ks.map((k, i) => ({ ...k.metadata, segHoy: usos[i][dia] || 0, segDias: usos[i] }));
    // todas las cuentas que han entrado alguna vez: la ficha de r:, y quien aún no la tiene (no ha abierto la app desde
    // que existe), con lo de p:
    const reg = new Map((await listar(env, 'r:', 50000)).filter((k) => k.metadata).map((k) => [String(k.metadata.uid), k.metadata]));
    marca('registro');
    for (const x of lista) {
      const r = reg.get(String(x.uid));
      if (!r) reg.set(String(x.uid), { uid: x.uid, primera: x.primera, ultima: x.ultima, canales: x.canal || '', dias: 0 });
      else if ((x.ultima || 0) > (r.ultima || 0)) reg.set(String(x.uid), { ...r, ultima: x.ultima });
    }
    // (19 nov) las invitaciones de cada cuenta: cuántos entran y cuántos vuelven otro día, para ver si alguien abusa
    let invitar = null;
    const [inv, embudo] = await Promise.all([env.QR ? conTope(invPedir(env, { op: 'todos' }), 6000) : null, conTope(leerEmbudo(env), 6000)]);
    invitar = inv;
    marca('fin');
    return json({ lista, registro: [...reg.values()], ahora: Date.now(), dias, embudo, invitar, tiempos }, 200, c);
  }
  return json({ e: 'No existe' }, 404, c);
}

// El reloj del bot de X: el cron de GitHub Actions no dispara (2 nov, 0 ejecuciones por schedule), así que este Worker,
// con su cron de wrangler.toml, lanza «Bot X» en main cada 5 min con la API de GitHub. Token de grano fino solo para
// este repo con Actions: lectura y escritura, en el secreto BOT_DISPATCH_TOKEN (lo pone worker.yml). Sin él, no hace nada.
// Si ya hay una ejecución en marcha, la nueva espera (concurrency bot-x en bot.yml): no se pisan.
const BOT_FLUJO = 'https://api.github.com/repos/charly10sf/fantasy-manager/actions/workflows/bot.yml/dispatches';

// El portal de datos de la web (16 nov): el cron de «Portal web» (portal-web.yml) tampoco ha disparado nunca, así que este
// Worker lo lanza igual, con el mismo token: a las 00:47 (después del mercado de las 00:15) y a las 07:13 de Madrid. Los dos
// crons van en UTC y cubren verano e invierno; `tocaPortal` descarta la franja que no toca. Si ya hay una ejecución
// (concurrency portal-web), la nueva espera. portal-web.yml sigue con su schedule por si algún día funciona: entre las dos
// no se pisan.
const PORTAL_FLUJO = 'https://api.github.com/repos/charly10sf/fantasy-manager/actions/workflows/portal-web.yml/dispatches';
export const CRON_PORTAL = ['47 22,23 * * *', '13 5,6 * * *'];
export function tocaPortal(t) {
  const [h, m] = HM.format(new Date(t)).split(':').map(Number);
  return (h === 0 && m === 47) || (h === 7 && m === 13);
}

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

export async function lanzarBot(env, pedir = fetch, inputs = null, flujo = BOT_FLUJO) {
  const token = env.BOT_DISPATCH_TOKEN;
  if (!token) return { ok: false, motivo: 'sin BOT_DISPATCH_TOKEN' };
  const r = await pedir(flujo, {
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
  throw new Error(`GitHub contestó ${r.status} al lanzar «${flujo === PORTAL_FLUJO ? 'Portal web' : 'Bot X'}»: ${texto}`);
}

// qué freno por IP lleva cada ruta (FRENOS)
/* ---------- el semáforo de LaLiga y la entrada paso a paso (0.7.13i) ---------- */
// Todo en un solo Durable Object («embudo|todos»): las cuentas de cada día (e|AAAA-MM-DD → { canal: { paso: n }, 'o:x': … }),
// las entradas de cada hora para el semáforo (h|AAAA-MM-DDTHH → { ok, x }) y la última comprobación (est). Nunca pone alarma:
// lo viejo se borra al leer.
// (21 nov) pasos nuevos: «llega» (la web: llega sin sesión; «ver» pasa a ser «el bloque de entrar a la vista»), «v» (la web:
// vuelve de la pestaña de LaLiga), «x-vuelve» (la app de Android: vuelve de LaLiga sin el código, porque eligió la otra app en
// «Abrir con», LaLiga dio error o cerró la pestaña) «inicio» (el iPhone: pasa la sesión a la pantalla de inicio) y «saf» (el iPhone dentro de X o Instagram: toca «Abrir en Safari»)
export const EMB_PASOS = new Set(['llega', 'v', 'x-vuelve', 'inicio', 'saf', 'ver', 'demo', 'play', 'l', 'p', 'ok', 'x-cancel', 'x-caduca', 'x-laliga', 'x-redirect', 'x-perdido', 'x-red', 'x-otro']);
export const EMB_CANALES = new Set(['play', 'github', 'web-android', 'web-iphone', 'web-pc']);
const EMB_DIAS = 60, EMB_VER = 14, EMB_ORIGENES = 20, ESTADO_CADA = 120e3, ESTADO_TIEMPO = 8000;
const horaMadridF = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' });
const horaMadrid = (t = Date.now()) => `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t))}T${horaMadridF.format(new Date(t)).padStart(2, '0')}`;
const objEmbudo = (env) => env.QR.get(env.QR.idFromName('embudo|todos'));

/** prueba cada cosa de PRUEBAS desde el Worker */
export async function probarLaLiga(f = fetch) {
  const vez = async (p) => {
    const t0 = Date.now();
    try {
      const r = await f(p.url, { method: p.metodo, headers: p.cabeceras, body: p.cuerpo || undefined, signal: AbortSignal.timeout(ESTADO_TIEMPO), redirect: 'manual' });
      const txt = await r.text();
      return resultado(p, r.status, txt, Date.now() - t0);
    } catch (e) { return resultado(p, 0, '', Date.now() - t0); }
  };
  // (la página de entrar de LaLiga da a veces un 503 suelto, como el «falla a la primera» al entrar: solo cuenta como caída
  // si falla también la segunda; si la segunda va, cuenta lo que tardó)
  const una = async (p) => { const a = await vez(p); return a.e === 'mal' ? vez(p) : a; };
  const [login, api, cuenta] = await Promise.all([una(PRUEBAS.login), una(PRUEBAS.api), una(PRUEBAS.cuenta)]);
  return { login, api, cuenta };
}
/** lo que hace el objeto: sumar un paso, leer los días y el estado */
async function embudoObjeto(st, ruta, req, memo) {
  if (ruta === '/embudo/sumar') {
    const b = await req.json().catch(() => null);
    if (!b || !EMB_PASOS.has(b.p) || !EMB_CANALES.has(b.k) || !/^\d{4}-\d\d-\d\d$/.test(b.d || '')) return new Response('mal', { status: 400 });
    const kd = `e|${b.d}`, x = (await st.get(kd)) || {};
    const sumar = (g) => { const o = x[g] || (x[g] = {}); o[b.p] = (o[b.p] || 0) + 1; };
    sumar(b.k);
    const o = typeof b.o === 'string' && /^[a-z0-9_-]{1,24}$/.test(b.o) ? b.o : '';
    if (o && (x[`o:${o}`] || Object.keys(x).filter((k) => k.startsWith('o:')).length < EMB_ORIGENES)) sumar(`o:${o}`);
    await st.put(kd, x);
    if (b.p === 'ok' || b.p === 'x-laliga') {
      const kh = `h|${b.h}`, y = (await st.get(kh)) || {};
      y[b.p === 'ok' ? 'ok' : 'x'] = (y[b.p === 'ok' ? 'ok' : 'x'] || 0) + 1;
      await st.put(kh, y);
    }
    return new Response('ok', { status: 200 });
  }
  if (ruta === '/embudo/leer') {
    const viejos = [...(await st.list({ prefix: 'e|', end: `e|${diaHace(EMB_DIAS)}`, limit: 500 })).keys()];
    for (let i = 0; i < viejos.length; i += 128) await st.delete(viejos.slice(i, i + 128));
    const dias = {};
    for (const [k, v] of await st.list({ prefix: 'e|', reverse: true, limit: EMB_VER })) dias[k.slice(2)] = v;
    return new Response(JSON.stringify({ dias }), { status: 200 });
  }
  if (ruta === '/estado') {
    const ya = memo.est || (await st.get('est'));
    if (ya && Date.now() - ya.t < ESTADO_CADA) return new Response(JSON.stringify(ya), { status: 200 });
    // (dos a la vez: la segunda espera a la primera)
    if (!memo.mirando) {
      memo.mirando = (async () => {
        const p = await probarLaLiga();
        const ahora = Date.now(), horas = [horaMadrid(ahora), horaMadrid(ahora - 3600e3)];
        const entradas = { ok: 0, x: 0 };
        for (const h of horas) { const y = await st.get(`h|${h}`); if (y) { entradas.ok += y.ok || 0; entradas.x += y.x || 0; } }
        const viejas = [...(await st.list({ prefix: 'h|', end: `h|${horaMadrid(ahora - 48 * 3600e3)}`, limit: 200 })).keys()];
        if (viejas.length) await st.delete(viejas.slice(0, 128));
        const est = { nivel: nivelDe(p, entradas), t: ahora, ...p, entradas };
        await st.put('est', est);
        memo.est = est;
        return est;
      })().finally(() => { memo.mirando = null; });
    }
    return new Response(JSON.stringify(await memo.mirando), { status: 200 });
  }
  return null;
}
// sin el objeto (si Cloudflare no dejó crearlo): el estado en la memoria del Worker, sin las entradas
let ESTADO_MEM = null;
async function estadoLaLiga(env, c) {
  const cab = { ...c, 'cache-control': 'no-store' };
  if (env.QR) {
    try {
      const r = await objEmbudo(env).fetch('https://embudo/estado');
      if (r.status === 200) return new Response(await r.text(), { status: 200, headers: { ...cab, 'content-type': 'application/json' } });
    } catch (e) { /* a la memoria */ }
  }
  if (!ESTADO_MEM || Date.now() - ESTADO_MEM.t > ESTADO_CADA) { const p = await probarLaLiga(); ESTADO_MEM = { nivel: nivelDe(p), t: Date.now(), ...p, entradas: null }; }
  return json(ESTADO_MEM, 200, cab);
}
async function embudoApunte(req, env, c) {
  const txt = await req.text();
  if (txt.length > 400) return json({ e: 'Demasiados datos' }, 413, c);
  let b;
  try { b = JSON.parse(txt); } catch (e) { return json({ e: 'No es JSON' }, 400, c); }
  if (!b || !EMB_PASOS.has(b.p) || !EMB_CANALES.has(b.k)) return json({ e: 'Paso no válido' }, 400, c);
  if (!env.QR) return json({ ok: false }, 200, c);
  const r = await objEmbudo(env).fetch('https://embudo/embudo/sumar', { method: 'POST', body: JSON.stringify({ p: b.p, k: b.k, o: b.o || '', d: hoyMadrid(), h: horaMadrid() }) });
  return json({ ok: r.status === 200 }, 200, c);
}
/** los 14 últimos días, para «Quién usa la app» (null si no se puede) */
async function leerEmbudo(env) {
  if (!env.QR) return null;
  try { const r = await objEmbudo(env).fetch('https://embudo/embudo/leer'); return r.status === 200 ? await r.json() : null; } catch (e) { return null; }
}

const FRENO_RUTA = {
  'POST /vincular': 'vincular', 'POST /vincular/usar': 'usar', 'POST /qr/dejar': 'qrDejar', 'GET /qr/esperar': 'qrEsperar', 'POST /fallos': 'falloNuevo',
  'POST /dinero': 'dinero', 'GET /dinero/cal': 'dineroCal',
  'POST /pujas': 'pujas', 'GET /pujas/cal': 'pujasCal',
  'POST /embudo': 'embudo', 'GET /estado': 'estado',
};

export default {
  async scheduled(evento, env, ctx) {
    if (CRON_PORTAL.includes(evento.cron)) {
      if (!tocaPortal(evento.scheduledTime)) return;
      ctx.waitUntil(lanzarBot(env, fetch, null, PORTAL_FLUJO).then((r) => { if (!r.ok) console.log('Portal web no lanzado:', r.motivo); }));
      return;
    }
    let inputs = null;
    if (evento.cron === CRON_MERCADO) {
      if (!tocaMercado(evento.scheduledTime)) return;
      inputs = { tipos: 'mercado' };
    }
    ctx.waitUntil(lanzarBot(env, fetch, inputs).then((r) => { if (!r.ok) console.log('Bot X no lanzado:', r.motivo); }));
  },

  async fetch(req, env, ctx) {
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
      if (url.pathname === '/plan' && req.method === 'POST') return await planIA(req, env, c, ctx);
      if (url.pathname === '/pregunta' && req.method === 'POST') return await preguntaIA(req, env, c, ctx);
      // (15 nov) el plan de un pedido, para el aviso del móvil con la app en segundo plano (Recoger.java): { fin } o { marcha }
      if (url.pathname === '/plan/res' && req.method === 'GET') {
        const u = await quienEs(req);
        if (!u) return json({ e: 'Sin sesión' }, 401, c);
        const x = await resPlan(env, u.uid, 'leer', url.searchParams.get('rid') || '');
        return json(x.fin ? { fin: x.fin } : { marcha: !!(x.marcha && Date.now() - x.marcha < RES_MARCHA_MS) }, 200, c);
      }
      // (16 nov) lo mismo con una pregunta del chat (Recoger.java, desde la 0.8): { fin: { resumen } } o { marcha }
      if (url.pathname === '/pregunta/res' && req.method === 'GET') {
        const u = await quienEs(req);
        if (!u) return json({ e: 'Sin sesión' }, 401, c);
        const x = await resPlan(env, u.uid, 'leer', url.searchParams.get('rid') || '', null, 'preg');
        return json(x.fin ? { fin: x.fin.texto ? { resumen: x.fin.resumen || resumenRespuesta(x.fin.texto) } : { e: x.fin.e || '' } } : { marcha: !!(x.marcha && Date.now() - x.marcha < RES_MARCHA_MS) }, 200, c);
      }
      if (url.pathname === '/dinero' && req.method === 'POST') return await dineroApunte(req, env, c);
      if (url.pathname === '/dinero/cal' && req.method === 'GET') return await dineroCal(env, c);
      if (url.pathname === '/pujas' && req.method === 'POST') return await pujasApunte(req, env, c);
      if (url.pathname === '/pujas/cal' && req.method === 'GET') return await pujasCal(env, c);
      if (url.pathname === '/embudo' && req.method === 'POST') return await embudoApunte(req, env, c);
      if (url.pathname === '/estado' && req.method === 'GET') return await estadoLaLiga(env, c);
      if (url.pathname === '/hola' || url.pathname === '/hola/todos' || url.pathname === '/caras') return await hola(req, env, c, url.pathname);
      if (url.pathname === '/invitar' || url.pathname.startsWith('/invitar/')) return await invitar(req, env, c, url.pathname);
      if (url.pathname === '/apodos' && (req.method === 'GET' || req.method === 'POST')) return await apodos(req, env, c);
      if (url.pathname === '/') return json({ ok: true, app: 'Fantasy Manager', kv: !!env.VINCULOS, qr: env.QR ? 'objeto' : env.VINCULOS ? 'kv' : 'no', avisos: !!env.VINCULOS, dueno: adminsDe(env).length > 0 }, 200, c);
      return json({ e: 'No existe' }, 404, c);
    } catch (e) {
      if (esKVLleno(e)) return json({ e: KV_LLENO, lleno: true }, 503, c);
      return json({ e: String((e && e.message) || e) }, 500, c);
    }
  },
};
