// Prueba sin red del Worker (0.7a): /borrar, /vincular y /qr cerrados y como antes, y /hola con eventos.
// Uso: node worker/prueba/datos.mjs (sale «MAL» y código 1 si algo falla)
// prueba del Worker: /borrar, /vincular y /qr con lo cerrado, y lo de antes
import * as sobre from '../../web/js/sobre.js';
const W = (await import('../src/index.js')).default;
const kv = new Map();
const KV = {
  async get(k) { const v = kv.get(k); return v ? v.v : null; },
  async getWithMetadata(k) { const v = kv.get(k); return v ? { value: v.v, metadata: v.m } : { value: null, metadata: null }; },
  async put(k, v, o = {}) { kv.set(k, { v, m: o.metadata || null }); },
  async delete(k) { kv.delete(k); },
  async list({ prefix }) { return { keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name, metadata: kv.get(name).m })), list_complete: true }; },
};
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => true } };
const fetchReal = globalThis.fetch;
globalThis.fetch = async (u, o) => { if (String(u).includes('/user/me')) return new Response(JSON.stringify({ id: 4242, managerName: 'Pepe' }), { status: 200 }); throw new Error('sin red: ' + u); };
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
