// Las actas de los partidos de selecciones del parón (FotMob, API no oficial y sin clave: lib/fotmob.mjs), con lo de cada jugador de
// LaLiga: minutos, nota de FotMob, goles, asistencias, roja, si se retira lesionado y si es el mejor del partido. Lo usan el resumen
// diario (tipos/selecciones-dia.mjs; Carlos, 9 nov 10:13: «al final haga un resumen de los mejores y los peores de cada selección») y el
// del parón entero (tipos/selecciones.mjs).
//   - Comprobado con el España-Croacia del 29 sep (5181852): la nota va en `performance.rating` de cada jugador de
//     `content.lineup.homeTeam|awayTeam.starters|subs[]`; los cambios, en `performance.substitutionEvents` ([{ time, type: subIn|subOut,
//     reason }]); goles, asistencias y amarillas en `performance.events`; el mejor del partido, `performance.playerOfTheMatch`. Un suplente
//     que no entra no trae ni nota ni cambios. La nota no sale en todos: en partidos pequeños, solo en unos dos tercios de los que juegan.
//   - Minutos: 90 por partido (FotMob no da el descuento por jugador): el titular, hasta que sale o le echan; el suplente, desde que entra.
//   - La lesión, solo si FotMob la marca: el cambio con `injuredPlayerOut` (como hasta ahora) o con motivo «injury».
//   - La bandera de cada selección es su escudo en FotMob (`header.teams[].id`): lib/nacionalidad.mjs, `banderaUrl`.
// Caché: un día ya pasado no cambia, así que se guarda en el registro (`actasSelecciones`, los 14 últimos días) y no se vuelve a pedir en
// cada ejecución (con 25-35 partidos de selecciones al día serían 150 peticiones cada 5 minutos).
import { json, enParalelo } from './http.mjs';
import { FOTMOB, mismoNombre } from './fotmob.mjs';
import { corto, norm } from './texto.mjs';
import { pais, bandera, banderaUrl, coloresPais } from './nacionalidad.mjs';

const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
export const aaaammdd = (t) => DIA.format(new Date(t)).replace(/-/g, '');
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaTxt = (d) => `${Number(String(d).slice(6))} de ${MESES[Number(String(d).slice(4, 6)) - 1]}`;
const SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const diaSemana = (d) => SEMANA[new Date(Date.UTC(+String(d).slice(0, 4), +String(d).slice(4, 6) - 1, +String(d).slice(6), 12)).getUTCDay()];

/** ¿es un partido de selecciones absolutas masculinas? (por la competición y por los equipos) */
export function deSelecciones(liga, m) {
  const n = `${liga.name || ''} ${liga.parentLeagueName || ''}`;
  if (/women|\(w\)|u-?2[0-3]\b|u-?1\d\b|youth|olympic|club|copa del rey|copa de la reina|supercopa/i.test(n)) return false;
  if (m && [m.home && m.home.name, m.away && m.away.name].some((x) => /\(w\)|\bU-?\d\d\b/i.test(String(x || '')))) return false;
  return /nations league|friendl|world cup qual|qualification|euro\b|africa cup|asian cup|gold cup|copa am[eé]rica|concacaf|conmebol|afc\b|caf\b/i.test(n);
}

const cuenta = (pf, tipo) => ((pf && pf.events) || []).filter((e) => e.type === tipo).length;
const cambio = (pf, tipo) => ((pf && pf.substitutionEvents) || []).find((e) => e.type === tipo) || null;

/**
 * El acta de un partido (el detalle de FotMob) con los jugadores de LaLiga. clubesLiga: Set de los nombres cortos de LaLiga.
 * { casa: { nombre, codigo, idFm, goles }, fuera, jugadores: [{ id, nombre, club, codigo, casa, titular, convocado, min, nota, goles, asist,
 *   roja, lesion, mejor }] } (roja y lesion: el minuto o null). null si no hay alineaciones.
 */
export function leerActa(det, clubesLiga) {
  const lu = det && det.content && det.content.lineup;
  if (!lu || !lu.homeTeam || !lu.awayTeam) return null;
  const ev = (det.content.matchFacts && det.content.matchFacts.events && det.content.matchFacts.events.events) || [];
  const rojas = new Map(), lesionados = new Map();
  for (const e of ev) {
    const pid = e.player && e.player.id != null ? String(e.player.id) : e.playerId != null ? String(e.playerId) : null;
    if (e.type === 'Card' && /red/i.test(String(e.card || '')) && pid) rojas.set(pid, Number(e.time) || null);
    // el cambio por lesión: el que sale es el que estaba en el campo (titular, o el que había entrado antes)
    if (e.type === 'Substitution' && e.injuredPlayerOut && Array.isArray(e.swap) && e.swap.length === 2) lesionados.set(e.swap.map((s) => String(s.id)), Number(e.time) || null);
  }
  // los goles y las asistencias también de los sucesos (por si `performance` no los trae): el gol por el id; la asistencia por el nombre,
  // solo si es uno del mismo equipo (`assistInput`)
  const golesEv = new Map(), asistEv = new Map();
  const nombres = [[lu.homeTeam, true], [lu.awayTeam, false]].flatMap(([t, casa]) => [...(t.starters || []), ...(t.subs || [])].map((p) => ({ id: String(p.id), nombre: p.name, casa })));
  for (const e of ev) {
    if (e.type !== 'Goal' || !e.player || e.player.id == null || e.ownGoal || /own goal/i.test(String(e.goalDescription || ''))) continue;
    golesEv.set(String(e.player.id), (golesEv.get(String(e.player.id)) || 0) + 1);
    if (e.assistInput) { const del = nombres.filter((p) => p.casa === !!e.isHome && mismoNombre(p.nombre, e.assistInput)); if (del.length === 1) asistEv.set(del[0].id, (asistEv.get(del[0].id) || 0) + 1); }
  }
  // los cambios de los sucesos (por si `performance` no los trae): en `swap`, el que sale es el que estaba en el campo
  const titulares = new Set([lu.homeTeam, lu.awayTeam].flatMap((t) => (t.starters || []).map((p) => String(p.id))));
  const entraEv = new Map(), saleEv = new Map();
  for (const e of ev) if (e.type === 'Substitution' && Array.isArray(e.swap) && e.swap.length === 2) {
    const [a, b] = e.swap.map((x) => String(x.id));
    const [sale, entra] = titulares.has(b) || entraEv.has(b) || !(titulares.has(a) || entraEv.has(a)) ? [b, a] : [a, b];
    saleEv.set(sale, Number(e.time) || 0); entraEv.set(entra, Number(e.time) || 0);
  }
  const todos = [];
  const codigoDe = (t) => { const c = {}; for (const p of [...(t.starters || []), ...(t.subs || [])]) if (p.countryCode) c[p.countryCode] = (c[p.countryCode] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
  for (const [t, casa] of [[lu.homeTeam, true], [lu.awayTeam, false]]) for (const p of [...(t.starters || []), ...(t.subs || [])]) {
    const pf = p.performance || {}, titular = (t.starters || []).includes(p), id = String(p.id);
    const entra = cambio(pf, 'subIn') || (entraEv.has(id) ? { time: entraEv.get(id) } : null), sale = cambio(pf, 'subOut') || (saleEv.has(id) ? { time: saleEv.get(id) } : null);
    const roja = rojas.has(id) ? rojas.get(id) : cuenta(pf, 'redCard') || cuenta(pf, 'yellowRedCard') ? (sale ? null : 90) : null;
    const desde = titular ? 0 : entra ? Number(entra.time) || 0 : null;
    const hasta = Math.min(90, sale ? Number(sale.time) || 90 : roja != null ? roja : 90);
    const min = desde == null ? 0 : Math.max(1, hasta - desde);
    todos.push({ id, nombre: p.name, clubFm: p.primaryTeamName || '', club: corto(p.primaryTeamName || ''), codigo: p.countryCode || null, casa, titular, convocado: true,
      min, nota: pf.rating != null && Number.isFinite(Number(pf.rating)) ? Math.round(Number(pf.rating) * 10) / 10 : null,
      goles: Math.max(cuenta(pf, 'goal'), golesEv.get(id) || 0), asist: Math.max(cuenta(pf, 'assist'), asistEv.get(id) || 0), roja: rojas.has(id) || cuenta(pf, 'redCard') || cuenta(pf, 'yellowRedCard') ? (roja ?? hasta) : null,
      lesion: sale && /injur/i.test(String(sale.reason || '')) ? Number(sale.time) || null : null, mejor: !!pf.playerOfTheMatch });
  }
  for (const [[a, b], min] of lesionados) {
    const pa = todos.find((x) => x.id === a), pb = todos.find((x) => x.id === b);
    const sale = pb && (pb.titular || !(pa && pa.titular)) ? pb : pa;
    if (sale && sale.lesion == null) sale.lesion = min;
  }
  const h = det.header && det.header.teams;
  const equipo = (i, t) => ({ nombre: (h && h[i] && h[i].name) || t.name, codigo: codigoDe(t), idFm: (h && h[i] && h[i].id) ?? t.id ?? null, goles: h && h[i] && h[i].score != null ? Number(h[i].score) : null });
  return { casa: equipo(0, lu.homeTeam), fuera: equipo(1, lu.awayTeam), jugadores: todos.filter((x) => clubesLiga.has(x.club)) };
}

/** la selección de un equipo del acta: { nombre (en castellano si se sabe), bandera (emoji o null), banderaUrl } */
export const seleccion = (e) => ({ nombre: pais(e.codigo) || e.nombre, codigo: e.codigo || null, bandera: bandera(e.codigo), banderaUrl: banderaUrl(e.idFm), colores: coloresPais(e.codigo) });

/**
 * Las actas de los partidos de selecciones acabados de esos días: [{ id, fecha, liga, casa, fuera, jugadores }] (solo con algún jugador de
 * LaLiga). Los días anteriores a hoy, del registro si ya están (y se guardan si no).
 */
export async function actasDe(dias, { clubesLiga, pedir = json, registro = null, ahora = Date.now(), log = () => {} } = {}) {
  const hoy = aaaammdd(ahora);
  const cache = (registro && registro.datos && registro.datos.actasSelecciones) || {};
  const faltan = dias.filter((d) => !(d < hoy && Array.isArray(cache[d])));
  const ua = { headers: { Accept: 'application/json' }, tiempo: 15000, reintentos: 1 };
  const delDia = await enParalelo(faltan, 3, (d) => pedir(`${FOTMOB}/matches?date=${d}&timezone=Europe%2FMadrid&ccode3=ESP`, ua).catch(() => null));
  const ms = [], completos = new Set();
  delDia.forEach((r, i) => {
    if (!r || !Array.isArray(r.leagues)) return;
    let todosAcabados = true;
    for (const l of r.leagues) for (const m of l.matches || []) {
      if (!deSelecciones(l, m) || (m.status && m.status.cancelled)) continue;
      if (m.status && m.status.finished) ms.push({ id: m.id, fecha: faltan[i], liga: l.name, hora: (m.status && m.status.utcTime) || m.time || null }); else todosAcabados = false;
    }
    if (todosAcabados && faltan[i] < hoy) completos.add(faltan[i]);
  });
  const dets = await enParalelo(ms, 4, (m) => pedir(`${FOTMOB}/matchDetails?matchId=${m.id}`, ua).catch(() => null));
  const nuevas = {};
  dets.forEach((d, i) => {
    const a = leerActa(d, clubesLiga);
    if (!d) completos.delete(ms[i].fecha);          // un detalle que no llega: ese día no se guarda, se vuelve a pedir
    if (a && a.jugadores.length) (nuevas[ms[i].fecha] ||= []).push({ id: ms[i].id, fecha: ms[i].fecha, liga: ms[i].liga, hora: ms[i].hora || (d.header && d.header.status && d.header.status.utcTime) || null, ...a });
  });
  if (faltan.length) log(`  (actas) pedidos a FotMob ${faltan.length} días, ${ms.length} partidos de selecciones acabados; ${Object.values(nuevas).flat().length} con jugadores de LaLiga`);
  if (registro && registro.datos && completos.size) {
    const c = { ...cache };
    for (const d of completos) c[d] = nuevas[d] || [];
    registro.datos.actasSelecciones = Object.fromEntries(Object.entries(c).sort().slice(-14));
    if (registro.fichero && typeof registro.guardar === 'function') registro.guardar();
  }
  return dias.flatMap((d) => (d < hoy && Array.isArray(cache[d]) ? cache[d] : nuevas[d] || []));
}

/** el jugador de la lista de LaLiga que es este de FotMob: mismo club y el mismo nombre (exacto o, si es el único, el apellido) */
export function casarJugador(x, jugadores, equipos) {
  const delClub = jugadores.filter((j) => corto(equipos[String(j.teamId)] || '') === x.club);
  const n = norm(x.nombre);
  const exactos = delClub.filter((j) => norm(j.nickname) === n);
  if (exactos.length === 1) return exactos[0];
  const parecidos = delClub.filter((j) => mismoNombre(j.nickname, x.nombre));
  return parecidos.length === 1 ? parecidos[0] : null;
}

/**
 * Lo de cada jugador de LaLiga en esas actas, partido a partido: Map(id de LaLiga → { j, sel (su selección), partidos: [{ fecha, rival
 * (selección), marcador ('4-1' desde su lado), resultado ('ganó'|'empató'|'perdió'), titular, min, nota, goles, asist, roja, lesion, mejor }],
 * min (total), jugados }).
 */
export function porJugador(actas, jugadores, equipos) {
  const por = new Map();
  for (const a of actas) for (const x of a.jugadores) {
    const j = casarJugador(x, jugadores, equipos);
    if (!j) continue;
    const yo = x.casa ? a.casa : a.fuera, otro = x.casa ? a.fuera : a.casa;
    const k = String(j.id);
    const r = por.get(k) || { j, sel: seleccion(yo), partidos: [], min: 0, jugados: 0 };
    const marcador = yo.goles != null && otro.goles != null ? `${yo.goles}-${otro.goles}` : null;
    const resultado = marcador ? (yo.goles > otro.goles ? 'ganó' : yo.goles < otro.goles ? 'perdió' : 'empató') : null;
    r.partidos.push({ fecha: a.fecha, hora: a.hora || null, idPartido: a.id, rival: seleccion(otro), marcador, resultado, titular: x.titular, min: x.min, nota: x.nota, goles: x.goles, asist: x.asist, roja: x.roja, lesion: x.lesion, mejor: x.mejor });
    r.min += x.min; if (x.min > 0) r.jugados++;
    por.set(k, r);
  }
  return por;
}
