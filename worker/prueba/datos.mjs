// Prueba sin red del Worker (0.7a): /borrar, /vincular y /qr cerrados y como antes, y /hola con eventos.
// Uso: node worker/prueba/datos.mjs (sale «MAL» y código 1 si algo falla)
// prueba del Worker: /borrar, /vincular y /qr con lo cerrado, y lo de antes
import * as sobre from '../../web/js/sobre.js';
const W = (await import('../src/index.js')).default;
const kv = new Map();
// (escrituras: cuántas van; lleno: el KV no deja escribir, como con el cupo gratis del día gastado)
const cuenta = { escrituras: 0, lleno: false };
const KV = {
  async get(k) { const v = kv.get(k); return v ? v.v : null; },
  async getWithMetadata(k) { const v = kv.get(k); return v ? { value: v.v, metadata: v.m } : { value: null, metadata: null }; },
  async put(k, v, o = {}) { if (cuenta.lleno) throw new Error('KV put() limit exceeded for the day.'); cuenta.escrituras++; kv.set(k, { v, m: o.metadata || null, ttl: o.expirationTtl ?? null }); },
  async delete(k) { kv.delete(k); },
  async list({ prefix }) { return { keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name, metadata: kv.get(name).m })), list_complete: true }; },
};
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => true } };
const fetchReal = globalThis.fetch;
// LaLiga y los sitios de /p, falsos. Con un token que empieza por «y», es la cuenta 2222. Las ligas: la 77 es de la 4242
// y la 88, de otros (LaLiga da la clasificación de cualquier liga).
const pedidos = [];
const cabDe = (o, k) => (o && o.headers ? new Headers(o.headers).get(k) : null) || '';
globalThis.fetch = async (u, o) => {
  const s = String(u);
  if (s.includes('/user/me')) return new Response(JSON.stringify(/Bearer y/.test(cabDe(o, 'authorization')) ? { id: 2222, managerName: 'Otro' } : { id: 4242, managerName: 'Pepe' }), { status: 200 });
  if (s.includes('/leagues/77/standing')) return new Response(JSON.stringify([{ team: { manager: { id: 4242 } } }, { team: { manager: { id: 1111 } } }]), { status: 200 });
  if (s.includes('/leagues/88/standing')) return new Response(JSON.stringify([{ team: { manager: { id: 1111 } } }, { team: { manager: { id: 3333 } } }]), { status: 200 });
  pedidos.push({ u: s, m: (o && o.method) || 'GET' });
  if (s.startsWith('https://assets-fantasy.llt-services.com/')) return s.includes('.html') ? new Response('<h1>hola</h1>', { status: 200, headers: { 'content-type': 'text/html' } }) : new Response('PNG', { status: 200, headers: { 'content-type': 'image/png' } });
  if (/^https:\/\/(login\.laliga\.es|fantasy-api\.llt-services\.com|www\.futbolfantasy\.com)\//.test(s)) return new Response('{"ok":1}', { status: 200, headers: { 'content-type': 'application/json' } });
  throw new Error('sin red: ' + u);
};
const env = { VINCULOS: KV, ADMINS: '667015' };
const ORI = 'https://fantasymanagerapp.com';
const pedir = async (m, ruta, cuerpo, tk = 'x'.repeat(30)) => {
  const r = await W.fetch(new Request(`https://w.dev${ruta}`, { method: m, headers: { Origin: ORI, 'content-type': 'application/json', Authorization: `Bearer ${tk}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }), env, { waitUntil() {} });
  let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch (e) {}
  return { s: r.status, j, t };
};
const ok = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) process.exitCode = 1; };
// datos de la cuenta 4242 y de otra
await KV.put('p:4242', '1', { metadata: { uid: '4242' } }); await KV.put('r:4242', '1', { metadata: { uid: '4242' } });
await KV.put('u:4242:2026-11-04', '30'); await KV.put('f:4242:abc123', '{}', { metadata: { c: 2 } }); await KV.put('fc:abc123:0', 'x'); await KV.put('fc:abc123:1', 'y');
await KV.put('p:999', '1', { metadata: { uid: '999' } }); await KV.put('f:999:zzz999', '{}', { metadata: { c: 1 } }); await KV.put('fc:zzz999:0', 'z');
let r = await pedir('POST', '/borrar', {});
ok(r.s === 200 && r.j.ok && r.j.avisos === 1, `/borrar contesta ${r.s} ${r.t}`);
ok(![...kv.keys()].some((k) => k.includes('4242') || k.startsWith('fc:abc123')), 'no queda nada de la 4242');
ok(kv.has('p:999') && kv.has('f:999:zzz999') && kv.has('fc:zzz999:0'), 'lo de la 999 sigue');
r = await pedir('POST', '/borrar', {}, 'corto');
ok(r.s === 401, 'sin sesión, 401');
// código cerrado: al servidor solo le llega el id
const datos = { sesion: { token: 't'.repeat(40), renovar: 'r'.repeat(40) }, cfg: { ligaId: '1' }, ia: { clave: 'AQ.secreta' }, dichos: {} };
const codigo = sobre.nuevoCodigo();
const id0 = await sobre.idDeCodigo(codigo);
const cif = await sobre.cerrar({ codigo }, datos);
r = await pedir('POST', '/vincular', { id: id0, cif });
ok(r.s === 200 && r.j.ok, `/vincular cerrado ${r.s} ${r.t}`);
const guardado = [...kv.entries()].find(([k]) => k === `v:${id0}`);
ok(guardado && !guardado[1].v.includes('AQ.secreta') && ![...kv.keys()].some((k) => k.includes(codigo)), 'el servidor no ve el código ni la clave');
let fallo0 = null; try { await sobre.abrir({ codigo: id0 }, JSON.parse(guardado[1].v).cif); } catch (e) { fallo0 = e.message; }
ok(!!fallo0, 'con el id (lo que ve el servidor) no se abre');
r = await pedir('POST', '/vincular', { id: id0, cif });
ok(r.s === 409, 'el mismo id otra vez, 409');
r = await pedir('POST', '/vincular/usar', { id: id0 });
const abierto = await sobre.abrir({ codigo }, r.j.cif);
ok(abierto.ia.clave === 'AQ.secreta' && abierto.sesion.token === datos.sesion.token, 'el ordenador lo abre con el código');
r = await pedir('POST', '/vincular', { id: 'corto', cif });
ok(r.s === 400, 'id raro, 400');
r = await pedir('POST', '/vincular', datos);
ok(r.s === 200 && r.j.codigo && r.j.codigo.length === 8, 'lo de antes (sin cerrar) sigue valiendo');
r = await pedir('POST', '/vincular/usar', { codigo: r.j.codigo });
ok(r.s === 200 && r.j.sesion, 'y se usa con el código como antes');
// /borrar: una vez por minuto
r = await pedir('POST', '/borrar', {});
ok(r.s === 429, `/borrar dos veces seguidas: ${r.s}`);
// QR cerrado
const k = sobre.claveQR(); const id = 'A'.repeat(22);
r = await pedir('POST', '/qr/dejar', { id, cif: await sobre.cerrar({ qr: k }, datos) });
ok(r.s === 200, `/qr/dejar cerrado ${r.s} ${r.t}`);
ok(!kv.get(`q:${id}`).v.includes('AQ.secreta'), 'el QR guardado no se lee');
r = await W.fetch(new Request(`https://w.dev/qr/esperar?id=${id}`, { headers: { Origin: ORI } }), env, {});
const jq = await r.json();
ok((await sobre.abrir({ qr: k }, jq.cif)).ia.clave === 'AQ.secreta', 'el ordenador abre el QR');
r = await pedir('POST', '/qr/dejar', { id: 'B'.repeat(22), cif: 'v1.malo' });
ok(r.s === 400, 'cifrado roto, 400');
r = await pedir('POST', '/qr/dejar', { id: 'C'.repeat(22), ...datos });
ok(r.s === 200, 'QR de antes, sin cerrar, sigue valiendo');
// eventos con /hola
kv.clear();
const hola = (ev) => pedir('POST', '/hola', { equipo: 'X', liga: '1', v: '0.7a', canal: 'play', app: 1, ev });
r = await hola({ '2026-11-03': { p: 2, l: 1, e: 1 }, '2026-11-04': { p: 1, c: 1, zz: 9, q: 'x' } });
ok(r.s === 200 && r.j.ev === true, `/hola con eventos los suma (${r.t})`);
let m = kv.get('r:4242').m;
ok(m.tot.p === 3 && m.tot.c === 1 && !m.tot.zz && Object.keys(m.ev).length === 1, `ficha: ${JSON.stringify(m)}`);
r = await hola({ '2026-11-04': { p: 1 } });
ok(r.j.ev === false, 'el mismo día, menos de 12 h: no escribe y la app lo guarda para luego');
kv.get('r:4242').m.ultima -= 13 * 3600e3;
r = await hola({ '2026-11-04': { p: 1 } });
ok(r.j.ev === true && kv.get('r:4242').m.tot.p === 4, 'a las 12 h sí');
// muchas semanas: no pasa de 1 KB
const muchas = {}; for (let i = 0; i < 15; i++) { const d = new Date(Date.UTC(2026, 8, 1 + i * 7)).toISOString().slice(0, 10); muchas[d] = { p: 5, q: 9, b: 3, t: 2, l: 1, e: 1, v: 1, c: 1 }; }
kv.get('r:4242').m.ultima -= 13 * 3600e3;
r = await hola(muchas);
m = kv.get('r:4242').m;
ok(JSON.stringify(m).length <= 1000 && Object.keys(m.ev).length <= 6, `metadatos ${JSON.stringify(m).length} bytes, ${Object.keys(m.ev).length} semanas`);
r = await W.fetch(new Request('https://w.dev/hola/todos', { headers: { Origin: ORI, Authorization: 'Bearer ' + 'x'.repeat(30) } }), { ...env, ADMINS: '4242' }, {});
const todos = await r.json();
ok(todos.registro && todos.registro[0].tot, 'en /hola/todos sale con sus eventos');
// tiempo de uso (0.7t): hasta 10 min de golpe, nunca más de un día, y en /hola/todos los 7 últimos días
const W2 = await import('../src/index.js');
const dias = W2.diasAtras('2026-03-30', 7);
ok(dias.length === 7 && dias[0] === '2026-03-30' && dias[1] === '2026-03-29' && dias[6] === '2026-03-24', `diasAtras con cambio de hora: ${dias.join(',')}`);
r = await pedir('POST', '/uso', { seg: 300 });
ok(r.s === 200 && r.j.seg === 300, `/uso suma 300 s (${r.t})`);
r = await pedir('POST', '/uso', { seg: 5000 });
ok(r.j.seg === 300 + W2.MAX_USO, `/uso no suma más de ${W2.MAX_USO} s de golpe (${r.t})`);
const hoyM = r.j.dia, ayerM = W2.diasAtras(hoyM, 2)[1], antesM = W2.diasAtras(hoyM, 8)[7];
await KV.put(`u:4242:${ayerM}`, '2400'); await KV.put(`u:4242:${antesM}`, '999');
r = await W.fetch(new Request('https://w.dev/hola/todos', { headers: { Origin: ORI, Authorization: 'Bearer ' + 'x'.repeat(30) } }), { ...env, ADMINS: '4242' }, {});
const t2 = await r.json(), yo = t2.lista.find((x) => String(x.uid) === '4242');
ok(yo && yo.segHoy === 900 && yo.segDias[hoyM] === 900 && yo.segDias[ayerM] === 2400 && !(antesM in yo.segDias), `/hola/todos con hoy, ayer y sin el de hace 8 días (${JSON.stringify(yo && yo.segDias)})`);
ok(Array.isArray(t2.dias) && t2.dias[0] === hoyM && t2.dias.length === 7, '/hola/todos devuelve los 7 días');

// ---------- revisión total, sesión 1: frenos del KV (C1), proxy cerrado (A4), /caras (C6) y r: con caducidad (M1) ----------
const ahoraReal = Date.now.bind(Date);
let desfase = 0;
Date.now = () => ahoraReal() + desfase;
const minuto = () => { desfase += 61e3; };
const pide = async ({ m = 'POST', ruta, cuerpo, tk = 'x'.repeat(30), ip = '10.0.0.1', origen = ORI, cab = {}, e = env, crudo }) => {
  const h = { 'content-type': 'application/json', Authorization: `Bearer ${tk}`, 'cf-connecting-ip': ip, ...cab };
  if (origen) h.Origin = origen;
  const r = await W.fetch(new Request(`https://w.dev${ruta}`, { method: m, headers: h, body: crudo != null ? crudo : cuerpo ? JSON.stringify(cuerpo) : undefined }), e, { waitUntil() {} });
  let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch (x) {}
  return { s: r.status, j, t, h: r.headers };
};
kv.clear();
// /vincular anónimo: 30 seguidas desde la misma IP
cuenta.escrituras = 0;
let estados = [];
for (let i = 0; i < 30; i++) estados.push((await pide({ ruta: '/vincular', cuerpo: datos, ip: '1.2.3.4', tk: '' })).s);
ok(cuenta.escrituras === W2.FRENOS.vincular.min && estados.filter((s) => s === 429).length === 30 - W2.FRENOS.vincular.min, `/vincular, 30 seguidas desde una IP: ${cuenta.escrituras} escrituras y ${estados.filter((s) => s === 429).length} con 429`);
r = await pide({ ruta: '/vincular', cuerpo: datos, ip: '1.2.3.5', tk: '' });
ok(r.s === 200, 'otra IP sigue pudiendo');
// a lo largo del día: como mucho 20 por IP aunque espere cada minuto
cuenta.escrituras = 0;
for (let i = 0; i < 10; i++) { minuto(); for (let n = 0; n < 6; n++) await pide({ ruta: '/vincular', cuerpo: datos, ip: '1.2.3.6', tk: '' }); }
ok(cuenta.escrituras === W2.FRENOS.vincular.dia, `/vincular en 10 minutos desde una IP: ${cuenta.escrituras} escrituras (tope ${W2.FRENOS.vincular.dia} al día)`);
// IPv6: toda la /64 cuenta como una
ok(W2.ipDe(new Request('https://w', { headers: { 'cf-connecting-ip': '2a01:4f8:c0:1::abcd' } })) === W2.ipDe(new Request('https://w', { headers: { 'cf-connecting-ip': '2a01:04f8:00c0:0001:ffff::1' } })), 'IPv6: la misma /64 es la misma IP');
minuto();
cuenta.escrituras = 0;
for (let i = 0; i < 6; i++) await pide({ ruta: '/vincular', cuerpo: datos, ip: `2a01:4f8:c0:1::${i + 1}`, tk: '' });
for (let i = 0; i < 6; i++) await pide({ ruta: '/vincular', cuerpo: datos, ip: `2a01:4f8:c0:1:${i + 1}::9`, tk: '' });
ok(cuenta.escrituras === W2.FRENOS.vincular.min, `12 IPv6 de la misma /64: ${cuenta.escrituras} escrituras`);
// el KV lleno: 503 claro, no 500 ni un código que no funciona
const env2 = { VINCULOS: KV, ADMINS: '667015' };
cuenta.lleno = true;
r = await pide({ ruta: '/vincular', cuerpo: datos, ip: '5.5.5.5', tk: '', e: env2 });
ok(r.s === 503 && /tope/.test(r.j.e) && !r.j.codigo, `/vincular con el KV lleno: ${r.s} «${r.j && r.j.e}»`);
r = await pide({ ruta: '/vincular', cuerpo: { id: await sobre.idDeCodigo(sobre.nuevoCodigo()), cif }, ip: '5.5.5.6', tk: '', e: env2 });
ok(r.s === 503, `lo cerrado con el KV lleno: ${r.s}`);
r = await pide({ ruta: '/fallos', cuerpo: { texto: 'falla' }, ip: '5.5.5.7', e: env2 });
ok(r.s === 503 && /tope/.test(r.j.e), `/fallos con el KV lleno: ${r.s} «${r.j && r.j.e}»`);
cuenta.lleno = false;
// sin KV: 503, nada de la caché
r = await pide({ ruta: '/vincular', cuerpo: datos, ip: '5.5.5.8', tk: '', e: { ADMINS: '1' } });
ok(r.s === 503, `/vincular sin KV: ${r.s}`);
// el formato de antes se puede apagar
r = await pide({ ruta: '/vincular', cuerpo: datos, ip: '5.5.5.9', tk: '', e: { ...env2, FORMATO_VIEJO: 'no' } });
ok(r.s === 400 && /Actualiza/.test(r.j.e), `FORMATO_VIEJO=no: lo de antes da ${r.s}`);
r = await pide({ ruta: '/qr/dejar', cuerpo: { id: 'D'.repeat(22), ...datos }, ip: '5.5.5.9', tk: '', e: { ...env2, FORMATO_VIEJO: 'no' } });
ok(r.s === 400, `FORMATO_VIEJO=no: el QR sin cerrar da ${r.s}`);
// entre todos: 300 al día, aunque cada una venga de una IP distinta
minuto();
cuenta.escrituras = 0;
estados = [];
for (let i = 0; i < 400; i++) estados.push((await pide({ ruta: '/vincular', cuerpo: datos, ip: `9.9.${i >> 8}.${i & 255}`, tk: '' })).s);
ok(cuenta.escrituras <= W2.FRENOS.vincular.todos && estados.at(-1) === 503, `/vincular desde 400 IP: ${cuenta.escrituras} escrituras y la última da ${estados.at(-1)}`);
// /vincular/usar: no se puede probar códigos sin parar
estados = [];
for (let i = 0; i < 20; i++) estados.push((await pide({ ruta: '/vincular/usar', cuerpo: { codigo: 'ABCDEFGH' }, ip: '6.6.6.6', tk: '' })).s);
ok(estados.filter((s) => s === 429).length === 20 - W2.FRENOS.usar.min, `/vincular/usar, 20 seguidas: ${estados.filter((s) => s === 429).length} con 429`);
// /qr/esperar: el ordenador pregunta cada 2 s (30 al minuto) y pasa
estados = [];
for (let i = 0; i < 30; i++) estados.push((await pide({ m: 'GET', ruta: `/qr/esperar?id=${'E'.repeat(22)}`, ip: '6.6.6.7' })).s);
ok(estados.every((s) => s === 204), 'el QR, preguntando cada 2 s, no se frena');
// /uso: 300 llamadas de una cuenta
kv.clear(); minuto();
cuenta.escrituras = 0;
estados = [];
for (let i = 0; i < 300; i++) estados.push((await pide({ ruta: '/uso', cuerpo: { seg: 60 }, tk: 'y'.repeat(30) })).s);
ok(cuenta.escrituras === 1 && estados.filter((s) => s === 200).length === W2.FRENOS.uso.min, `/uso, 300 seguidas: ${cuenta.escrituras} escritura y ${estados.filter((s) => s === 200).length} contestadas`);
// cada minuto: escribe cada 4, pero el total que devuelve cuenta todo
cuenta.escrituras = 0;
let seg = 0;
for (let i = 0; i < 12; i++) { minuto(); r = await pide({ ruta: '/uso', cuerpo: { seg: 60 }, tk: 'y'.repeat(30) }); seg = r.j.seg; }
ok(cuenta.escrituras === 3 && seg === 360 + 12 * 60, `/uso cada minuto durante 12 min: ${cuenta.escrituras} escrituras, total ${seg} s`);
ok(Number(kv.get(`u:2222:${r.j.dia}`).v) <= seg, 'lo guardado no pasa de lo contado');
// /hola: alternar la versión no escribe cada vez
kv.clear();
cuenta.escrituras = 0;
for (let i = 0; i < 10; i++) { minuto(); await pide({ ruta: '/hola', cuerpo: { equipo: 'X', liga: '1', v: i % 2 ? '0.7y' : '0.7z', canal: 'web', app: 1 }, tk: 'h'.repeat(30) }); }
const escP = [...kv.keys()].filter((k) => k.startsWith('p:')).length;
ok(cuenta.escrituras <= 1 + W2.CAMBIOS_DIA + 1, `/hola con 10 cambios de versión: ${cuenta.escrituras} escrituras (p: y r:), ${escP} ficha`);
ok(kv.get('p:4242').m.nc === W2.CAMBIOS_DIA, `apunta los cambios del día: ${kv.get('p:4242').m.nc}`);
// r:<uid> caduca a los 400 días (se renueva al escribir)
ok(kv.get('r:4242').ttl === 400 * 86400, `r: con expirationTtl ${kv.get('r:4242').ttl}`);
estados = [];
minuto();
for (let i = 0; i < 10; i++) estados.push((await pide({ ruta: '/hola', cuerpo: { v: '0.7z' }, tk: 'h'.repeat(30) })).s);
ok(estados.filter((s) => s === 429).length === 10 - W2.FRENOS.hola.min, '/hola, 10 en un minuto: el resto 429');
// /fallos: 5 avisos al día por cuenta y capturas de hasta 350 KB
kv.clear(); minuto();
const cap = (n) => 'data:image/jpeg;base64,' + 'A'.repeat(n);
r = await pide({ ruta: '/fallos', cuerpo: { texto: 'uno', capturas: [cap(300000), cap(W2.MAX_CAPTURA + 10)] }, ip: '7.7.7.1', tk: 'f'.repeat(30) });
ok(r.s === 200 && [...kv.keys()].filter((k) => k.startsWith('fc:')).length === 1, `/fallos: la captura de más de 350 KB no se guarda (${[...kv.keys()].filter((k) => k.startsWith('fc:')).length} guardada)`);
for (let i = 0; i < 4; i++) { minuto(); await pide({ ruta: '/fallos', cuerpo: { texto: `más ${i}` }, ip: `7.7.7.${i + 2}`, tk: 'f'.repeat(30) }); }
minuto();
r = await pide({ ruta: '/fallos', cuerpo: { texto: 'el sexto' }, ip: '7.7.7.9', tk: 'f'.repeat(30) });
ok(r.s === 429 && [...kv.keys()].filter((k) => k.startsWith('f:4242:')).length === W2.AL_DIA, `/fallos: el sexto del día da ${r.s}`);
// /caras: solo de una liga en la que estás
await KV.put('p:1111', '1', { metadata: { uid: '1111', foto: 'https://assets-fantasy.llt-services.com/u/1111.png' } });
r = await pide({ m: 'GET', ruta: '/caras?liga=77' });
ok(r.s === 200 && r.j.caras['1111'], `/caras de tu liga: ${r.s}`);
r = await pide({ m: 'GET', ruta: '/caras?liga=88' });
ok(r.s === 403 && !r.t.includes('1111.png'), `/caras de una liga en la que no estás: ${r.s}`);
// ---------- A4: /p e /img, con el Origin puesto a mano ----------
const p = (url, metodo = 'GET', cab = {}, cuerpo, origen = ORI) => pide({ ruta: '/p', origen, crudo: cuerpo || '', cab: { 'x-u': url, 'x-m': metodo, 'x-h': JSON.stringify(cab) } });
const TOKEN = 'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token?p=B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN';
pedidos.length = 0;
r = await p(TOKEN, 'POST', { 'content-type': 'application/x-www-form-urlencoded' }, 'grant_type=refresh_token');
ok(r.h.get('x-s') === '200' && pedidos.length === 1, `POST al token de login: x-s ${r.h.get('x-s')}`);
r = await p('https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/authorize', 'POST', {}, 'x=1');
ok(r.h.get('x-s') === '0' && pedidos.length === 1, `POST a login con otra ruta: no pasa (${r.t})`);
r = await p(TOKEN, 'GET');
ok(r.h.get('x-s') === '0' && pedidos.length === 1, 'GET al token: no pasa');
r = await p('https://login.laliga.es:8443/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token', 'POST', {}, 'x');
ok(r.h.get('x-s') === '0' && pedidos.length === 1, 'con puerto: no pasa');
r = await p('https://fantasy-api.llt-services.com/api/v3/player/1', 'GET');
ok(r.h.get('x-s') === '0', 'la API de LaLiga sin sesión: no pasa');
r = await p('https://fantasy-api.llt-services.com/api/v3/player/1', 'GET', { Authorization: 'Bearer ' + 'z'.repeat(40) });
ok(r.h.get('x-s') === '200', 'con sesión: pasa');
r = await p('https://fantasy-api.llt-services.com/stats/v1/competition/1/stats/week/12', 'GET', { Authorization: 'Bearer ' + 'z'.repeat(40) });
ok(r.h.get('x-s') === '200', 'las estadísticas de la jornada (/stats/) con sesión: pasan');
r = await p('https://fantasy-api.llt-services.com/api/v1/competition/1/players?x-lang=es', 'GET');
ok(r.h.get('x-s') === '200', 'la lista de jugadores de la demo, sin sesión: pasa');
r = await p('https://fantasy-api.llt-services.com/api/v3/league/1/market/bid', 'POST', { Authorization: 'Bearer ' + 'z'.repeat(40) }, '{}');
ok(r.h.get('x-s') === '0', 'POST a la API de LaLiga (pujar): no pasa');
r = await p('https://fantasy-api.llt-services.com/otra/cosa', 'GET', { Authorization: 'Bearer ' + 'z'.repeat(40) });
ok(r.h.get('x-s') === '0', 'fuera de /api/: no pasa');
r = await p('https://www.futbolfantasy.com/laliga/equipos/x', 'PUT', {}, 'x');
ok(r.h.get('x-s') === '0', 'PUT a futbolfantasy: no pasa');
r = await p('https://www.futbolfantasy.com/laliga/equipos/x', 'POST', {}, 'x');
ok(r.h.get('x-s') === '0', 'POST a futbolfantasy: no pasa');
r = await p('https://www.futbolfantasy.com/laliga/equipos/x');
ok(r.h.get('x-s') === '200', 'GET a futbolfantasy: pasa');
r = await p('https://www.futbolfantasy.com/x', 'GET', {}, '', 'https://fantasy-manager-malo.pages.dev');
ok(r.s === 403, `Origin de otro proyecto de Pages: ${r.s}`);
r = await p('https://www.futbolfantasy.com/x', 'GET', {}, '', 'https://web-prueba.fantasy-manager-61v.pages.dev');
ok(r.s === 200 && r.h.get('x-s') === '200', 'Origin de una vista previa de Carlos: pasa');
r = await p('https://www.futbolfantasy.com/x', 'GET', {}, '', null);
ok(r.s === 403, 'sin Origin: 403');
const img = (u) => pide({ m: 'GET', ruta: `/img?u=${encodeURIComponent(u)}` });
r = await img('https://assets-fantasy.llt-services.com/players/1.png');
ok(r.s === 200 && /^image\//.test(r.h.get('content-type')), `/img de una cara: ${r.s} ${r.h.get('content-type')}`);
r = await img('https://assets-fantasy.llt-services.com/x.html');
ok(r.s === 415 && !/public/.test(r.h.get('cache-control')), `/img que no es imagen: ${r.s}, sin caché`);
r = await img('https://www.futbolfantasy.com/x.png');
ok(r.s === 403, `/img de otro sitio: ${r.s}`);
r = await img('https://assets-fantasy.llt-services.com:444/players/1.png');
ok(r.s === 403, `/img con puerto: ${r.s}`);
// los topes por día van en el Durable Object Emparejar (el del QR): uno falso con su almacén en memoria
const objetos = new Map();
const QR = {
  idFromName: (n) => n,
  get: (id) => {
    if (!objetos.has(id)) {
      const m = new Map();
      const storage = { get: async (k) => m.get(k), put: async (k, v) => { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) m.set(a, b); else m.set(k, v); }, deleteAll: async () => m.clear(), setAlarm: async () => {} };
      objetos.set(id, new W2.Emparejar({ storage }));
    }
    const o = objetos.get(id);
    return { fetch: (u, op) => o.fetch(new Request(u, op)) };
  },
};
const envDO = { VINCULOS: KV, ADMINS: '667015', QR };
cuenta.escrituras = 0;
for (let i = 0; i < 10; i++) { minuto(); for (let n = 0; n < 6; n++) await pide({ ruta: '/vincular', cuerpo: datos, ip: '8.8.8.8', tk: '', e: envDO }); }
ok(cuenta.escrituras === W2.FRENOS.vincular.dia && [...objetos.keys()].some((k) => k.includes('vincular|8.8.8.8')), `con el Durable Object: ${cuenta.escrituras} escrituras en 10 minutos desde una IP`);
r = await pide({ ruta: '/qr/dejar', cuerpo: { id: 'F'.repeat(22), cif: await sobre.cerrar({ qr: sobre.claveQR() }, datos) }, ip: '8.8.8.9', tk: '', e: envDO });
ok(r.s === 200, `el QR sigue yendo con el objeto: ${r.s}`);
