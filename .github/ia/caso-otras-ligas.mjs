// (26 nov, Carlos: «la demanda de otras ligas y lo que se paga en otras ligas por un jugador se puede hacer todo en uno»)
// Lo que solo se ve juntando todas las ligas: web/js/otras-ligas.js, lo de app.js que lo manda y lo lee, la línea de la ficha
// (hojas.js) y, detrás, EL WORKER DE VERDAD (worker/src/index.js con worker/src/ligas.js) sobre un SQLite de mentira.
// Lo que tiene que pasar:
//  (a) las compras se mandan con el id del jugador y la huella de la liga, una vez; las de antes (sin jugador) se mandan otra
//      vez una sola vez; con un servidor de antes (no contesta `jug`) se quedan para otro día;
//  (b) la demanda: los libres con sus pujas, solo si ha cambiado algo y como mucho cada media hora; un fallo espera una hora;
//  (c) las cláusulas que se abren: se apunta lo último visto antes de abrirse y se manda pasadas las 24 h con si se lo
//      llevaron; si cambió de dueño de otra forma, o la actividad no llega, no se manda nada;
//  (d) de lo que sale del móvil: ni el id de la liga, ni un mánager, ni un equipo, ni un nombre;
//  (e) con «Ayudar a mejorar la IA» apagado, o en la liga de ejemplo, no sale nada;
//  (f) APAGADO en limites.json (como se publica): ni se pide lo de las demás ligas ni sale nada en la ficha;
//  (g) encendido: la ficha de un libre dice lo pagado en las demás ligas (con 3 ligas o más y sin la tuya) y, si está
//      encendida, la demanda como un nivel; lo leído para otra liga tuya no vale; a la IA no le llega nada de esto;
//  (h) los textos, tal cual;
//  (i) la medida (.github/ia/medir-otras-ligas.mjs): su copia de `M.pagaLiga` da lo mismo que el motor, y con datos
//      inventados a propósito dice «sí» cuando lo de las demás ligas ayuda, «no» cuando no y «aún no se sabe» con pocos.
// Sin IA ni red. Uso: node .github/ia/caso-otras-ligas.mjs   (PW_MODULO y CHROME como en prueba-web.mjs; CAPTURAS=carpeta
// guarda la ficha con la línea encendida en móvil, iPhone y ordenador). Sale con 1 si algo falla.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { objetos } from '../../worker/prueba/objeto.mjs';
import * as MD from './medir-otras-ligas.mjs';

const pw = await import(process.env.PW_MODULO || 'playwright').catch(() => import('playwright-core'));
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = http.createServer(async (q, r) => {
  const ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const b = await readFile(join(WEB, ruta.endsWith('/') ? `${ruta}index.html` : ruta)); r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b); } catch (e) { r.writeHead(404); r.end('no'); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
let mal = 0;
const ok = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) mal++; };

/* ---------- el Worker de verdad, con sus objetos de mentira (SQLite de verdad) ---------- */
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => true } };
const fetchReal = globalThis.fetch;
let limW = { ligas: [] };
// la cuenta de la página es la 7001; «d…», el dueño
globalThis.fetch = async (u, o) => {
  const s = String(u), tk = String((o && o.headers && new Headers(o.headers).get('authorization')) || '').replace('Bearer ', '');
  if (s.includes('/user/me')) return new Response(JSON.stringify({ id: tk.startsWith('d') ? 667015 : 7001, managerName: 'Prueba' }), { status: 200 });
  if (s.includes('limites.json')) return new Response(JSON.stringify(limW), { status: 200 });
  return fetchReal(u, o);
};
const WM = await import('../../worker/src/index.js');
const QR = objetos(WM.Emparejar); QR.env = {};
const envW = { ADMINS: '667015', QR };
const db = () => { QR.get('ligas|todos'); return QR.hay.get('ligas|todos').db; };
const sql = (q, ...a) => db().prepare(q).all(...a);
const DIAM = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
const obj = async (b) => (await QR.get('ligas|todos').fetch('https://x/ligas', { method: 'POST', body: JSON.stringify({ ahora: Date.now(), dia: DIAM.format(new Date()), ...b }) })).json();
// (las tablas del objeto se hacen con su primera petición)
await obj({ op: 'ver', l: '0'.repeat(24), ids: [] });
// lo que llega al servidor desde la página (para mirar que no lleva nada de nadie) y cómo contesta
const llegadas = [];
const modo = { viejo: false, caido: false };

const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const sesion = JSON.stringify({ token: 't'.repeat(40), renovar: 'r'.repeat(40), caduca: Date.now() + 864e5, desde: Date.now() });
async function navegador({ ancho = 390, alto = 844, ua = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, timezoneId: 'Europe/Madrid', locale: 'es-ES', ...(ua ? { userAgent: ua } : {}) });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
  await ctx.route('https://fantasy-manager.fantasymanager-web-app.workers.dev/**', async (r) => {
    const q = r.request(), u = new URL(q.url());
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const deLigas = u.pathname === '/pujas' || u.pathname.startsWith('/ligas');
    if (!deLigas) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true}' });
    llegadas.push({ ruta: u.pathname, cuerpo: q.postData() || '', dir: q.url() });
    if (modo.caido) return r.abort('internetdisconnected');
    const resp = await WM.default.fetch(new Request(`https://w.dev${u.pathname}${u.search}`, { method: q.method(), headers: { Origin: BASE, 'content-type': 'application/json', Authorization: q.headers().authorization || '', 'cf-connecting-ip': `10.7.0.${llegadas.length % 250}` }, body: q.method() === 'POST' ? q.postData() : undefined }), envW, { waitUntil() {} });
    let texto = await resp.text();
    // (un servidor de antes del 26 nov: /pujas contesta sin `jug`)
    if (modo.viejo && u.pathname === '/pujas') { const j = JSON.parse(texto); delete j.jug; texto = JSON.stringify(j); }
    return r.fulfill({ status: resp.status, headers: { ...cors, 'content-type': 'application/json' }, body: texto });
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript(`if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-tema-aviso', '1'); localStorage.setItem('fm-beta-aviso', '1'); localStorage.setItem('fm-worker', 'https://fantasy-manager.fantasymanager-web-app.workers.dev'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-n-sesion', ${JSON.stringify(sesion)}); }`);
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M && window.__fmLigas, null, { timeout: 30000 });
  return { ctx, page, errores };
}
const P = await navegador();
const en = (f, x) => P.page.evaluate(f, x);
const de = (ruta) => llegadas.filter((x) => x.ruta === ruta);
/** el interruptor de limites.json, en la página (lo que lee la app) y en el servidor (que lo lee cada 10 minutos: se le quita lo leído) */
let salto = 0;
async function interruptor(otras) {
  limW = otras ? { ligas: [], otrasLigas: otras } : { ligas: [] };
  // (cada vez, 11 minutos más allá de la última lectura del servidor)
  salto += 11 * 60e3;
  const real = Date.now, mas = salto; Date.now = () => real() + mas;
  try { await WM.cfgOtrasLigas(envW, '1'); } finally { Date.now = real; }
  await en(async (o) => {
    const { LS } = await import('./js/util.js');
    const g = LS.get('limites', null) || { cfg: {} };
    const cfg = { ...(g.cfg || {}) };
    if (o) cfg.otrasLigas = o; else delete cfg.otrasLigas;
    LS.set('limites', { ...g, cfg });
  }, otras);
}

try {
  /* ---- (e) en la liga de ejemplo no sale nada ---- */
  await en(async () => { await window.__fmLigas.compras(); await window.__fmLigas.ligas(); await window.__fmLigas.otras(); });
  ok(llegadas.length === 0, `en la liga de ejemplo no se manda ni se pide nada (${llegadas.length})`);

  // fuera de la liga de ejemplo: la misma liga, como si fuera la de una cuenta de verdad (y a quién se le pinta: no es demo)
  const liga = await en(async () => {
    localStorage.setItem('fm-demo', 'false');
    const Li = await import('./js/limite.js');
    Li.fijarYo(window.S.M.yo || { teamId: window.S.D.yo.teamId, nombre: 'Yo' }, false);
    // (la liga de ejemplo no dice de qué clase es: sin eso no se manda ni se pide nada; después, una privada normal)
    await window.__fmLigas.compras(); await window.__fmLigas.ligas();
    window.__sinTipo = { pujas: (await import('./js/util.js')).LS.get((await import('./js/datos.js')).K('pujas-mandadas'), null) };
    return { id: window.S.D.liga.id, nombre: window.S.D.liga.nombre, compras: (window.S.M.comprasLiga || []).length, libres: window.S.M.mercado.filter((m) => m.tipo === 'liga').map((m) => [Number(m.pid), m.pujas]), equipos: window.S.D.clasif.map((e) => [String(e.teamId), e.nombre, e.manager]) };
  });

  // sin saber la clase de la liga: las compras van como siempre (sin la huella de la liga: el servidor no apunta nada por
  // jugador) y se quedan «sin jugador»; la demanda y las cláusulas, ni se mandan
  const sinTipo = await en(async () => { const { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js'); const OL = await import('./js/otras-ligas.js'); const r = window.__sinTipo.pujas; LS.del(K('pujas-mandadas')); window.S.D.liga.acceso = 'private'; window.S.D.liga.tipo = '8'; return { r, tipos: [OL.tipoLiga(null), OL.tipoLiga({ acceso: 'private', tipo: '8' }), OL.tipoLiga({ acceso: 'Public', tipo: 12, premium: true }), OL.tipoLiga({ acceso: 'a b<c>', tipo: '' }), OL.tipoLiga({ premium: true })] }; });
  const cs = de('/pujas').length ? JSON.parse(de('/pujas')[0].cuerpo) : {};
  ok(de('/pujas').length === 1 && !('l' in cs) && !('t' in cs) && de('/ligas').length === 0 && sinTipo.r && !sinTipo.r.jug && sql('SELECT COUNT(*) AS c FROM pago')[0].c === 0, `sin saber de qué clase es la liga: las compras como siempre y nada para lo de todas las ligas (${de('/pujas').length} y ${de('/ligas').length})`);
  ok(JSON.stringify(sinTipo.tipos) === '["","private|8|n","public|12|p","abc||n",""]', `la clase de la liga: acceso, tipo y si es Premium (${JSON.stringify(sinTipo.tipos)})`);
  llegadas.length = 0;

  /* ---- (e) con «Ayudar a mejorar la IA» apagado, nada ---- */
  await en(async () => { const So = await import('./js/soporte.js'); So.ponerMejorarIA(false); await window.__fmLigas.compras(); await window.__fmLigas.ligas(); So.ponerMejorarIA(true); });
  ok(llegadas.length === 0, `con «Ayudar a mejorar la IA» apagado no se manda nada (${llegadas.length})`);

  /* ---- (a) las compras, con su jugador ---- */
  // un servidor de antes: entran como siempre, pero se quedan apuntadas «sin jugador» para mandarlas cuando lo mire
  modo.viejo = true;
  let reg = await en(async () => { const { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js'); await window.__fmLigas.compras(); return LS.get(K('pujas-mandadas'), null); });
  modo.viejo = false;
  ok(de('/pujas').length === 1 && reg && !reg.jug && Object.keys(reg.c).length === Math.min(80, liga.compras), `con un servidor de antes, las compras se apuntan sin jugador (${JSON.stringify(reg && { jug: reg.jug, n: Object.keys(reg.c).length })})`);
  // el mismo día no se repite; al día siguiente, ya con el servidor nuevo, van otra vez (una sola) con su jugador
  await en(() => window.__fmLigas.compras());
  ok(de('/pujas').length === 1, 'el mismo día no se mandan otra vez');
  sql('DELETE FROM pago');
  reg = await en(async () => { const { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js'); LS.set(K('pujas-mandadas'), { ...LS.get(K('pujas-mandadas'), {}), dia: '2000-01-01' }); await window.__fmLigas.compras(); return LS.get(K('pujas-mandadas'), null); });
  const c2 = JSON.parse(de('/pujas')[1].cuerpo);
  ok(de('/pujas').length === 2 && reg.jug === 1 && c2.c.length === Math.min(80, liga.compras) && c2.c.every((x) => Number.isInteger(x.p) && x.p > 0) && /^[0-9a-f]{24}$/.test(c2.l) && c2.t === 'private|8|n', `con el servidor nuevo se mandan otra vez, con el jugador y la huella de la liga (${c2.c.length})`);
  ok(sql('SELECT COUNT(*) AS c FROM pago')[0].c === c2.c.length && sql('SELECT COUNT(DISTINCT lg) AS c FROM pago')[0].c === 1, `y el servidor guarda lo pagado por cada jugador (${sql('SELECT COUNT(*) AS c FROM pago')[0].c} filas, una liga)`);
  await en(async () => { const { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js'); LS.set(K('pujas-mandadas'), { ...LS.get(K('pujas-mandadas'), {}), dia: '2000-01-01' }); await window.__fmLigas.compras(); });
  ok(de('/pujas').length === 2, 'y ya no se repiten: otro día, sin compras nuevas, no se manda nada');

  /* ---- (b) la demanda ---- */
  await en(() => window.__fmLigas.ligas());
  const d1 = de('/ligas').length ? JSON.parse(de('/ligas')[0].cuerpo) : {};
  ok(de('/ligas').length === 1 && JSON.stringify(d1.m) === JSON.stringify([...liga.libres].sort((a, b) => a[0] - b[0])) && d1.l === c2.l && d1.t === 'private|8|n', `la demanda: los ${liga.libres.length} libres con sus pujas (${JSON.stringify(d1.m).slice(0, 80)}…)`);
  ok(sql('SELECT COUNT(*) AS c FROM dem')[0].c === liga.libres.length && sql('SELECT lg FROM dem LIMIT 1')[0].lg === sql('SELECT lg FROM pago LIMIT 1')[0].lg, 'el servidor la guarda con la misma huella de dentro que las compras');
  await en(() => window.__fmLigas.ligas());
  ok(de('/ligas').length === 1, 'sin cambios, no se manda otra vez');
  // cambia una puja: antes de media hora no; pasada, sí
  const env0 = await en(async () => { const { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js'); const m = window.S.M.mercado.find((x) => x.tipo === 'liga'); m.pujas = (m.pujas || 0) + 2; await window.__fmLigas.ligas(); return LS.get(K('ligas-env'), null); });
  ok(de('/ligas').length === 1 && env0.n === 1, 'con un cambio, pero antes de media hora, tampoco');
  await en(async () => { const { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js'); LS.set(K('ligas-env'), { ...LS.get(K('ligas-env'), {}), t: Date.now() - 31 * 60e3 }); await window.__fmLigas.ligas(); });
  ok(de('/ligas').length === 2 && sql('SELECT MAX(mx) AS m FROM dem')[0].m >= 2, 'pasada media hora, se manda el cambio');
  // el servidor no contesta: se espera una hora antes de volver a probar
  modo.caido = true;
  const env1 = await en(async () => { const { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js'); LS.set(K('ligas-env'), { ...LS.get(K('ligas-env'), {}), t: Date.now() - 31 * 60e3 }); const m = window.S.M.mercado.find((x) => x.tipo === 'liga'); m.pujas += 1; await window.__fmLigas.ligas(); await window.__fmLigas.ligas(); return LS.get(K('ligas-env'), null); });
  modo.caido = false;
  ok(de('/ligas').length === 3 && env1.mal > 0, 'si el servidor no contesta, no se insiste (una hora de espera)');

  /* ---- (c) las cláusulas que se abren ---- */
  const ap = await en(async () => {
    const { LS } = await import('./js/util.js'), { K, actHist } = await import('./js/datos.js'), OL = await import('./js/otras-ligas.js');
    const S = window.S, HORA = 36e5, ahora = Date.now();
    const out = {};
    // de verdad, con el motor: lo que está a punto de abrirse se apunta (lo abierto, lo blindado y lo lejano, no)
    const fichas = OL.fichasDe(S.M);
    const r0 = OL.apuntarAperturas({}, fichas, ahora);
    const pronto = fichas.filter((f) => !f.abierta && !f.escudo && f.base > 0 && f.abre > ahora && f.abre - ahora <= OL.AP_ANTES && f.pos <= 4);
    out.motor = { fichas: fichas.length, pronto: pronto.length, apuntadas: Object.keys(r0.reg).length, campos: fichas.every((f) => f.pid != null && f.cl > 0 && f.v > 0 && f.pos >= 1 && typeof f.abierta === 'boolean'), abiertas: fichas.filter((f) => f.abierta).length };
    // el registro: una ya abierta no entra; la misma se pisa con lo último; lo caducado se va
    const f1 = { pid: '7', tid: 'A', base: ahora + 5 * HORA, abre: ahora + 5 * HORA, abierta: false, escudo: false, cl: 30e6, v: 25e6, r: 0.01, pos: 4, tit: 0.9 };
    const a1 = OL.apuntarAperturas(null, [f1, { ...f1, pid: '8', abierta: true }, { ...f1, pid: '9', abre: ahora + 50 * HORA, base: ahora + 50 * HORA }, { ...f1, pid: '10', pos: 5 }, { ...f1, pid: '11', escudo: true }], ahora);
    const a2 = OL.apuntarAperturas(a1.reg, [{ ...f1, v: 26e6 }], ahora + HORA);
    const a3 = OL.apuntarAperturas(a2.reg, [], ahora + 5 * HORA + OL.AP_VENTANA + OL.AP_CADUCA + HORA);
    // solo la primera vez que se abre: la que LaLiga dejó de proteger hace días y solo espera al principio de la jornada, no;
    // la que deja de proteger con las cláusulas ya cerradas por la jornada (se abre al empezar), sí
    const a4 = OL.apuntarAperturas(null, [{ ...f1, pid: '20', base: ahora - 9 * 864e5, abre: ahora + 5 * HORA, veda: ahora - 19 * HORA }, { ...f1, pid: '21', base: ahora - 3 * HORA, abre: ahora + 5 * HORA, veda: ahora - 19 * HORA }, { ...f1, pid: '22', base: ahora - 3 * HORA, abre: ahora + 5 * HORA, veda: null }], ahora);
    out.veda = Object.keys(a4.reg).map((k) => k.split('|')[0]).join();
    out.reg = { una: Object.keys(a1.reg).join() === `7|${f1.base}`, pisa: a2.reg[`7|${f1.base}`].v === 26e6 && a2.reg[`7|${f1.base}`].t === ahora + HORA && a1.reg[`7|${f1.base}`].v === 25e6, caduca: Object.keys(a3.reg).length === 0 && a3.cambia };
    // resolver: cuatro cláusulas que se abrieron hace 30 h, vistas 2 h antes
    const abre = ahora - 30 * HORA, visto = abre - 2 * HORA;
    const e = (pid, cl = 30e6) => ({ pid, tid: 'A', base: abre, abre, cl, v: 25e6, r: 0.01, pos: 3, tit: 0.8, t: visto });
    const R = { 'cz|1': e('cz'), 'trato|1': e('trato'), 'nada|1': e('nada'), 'blinda|1': e('blinda'), 'vendido|1': e('vendido'), 'par|1': e('par'), 'antes|1': e('antes'), 'sube|1': e('sube') };
    const act = [
      { t: abre + 3 * HORA, clase: 'clausula', pid: 'cz', quienId: 'x', otroId: 'y', importe: 30e6 },
      { t: abre + 4 * HORA, clase: 'compra', pid: 'trato', quienId: 'x', otroId: 'y', importe: 27e6 },
      { t: abre + HORA, clase: 'blindaje', pid: 'blinda', quienId: 'y' },
      { t: abre + 6 * HORA, clase: 'venta', pid: 'vendido', quienId: 'y', importe: 26e6 },
      // (un clausulazo que LaLiga cuenta como compra entre mánagers por el importe de la cláusula, con la venta del otro al lado)
      { t: abre + 2 * HORA, clase: 'compra', pid: 'par', quienId: 'x', otroId: 'y', importe: 30e6 }, { t: abre + 2 * HORA + 1000, clase: 'venta', pid: 'par', quienId: 'y', otroId: 'x', importe: 30e6 },
      // (lo fichó otro ANTES de abrirse: ya no es del mismo dueño)
      { t: abre - HORA, clase: 'compra', pid: 'antes', quienId: 'z', otroId: 'y', importe: 28e6 },
      // (su valor pasó de la cláusula esa noche y LaLiga la subió sola: el clausulazo se paga por lo que vale ese día, 31,2 M)
      { t: abre + 20 * HORA, clase: 'compra', pid: 'sube', quienId: 'x', otroId: 'y', importe: 31.2e6 },
      // (fuera de las 24 h: no cuenta)
      { t: abre + 26 * HORA, clase: 'clausula', pid: 'nada', quienId: 'x', otroId: 'y', importe: 30e6 },
    ];
    const valorEn = (pid, t) => (pid === 'sube' && t > abre + 10 * HORA ? 31.2e6 : pid === 'trato' ? 26e6 : 25e6);
    const res = OL.resolverAperturas(R, act, abre - 10 * 864e5, ahora, valorEn);
    out.sinValor = OL.resolverAperturas(R, act, abre - 10 * 864e5, ahora).quitar.includes('sube|1');
    const por = Object.fromEntries(res.listas.map((x) => [x.c.split('|')[0], x]));
    out.res = { listas: res.listas.map((x) => `${x.c.split('|')[0]}:${x.ida ? 1 : 0}${x.bl ? 'b' : ''}`).sort().join(), quitar: [...res.quitar].sort().join(), cs: por.cz && Math.round(por.cz.cs * 1000) / 1000,
      // con la liga guardada de hace días (la foto es de antes de acabar las 24 h) o sin actividad que llegue hasta entonces, nada
      fotoVieja: OL.resolverAperturas(R, act, abre - 10 * 864e5, abre + 20 * HORA).listas.length, sinActividad: OL.resolverAperturas(R, act, abre - HORA, ahora).listas.length + OL.resolverAperturas(R, act, null, ahora).listas.length };
    // de punta a punta: tres en el registro de la liga y la actividad guardada; se mandan dos y la tercera se quita sin mandar
    const kA = K('ligas-aperturas');
    LS.set(kA, { 'cz|1': { ...e('990001'), base: abre }, 'nada|1': { ...e('990002'), base: abre + 1 }, 'vendido|1': { ...e('990003'), base: abre + 2 } });
    const ah = actHist(S.D.liga.id);
    LS.set(K('acthist'), { liga: S.D.liga.id, lista: [...(ah.lista || []), { id: 'pa1', t: abre + 3 * HORA, clase: 'clausula', pid: '990001', quienId: 'x', otroId: 'y', importe: 30e6 }, { id: 'pa2', t: abre + 6 * HORA, clase: 'venta', pid: '990003', quienId: 'y', importe: 26e6 }], completa: true, desde: abre - 20 * 864e5, v: 2, t: ahora });
    S.D.t = ahora;
    LS.set(K('ligas-env'), { t: 0, f: '', dia: '', n: 0, mal: 0 });
    await window.__fmLigas.ligas();
    out.queda = Object.keys(LS.get(kA, {})).filter((k) => /^(cz|nada|vendido)\|/.test(k));
    return out;
  });
  ok(ap.motor.campos && ap.motor.fichas > 20 && ap.motor.apuntadas === ap.motor.pronto && ap.motor.abiertas > 0, `del motor salen las fichas de todos los equipos y se apuntan las que se abren en día y medio (${JSON.stringify(ap.motor)})`);
  ok(ap.reg.una && ap.reg.pisa && ap.reg.caduca, `el registro: solo lo que está a punto de abrirse, con lo último visto, y lo caducado fuera (${JSON.stringify(ap.reg)})`);
  ok(ap.veda === '21', `solo cuenta la primera vez que se abre: la que ya estaba abierta y espera al principio de la jornada, no (${ap.veda})`);
  ok(ap.res.listas === 'blinda:0b,cz:1,nada:0,par:1,sube:1' && ap.res.quitar === 'antes|1,trato|1,vendido|1' && ap.res.cs === 0.2 && ap.sinValor, `al pasar las 24 h: clausulado, no clausulado y blindado se mandan; vendido, pactado o fichado antes, no (${JSON.stringify(ap.res)})`);
  ok(ap.res.fotoVieja === 0 && ap.res.sinActividad === 0, 'con la liga guardada de antes, o sin actividad que llegue hasta entonces, no se manda nada');
  const dA = JSON.parse(de('/ligas')[de('/ligas').length - 1].cuerpo);
  const cla = sql('SELECT * FROM cla ORDER BY ida');
  ok(dA.a.length === 2 && dA.a.every((x) => Object.keys(x).sort().join() === 'bl,cs,d,ida,k,pos,r,tit,v') && cla.length === 2 && cla[0].ida === 0 && cla[1].ida === 1 && cla[1].cs === 0.2 && cla[1].tit === 80 && ap.queda.length === 0, `de punta a punta: dos cláusulas al servidor (una clausulada y otra no), sin jugador, y el registro limpio (${JSON.stringify(dA.a.map((x) => x.ida))} ${ap.queda})`);

  // con la liga guardada de hace rato (sin poder leerla de nuevo) la demanda no se manda: las pujas pueden ser ya otras
  const nL = de('/ligas').length;
  await en(async () => { const { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js'); const S = window.S; LS.set(K('ligas-env'), { t: 0, f: '', dia: '', n: 0, mal: 0 }); S.M.mercado.find((x) => x.tipo === 'liga').pujas += 1; S.D.t = Date.now() - 2 * 3600e3; await window.__fmLigas.ligas(); });
  const nL2 = de('/ligas').length;
  await en(async () => { window.S.D.t = Date.now(); await window.__fmLigas.ligas(); });
  ok(nL2 === nL && de('/ligas').length === nL + 1, `con la liga guardada de hace 2 h la demanda no se manda; recién leída, sí (${nL}, ${nL2}, ${de('/ligas').length})`);

  /* ---- (d) de lo que sale del móvil, nada de nadie ---- */
  const todo = llegadas.map((x) => `${x.dir} ${x.cuerpo}`).join('\n');
  const nombres = liga.equipos.flatMap(([tid, n, m]) => [n, m]).filter((x) => x && String(x).length >= 4);
  const clavesBien = llegadas.every((x) => { if (!x.cuerpo) return true; const j = JSON.parse(x.cuerpo); return Object.keys(j).every((k) => ['l', 't', 'c', 'm', 'a', 'ids'].includes(k)) && (j.t == null || j.t === 'private|8|n') && (j.c || []).every((y) => Object.keys(y).sort().join() === 'd,k,p,r,s,top,v') && (j.m || []).every((y) => Array.isArray(y) && y.length === 2 && y.every(Number.isInteger)); });
  ok(clavesBien && !todo.includes(liga.nombre) && !nombres.some((n) => todo.includes(n)) && !/"(liga|tid|teamId|manager|equipo|quien|nombre|uid)"/.test(todo) && !llegadas.some((x) => /[?&]l=/.test(x.dir)), 'lo que sale del móvil: ids de jugador, números y huellas; ni liga, ni mánager, ni equipo, ni nombres (y la huella, nunca en la dirección)');

  /* ---- (f) apagado en limites.json, como se publica ---- */
  // en el servidor, lo pagado por dos libres en otras ligas: uno en 5 ligas y otro solo en 2; y la demanda de todos en 8 ligas
  const [pidA, pidB] = liga.libres.map((x) => x[0]);
  const hx = (i) => i.toString(16).padStart(24, '0');
  const hoyU = new Date().toISOString().slice(0, 10);
  const T = 'private|8|n';
  // (y de una liga Premium, que es otra clase: no se junta con las privadas normales)
  await obj({ op: 'pago', l: hx(0xaa099), t: 'private|8|p', uid: '9099', xs: [{ k: hx(0xbb099), d: hoyU, p: pidA, s: 0.7, v: 20e6, r: 0.01, top: false }] });
  for (let n = 1; n <= 5; n++) await obj({ op: 'pago', l: hx(0xaa000 + n), t: T, uid: String(9000 + n), xs: [{ k: hx(0xbb000 + n), d: hoyU, p: pidA, s: [0.06, 0.09, 0.11, 0.14, 0.19][n - 1], v: 20e6, r: 0.01, top: false }, ...(n <= 2 ? [{ k: hx(0xcc000 + n), d: hoyU, p: pidB, s: 0.3, v: 5e6, r: null, top: false }] : [])] });
  for (let n = 1; n <= 8; n++) await obj({ op: 'apunte', l: hx(0xaa000 + n), t: T, uid: String(9000 + n), m: liga.libres.map(([p], i) => [p, p === pidA ? 5 : i % 3 === 0 ? 1 : 0]) });
  const antes = llegadas.length;
  let fx = await en(async (pid) => { const Hj = await import('./js/hojas.js'); await window.__fmLigas.otras(); const m = window.S.M.mercado.find((x) => Number(x.pid) === pid); return { otras: window.S.otras || null, linea: Hj.otrasLigasHTML(window.S, m), ficha: Hj.fichaJugador(window.S, m.pid) }; }, pidA);
  ok(llegadas.length === antes && !fx.otras && fx.linea === '' && !/otras ligas/i.test(fx.ficha), 'APAGADO (como se publica): ni se pide lo de las demás ligas ni sale nada en la ficha');
  // aunque alguien lo pida a mano, el servidor no da nada
  let rv = await (await WM.default.fetch(new Request('https://w.dev/ligas/ver', { method: 'POST', headers: { Origin: BASE, 'content-type': 'application/json', Authorization: `Bearer ${'t'.repeat(40)}`, 'cf-connecting-ip': '10.8.0.1' }, body: JSON.stringify({ l: hx(1), t: T, ids: [pidA] }) }), envW, { waitUntil() {} })).json();
  ok(JSON.stringify(rv.p) === '{}' && JSON.stringify(rv.d) === '{}', `apagado, el servidor no devuelve nada aunque se le pida a mano (${JSON.stringify(rv)})`);

  /* ---- (g) encendido: solo lo pagado ---- */
  await interruptor({ pagado: true, demanda: false });
  fx = await en(async ([a, b]) => {
    const Hj = await import('./js/hojas.js'), Ia = await import('./js/ia.js'), { cfg } = await import('./js/datos.js');
    await window.__fmLigas.otras();
    const S = window.S, mA = S.M.mercado.find((x) => Number(x.pid) === a), mB = S.M.mercado.find((x) => Number(x.pid) === b);
    const ficha = Hj.fichaJugador(S, mA.pid);
    const txt = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
    let ctx = '', chat = '';
    try { ctx = Ia.contexto(S.D, S.M, cfg()); } catch (e) { ctx = `ERROR ${e.message}`; }
    try { const dc = Ia.datosChat(`¿Cuánto pujo por ${mA.j.nombre}?`, S.D, S.M, cfg()); chat = typeof dc === 'string' ? dc : JSON.stringify(dc); } catch (e) { chat = `ERROR ${e.message}`; }
    return { otras: S.otras, lineaA: txt(Hj.otrasLigasHTML(S, mA)), lineaB: Hj.otrasLigasHTML(S, mB), enFicha: /Lo pagado en otras ligas/.test(ficha), demEnFicha: /Demanda en otras ligas/.test(ficha), valor: mA.j.valor, puja: mA.puja, nombre: mA.j.nombre,
      ia: /otras ligas|demás ligas/i.test(ctx) || /otras ligas|demás ligas/i.test(chat), iaErr: /^ERROR/.test(ctx) || /^ERROR/.test(chat) ? `${ctx.slice(0, 80)} | ${chat.slice(0, 80)}` : '', ctxLargo: ctx.length, chatLargo: chat.length };
  }, [pidA, pidB]);
  ok(de('/ligas/ver').length === 1 && fx.otras && fx.otras.p[pidA] && fx.otras.p[pidA].n === 5 && fx.otras.p[pidA].med === 0.11 && fx.otras.p[pidA].max === 0.19 && !fx.otras.p[pidB] && Object.keys(fx.otras.d).length === 0, `encendido lo pagado: se pide una vez y llega lo del que tiene 5 ligas de la misma clase, sin la Premium (${JSON.stringify(fx.otras && fx.otras.p)})`);
  ok(fx.enFicha && !fx.demEnFicha && fx.lineaB === '' && fx.lineaA.includes('Lo pagado en otras ligas') && fx.lineaA.includes('En 3 días: +11,0 % de mediana · lo más, +19,0 %') && fx.lineaA.includes('en 5 ligas que usan la app'), `la ficha lo dice, y del que solo tiene 2 ligas no dice nada: «${fx.lineaA}»`);
  ok(!fx.ia && !fx.iaErr && fx.ctxLargo > 500 && fx.chatLargo > 100, `a la IA (plan y chat) no le llega nada de esto (${fx.iaErr || `${fx.ctxLargo} y ${fx.chatLargo} caracteres mirados`})`);
  // no cambia la puja de la app
  const pujas = await en((pid) => {
    const S = window.S, g = S.otras, puja = () => { window.__fmRehacer(); return S.M.mercado.find((x) => Number(x.pid) === pid).puja; };
    S.otras = null; const sin = puja(); S.otras = g; const con = puja();
    return { sin, con };
  }, pidA);
  ok(pujas.sin > 0 && pujas.sin === pujas.con, `la puja que propone la app es la misma con lo de las demás ligas y sin ello (${pujas.sin} y ${pujas.con})`);
  // no se pide otra vez mientras no cambien los libres ni pasen 3 h
  await en(() => window.__fmLigas.otras());
  ok(de('/ligas/ver').length === 1, 'no se pide otra vez con los mismos libres');
  // lo de mi propia liga no cuenta: mi liga también lo ha comprado (sería la sexta) y sigo viendo 5
  await en(async (pid) => { const { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js'); LS.set(K('otras-ligas'), { ...LS.get(K('otras-ligas'), {}), t: Date.now() - 4 * 3600e3 }); }, pidA);
  await obj({ op: 'pago', l: c2.l, t: T, uid: '7001', xs: [{ k: hx(0xdd001), d: hoyU, p: pidA, s: 0.9, v: 20e6, r: 0.01, top: false }] });
  fx = await en(async (pid) => { await window.__fmLigas.otras(); return window.S.otras.p[pid]; }, pidA);
  ok(de('/ligas/ver').length === 2 && fx.n === 5 && fx.max === 0.19, `pasadas 3 h se pide otra vez, y lo de tu propia liga no entra (${JSON.stringify(fx)})`);
  // lo leído para otra liga tuya no vale aquí
  fx = await en(async (pid) => { const Hj = await import('./js/hojas.js'); const S = window.S, m = S.M.mercado.find((x) => Number(x.pid) === pid); const bien = Hj.otrasLigasHTML(S, m); const g = S.otras; S.otras = { ...g, liga: 'otra' }; const otra = Hj.otrasLigasHTML(S, m); S.otras = { ...g, t: Date.now() - 13 * 3600e3 }; const vieja = Hj.otrasLigasHTML(S, m); S.otras = g; return { bien: bien.length > 0, otra, vieja }; }, pidA);
  ok(fx.bien && fx.otra === '' && fx.vieja === '', 'lo leído para otra liga tuya, o hace más de medio día, no se enseña');

  /* ---- (g) encendida también la demanda ---- */
  await interruptor({ pagado: true, demanda: true });
  // (dónde se cortan los niveles se rehace cada 10 minutos en el servidor: se le quita lo que tenía)
  for (const x of QR.hay.values()) if (x.o && x.o.memo) delete x.o.memo.ligasCortes;
  fx = await en(async ([a, b]) => {
    const Hj = await import('./js/hojas.js'), { LS } = await import('./js/util.js'), { K } = await import('./js/datos.js');
    LS.set(K('otras-ligas'), { ...LS.get(K('otras-ligas'), {}), t: Date.now() - 4 * 3600e3 });
    await window.__fmLigas.otras();
    const S = window.S, mA = S.M.mercado.find((x) => Number(x.pid) === a);
    const txt = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
    return { d: S.otras.d, linea: txt(Hj.otrasLigasHTML(S, mA)) };
  }, [pidA, pidB]);
  ok(fx.d[pidA] && fx.d[pidA][0] === 3 && Object.values(fx.d).every((x) => x.every((v) => [0, 1, 2, 3].includes(v))) && fx.linea.includes('Demanda en otras ligas') && fx.linea.includes('Hoy, alta') && !/\d+ ligas (pujan|de)/.test(fx.linea.split('Demanda en otras ligas')[1]), `la demanda, como un nivel y sin cifras de ligas: «${fx.linea.split('Demanda en otras ligas')[1]}»`);

  /* ---- capturas de la ficha con la línea encendida (para enseñárselas a Carlos) ---- */
  if (process.env.CAPTURAS) {
    await mkdir(process.env.CAPTURAS, { recursive: true });
    const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
    for (const [nombre, o] of [['movil', {}], ['iphone', { ua: UA_IPHONE, ancho: 393, alto: 852 }], ['ordenador', { ancho: 1366, alto: 800 }]]) {
      const Q = nombre === 'movil' ? P : await navegador(o);
      await Q.page.evaluate(async ([a, otras]) => {
        localStorage.setItem('fm-demo', 'false');
        const Li = await import('./js/limite.js'), { LS } = await import('./js/util.js');
        const S = window.S;
        Li.fijarYo(S.M.yo || { teamId: S.D.yo.teamId, nombre: 'Yo' }, false);
        S.D.liga.acceso = 'private'; S.D.liga.tipo = '8';
        const g = LS.get('limites', null) || { cfg: {} };
        LS.set('limites', { ...g, cfg: { ...(g.cfg || {}), otrasLigas: { pagado: true, demanda: true } } });
        S.otras = { ...otras, liga: S.D.liga.id, t: Date.now() };
        const m = S.M.mercado.find((x) => Number(x.pid) === a);
        document.querySelector(`[data-j="${m.pid}"]`) ? document.querySelector(`[data-j="${m.pid}"]`).click() : null;
        window.__pidCaptura = m.pid;
      }, [pidA, await en(() => window.S.otras)]);
      // (si no había nada que tocar en esa pestaña, por Mercado)
      if (!(await Q.page.$('.hoja, .ficha-j, #hoja'))) { await Q.page.evaluate(() => { const b = document.querySelector('[data-ir="mercado"], [data-v="mercado"]'); if (b) b.click(); }); await Q.page.waitForTimeout(600); await Q.page.evaluate(() => { const x = document.querySelector(`[data-j="${window.__pidCaptura}"]`); if (x) x.click(); }); }
      await Q.page.waitForTimeout(900);
      await Q.page.evaluate(() => { for (const d of document.querySelectorAll('details.av-pleg')) if (/otras ligas/i.test(d.textContent)) { d.open = true; d.scrollIntoView({ block: 'center' }); } });
      await Q.page.waitForTimeout(300);
      await Q.page.screenshot({ path: join(process.env.CAPTURAS, `otras-ligas-${nombre}.png`) });
      if (Q !== P) await Q.ctx.close();
    }
    console.log(`     capturas en ${process.env.CAPTURAS}`);
  }

  /* ---- (h) los textos, tal cual ---- */
  const tx = await en(async () => {
    const OL = await import('./js/otras-ligas.js');
    const HORA = 36e5, t = 1e12;
    return {
      p1: OL.pagadoTxt({ n: 9, med: 0.11, max: 0.19 }, 59.9e6), p2: OL.pagadoTxt({ n: 20, med: 0.052, max: 0.052 }, 1.2e6), p3: OL.pagadoTxt({ n: 2, med: 0.1, max: 0.2 }, 10e6), p4: OL.pagadoTxt(null, 10e6), p5: OL.pagadoTxt({ n: 5, med: 0.1, max: 0.2 }, 0), p6: OL.pagadoTxt({ n: 4, med: -0.02, max: 0.03 }, 8e6),
      d1: OL.demandaTxt([3, 1]), d2: OL.demandaTxt([2, 0]), d3: OL.demandaTxt([0, 3]), d4: OL.demandaTxt(null), d5: OL.demandaTxt([1, 1]),
      manda: [
        OL.tocaMandar(null, '1:0', 0, t, 'a'), OL.tocaMandar({ t: t - 10 * 60e3, f: 'x', dia: 'a', n: 1 }, '1:0', 0, t, 'a'), OL.tocaMandar({ t: t - HORA, f: '1:0', dia: 'a', n: 1 }, '1:0', 0, t, 'a'), OL.tocaMandar({ t: t - HORA, f: '1:0', dia: 'a', n: 1 }, '1:1', 0, t, 'a'),
        OL.tocaMandar({ t: t - HORA, f: '1:0', dia: 'a', n: 1 }, '1:0', 0, t, 'b'), OL.tocaMandar({ t: t - HORA, f: '1:0', dia: 'a', n: 1 }, '1:0', 2, t, 'a'), OL.tocaMandar({ t: t - HORA, f: 'x', dia: 'a', n: OL.ENVIOS_DIA }, '1:1', 0, t, 'a'), OL.tocaMandar({ t: t - HORA, f: 'x', dia: 'a', n: OL.ENVIOS_DIA }, '1:1', 0, t, 'b'),
        OL.tocaMandar({ t: t - 2 * HORA, f: 'x', dia: 'a', n: 1, mal: t - 20 * 60e3 }, '1:1', 0, t, 'a'), OL.tocaMandar({ t: t - HORA, f: '', dia: 'a', n: 1 }, '', 0, t, 'a'),
      ].map((x) => (x ? 1 : 0)).join(''),
      ver: [OL.tocaVer(null, '1,2', t), OL.tocaVer({ k: '1,2', t: t - HORA }, '1,2', t), OL.tocaVer({ k: '1,2', t: t - HORA }, '1,3', t), OL.tocaVer({ k: '1,2', t: t - 4 * HORA }, '1,2', t), OL.tocaVer({ k: '', t: 0, mal: t - 60e3 }, '1,2', t), OL.tocaVer(null, '', t)].map((x) => (x ? 1 : 0)).join(''),
      dem: JSON.stringify(OL.demandaDe([{ tipo: 'liga', pid: '12', pujas: 2, cierra: t + 1, j: { valor: 1e6 } }, { tipo: 'manager', pid: '13', pujas: 9, j: { valor: 1e6 } }, { tipo: 'liga', pid: '3', pujas: null, j: { valor: 2e6 } }, { tipo: 'liga', pid: 'p9', pujas: 1, j: { valor: 1e6 } }, { tipo: 'liga', pid: '14', pujas: 1, cierra: t - 1, j: { valor: 1e6 } }, { tipo: 'liga', pid: '15', pujas: 4, j: { valor: 0 } }, { tipo: 'liga', pid: '16', pujas: 4 }, { tipo: 'liga', pid: '17', pujas: 4, j: { valor: 3e6, pos: 5 } }, null], t)),
    };
  });
  ok(tx.p1 && tx.p1.l === 'En 3 días: +11,0 % de mediana · lo más, +19,0 %' && tx.p1.d[0] === 'Se lo han llevado en 9 ligas que usan la app en los 3 últimos días. La mitad pagó un +11,0 % sobre su valor o menos, y quien más, un +19,0 %.' && /^Con lo que vale hoy serían 66,49 M€? y 71,28 M€?\.$/.test(tx.p1.d[1].replace(/ /g, ' ')) && tx.p1.d.length === 3 && tx.p1.d[2] === '<span class="t2">Cada liga paga distinto: es un dato más, y la puja de la app no cambia por él.</span>', `el texto de lo pagado: «${tx.p1 && `${tx.p1.l} | ${tx.p1.d.join(' | ')}`}»`);
  ok(tx.p2 && tx.p2.l === 'En 3 días: +5,2 % de mediana' && tx.p2.d[0].includes('en 20 ligas o más que usan la app') && !tx.p2.d[0].includes('quien más') && !tx.p3 && !tx.p4 && !tx.p5 && tx.p6 && tx.p6.l === 'En 3 días: −2,0 % de mediana · lo más, +3,0 %', `sin 3 ligas, sin valor o sin datos, nada; con 20 o más no se dice cuántas; por debajo del valor, con su signo: «${tx.p2 && tx.p2.l}» · «${tx.p6 && tx.p6.l}»`);
  ok(tx.d1 && tx.d1.l === 'Hoy, alta · ayer, baja' && tx.d1.d[0] === 'Entre los libres de hoy en las demás ligas que usan la app, es de los que más pujas llevan (ayer, de los que menos pujas llevan).' && tx.d2.l === 'Hoy, media' && !tx.d3 && !tx.d4 && tx.d5.l === 'Hoy, baja · ayer, baja', `el texto de la demanda: «${tx.d1 && `${tx.d1.l} | ${tx.d1.d.join(' | ')}`}»`);
  ok(tx.manda === '1001110100', `cuándo se manda: la primera vez, con cambios pasada media hora, lo mismo una vez al día, con cláusulas resueltas; no antes de media hora, ni sin cambios, ni pasado el tope del día, ni tras un fallo, ni sin nada (${tx.manda})`);
  ok(tx.ver === '101100', `cuándo se pide lo de las demás ligas: la primera vez, al cambiar los libres o a las 3 h; no tras un fallo ni sin libres (${tx.ver})`);
  ok(tx.dem === '[[3,0],[12,2]]', `de la demanda salen solo los libres de la liga con la subasta abierta que la app conoce (${tx.dem})`);

  /* ---- (i) la medida ---- */
  // su copia de `M.pagaLiga`, dentro de la app (como se va a usar: el código del archivo, importado en la página) frente al
  // motor, con la liga de ejemplo y una tabla de todas las ligas
  const codigo = await readFile(fileURLToPath(new URL('./medir-otras-ligas.mjs', import.meta.url)), 'utf8');
  const rep = await en(async (cod) => {
    const X = await import(URL.createObjectURL(new Blob([cod], { type: 'text/javascript' })));
    const Mo = await import('./js/motor.js');
    const S = window.S, copia = (x) => JSON.parse(JSON.stringify(x));
    const cel = (k, b) => ({ k, n: 40, p10: b - 0.04, p25: b - 0.02, med: b, p75: b + 0.03, p90: b + 0.07 });
    const cal = { n: 400, tv: [[0, 1e6], [1e6, 3e6], [3e6, 10e6], [10e6, 30e6], [30e6, 1e12]], tr: [[-1, 0.004], [0.004, 0.012], [0.012, 1]], celdas: [] };
    cal.tv.forEach((_, i) => { cal.celdas.push(cel(`${i}|*`, 0.2 - i * 0.03)); cal.tr.forEach((__, j) => cal.celdas.push(cel(`${i}|${j}`, 0.18 - i * 0.03 + j * 0.02))); });
    cal.tr.forEach((_, j) => cal.celdas.push(cel(`top|${j}`, 0.15 + j * 0.03)));
    let peor = 0, suma = 0, n = 0, conLiga = 0, conTodas = 0;
    for (const c of [null, cal]) {
      const M = Mo.analizar(copia(S.D), copia(S.H), S.c, { det: S.det, calPujas: c });
      const propias = (M.pujasLiga && !M.pujasLiga.poco && M.pujasLiga.todas) || [];
      for (const j of Object.values(S.D.maestro).filter((x) => x.valor > 3e5 && x.pos <= 4).slice(0, 150)) {
        const pf = M.perfilPuja(j.id), a = M.pagaLiga(j.valor, j.id), b = X.pagaLiga(propias, c, j.valor, pf);
        if (!a && !b) continue;
        if (!a || !b) { peor = 9; continue; }
        n++; if (a.n) conLiga++; if (a.todos) conTodas++;
        for (const q of [0.25, 0.5, 0.72, 0.9]) { const dif = Math.abs(a.q(q) - b.q(q)); peor = Math.max(peor, dif); suma += dif / 4; }
      }
    }
    const tr = await X.traer(async (ruta) => (ruta.startsWith('/pujas/cal') ? cal : { pago: [['2026-11-20', 1, 0.1, 1e6, null, 0, 'a']], dem: [], cla: [], hay: { x: 1 }, corta: false }), '2026-10-01', '2026-11-26');
    return { peor, medio: suma / n, n, conLiga, conTodas, traer: tr.pago.length === 2 && tr.cal === cal && tr.cortas === 0 };
  }, codigo);
  // (el motor guarda lo de cada jugador por casillas: valor de 2,5 % en 2,5 % y subida de 0,25 en 0,25 puntos; dos jugadores
  // de la misma casilla llevan lo del primero. Por eso no sale clavado: como mucho, unas décimas de punto)
  ok(rep.n > 100 && rep.conLiga > 0 && rep.conTodas > 0 && rep.peor < 0.004 && rep.medio < 0.0006 && rep.traer, `la copia de pagaLiga de la medida da lo mismo que el motor (${rep.n} jugadores, ${rep.conLiga} con compras de la liga y ${rep.conTodas} mezclando con todas; se separan ${(rep.medio * 100).toFixed(3)} puntos de media y ${(rep.peor * 100).toFixed(2)} como mucho)`);
  // datos inventados a propósito, con azar fijo
  let sem = 12345;
  const azar = () => { sem = (sem * 1664525 + 1013904223) % 4294967296; return sem / 4294967296; };
  const normal = () => (azar() + azar() + azar() + azar() - 2) * 0.87;
  const dia = (n) => new Date(Date.UTC(2026, 10, 1 + n, 12)).toISOString().slice(0, 10);
  const jug = Array.from({ length: 60 }, (_, i) => ({ pid: 100 + i, v: i < 15 ? 45e6 : 4e6 + i * 2e5, moda: (azar() - 0.5) * 0.3 }));
  // 40 ligas y 25 días; cada liga paga algo más o menos que las demás (su «manía»)
  const fabrica = (conModa, nLigas = 40, nDias = 25) => {
    const out = [];
    for (let l = 0; l < nLigas; l++) { const mania = (azar() - 0.5) * 0.06; for (let d = 0; d < nDias; d++) for (let k = 0; k < 4; k++) { const j = jug[Math.floor(azar() * (d < 5 ? 60 : 12 + (d % 3) * 6))]; out.push([dia(d), j.pid, Math.round((0.12 + mania + (conModa ? j.moda : 0) + normal() * (conModa ? 0.015 : 0.06)) * 1000) / 1000, j.v, 0.005, j.v >= 30e6 ? 1 : 0, `L${l}`]); } }
    return out;
  };
  const si = MD.medirPagado(fabrica(true), null), no = MD.medirPagado(fabrica(false), null), poco = MD.medirPagado(fabrica(true, 6, 6), null);
  ok(si.veredicto.paraLaPuja === 'sí' && si.todos.conDato >= 60 && si.todos.errorOtras.mediana < si.todos.errorApp.mediana * 0.6 && si.todos.otrasMasCerca > 0.6 && si.caros.conDato >= 20 && si.veredicto.paraLaPujaDeLosCaros === 'sí', `la medida de lo pagado, cuando cada jugador tiene su precio y las demás ligas lo saben: «sí» (${JSON.stringify({ n: si.todos.conDato, app: si.todos.errorApp.mediana, otras: si.todos.errorOtras.mediana, cerca: si.todos.otrasMasCerca })})`);
  ok(no.veredicto.paraLaPuja === 'no' && no.todos.conDato >= 60, `cuando lo de las demás ligas no añade nada: «no» (${JSON.stringify({ n: no.todos.conDato, app: no.todos.errorApp.mediana, otras: no.todos.errorOtras.mediana, cerca: no.todos.otrasMasCerca })})`);
  ok(poco.veredicto.paraLaPuja === 'aún no se sabe', `con pocas compras con dato: «aún no se sabe» (${poco.todos.conDato})`);
  // no mira el futuro: una compra no se predice con las de ese mismo día ni las de después, ni con las de su propia liga
  const fut = MD.medirPagado([['2026-11-10', 1, 0.5, 5e6, null, 0, 'A'], ['2026-11-10', 1, 0.5, 5e6, null, 0, 'B'], ['2026-11-11', 1, 0.5, 5e6, null, 0, 'C'], ['2026-11-12', 1, 0.5, 5e6, null, 0, 'D'], ['2026-11-12', 1, 0.5, 5e6, null, 0, 'A'], ['2026-11-13', 1, 0.5, 5e6, null, 0, 'E'], ['2026-11-20', 1, 0.5, 5e6, null, 0, 'F']], { n: 50, tv: [[0, 1e12]], tr: [[-1, 1]], celdas: [{ k: '0|*', n: 50, p10: 0.1, p25: 0.1, med: 0.1, p75: 0.1, p90: 0.1 }] });
  // (con 3 ligas o más antes: la de D del día 12, con A, B y C; y la de E del día 13, con A, B, C y D. La de A del día 12 no: sin
  // la suya ni la de ese mismo día le quedan dos; la del día 20, ninguna)
  ok(fut.todos.conDato === 2 && fut.n === 7, `para cada compra solo cuentan las de otras ligas de los 3 días de antes (${fut.todos.conDato} con dato de 7)`);
  // la demanda: 30 días, 80 libres al día; lo que sube cada noche es lo que venía más (o no) un tanto por su demanda
  const valores = {}, dem = [], demNo = [], valoresNo = {};
  for (const [conDem, V, D] of [[true, valores, dem], [false, valoresNo, demNo]]) {
    for (let p = 0; p < 80; p++) {
      const venia = (azar() - 0.5) * 0.02; let v = 5e6 + p * 3e5; const serie = [];
      for (let d = -4; d < 0; d++) { serie.push([dia(d), Math.round(v)]); v *= 1 + venia; }
      for (let d = 0; d < 30; d++) { const z = azar(); serie.push([dia(d), Math.round(v)]); D.push([dia(d), 500 + p, 8, Math.round(z * 8), Math.round(z * 24), 0]); v *= 1 + venia + (conDem ? (z - 0.5) * 0.02 : 0) + normal() * 0.002; }
      serie.push([dia(30), Math.round(v)]);
      V[500 + p] = serie;
    }
  }
  const dSi = MD.medirDemanda(dem, valores), dNo = MD.medirDemanda(demNo, valoresNo), dPoco = MD.medirDemanda(dem.slice(0, 400), valores), dMin = MD.medirDemanda(dem.map((x) => [x[0], x[1], 3, x[3], x[4]]), valores);
  ok(dSi.veredicto === 'sí' && dSi.mejora > 0.2 && dSi.segundaMitad.tercios.alta.sube > dSi.segundaMitad.tercios.baja.sube && dSi.primeraMitad.ajuste.b > 0.01, `la medida de la demanda, cuando la demanda mueve el valor: «sí» (${JSON.stringify({ n: dSi.n, mejora: dSi.mejora, b: dSi.primeraMitad.ajuste.b })})`);
  ok(dNo.veredicto === 'no' && dNo.mejora < 0.05, `cuando no lo mueve: «no» (${JSON.stringify({ n: dNo.n, mejora: dNo.mejora })})`);
  ok(dPoco.veredicto === 'aún no se sabe' && dMin.veredicto === 'aún no se sabe' && dMin.n === 0, `con pocos casos, o con jugadores libres en menos de 5 ligas: «aún no se sabe» (${dPoco.n} y ${dMin.n})`);
  const mc = MD.medirClausulas([['2026-11-20', 30e6, 0.01, 0.01, 3, 80, 1, 0], ['2026-11-20', 30e6, 0.02, 0.01, 3, 80, 0, 0], ['2026-11-21', 3e6, 0.4, -0.01, 2, 20, 0, 0], ['2026-11-21', 50e6, 0, 0.02, 4, 90, 0, 1]]);
  const rs = MD.resumen({ pago: [['2026-11-20', 1, 0.1, 1e6, null, 0, 'a'], ['2026-11-20', 1, 0.1, 1e6, null, 0, 'b'], ['2026-11-21', 1, 0.1, 1e6, null, 0, 'a'], ['2026-11-21', 2, 0.1, 1e6, null, 0, 'a']], dem: [['2026-11-20', 1, 6, 2, 3, 3], ['2026-11-20', 2, 2, 0, 0, 0]], cla: [['2026-11-21', 1e6, 0, null, 1, null, 0, 0]] });
  ok(mc.n === 4 && mc.blindadas === 1 && mc.sinBlindar.n === 3 && mc.sinBlindar.pagadas === 1 && mc.porClausula['a su valor (hasta +3 %)'].parte === 0.5 && mc.porValor['20 a 40 M'].n === 2 && mc.porTendencia.bajaba.n === 1 && mc.porTitular['no titular'].n === 1, `la tabla de las cláusulas: las blindadas aparte y la parte que se paga por tramo (${JSON.stringify(mc.sinBlindar)})`);
  ok(rs.porDia.length === 2 && rs.porDia[0].compras === 2 && rs.porDia[0].ligas === 2 && rs.porDia[0].libres === 2 && rs.porDia[0].libresEn5Ligas === 1 && rs.porDia[1].clausulas === 1 && rs.jugadoresCon3Compras === 1 && rs.jugadores === 2, `el resumen de lo que ha llegado, por día (${JSON.stringify(rs.porDia)})`);
  ok(P.errores.length === 0, `sin errores en la página (${P.errores.join(' | ').slice(0, 200)})`);
} catch (e) {
  mal++;
  console.log(`MAL  la prueba se ha roto: ${e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e}`);
}
await nav.close(); srv.close();
globalThis.fetch = fetchReal;
process.exit(mal ? 1 : 0);
