// Datos variados de cada jugador para los tuits (Carlos, 9 nov 09:12: «lo de que siempre diga los puntos de media no es bueno tampoco.
// Podría dar otros datos»). Hasta ahora el único número del jugador en los hechos era su media, así que salía casi siempre.
//
// Cada jugador trae aquí todo lo que se puede contar de él, sacado de LaLiga: la lista de jugadores (`jugadores()`: puntos de cada
// jornada, valor) y, para los que salen en un tuit, su ficha (`playerStats[]`: goles, asistencias, minutos, goles encajados) y su
// histórico de valor. De todo eso se elige UN dato por tuit (dos en los largos): el que más le cuenta a quien juega al fantasy (una
// racha, una mejor jornada muy alta, un valor que se ha disparado, el máximo goleador de su puesto…) y que no sea del mismo tipo que
// los de los últimos tuits. La media, solo si no hay nada mejor, y nunca dos tuits seguidos.
//
// Cómo se usa:
//   - ejecutar.mjs llama a `fijarDatos` una vez (lista, hasta qué jornada contar, registro con los últimos tuits);
//   - cada tipo, antes de montar sus hechos, `prepararDatos(ids)` (ficha e histórico de valor, en paralelo y guardados en la ejecución);
//   - `jugador()` de lib/hechos.mjs pega a cada jugador sus candidatos (sin que se vean en el JSON);
//   - `redactar()` de lib/redaccion.mjs, justo antes de preguntar a la IA, llama a `limitarDatos(hechos)`: deja el dato elegido en
//     `datoDestacado` de los jugadores que más pesan y quita `mediaPuntos` a los demás;
//   - la plantilla (último recurso) usa `datoPlantilla(j)` con la misma elección.
// Prueba sin red: bot/prueba/datos-ejemplo.mjs.
import { fmt, norm, dineroTxt, hash, corto } from './texto.mjs';
import { ficha as pedirFicha, valorMercado as pedirValor } from './laliga.mjs';
import { enParalelo } from './http.mjs';

const CANDIDATOS = Symbol('candidatos');
const MINIMO = 0.2;   // la fuerza mínima de un dato para que vaya en los hechos (la media, aparte)
const PUESTO = { 1: 'portero', 2: 'defensa', 3: 'centrocampista', 4: 'delantero' };
const PLURAL = { portero: 'porteros', defensa: 'defensas', centrocampista: 'centrocampistas', delantero: 'delanteros' };
const LETRA = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco'];
// los tipos de tuit cuyos últimos textos cuentan para no repetir el tipo de dato (el mercado habla siempre de valor y el directo,
// de los puntos de hoy: no cuentan)
const ROTAN = ['caidas', 'novedades', 'noticias', 'sancionados', 'lloros', 'onceideal', 'resumen', 'balance', 'revalorizaciones', 'calendario', 'selecciones', 'selecciones-dia'];

const ctx = { lista: [], porId: new Map(), porNombre: new Map(), equipos: {}, hasta: Infinity, fichas: new Map(), valores: new Map(), recientes: [], usados: [], rangos: new Map(), pedir: { ficha: pedirFicha, valor: pedirValor } };

/** una vez por ejecución: la lista de jugadores de LaLiga, la última jornada que cuenta (con una en juego, la anterior) y el registro */
export function fijarDatos({ jugadores = [], equipos = {}, hasta = Infinity, registro = null, pedir = null } = {}) {
  ctx.lista = jugadores; ctx.equipos = equipos; ctx.hasta = Number.isFinite(Number(hasta)) ? Number(hasta) : Infinity;
  ctx.porId = new Map(jugadores.map((j) => [String(j.id), j]));
  ctx.porNombre = new Map();
  for (const j of jugadores) { const k = norm(j.nickname); if (!ctx.porNombre.has(k)) ctx.porNombre.set(k, []); ctx.porNombre.get(k).push(j); }
  ctx.fichas = new Map(); ctx.valores = new Map(); ctx.usados = []; ctx.rangos = new Map();
  ctx.recientes = recientesDelRegistro(registro);
  if (pedir) ctx.pedir = { ...ctx.pedir, ...pedir };
}
/** los últimos textos publicados de los tipos que rotan, del más viejo al más nuevo */
function recientesDelRegistro(registro) {
  const r = (registro && registro.datos && registro.datos.recientes) || {};
  return ROTAN.flatMap((t) => (r[t] || []).map((x) => ({ t: x.t || '', texto: x.texto || '' }))).sort((a, b) => String(a.t).localeCompare(String(b.t))).map((x) => x.texto);
}
/** apunta un texto como reciente (los de esta misma ejecución, para que el siguiente tuit no repita el tipo de dato) */
export function apuntarTexto(texto, tipo = null) { if (texto && (tipo == null || ROTAN.includes(tipo))) ctx.recientes.push(String(texto)); }

/** guarda una ficha ya pedida (caídas ya las pide todas) */
export function guardarFicha(id, f) { if (id != null && f && !f.error) ctx.fichas.set(String(id), f); }

/** pide la ficha y el histórico de valor de los que no los tengan (de 5 en 5; lo que falla se queda sin ese dato) */
export async function prepararDatos(ids, { ficha = true, valor = true, tiempo = 8000 } = {}) {
  const xs = [...new Set((ids || []).filter((x) => x != null).map(String))];
  const conTiempo = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), tiempo))]).catch(() => null);
  if (ficha) {
    const faltan = xs.filter((id) => !ctx.fichas.has(id));
    const fs = await enParalelo(faltan, 5, (id) => conTiempo(ctx.pedir.ficha(id)));
    faltan.forEach((id, i) => { if (fs[i] && !fs[i].error) ctx.fichas.set(id, fs[i]); });
  }
  if (valor) {
    const faltan = xs.filter((id) => !ctx.valores.has(id));
    const vs = await enParalelo(faltan, 5, (id) => conTiempo(ctx.pedir.valor(id)));
    faltan.forEach((id, i) => { if (Array.isArray(vs[i]) && vs[i].length) ctx.valores.set(id, vs[i]); });
  }
}

/** el jugador de la lista de LaLiga: por id o, si no, por su nombre (y su club si hay más de uno) */
export function buscar(j) {
  if (!j) return null;
  if (j.id != null && ctx.porId.has(String(j.id))) return ctx.porId.get(String(j.id));
  const xs = ctx.porNombre.get(norm(j.nickname || j.nombre)) || [];
  if (xs.length <= 1) return xs[0] || null;
  const club = corto(j.equipo || ctx.equipos[String(j.teamId)] || '');
  const ys = xs.filter((x) => (j.teamId != null && String(x.teamId) === String(j.teamId)) || (club && corto(ctx.equipos[String(x.teamId)] || '') === club));
  return ys.length === 1 ? ys[0] : null;
}

const semanas = (j, hasta) => (j.weekPoints || []).filter((w) => w.weekNumber <= hasta).sort((a, b) => a.weekNumber - b.weekNumber);
const sumaPts = (ws) => ws.reduce((s, w) => s + (Number(w.points) || 0), 0);
/** el puesto (1, 2…) de un jugador entre los de su posición por puntos hasta `hasta` */
function puestoEnSuPosicion(j, hasta) {
  const k = `${j.positionId}|${hasta}`;
  if (!ctx.rangos.has(k)) {
    const orden = ctx.lista.filter((x) => String(x.positionId) === String(j.positionId) && x.playerStatus !== 'out_of_league')
      .map((x) => ({ id: String(x.id), pts: sumaPts(semanas(x, hasta)) })).sort((a, b) => b.pts - a.pts);
    ctx.rangos.set(k, orden);
  }
  const orden = ctx.rangos.get(k), i = orden.findIndex((x) => x.id === String(j.id));
  if (i < 0) return null;
  // empatado con el de delante: no es «el 3º», es «de los que más»
  return { k: i + 1, empate: (i > 0 && orden[i - 1].pts === orden[i].pts) || (orden[i + 1] && orden[i + 1].pts === orden[i].pts) };
}

/**
 * Todo lo que se sabe de un jugador hasta la última jornada que cuenta. j: el de la lista de LaLiga (o uno con id o nickname).
 * { id, nombre, pos, total, jugadas, media, racha3, rachaN, mejor, valor, cambio30, pct30, cambioIni, goles, asist, mins, jugados, n60, ceros, rango }
 */
export function perfil(j, { hasta = ctx.hasta } = {}) {
  const L = buscar(j) || (j && j.weekPoints ? j : null);
  if (!L) return null;
  const ws = semanas(L, hasta);
  const ultima = ws.length ? ws[ws.length - 1].weekNumber : null;
  const tope = Number.isFinite(hasta) ? Math.min(hasta, ultima ?? hasta) : ultima;
  const total = sumaPts(ws), media = ws.length ? total / ws.length : Number(L.averagePoints) || 0;
  // la racha: las tres últimas jornadas que cuentan, solo si ha puntuado (jugado) en las tres
  const tres = tope != null ? [tope - 2, tope - 1, tope].map((n) => ws.find((w) => w.weekNumber === n)) : [];
  const racha3 = tres.length === 3 && tres.every(Boolean) ? { pts: sumaPts(tres), desde: tope - 2, hasta: tope } : null;
  const mejor = ws.reduce((m, w) => (!m || Number(w.points) > Number(m.points) ? w : m), null);
  const p = { id: String(L.id), nombre: L.nickname, pos: Number(L.positionId), puesto: PUESTO[Number(L.positionId)] || null, total, jugadas: ws.length, media, racha3,
    mejor: mejor ? { jornada: mejor.weekNumber, pts: Number(mejor.points) } : null, valor: Number(L.marketValue) || 0, rango: puestoEnSuPosicion(L, hasta) };
  const v = ctx.valores.get(String(L.id));
  if (v && v.length) {
    const xs = [...v].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const hoy = Number(xs[xs.length - 1].marketValue), t30 = Date.parse(xs[xs.length - 1].date) - 30 * 864e5;
    const antes = [...xs].reverse().find((x) => Date.parse(x.date) <= t30) || xs[0];
    p.valor = hoy || p.valor;
    p.cambio30 = hoy - Number(antes.marketValue); p.pct30 = Number(antes.marketValue) ? (p.cambio30 / Number(antes.marketValue)) * 100 : 0;
    p.cambioIni = hoy - Number(xs[0].marketValue); p.valorIni = Number(xs[0].marketValue);
  }
  const f = ctx.fichas.get(String(L.id));
  if (f && Array.isArray(f.playerStats)) {
    const ps = f.playerStats.filter((x) => x.weekNumber <= hasta && x.stats);
    const s = (x, k) => Number((x.stats[k] || [])[0]) || 0;
    p.goles = ps.reduce((a, x) => a + s(x, 'goals'), 0);
    p.asist = ps.reduce((a, x) => a + s(x, 'goal_assist'), 0);
    p.mins = ps.reduce((a, x) => a + s(x, 'mins_played'), 0);
    p.jugados = ps.filter((x) => s(x, 'mins_played') > 0).length;
    p.n60 = ps.filter((x) => s(x, 'mins_played') >= 60).length;
    p.ceros = ps.filter((x) => s(x, 'mins_played') >= 60 && s(x, 'goals_conceded') === 0).length;
    p.ultimaFicha = ps.reduce((m, x) => Math.max(m, x.weekNumber), 0);
  }
  return p;
}

const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
/** «3 goles y 2 asistencias», «un gol», «4 asistencias» */
const golesTxt = (g, a) => [g ? pl(g, 'gol', 'goles') : '', a ? pl(a, 'asistencia', 'asistencias') : ''].filter(Boolean).join(' y ');

/**
 * Lo que se puede contar de un jugador, cada cosa con su fuerza (cuánto llama la atención: de 0 a 1 y pico) y la frase con verbo
 * («suma 31 puntos en las tres últimas jornadas»), que sirve en los hechos y en la plantilla. `sin`: tipos de dato que no van.
 * [{ que, dice, fuerza, n? }]
 */
export function candidatos(p, { sin = [] } = {}) {
  if (!p) return [];
  const out = [], add = (que, dice, fuerza, extra = {}) => { if (!sin.includes(que) && fuerza > 0) out.push({ que, dice, fuerza, ...extra }); };
  const m = p.media;
  // la racha (buena o mala), comparada con lo que suele dar
  if (p.racha3 && p.jugadas >= 5) {
    const r = p.racha3.pts / 3;
    if (r >= 6 && r >= m * 1.35) add('racha', `suma ${p.racha3.pts} puntos en las tres últimas jornadas`, Math.min(1, 0.6 + (r / Math.max(m, 1) - 1.35) * 0.5), { jornadas: 3 });
    else if (m >= 4 && r <= m * 0.45) add('racha', `solo ha sumado ${p.racha3.pts} puntos en las tres últimas jornadas`, Math.min(0.85, 0.5 + (m - r) * 0.05), { jornadas: 3, mala: true });
  }
  // la mejor jornada, si fue muy alta
  if (p.mejor && p.mejor.pts >= 15) add('mejor', `tuvo su mejor jornada en la ${p.mejor.jornada}, con ${p.mejor.pts} puntos`, Math.min(0.9, 0.45 + (p.mejor.pts - 15) * 0.025));
  // el valor: lo que ha subido o bajado en el último mes; si no se mueve, solo lo que vale (poco interés)
  if (p.valor > 0) {
    const v = dineroTxt(p.valor).t;
    if (p.cambio30 != null && Math.abs(p.pct30) >= 20 && Math.abs(p.cambio30) >= 1e6) {
      const d = dineroTxt(p.cambio30).t;
      add('valor', p.cambio30 > 0 ? `vale ${v} y ha ganado ${d} en el último mes` : `vale ${v} y ha perdido ${d} en el último mes`, Math.min(0.9, 0.5 + (Math.abs(p.pct30) - 20) / 120));
    } else add('valor', `vale ${v}`, p.valor >= 40e6 ? 0.22 : 0.12);
  }
  // goles y asistencias (medios y delanteros), porterías a cero (porteros y defensas)
  if (p.goles != null && p.pos >= 3 && (p.goles + p.asist >= 4 || p.goles >= 3)) add('goles', `lleva ${golesTxt(p.goles, p.asist)} en la liga`, Math.min(0.85, 0.4 + (p.goles + p.asist * 0.6) * 0.04));
  if (p.ceros != null && p.pos <= 2 && p.ceros >= 3) add('porterias', `lleva ${pl(p.ceros, 'portería a cero', 'porterías a cero')} en ${p.jugados} partidos`, Math.min(0.8, 0.4 + p.ceros * 0.06));
  // los minutos: si no se ha perdido ni uno o casi
  if (p.jugados != null && p.ultimaFicha >= 6 && p.n60 === p.ultimaFicha) add('minutos', `ha jugado los ${p.ultimaFicha} partidos de liga, todos de 60 minutos o más`, 0.35);
  else if (p.mins != null && p.jugados >= 6) add('minutos', `lleva ${p.mins} minutos en ${p.jugados} partidos`, 0.18);
  // el puesto entre los de su posición
  if (p.rango && p.puesto && !p.rango.empate && p.rango.k <= 10) {
    const k = p.rango.k;
    add('ranking', k === 1 ? `es el ${p.puesto} que más puntos lleva esta temporada` : `es el ${k}º ${p.puesto} con más puntos de la temporada`, k === 1 ? 0.75 : k <= 3 ? 0.6 : k <= 5 ? 0.45 : 0.3);
  } else if (p.rango && p.puesto && p.rango.k <= 10) add('ranking', `está entre los diez ${PLURAL[p.puesto]} con más puntos de la temporada`, 0.28);
  if (p.total >= 15) add('total', `lleva ${p.total} puntos en la temporada`, p.total >= 80 ? 0.3 : 0.16);
  if (m >= 3) add('media', `va a ${fmt(m)} puntos de media`, 0.1);
  return out;
}

/** qué tipos de dato lleva un texto ya escrito (para no repetirlos en el siguiente) */
export function tiposEnTexto(texto) {
  const t = String(texto || '');
  const out = new Set();
  if (MEDIA.test(t)) out.add('media');
  if (/[úu]ltim[ao]s (?:tres|cuatro|cinco|\d) (?:jornadas|partidos)|(?:tres|cuatro|cinco|\d) [úu]ltim[ao]s (?:jornadas|partidos)|\bracha\b|jornadas seguidas/i.test(t)) out.add('racha');
  if (/mejor jornada|su techo|su mejor partido/i.test(t)) out.add('mejor');
  if (/\b(?:ha ganado|ha perdido|se ha revalorizado|se ha disparado su valor|ha subido|ha bajado)\b[^.\n]{0,30}\d+(?:,\d+)? ?[MK]\b|\b(?:vale|cuesta)\s\d+(?:,\d+)? ?M\b/i.test(t)) out.add('valor');
  if (/\b\d+ goles\b|\b(?:un|\d+) gol(?:es)? y \d+ asistencias?\b|\b\d+ asistencias\b/i.test(t)) out.add('goles');
  if (/porter[ií]as? a cero|sin encajar/i.test(t)) out.add('porterias');
  if (/\b\d+ minutos en \d+ partidos|los \d+ partidos de liga/i.test(t)) out.add('minutos');
  if (/(?:portero|defensa|centrocampista|delantero)s? (?:que más puntos|con más puntos)|entre los (?:diez|\d+) (?:porteros|defensas|centrocampistas|delanteros)/i.test(t)) out.add('ranking');
  if (/\b\d+ puntos (?:en la|esta|en toda la) temporada/i.test(t)) out.add('total');
  return out;
}
// (la misma expresión que cuenta las medias en lib/redaccion.mjs)
export const MEDIA = /\bde media\b|\bpuntos por partido\b|\bmedia de \d|\bpromedi/i;

/** lo que no se repite: los tipos de dato de los dos últimos tuits que rotan (publicados y de esta ejecución) */
export function evitar(n = 2) {
  const s = new Set();
  for (const t of ctx.recientes.slice(-n)) for (const x of tiposEnTexto(t)) s.add(x);
  for (const x of ctx.usados.slice(-n)) s.add(x);
  return s;
}

/** el mejor dato de una lista de candidatos, sin repetir el tipo de los últimos: la media, solo si no hay otro */
export function elegir(cands, { ev = evitar(), semilla = '' } = {}) {
  const xs = (cands || []).filter((c) => c.que !== 'media' || !ev.has('media'));
  if (!xs.length) return null;
  // un poco de azar fijo por jugador y día, para que dos datos de fuerza parecida no salgan siempre en el mismo orden
  const nota = (c) => c.fuerza * (ev.has(c.que) ? 0.35 : 1) + ((hash(`${semilla}${c.que}`) % 100) / 100) * 0.08;
  return [...xs].sort((a, b) => nota(b) - nota(a))[0];
}

/** pega a un jugador de los hechos sus candidatos (no salen en el JSON) */
export function conCandidatos(h, j, { sin = [] } = {}) {
  if (!h || !ctx.lista.length) return h;
  const cs = candidatos(perfil(j), { sin });
  if (cs.length) Object.defineProperty(h, CANDIDATOS, { value: cs, enumerable: false, configurable: true });
  return h;
}
export const tieneCandidatos = (h) => !!(h && h[CANDIDATOS]);

const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
/**
 * Antes de preguntar a la IA: el dato de cada jugador que trae candidatos. Solo `n` jugadores (los que tengan el dato más fuerte)
 * llevan `datoDestacado`; a todos los que traen candidatos se les quita `mediaPuntos` salvo si su dato elegido es la media.
 * Devuelve los datos elegidos ([{ nombre, que, dice }]).
 */
export function limitarDatos(hechos, { n = 1 } = {}) {
  const js = ((hechos && hechos.jugadores) || []).filter(tieneCandidatos);
  if (!js.length) return [];
  const ev = evitar();
  // un dato flojo («vale 682 K», «946 minutos en 12 partidos») no aporta: por debajo de MINIMO no va; la media, solo al protagonista
  // y si no tiene nada mejor (simulacro del 9 nov)
  const vale = (j) => j[CANDIDATOS].filter((c) => c.fuerza >= MINIMO || (c.que === 'media' && j.principal));
  const elegidos = js.map((j) => ({ j, d: elegir(vale(j), { ev, semilla: `${j.nombre}${hoy()}` }) })).filter((x) => x.d);
  // primero el protagonista; luego el dato más fuerte
  elegidos.sort((a, b) => Number(!!b.j.principal) - Number(!!a.j.principal) || b.d.fuerza - a.d.fuerza);
  const van = new Set();
  const usados = new Set();
  for (const x of elegidos) {
    if (van.size >= n) break;
    if (usados.has(x.d.que)) continue;          // dos jugadores del mismo tuit, dos tipos de dato distintos
    van.add(x); usados.add(x.d.que);
  }
  for (const j of js) {
    const x = elegidos.find((y) => y.j === j && van.has(y));
    if (x) { j.datoDestacado = { que: x.d.que, dice: x.d.dice, ...(x.d.jornadas ? { jornadas: x.d.jornadas } : {}) }; if (x.d.que !== 'media') delete j.mediaPuntos; }
    else { delete j.datoDestacado; delete j.mediaPuntos; }
  }
  const out = [...van].map((x) => ({ nombre: x.j.nombre, que: x.d.que, dice: x.d.dice }));
  for (const x of out) ctx.usados.push(x.que);
  return out;
}

/** el dato para la plantilla de un jugador (sin apuntarlo: la plantilla es el último recurso), o null */
export function datoPlantilla(j, { sin = [] } = {}) {
  if (!ctx.lista.length) return null;
  const d = elegir(candidatos(perfil(j), { sin }).filter((c) => c.fuerza >= MINIMO || c.que === 'media'), { semilla: `${(j && (j.nickname || j.nombre)) || ''}${hoy()}` });
  if (!d) return null;
  return { ...d, numeros: (d.dice.match(/\d+/g) || []).map(Number) };
}

/** para las pruebas: el estado de dentro */
export const _ctx = ctx;
export { PUESTO, LETRA };
