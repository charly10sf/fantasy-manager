/* La inercia del motor, medida con los datos PÚBLICOS de LaLiga (24 nov, Fran: «la app sigue sin entender las tendencias»).
   medir-motor.mjs necesita los datos de una liga de verdad, que no van en el repo. Esto no: baja de la API sin sesión la
   lista de jugadores, el valor de cada uno día a día desde agosto y las jornadas con sus fechas, monta con eso una liga
   vacía (sin mánagers) y le pasa la misma medida de la inercia de medir-motor.mjs: para cada día pasado, lo que el motor
   habría dicho de cada jugador (fase y lo que esperaba a 3 y 7 días) frente a lo que pasó.

   Uso:  node .github/ia/medir-inercia-publico.mjs <carpeta-caché> [desde AAAA-MM-DD] [valor mínimo en M, 1.5]
   La carpeta guarda lo bajado (jug.json, mv/<id>.json, wk/<n>.json): con ella llena no se vuelve a pedir nada.
   Saca por la salida las cifras agregadas (JSON) y ejemplos con nombres de jugadores. No hay nada de ninguna liga. */
import fs from 'node:fs';
import path from 'node:path';

const H = 'https://fantasy-api.llt-services.com';
const dir = process.argv[2], desde = process.argv[3] || null, minM = Number(process.argv[4] || 1.5);
if (!dir) { console.error('uso: node .github/ia/medir-inercia-publico.mjs <carpeta-caché> [desde] [valor mínimo en M]'); process.exit(1); }
fs.mkdirSync(path.join(dir, 'mv'), { recursive: true }); fs.mkdirSync(path.join(dir, 'wk'), { recursive: true });

async function traer(arch, url, cab = {}) {
  const f = path.join(dir, arch);
  if (fs.existsSync(f) && fs.statSync(f).size > 2) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const r = await fetch(url, { headers: { 'x-app': '2', ...cab }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const t = await r.text(); fs.writeFileSync(f, t); return JSON.parse(t);
}
const num = (x) => Number(x) || 0;

const lista = (await traer('jug.json', `${H}/api/v1/competition/1/players?x-lang=es`, { Origin: 'https://medida.fantasymanagerapp.com' }))
  .filter((j) => num(j.positionId) >= 1 && num(j.positionId) <= 4 && num(j.marketValue) >= minM * 1e6);
const semanas = [];
for (let n = 1; n <= 38; n++) { let w; try { w = await traer(`wk/${n}.json`, `${H}/stats/v1/competition/1/stats/week/${n}?x-lang=es`); } catch (e) { break; } if (!Array.isArray(w) || !w.length) break; semanas.push({ n, ps: w }); }
const valores = {};
for (let i = 0; i < lista.length; i += 8) await Promise.all(lista.slice(i, i + 8).map(async (j) => { valores[j.id] = await traer(`mv/${j.id}.json`, `${H}/api/v1/competition/1/player/${j.id}/market-value?x-lang=es`); }));

globalThis.localStorage ||= { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 };
// (el motor arrastra módulos pensados para el navegador: con esto se dejan importar en node)
globalThis.window ||= globalThis;
globalThis.document ||= { addEventListener() {}, querySelector: () => null, documentElement: { classList: { add() {}, remove() {}, toggle() {} } }, visibilityState: 'visible' };
globalThis.addEventListener ||= () => {};
const raiz = new URL('../../web/js/', import.meta.url);
const { analizar, ofertaDueno } = await import(new URL('motor.js', raiz));
const ventasInercia = () => [];   // (la pieza de la inercia no la usa, y acciones.js no se puede importar fuera del navegador)
const U = await import(new URL('util.js', raiz));
const { medir } = await import(new URL('./medir-motor.mjs', import.meta.url));

// la liga vacía: los jugadores de verdad, las jornadas de verdad y un solo equipo sin nadie
const equipos = {}, partidos = [], resultados = [], calPasado = [];
for (const { n, ps } of semanas) for (const p of ps) {
  for (const l of [p.local, p.visitor]) if (l && l.id != null) equipos[String(l.id)] = { nombre: l.mainName, corto: String(l.mainName || '').slice(0, 3).toUpperCase(), escudo: null };
  const f = { id: `p${p.id}`, jornada: n, fecha: Date.parse(p.date), localId: String(p.local.id), visitanteId: String(p.visitor.id), local: p.local.mainName, visitante: p.visitor.mainName, gl: num(p.localScore), gv: num(p.visitorScore), st: p.matchState, estado: p.matchState };
  if (p.matchState === 7) { resultados.push({ jornada: n, localId: f.localId, visitanteId: f.visitanteId, gl: f.gl, gv: f.gv }); calPasado.push(f); } else partidos.push(f);
}
const maestro = {}, v = {};
for (const j of lista) {
  const sem = (j.weekPoints || []).map((w) => ({ n: w.weekNumber, pts: num(w.points) })).sort((a, b) => a.n - b.n);
  maestro[j.id] = { id: j.id, nombre: j.nickname, largo: j.nickname, equipoId: String(j.teamId), equipo: (equipos[String(j.teamId)] || {}).nombre || '', pos: num(j.positionId), valor: num(j.marketValue), puntos: num(j.points), media: Math.round(num(j.averagePoints) * 10) / 10, estado: j.playerStatus || 'ok', img: null, semanas: sem };
  v[j.id] = (valores[j.id] || []).map((x) => [String(x.date).slice(0, 10), num(x.marketValue)]).filter((x) => x[1]);
}
const jornada = (partidos[0] || {}).jornada || (semanas[semanas.length - 1] || {}).n || 1;
const D = { t: Date.now(), demo: false, yo: { teamId: 't1', userId: 'u1', manager: 'yo', nombre: 'Medida' }, liga: { id: 'l1', nombre: 'Medida' }, ligas: [], equipos, equiposT: {},
  clasif: [{ teamId: 't1', userId: 'u1', nombre: 'Medida', manager: 'yo', puntos: 0, valor: 0, pos: 1 }], plantillas: { t1: [] }, maestro, mercado: [], actividad: [], dinero: 0, dineros: {},
  valorEquipo: 0, jornada, partidos, resultados, tendencias: {}, avisos: [], misVentas: [] };
const todos = Object.values(v).flat().map((x) => x[0]).sort();
const X = { datos: D, hist: { v, eq: {}, yo: [], mov: [] }, acthist: { desde: Date.parse(todos[0]), lista: [] }, det: {}, cfg: { deuda: 20 }, calPasado };

const r = await medir(X, { analizar, ofertaDueno, ventasInercia, U, c: X.cfg }, { piezas: ['inercia'], desde: desde || U.otroDia(todos[0], 28) });
const pares = r.inercia._pares;

/* ---------- lo que no mide medir-motor: cada fase, día a día ---------- */
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
const mediana = (l) => { const o = [...l].sort((a, b) => a - b); return o.length ? o[Math.floor(o.length / 2)] : 0; };
const P = r._P;
const fila = (l) => {
  const con3 = l.filter((x) => x.r3 != null);
  return { n: l.length,
    bajan3: con3.length ? r2(con3.filter((x) => x.r3 < -x.quieto).length / con3.length) : null, suben3: con3.length ? r2(con3.filter((x) => x.r3 > x.quieto).length / con3.length) : null,
    real3pct: r1(media(con3.map((x) => x.r3 / x.v)) * 100), previsto3pct: r1(media(con3.map((x) => x.p3 / x.v)) * 100),
    bajan7: r2(l.filter((x) => x.r7 < -x.quieto).length / l.length), suben7: r2(l.filter((x) => x.r7 > x.quieto).length / l.length),
    real7pct: r1(media(l.map((x) => x.r7 / x.v)) * 100), previsto7pct: r1(media(l.map((x) => x.p7 / x.v)) * 100), realMediana7pct: r1(mediana(l.map((x) => x.r7 / x.v)) * 100) };
};
const porFase = {};
for (const x of pares) (porFase[x.fase] ||= []).push(x);
// el primer día en negativo después de subir (lo de Bernardo Silva, 24 nov): ¿sigue bajando?
const primerGiro = pares.filter((x) => { if (x.fase !== 'giro') return false; const ay = P.vDia(x.pid, U.otroDia(U.diaDe(x.T), -1)), ant = P.vDia(x.pid, U.otroDia(U.diaDe(x.T), -2)); return ay && ant && ay - ant >= 0; });
// los errores gordos de dirección: el motor dice que sube (acelera o sube) y en 7 días ha bajado más de un 3 %, y al revés
const sube = pares.filter((x) => x.fase === 'acelera' || x.fase === 'sube'), bajaF = pares.filter((x) => x.fase === 'baja' || x.fase === 'giro');
const ej = (l, k) => [...l].sort(k).slice(0, 8).map((x) => ({ nombre: x.nombre, dia: U.diaDe(x.T), fase: x.fase, valorM: r1(x.v / 1e6), previsto7M: r2(x.p7 / 1e6), real7M: r2(x.r7 / 1e6) }));
const out = {
  jugadores: lista.length, dias: `${r.desde} → ${r.hasta}`, pares: pares.length, total: r.inercia.total, porFase: Object.fromEntries(Object.entries(porFase).map(([k, l]) => [k, fila(l)])),
  primerDiaDeGiro: fila(primerGiro),
  diceQueSubeYBajaMasDe3: { n: sube.length, veces: r2(sube.filter((x) => x.r7 < -0.03 * x.v).length / Math.max(1, sube.length)) },
  diceQueBajaYSubeMasDe3: { n: bajaF.length, veces: r2(bajaF.filter((x) => x.r7 > 0.03 * x.v).length / Math.max(1, bajaF.length)) },
  porPrecio: r.inercia.porPrecio,
  peoresSube: ej(sube, (a, b) => a.r7 / a.v - b.r7 / b.v), peoresBaja: ej(bajaF, (a, b) => b.r7 / b.v - a.r7 / a.v),
};
// VOLCAR=archivo: cada caso con sus cambios de antes y de después, para ajustar la proyección fuera
if (process.env.VOLCAR) {
  const filas = pares.filter((x) => x.fase === 'giro' || x.fase === 'parado' || x.fase === 'frena').map((x) => {
    const d = U.diaDe(x.T), vd = (k) => P.vDia(x.pid, U.otroDia(d, k));
    return { n: x.nombre, d, f: x.fase, v: x.v, ult: x.ult, q: x.quieto, p3: x.p3, p7: x.p7, antes: [-5, -4, -3, -2, -1, 0].map(vd), desp: [1, 2, 3, 4, 5, 6, 7].map(vd) };
  });
  fs.writeFileSync(process.env.VOLCAR, JSON.stringify(filas));
}
console.log(JSON.stringify(out, null, 1));
