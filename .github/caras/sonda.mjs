// Sonda (solo lectura, sin token): qué fotos y escudos da LaLiga sin sesión y cuántos jugadores de la liga de ejemplo casan.
import { traer, casar, parecido } from './caras-demo.js';
import { demo } from './demo.js';
import * as N from './normalizar.js';
const http = async (m, u, { cabeceras, tiempo }) => { try { const r = await fetch(u, { method: m, headers: cabeceras, signal: AbortSignal.timeout(tiempo) }); return { s: r.status, b: await r.text() }; } catch (e) { return { s: 0, e: e.message }; } };
const UA = { 'x-app': '2', 'x-lang': 'es', Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/130.0' };
const forma = (x, p = 0) => x == null ? String(x) : Array.isArray(x) ? `[${x.length}${x.length ? ' × ' + forma(x[0], p + 1) : ''}]` : typeof x !== 'object' ? typeof x : p > 2 ? '{…}' : '{' + Object.keys(x).map((k) => k + (x[k] && typeof x[k] === 'object' ? ':' + forma(x[k], p + 1) : '')).join(', ') + '}';
for (const ruta of ['/api/v1/competition/1/players', '/api/v3/teams-master', '/api/v4/teams-master', '/api/v1/teams', '/stats/v1/competition/1/stats/week/11']) {
  const r = await http('GET', 'https://fantasy-api.llt-services.com' + ruta + '?x-lang=es', { cabeceras: UA, tiempo: 20000 });
  console.log('##', ruta, r.s, (r.b || '').length);
  if (r.s === 200) { const j = JSON.parse(r.b); const l = N.lista(j); console.log('forma', forma(l.length ? l[0] : j).slice(0, 1500)); if (l[0]) console.log('ej', JSON.stringify(l[0]).slice(0, 1200)); }
}
const { D } = demo();
const lista = Object.values(D.maestro).map(({ id, nombre, equipoId }) => ({ id, nombre, equipoId }));
const g = await traer(http, lista);
console.log('## casados', g.casados, 'de', g.total, '· con foto', Object.keys(g.caras).length, '· escudos', Object.keys(g.escudos).length);
console.log('ej cara', Object.values(g.caras)[0], '· ej escudo', Object.values(g.escudos)[0]);
// los que no casan: dónde está ahora alguien con ese nombre
const r = await http('GET', 'https://fantasy-api.llt-services.com/api/v1/competition/1/players?x-lang=es', { cabeceras: UA, tiempo: 20000 });
const todos = N.lista(JSON.parse(r.b)).map((p) => N.jugador(p, {})).filter(Boolean);
for (const d of lista) {
  if (g.caras[d.id]) continue;
  const en = todos.map((j) => ({ j, p: parecido(d.nombre, j) })).filter((x) => x.p > 0).map((x) => `${x.j.nombre}/${x.j.largo} eq${x.j.equipoId} ${x.j.img ? 'foto' : 'sin'}`);
  console.log('NO', d.nombre, 'eq', d.equipoId, '→', en.slice(0, 4).join(' | ') || 'nadie');
}
// equipos de LaLiga ahora (para ver ids)
const eqs = {}; for (const j of todos) eqs[j.equipoId] = (eqs[j.equipoId] || 0) + 1; console.log('equipos', JSON.stringify(eqs));
const am = casar(lista, todos); const dudosos = Object.entries(am).filter(([id, j]) => parecido(D.maestro[id].nombre, j) < 100).map(([id, j]) => `${D.maestro[id].nombre}→${j.nombre}`); console.log('casados no exactos:', dudosos.join(', '));
