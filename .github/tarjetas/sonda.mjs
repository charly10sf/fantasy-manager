// Sonda para las tarjetas con imagen del bot de X (solo lectura, sin secretos ni token).
// Comprueba: histórico de valor sin token, formato de fotos y escudos, campos de cada jugador en stats/week/{n}.
// Deja en ./salida los datos de la jornada y las imágenes que usarían las tarjetas (se sube como artefacto).
import { mkdirSync, writeFileSync } from 'node:fs';

const H = 'https://fantasy-api.llt-services.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const N = Number(process.env.JORNADA || 11);
const OUT = 'salida';
for (const d of ['', '/img', '/valor', '/fichas']) mkdirSync(OUT + d, { recursive: true });

async function pedir(url, cab = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...cab }, signal: AbortSignal.timeout(20000) });
    const buf = Buffer.from(await r.arrayBuffer());
    return { s: r.status, tipo: r.headers.get('content-type'), buf, ms: Date.now() - t0, url: r.url };
  } catch (e) { return { s: 0, err: String(e.message || e), buf: Buffer.alloc(0), ms: Date.now() - t0 }; }
}
const json = async (url) => { const r = await pedir(url, { 'x-app': '2' }); if (r.s !== 200) throw new Error(`HTTP ${r.s} ${url}`); return JSON.parse(r.buf.toString()); };

function formato(b) {
  if (b.length < 12) return { f: 'vacío' };
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { f: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { f: 'jpeg', w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
    return { f: 'jpeg' };
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const c = b.toString('ascii', 12, 16);
    if (c === 'VP8X') return { f: 'webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (c === 'VP8L') { const v = b.readUInt32LE(21); return { f: 'webp', w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
    if (c === 'VP8 ') return { f: 'webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    return { f: 'webp' };
  }
  const t = b.toString('utf8', 0, 300);
  if (/<svg|<\?xml/i.test(t)) { const vb = t.match(/viewBox="([^"]+)"/); return { f: 'svg', viewBox: vb && vb[1] }; }
  return { f: 'desconocido', cabeza: b.toString('hex', 0, 8) };
}
const ext = (f) => ({ png: 'png', jpeg: 'jpg', webp: 'webp', svg: 'svg' }[f] || 'bin');

console.log(`# Sonda de tarjetas · jornada ${N}`);

// 1) jugadores, equipos y estadísticas de la jornada
const jugadores = await json(`${H}/api/v1/competition/1/players?x-lang=es`);
const equipos = await json(`${H}/api/v3/teams-master?x-lang=es`);
const stats = await json(`${H}/stats/v1/competition/1/stats/week/${N}?x-lang=es`);
writeFileSync(`${OUT}/jugadores.json`, JSON.stringify(jugadores));
writeFileSync(`${OUT}/equipos.json`, JSON.stringify(equipos));
writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats));
console.log(`jugadores ${jugadores.length} · equipos ${Array.isArray(equipos) ? equipos.length : Object.keys(equipos).length} · partidos ${stats.length}`);

// 2) campos de stats/week/{n}
const m0 = stats.find((m) => (m.local?.players || []).length);
console.log('\n## stats/week: claves de un partido:', Object.keys(m0).join(', '));
console.log('claves de local:', Object.keys(m0.local).join(', '));
const claves = {};
let total = 0;
for (const m of stats) for (const l of [m.local, m.visitor]) for (const p of l?.players || []) { total++; for (const k of Object.keys(p)) claves[k] = (claves[k] || 0) + 1; }
console.log(`jugadores en la jornada: ${total} · claves (cuántos las traen):`, JSON.stringify(claves));
console.log('un jugador entero:', JSON.stringify(m0.local.players[0]).slice(0, 1500));
const cero = [];
for (const m of stats) for (const l of [m.local, m.visitor]) for (const p of l?.players || []) if (Number(p.weekPoints) === 0) cero.push(p);
console.log(`con 0 puntos: ${cero.length}; ejemplo:`, JSON.stringify(cero[0]).slice(0, 600));

// 3) fotos y escudos
const e0 = Array.isArray(equipos) ? equipos[0] : Object.values(equipos)[0];
console.log('\n## teams-master: un equipo:', JSON.stringify(e0).slice(0, 800));
console.log('## jugador de la lista: claves:', Object.keys(jugadores[0]).join(', '));
console.log('image de ejemplo:', JSON.stringify(jugadores[0].images || jugadores[0].image).slice(0, 400));

const listaEq = Array.isArray(equipos) ? equipos : Object.values(equipos);
const resumenImg = {};
async function bajar(url, nombre) {
  if (!url) return null;
  const r = await pedir(url);
  const f = formato(r.buf);
  const k = `${r.s} ${f.f}`;
  resumenImg[k] = (resumenImg[k] || 0) + 1;
  if (r.s === 200 && r.buf.length) writeFileSync(`${OUT}/img/${nombre}.${ext(f.f)}`, r.buf);
  return { url, s: r.s, tipo: r.tipo, bytes: r.buf.length, ms: r.ms, ...f };
}
const escudos = {};
for (const e of listaEq) {
  escudos[e.id] = { color: await bajar(e.badgeColor, `escudo-${e.id}`), blanco: await bajar(e.badgeWhite, `escudo-${e.id}-blanco`) };
}
console.log('escudo 1:', JSON.stringify(escudos[listaEq[0].id]));

// caras: los 3 mejores y los 3 peores de cada equipo en la jornada, y los 5 mejores de la jornada
const porId = new Map(jugadores.map((j) => [String(j.id), j]));
const quiero = new Set();
for (const m of stats) for (const l of [m.local, m.visitor]) {
  const o = (l?.players || []).filter((p) => p.weekPoints != null).sort((a, b) => b.weekPoints - a.weekPoints);
  o.slice(0, 3).concat(o.slice(-4)).forEach((p) => quiero.add(String(p.id)));
}
const caras = {};
for (const id of quiero) {
  const j = porId.get(id);
  const url = j && (typeof j.images === 'object' ? (j.images?.transparent?.['256x256'] || j.images?.big || Object.values(j.images || {})[0]) : j.image);
  caras[id] = await bajar(typeof url === 'string' ? url : j?.image, `cara-${id}`);
}
const una = Object.values(caras).find(Boolean);
console.log(`caras pedidas ${quiero.size}; una:`, JSON.stringify(una));
console.log('resumen de descargas (estado formato: cuántas):', JSON.stringify(resumenImg));
writeFileSync(`${OUT}/imagenes.json`, JSON.stringify({ escudos, caras }, null, 1));

// 4) histórico de valor: 4 rutas, con y sin x-app
const muestra = [...stats.flatMap((m) => [...(m.local?.players || []), ...(m.visitor?.players || [])])].sort((a, b) => b.weekPoints - a.weekPoints).slice(0, 8).map((p) => String(p.id));
const RUTAS = [(id) => `/api/v1/competition/1/player/${id}/market-value`, (id) => `/api/v3/player/${id}/market-value`, (id) => `/api/v4/player/${id}/market-value`, (id) => `/api/v5/player/${id}/market-value`, (id) => `/api/v1/player/${id}/market-value`];
console.log('\n## histórico de valor (sin token)');
for (const [i, ruta] of RUTAS.entries()) for (const cab of [{}, { 'x-app': '2' }]) {
  const r = await pedir(`${H}${ruta(muestra[0])}?x-lang=es`, cab);
  console.log(`ruta ${i} ${ruta('ID')} ${Object.keys(cab).length ? 'x-app' : 'sin cabeceras'} → ${r.s} ${r.tipo || ''} ${r.buf.length} B ${r.ms} ms · ${r.buf.toString().slice(0, 300).replace(/\s+/g, ' ')}`);
  if (r.s === 200) writeFileSync(`${OUT}/valor/ruta${i}-${muestra[0]}.json`, r.buf);
}
// la ficha del jugador puede traer el histórico dentro
for (const id of muestra) {
  const r = await pedir(`${H}/api/v1/competition/1/player/${id}?x-lang=es`, { 'x-app': '2' });
  if (r.s !== 200) { console.log(`ficha ${id}: ${r.s}`); continue; }
  writeFileSync(`${OUT}/fichas/${id}.json`, r.buf);
  const d = JSON.parse(r.buf.toString());
  let hist = null; const ruta = [];
  const visitar = (x, camino) => {
    if (hist || !x || typeof x !== 'object') return;
    if (Array.isArray(x)) { if (x.length > 2 && x[0] && typeof x[0] === 'object' && 'marketValue' in x[0]) { hist = x; ruta.push(camino); return; } x.slice(0, 50).forEach((y, k) => visitar(y, `${camino}[${k}]`)); return; }
    for (const [k, v] of Object.entries(x)) visitar(v, `${camino}.${k}`);
  };
  visitar(d, '');
  console.log(`ficha ${id}: claves ${Object.keys(d).join(', ')} · histórico dentro: ${hist ? `${ruta[0]} (${hist.length} puntos; ${JSON.stringify(hist[0])} … ${JSON.stringify(hist[hist.length - 1])})` : 'no'}`);
}
// los que valgan, para todos los de la muestra con la primera ruta que dé 200
for (const id of muestra.slice(1)) for (const [i, ruta] of RUTAS.entries()) {
  const r = await pedir(`${H}${ruta(id)}?x-lang=es`, { 'x-app': '2' });
  if (r.s === 200) { writeFileSync(`${OUT}/valor/ruta${i}-${id}.json`, r.buf); break; }
}
console.log('\nfin');
