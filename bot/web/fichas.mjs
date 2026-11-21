// Fase 2 del portal de datos: una página por cada uno de los 20 equipos (equipos/<club>.html), una por cada jugador de los que más
// pesan en el juego (jugadores/<nombre>.html, ~150) y el índice de jugadores (jugadores/). Todo con la API de LaLiga Fantasy sin token:
// la lista de jugadores (puntos de cada jornada), el histórico de valor (ya bajado para /mercado/ en `hechosMercado`), stats/week de
// cada jornada (resultados, clasificación y calendario) y la ficha de cada jugador (minutos, goles, paradas…). Nada de la liga de
// nadie. El texto sale de reglas sobre los datos, sin IA, con las cifras medidas de las guías (.github/datos-guias).
import { enParalelo } from '../lib/http.mjs';
import { ESTADOS } from '../lib/laliga.mjs';
import { tablaDe, nivelDe } from '../lib/info-jugador.mjs';
import { baseTitular } from '../tipos/caidas.mjs';
import { motivoSancion } from '../lib/partes.mjs';
import { corto, el, del, al } from '../lib/texto.mjs';
import { fechaHora, diaCorto, hora } from './vista.mjs';
import { bloqueFicha } from './onces.mjs';
import { e, coma, dinero, dif, pct, cara, escudo, chipPuntos, cambio, graficaValor, bloque, slug, diaMadrid, fechaCorta, POS, PUESTO,
  celdaJug, tabla, kpis, subnav, pestanas, forma, chapaPos, nivelChip, fichasJornada } from './portal.mjs';

const num = (x) => Number(x) || 0;
const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const CASA = 0.85, FUERA = 1.15;   // como bot/tipos/calendario.mjs: jugar fuera pesa más que en casa
const INICIO = Date.parse('2026-08-01');
const PLURAL = { 1: 'porteros', 2: 'defensas', 3: 'centrocampistas', 4: 'delanteros' };

// lo que dicen los datos de la temporada (guías de alineación, porteros y valor de mercado; .github/datos-guias, 15 nov, J1-J12)
const TITULAR = { 1: 6.6, 2: 4.7, 3: 5.5, 4: 6.4 };          // puntos de media con 60 minutos o más, por puesto
const PORTERO_GOLES = [11.4, 6.3, 4.7, 2.2];                  // portero titular según los goles encajados (0, 1, 2, 3 o más)

// pesa en el fantasy (bot/tipos/sancionados.mjs): titular habitual, buena media o mucho valor
const pesa = (j, b) => (b && b.p >= 0.5) || num(j.averagePoints) >= 3 || num(j.marketValue) >= 8e6;

/** el valor de un jugador un día (el último conocido hasta ese día; antes del primero, el primero) */
function valorEn(serie, t) {
  let v = serie.length ? serie[0].v : 0;
  for (const x of serie) { if (x.t > t) break; v = x.v; }
  return v;
}

/** la URL de cada uno, estable: la primera vez que sale se apunta en el estado y ya no cambia (si dos se llaman igual, con el club) */
function asignar(mapa, id, base, extra) {
  if (mapa[id]) return mapa[id];
  const usados = new Set(Object.values(mapa));
  let s = slug(base) || `jugador-${id}`;
  if (usados.has(s)) s = slug(`${base} ${extra}`);
  if (usados.has(s)) s = `${s}-${id}`;
  mapa[id] = s;
  return s;
}

/**
 * Los hechos de las fichas. api: { jugadores, statsSemana, semanaActual, ficha }; hm: lo de `hechosMercado` (con `todas` y
 * `equipos`); estado: { jugadores: {id: slug}, equipos: {id: slug} } (lo que ya tiene página; se amplía aquí). max: cuántos
 * jugadores con ficha como mucho (los que ya tienen página se quedan siempre, mientras sigan en LaLiga).
 */
export async function hechosFichas(api, hm, { estado = {}, max = 2000, ahora = Date.now(), log = () => {} } = {}) {
  const slugs = { jugadores: { ...(estado.jugadores || {}) }, equipos: { ...(estado.equipos || {}) }, ...(estado.indexables ? { indexables: { ...estado.indexables } } : {}) };
  const sem = await api.semanaActual();
  const W = sem.weekNumber;
  const nums = Array.from({ length: Math.min(38, W + 5) }, (_, i) => i + 1);
  const semanas = await enParalelo(nums, 4, (J) => api.statsSemana(J).catch(() => []));
  const partidos = [];
  semanas.forEach((st, i) => { if (Array.isArray(st)) for (const m of st) partidos.push({ ...m, J: nums[i] }); });
  const tabla = tablaDe(partidos);
  const ultimaJugada = Math.max(0, ...nums.filter((J, i) => Array.isArray(semanas[i]) && semanas[i].length && semanas[i].every((m) => m.matchState === 7)));
  if (!ultimaJugada || tabla.n < 10) { log(`  (fichas) sin jornadas jugadas o sin clasificación (${tabla.n} equipos)`); return null; }

  // por equipo: resultados de lo jugado y los próximos 4 partidos (los que no han empezado) con la dificultad de cada rival
  const res = {}, prox = {}, nombre = {}, escudoDe = {};
  for (const m of [...partidos].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    for (const [yo, otro, casa] of [[m.local, m.visitor, true], [m.visitor, m.local, false]]) {
      if (!yo || !otro || yo.id == null) continue;
      const id = String(yo.id), rid = String(otro.id);
      nombre[id] = yo.mainName; escudoDe[id] = yo.badgeColor || escudoDe[id];
      if (m.matchState === 7) {
        const gf = num(casa ? m.localScore : m.visitorScore), gc = num(casa ? m.visitorScore : m.localScore);
        (res[id] ||= []).push({ J: m.J, rivalId: rid, rival: corto(otro.mainName), escRival: otro.badgeColor, casa, gf, gc, r: gf > gc ? 'G' : gf === gc ? 'E' : 'P' });
      } else if (m.matchState === 1 && (prox[id] || []).length < 4) {
        const r = tabla.porId[rid];
        const fuerza = r && r.pj ? r.pts / r.pj / tabla.mediaPts : 1;
        (prox[id] ||= []).push({ J: m.J, t: Date.parse(m.date), rivalId: rid, rival: corto(otro.mainName), escRival: otro.badgeColor, casa, pos: r ? r.pos : null, nivel: nivelDe(r, tabla) || 'media', d: fuerza * (casa ? CASA : FUERA) });
      }
    }
  }
  for (const id of Object.keys(res)) res[id].sort((a, b) => a.J - b.J);
  const dificultad = Object.entries(prox).filter(([, ps]) => ps.length >= 2).map(([id, ps]) => ({ id, d: ps.reduce((s, p) => s + p.d, 0) / ps.length })).sort((a, b) => a.d - b.d);
  const puestoCal = Object.fromEntries(dificultad.map((x, i) => [x.id, i + 1]));

  // los jugadores: la fila del mercado (valor, rachas, serie) + la lista (puntos por jornada) + su ficha (minutos y demás)
  const todos = await api.jugadores();
  const lista0 = new Map(todos.map((j) => [String(j.id), j]));
  const filas = hm.todas.filter((f) => f.pos >= 1 && f.pos <= 4 && lista0.has(f.id));
  const conPuntos = filas.filter((f) => (lista0.get(f.id).weekPoints || []).length);
  log(`  (fichas) ${conPuntos.length} fichas de jugadores`);
  const fichas = await enParalelo(conPuntos, 8, (f) => api.ficha(f.id));
  const fichaDe = new Map(conPuntos.map((f, i) => [f.id, fichas[i] && !fichas[i].error && Array.isArray(fichas[i].playerStats) ? fichas[i] : null]));
  const sinFicha = conPuntos.filter((f) => !fichaDe.get(f.id)).length;
  if (sinFicha > conPuntos.length * 0.2) { log(`  (fichas) ${sinFicha} fichas sin bajar: lo dejo para la próxima`); return null; }

  // el que más vale de cada puesto en cada equipo, de los que pueden jugar (para el % de titular, como la app)
  const topPuesto = {};
  for (const f of filas) { if (f.pos >= 1 && f.pos <= 4 && !['injured', 'suspended', 'out_of_league'].includes(f.estado)) { const k = `${f.teamId}|${f.pos}`; topPuesto[k] = Math.max(topPuesto[k] || 0, num(f.valor)); } }
  const vrelDe = (f) => { const t = topPuesto[`${f.teamId}|${f.pos}`]; return t ? Math.min(1, num(f.valor) / t) : null; };
  const J = [];
  for (const f of filas) {
    const j = lista0.get(f.id), fi = fichaDe.get(f.id) || null;
    const v = (x, k) => num(x.stats && x.stats[k] && x.stats[k][0]);
    const puntosJ = new Map((j.weekPoints || []).map((w) => [num(w.weekNumber), num(w.points)]));
    const ps = fi ? fi.playerStats.filter((x) => x.stats).sort((a, b) => a.weekNumber - b.weekNumber) : [];
    const porJ = new Map(ps.map((x) => [num(x.weekNumber), x]));
    const rs = res[f.teamId] || [];
    const jornadas = rs.map((r) => {
      const x = porJ.get(r.J);
      return { ...r, min: x ? v(x, 'mins_played') : 0, pts: puntosJ.has(r.J) ? puntosJ.get(r.J) : (x ? num(x.totalPoints) : null), g: x ? v(x, 'goals') : 0, a: x ? v(x, 'goal_assist') : 0,
        am: x ? v(x, 'yellow_card') : 0, roja: x ? v(x, 'red_card') + v(x, 'second_yellow_card') : 0, par: x ? v(x, 'saves') : 0, enc: x ? v(x, 'goals_conceded') : 0 };
    });
    const jugados = jornadas.filter((x) => x.min > 0);
    const tit = jugados.filter((x) => x.min >= 60);
    const b = fi ? baseTitular(fi.playerStats, ultimaJugada, vrelDe(f)) : null;
    J.push({ ...f, nombreCompleto: (fi && fi.name) || f.nombre, club: nombre[f.teamId] || f.equipo, fi: !!fi, jornadas, jugados: jugados.length, titular: tit.length,
      minutos: jugados.reduce((s, x) => s + x.min, 0), goles: jugados.reduce((s, x) => s + x.g, 0), asist: jugados.reduce((s, x) => s + x.a, 0),
      amarillas: jugados.reduce((s, x) => s + x.am, 0), rojas: jugados.reduce((s, x) => s + x.roja, 0), paradas: jugados.reduce((s, x) => s + x.par, 0),
      aCero: tit.filter((x) => x.enc === 0).length, mediaTit: tit.length ? tit.reduce((s, x) => s + num(x.pts), 0) / tit.length : null,
      ult5: jornadas.slice(-5), tit5: jornadas.slice(-5).filter((x) => x.min >= 60).length, b, pesa: pesa(j, b),
      motivo: f.estado === 'suspended' && fi ? motivoSancion(fi) : null, pctTit: b ? Math.round(b.p * 100) : null });
  }
  // el puesto de cada uno por media entre los de su puesto que han jugado 5 partidos o más
  for (const p of [1, 2, 3, 4]) {
    const xs = J.filter((x) => x.pos === p && x.jugados >= 5).sort((a, b) => b.media - a.media);
    xs.forEach((x, i) => { x.rangoMedia = i + 1; x.deRango = xs.length; });
    // (sesión 4) más puestos dentro de su puesto: por valor (todos), por puntos en total, por puntos por millón y por cada 90 minutos
    const todosP = J.filter((x) => x.pos === p);
    [...todosP].sort((a, b) => b.valor - a.valor).forEach((x, i) => { x.rangoValor = i + 1; x.deValor = todosP.length; });
    [...todosP].filter((x) => x.puntos > 0).sort((a, b) => b.puntos - a.puntos).forEach((x, i) => { x.rangoPuntos = i + 1; });
    [...xs].filter((x) => x.valor > 0 && x.puntos > 0).map((x) => ({ x, r: x.puntos / (x.valor / 1e6) })).sort((a, b) => b.r - a.r)
      .forEach(({ x, r }, i) => { x.ptsMillon = r; x.rangoMillon = i + 1; });
    [...todosP].filter((x) => x.minutos >= 450).map((x) => ({ x, r: (x.puntos / x.minutos) * 90 })).sort((a, b) => b.r - a.r)
      .forEach(({ x, r }, i, arr) => { x.pts90 = r; x.rango90 = i + 1; x.de90 = arr.length; });
  }

  // (16 nov, idea 1 del plan de AdSense) lo que hace falta para los «hechos raros» de cada ficha: quién fue el mejor de su puesto en
  // cada jornada, la mediana y los percentiles de media y valor de cada puesto, y lo que se movió el valor ayer y anteayer
  const mejorJ = {};
  for (const x of J) for (const r of x.jornadas) if (r.min > 0 && r.pts != null) { const k = `${x.pos}|${r.J}`; if (!mejorJ[k] || r.pts > mejorJ[k]) mejorJ[k] = r.pts; }
  for (const x of J) x.mejorPuesto = x.jornadas.filter((r) => r.min > 0 && r.pts != null && r.pts >= 8 && r.pts === mejorJ[`${x.pos}|${r.J}`]).map((r) => ({ J: r.J, pts: r.pts }));
  const cuantil = (xs, q) => { const o = [...xs].sort((a, b) => a - b); return o.length ? o[Math.min(o.length - 1, Math.floor(q * o.length))] : 0; };
  const puestos = {};
  for (const p of [1, 2, 3, 4]) {
    const xs = J.filter((x) => x.pos === p && x.jugados >= 5);
    puestos[p] = { n: xs.length, media50: cuantil(xs.map((x) => x.media), 0.5), media75: cuantil(xs.map((x) => x.media), 0.75),
      valor50: cuantil(xs.map((x) => x.valor), 0.5), valor90: cuantil(xs.map((x) => x.valor), 0.9) };
  }
  for (const x of J) {
    const s = x.temporada || [];
    x.difAyer = s.length >= 3 ? s[s.length - 2].v - s[s.length - 3].v : null;
  }
  // el puesto de cada uno entre los que más suben (o bajan) hoy, en todo el mercado
  const rangoDif = {};
  [...J].filter((x) => x.dif > 0).sort((a, b) => b.dif - a.dif).forEach((x, i) => { rangoDif[x.id] = i + 1; });
  [...J].filter((x) => x.dif < 0).sort((a, b) => a.dif - b.dif).forEach((x, i) => { rangoDif[x.id] = i + 1; });

  // quién tiene página: los que ya la tenían (si siguen en LaLiga) y, hasta `max`, todos los demás por valor
  // (rework de la web, 21 nov) ficha para TODOS los jugadores, pesen o no y hayan jugado o no: las flojas van sin indexar (`admitirIndexables`)
  const ya = J.filter((x) => slugs.jugadores[x.id]);
  const nuevos = J.filter((x) => !slugs.jugadores[x.id]).sort((a, b) => b.valor - a.valor).slice(0, Math.max(0, max - ya.length));
  const conPagina = [...ya, ...nuevos].sort((a, b) => b.valor - a.valor);
  // con una inicial en el nombre del juego («F. de Jong», «Germán V.»), la URL va con el nombre completo: es lo que se busca
  const base = (x) => (/(^|\s)\p{L}\.(\s|$)/u.test(x.nombre) && x.nombreCompleto.split(/\s+/).length <= 4 ? x.nombreCompleto : x.nombre);
  for (const x of conPagina) x.slug = asignar(slugs.jugadores, x.id, base(x), x.equipo);
  const rutaJ = new Map(conPagina.map((x) => [x.id, `jugadores/${x.slug}.html`]));

  // los equipos
  const porEquipo = {};
  for (const x of J) (porEquipo[x.teamId] ||= []).push(x);
  const totalJ = {};
  for (const x of J) for (const r of x.jornadas) if (r.pts != null) totalJ[r.J] = (totalJ[r.J] || 0) + r.pts;
  const eqs = [];
  hm.equipos.forEach((q, i) => {
    const xs = (porEquipo[q.id] || []).sort((a, b) => a.pos - b.pos || b.puntos - a.puntos || b.valor - a.valor);
    if (!xs.length) return;
    const ptsJ = {};
    for (const x of xs) for (const r of x.jornadas) if (r.pts != null) ptsJ[r.J] = (ptsJ[r.J] || 0) + r.pts;
    // la evolución del valor de la plantilla de hoy (todos los de hm.todas de ese club, entrenador incluido)
    const del0 = hm.todas.filter((f) => f.teamId === q.id && f.temporada && f.temporada.length);
    const dias = [...new Set(del0.flatMap((f) => f.temporada.map((p) => diaMadrid(p.t))))].sort();
    const tDia = {};
    for (const f of del0) for (const p of f.temporada) tDia[diaMadrid(p.t)] = Math.max(tDia[diaMadrid(p.t)] || 0, p.t);
    const serie = dias.map((d) => ({ t: tDia[d], v: del0.reduce((s, f) => s + valorEn(f.temporada, tDia[d]), 0) }));
    const porteros = xs.filter((x) => x.pos === 1 && x.jugados > 0).sort((a, b) => b.minutos - a.minutos);
    const r = res[q.id] || [];
    eqs.push({ ...q, puestoValor: i + 1, tabla: tabla.porId[q.id] || null, resultados: r, proximos: prox[q.id] || [], puestoCal: puestoCal[q.id] || null,
      ptsJ: Object.entries(ptsJ).map(([k, p]) => [Number(k), p]).sort((a, b) => a[0] - b[0]), jugadores: xs, serie,
      aCero: r.filter((x) => x.gc === 0).length, paradas: porteros.reduce((s, x) => s + x.paradas, 0), portero: porteros[0] || null,
      bajas: xs.filter((x) => !x.ok && x.estado !== 'out_of_league'),
      entrenador: hm.todas.find((f) => f.teamId === q.id && f.pos === 5) || null });
  });
  for (const q of eqs) q.slug = asignar(slugs.equipos, q.id, q.nombre, q.club);
  for (const x of J) { const q = eqs.find((y) => y.id === x.teamId); x.equipoSlug = q ? q.slug : null; }
  const rutaE = new Map(eqs.map((q) => [q.id, `equipos/${q.slug}.html`]));
  const totales = eqs.map((q) => ({ id: q.id, pts: q.ptsJ.reduce((s, [, p]) => s + p, 0) })).sort((a, b) => b.pts - a.pts);
  totales.forEach((x, i) => { eqs.find((q) => q.id === x.id).puestoPuntos = i + 1; eqs.find((q) => q.id === x.id).puntosTotal = x.pts; });

  return {
    dia: hm.dia, generada: ahora, ultimaJugada, tabla, puestos, rangoDif, mediaJornada: Object.fromEntries(Object.entries(totalJ).map(([k, s]) => [k, s / eqs.length])),
    equipos: eqs, jugadores: conPagina, todos: J, slugs, nCalendario: dificultad.length,
    rutas: { jugador: (id) => rutaJ.get(String(id)) || null, equipo: (id) => rutaE.get(String(id)) || null },
  };
}

// ---------------------------------------------------------------- texto con reglas

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaDia = (d) => { const [, m, dd] = d.split('-').map(Number); return `${dd} de ${MESES[m - 1]}`; };
const enLetraA = (n) => ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco'][n] ?? String(n);
const ordinal = (n) => `${n}.º`;
const ordinalA = (n) => `${n}.ª`;
const partidosTxt = (n) => `${n} ${n === 1 ? 'partido' : 'partidos'}`;
const NIVEL_TXT = { 'fácil': 'un rival asequible', media: 'un rival de nivel medio', 'difícil': 'un rival difícil' };
/** «domingo 6 de diciembre a las 21:00» o, si LaLiga aún no ha puesto la hora (00:00 UTC), «domingo 6 de diciembre, hora por confirmar» */
export const cuando = (t) => { const d = new Date(t); return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? `${fechaHora(t).replace(/ a las .*$/, '')}, hora por confirmar` : fechaHora(t); };
const rivalTxt = (p) => `${p.casa ? 'recibe' : 'visita'} ${al(p.rival)}${p.pos ? ` (${p.pos}.º)` : ''}`;
const calTxt = (pc, n) => (!pc ? null : pc <= 5 ? 'de los más fáciles' : pc > n - 5 ? 'de los más difíciles' : 'normal');

// (16 nov, idea 1 del plan de AdSense) El análisis de cada ficha ya no es un párrafo fijo con otros números: es un banco de
// «hechos raros», cada uno con su umbral, y solo se escriben los que de verdad se cumplen en ese jugador o equipo, con varias
// formas de decir cada uno (elegida por el id, para que no cambie cada noche sin motivo). Lo que cuenta cada hecho está explicado
// en web/metodo.html (#fichas): si se cambia un umbral, cambiarlo también allí.

/** un número fijo por jugador y por hecho (FNV-1a): elige la forma de decir algo sin azar, siempre la misma para el mismo caso */
function huella(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const elige = (semilla, formas) => formas[huella(semilla) % formas.length];
const may = (f) => f.charAt(0).toUpperCase() + f.slice(1);
const pctTxt = (x) => `${Math.round(Math.abs(x))} %`;
const veces = (n) => (n === 1 ? 'una vez' : n === 2 ? 'dos veces' : `${n} veces`);
const jornadasTxt = (js) => (js.length === 1 ? `la jornada ${js[0]}` : `las jornadas ${js.slice(0, -1).join(', ')} y ${js[js.length - 1]}`);

/** los hechos de un jugador: [{ k, peso, txt, propio }] (propio: dice algo de él; los avisos, como una lesión, no cuentan) */
export function hechosJugador(x, H, eq) {
  const o = [];
  const p = PUESTO[x.pos], pl = PLURAL[x.pos], id = x.id;
  const add = (k, peso, formas, propio = true) => o.push({ k, peso, propio, txt: elige(`${id}|${k}`, formas) });
  const s = x.temporada || [];
  const desde = s.length ? s[0] : null;
  const max = s.length ? s.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const P = (H.puestos && H.puestos[x.pos]) || null;

  // el valor en la temporada
  if (desde && desde.v > 0) {
    const r = (x.valor - desde.v) / desde.v * 100;
    if (r >= 25) add('temporada', 3 + Math.min(3, r / 50), [
      `En agosto costaba ${dinero(desde.v)} y hoy ${dinero(x.valor)}: un ${pctTxt(r)} más.`,
      `Desde que empezó la temporada su valor ha crecido un ${pctTxt(r)}, de ${dinero(desde.v)} a ${dinero(x.valor)}.`,
      `Quien lo fichara a principios de agosto, por ${dinero(desde.v)}, tendría ahora un jugador de ${dinero(x.valor)}.`,
      `Es de los que han hecho ganar dinero: ${dif(x.valor - desde.v)} desde el arranque de la temporada.`,
      `Sus ${dinero(desde.v)} de agosto se han convertido en ${dinero(x.valor)}.`]);
    else if (r <= -25) add('temporada', 3 + Math.min(3, -r / 30), [
      `Ha perdido un ${pctTxt(r)} de su valor desde agosto: entonces costaba ${dinero(desde.v)} y ahora ${dinero(x.valor)}.`,
      `Empezó la temporada en ${dinero(desde.v)} y se ha quedado en ${dinero(x.valor)}, un ${pctTxt(r)} menos.`,
      `Su precio va cuesta abajo desde agosto: de ${dinero(desde.v)} a ${dinero(x.valor)} (-${pctTxt(r)}).`,
      `Quien lo tenga desde el principio ha perdido ${dinero(desde.v - x.valor)} con él.`,
      `Hoy sale bastante más barato que en verano: ${dinero(x.valor)}, cuando arrancó en ${dinero(desde.v)}.`]);
  }
  if (max && s.length > 10 && x.valor >= max.v && desde && x.valor > desde.v * 1.05) add('maximo', 4, [
    `Hoy vale más que nunca esta temporada.`,
    `Con el último cambio de mercado ha marcado su valor más alto de la temporada.`,
    `No ha estado tan caro en todo el curso como hoy.`]);
  // (si la racha a la baja empezó en el máximo, ya lo dice la racha: no se cuenta dos veces la misma caída)
  else if (max && desde && max.t !== desde.t && x.valor <= max.v * 0.75 && !o.some((h) => h.k === 'temporada')
    && !(x.racha <= -3 && Math.abs(max.v - x.valor + (x.rachaDif || 0)) <= 0.05 * max.v)) add('lejosMax', 3, [
    `Llegó a valer ${dinero(max.v)} el ${fechaCorta(max.t)}; hoy está un ${pctTxt((max.v - x.valor) / max.v * 100)} por debajo.`,
    `Su máximo fueron ${dinero(max.v)}, el ${fechaCorta(max.t)}, y desde entonces ha perdido ${dinero(max.v - x.valor)}.`]);

  // la racha, con lo que suele pasar después (52.302 cambios, guía de valor de mercado)
  const frena = x.racha >= 3 && x.difAyer > 0 && x.dif > 0 && x.dif < x.difAyer / 2;
  // (sesión 4) más formas, con la fecha y el valor de partida de la racha: es el hecho que sale en casi todas las fichas
  const rd = x.rachaDesde ? fechaCorta(x.rachaDesde) : null, r0 = x.valor - (x.rachaDif || 0), porDia = x.racha ? Math.abs(x.rachaDif / x.racha) : 0;
  if (x.racha >= 3) {
    const larga = x.racha >= 8;
    add('racha', 3 + Math.min(3, x.racha / 4), frena ? [
      `Lleva ${x.racha} días subiendo (${dif(x.rachaDif)} en total), pero hoy ha subido menos de la mitad que ayer, y cuando pasa eso la racha sigue solo el 61,9 % de las veces.`,
      `Sube desde hace ${x.racha} días, aunque frenando: hoy ${dif(x.dif)} después de ${dif(x.difAyer)} ayer. Esta temporada, con un frenazo así, el 61,9 % ha subido también al día siguiente.`,
      ...(rd ? [`El empujón que empezó el ${rd} pierde fuerza: ${dif(x.difAyer)} ayer y solo ${dif(x.dif)} hoy. Con un frenazo de ese tamaño, algo más de seis de cada diez rachas aguantan otro día.`] : [])]
      : larga ? [
        `Encadena ${x.racha} días seguidos subiendo, ${dif(x.rachaDif)} en total. Las rachas que llegan a tres días suelen durar unos ocho: la suya ya va por encima.`,
        `${x.racha} cambios de mercado seguidos al alza (${dif(x.rachaDif)}): de las rachas de esta temporada, solo el 42,2 % ha llegado a diez días.`,
        ...(rd ? [`No ha bajado ni un día desde el ${rd}, cuando valía ${dinero(r0)}; desde entonces gana de media ${dinero(porDia)} por cambio de mercado.`,
          `Quien lo comprara el ${rd} lleva ${dinero(x.rachaDif)} de beneficio: son ${x.racha} subidas sin una sola bajada.`] : [])]
        : [
          `Lleva ${x.racha} días seguidos subiendo (${dif(x.rachaDif)}). De los que llevan tres días al alza, el 87,3 % sube también el cuarto.`,
          `Su valor sube desde hace ${x.racha} días, ${dif(x.rachaDif)} en total; tras tres subidas seguidas, lo normal esta temporada es que venga una cuarta (87,3 %).`,
          ...(rd ? [`Valía ${dinero(r0)} el ${rd} y ahora ${dinero(x.valor)}, sin un día en rojo por medio.`,
            `Desde el ${rd} solo ha subido: ${dif(x.rachaDif)} en ${x.racha} cambios de mercado.`] : [])]);
  } else if (x.racha <= -3) add('racha', 3 + Math.min(3, -x.racha / 4), [
    `Lleva ${-x.racha} días seguidos bajando (${dif(x.rachaDif)}); tras tres bajadas, el 88,4 % baja también el cuarto día.`,
    `${-x.racha} días a la baja y ${dif(-x.rachaDif).replace(/^\+/, '')} perdidos: cuando un jugador encadena tres bajadas, casi nueve de cada diez veces llega la cuarta.`,
    ...(rd ? [`El ${rd} valía ${dinero(r0)}; hoy, ${dinero(x.valor)}. No ha tenido un solo día de subida desde entonces.`,
      `Desde el ${rd} pierde una media de ${dinero(porDia)} por cambio de mercado: ${-x.racha} bajadas seguidas.`,
      `Quien lo tenga desde el ${rd} ha visto cómo se le iban ${dinero(x.rachaDif)} sin un respiro.`] : [])]);

  // valor y puntos en sentidos contrarios
  if (P && x.jugados >= 5 && x.pct7 >= 5 && x.media < P.media50) add('subeSinPuntos', 4, [
    `Su valor ha subido un ${pctTxt(x.pct7)} en siete días con una media de ${coma(x.media)}, por debajo de la mitad de los ${pl}: el mercado va por delante de sus puntos.`,
    `Sube (${pct(x.pct7)} en una semana) sin que lo expliquen sus puntos: ${coma(x.media)} de media, menos que la mayoría de ${pl} con cinco partidos.`]);
  else if (P && x.rangoMedia && x.rangoMedia <= Math.max(5, Math.round(x.deRango * 0.2)) && x.pct7 <= -5) add('bajaConPuntos', 4, [
    `Tiene la ${ordinalA(x.rangoMedia)} mejor media de los ${pl} y aun así ha perdido un ${pctTxt(x.pct7)} de valor esta semana.`,
    `Baja en el mercado (${pct(x.pct7)} en siete días) pese a puntuar como pocos: ${coma(x.media)} de media, ${ordinalA(x.rangoMedia)} entre ${x.deRango} ${pl}.`]);
  if (x.rangoMedia && x.rangoMedia <= 5 && !o.some((h) => h.k === 'bajaConPuntos')) add('topMedia', x.rangoMedia === 1 ? 5 : 4, x.rangoMedia === 1 ? [
    `Ningún ${p} con cinco partidos o más tiene mejor media que él (${coma(x.media)}).`,
    `Es el ${p} con mejor media de LaLiga Fantasy entre los que han jugado cinco partidos: ${coma(x.media)}.`]
    : [
      `Su media, ${coma(x.media)}, es la ${ordinalA(x.rangoMedia)} mejor entre los ${x.deRango} ${pl} con cinco partidos o más.`,
      `Pocos ${pl} puntúan tanto: solo ${x.rangoMedia - 1 === 1 ? 'uno tiene' : `${x.rangoMedia - 1} tienen`} más media que sus ${coma(x.media)}.`]);

  // precio frente a puntos
  if (P && x.jugados >= 5 && x.media >= P.media75 && x.valor <= P.valor50) add('barato', 4, [
    `Da puntos de los buenos a precio de los normales: ${coma(x.media)} de media (de las mejores de su puesto) y vale ${dinero(x.valor)}, menos que la mitad de los ${pl}.`,
    `Por lo que cuesta, ${dinero(x.valor)}, puntúa mucho: está en el cuarto de ${pl} con más media.`]);
  else if (P && x.jugados >= 5 && x.valor >= P.valor90 && x.media <= P.media50) add('caro', 3.5, [
    `Está entre los ${pl} más caros y su media, ${coma(x.media)}, no llega a la de la mitad de su puesto.`,
    `Se paga como uno de los mejores ${pl} (${dinero(x.valor)}), pero sus ${coma(x.media)} puntos de media son de la parte baja.`]);

  // el sitio en el once
  const b = x.b;
  if (b && b.temporada >= 6 && b.b >= 0.7 && b.a <= 0.4) add('pierdeSitio', 5, [
    `Ha perdido el sitio: fue titular en el ${Math.round(b.b * 100)} % de sus partidos, pero solo en ${Math.round(b.a * b.ult)} de los ${b.ult} últimos ha llegado a 60 minutos.`,
    `Algo ha cambiado en las últimas jornadas: de titular casi fijo a jugar 60 minutos solo ${veces(Math.round(b.a * b.ult))} en los ${b.ult} últimos partidos.`]);
  else if (b && b.temporada >= 6 && b.b <= 0.5 && b.a >= 0.8) add('ganaSitio', 5, [
    `Se ha ganado el sitio: en toda la temporada fue titular la mitad de las veces o menos, pero en ${Math.round(b.a * b.ult)} de los ${b.ult} últimos partidos ha jugado 60 minutos o más.`,
    `Empezó la temporada entrando y saliendo del once; ahora lo juega casi todo (${Math.round(b.a * b.ult)} de los ${b.ult} últimos partidos de titular).`]);
  else if (x.titular && x.titular === H.ultimaJugada) add('fijo', 3, [
    `Ha jugado 60 minutos o más en las ${H.ultimaJugada} jornadas: no se ha perdido ni una.`,
    `Titular en todas las jornadas que se han jugado, las ${H.ultimaJugada}.`,
    `Su entrenador no lo ha sentado ni una vez: ${H.ultimaJugada} de ${H.ultimaJugada} con 60 minutos o más.`]);

  // cómo puntúa cuando es titular, frente a un titular cualquiera de su puesto (3.758 partidos, guía de la alineación)
  const ref = TITULAR[x.pos];
  if (x.titular >= 4 && x.mediaTit != null && x.mediaTit >= ref * 1.3) add('rindeTit', 3.5, [
    `Cuando juega de inicio saca ${coma(x.mediaTit)} puntos; un ${p} titular cualquiera, ${coma(ref)}.`,
    `De titular rinde muy por encima de su puesto: ${coma(x.mediaTit)} de media frente a los ${coma(ref)} de un ${p} titular normal.`]);
  else if (x.titular >= 4 && x.mediaTit != null && x.mediaTit <= ref * 0.7) add('flojoTit', 3.5, [
    `Incluso jugando 60 minutos se queda en ${coma(x.mediaTit)} puntos, lejos de los ${coma(ref)} de un ${p} titular normal.`,
    `Ser titular no le basta para puntuar: ${coma(x.mediaTit)} de media en esos partidos, cuando lo normal en un ${p} son ${coma(ref)}.`]);

  // el mejor de su puesto alguna jornada
  if (x.mejorPuesto && x.mejorPuesto.length) {
    const m = x.mejorPuesto, js = m.map((r) => r.J);
    add('mejorPuesto', 3 + Math.min(2, m.length), m.length === 1 ? [
      `Fue el ${p} que más puntos sacó en la jornada ${m[0].J}, con ${m[0].pts}.`,
      `En la jornada ${m[0].J} ningún ${p} hizo más puntos que sus ${m[0].pts}.`]
      : [
        `Ha sido ${veces(m.length)} el ${p} con más puntos de la jornada: en ${jornadasTxt(js)}.`,
        `Ningún ${p} puntuó más que él en ${jornadasTxt(js)}.`]);
  }

  // regularidad
  const pj = x.jornadas.filter((r) => r.min > 0 && r.pts != null);
  const n10 = pj.filter((r) => r.pts >= 10).length, n1 = pj.filter((r) => r.pts <= 1).length;
  if (n10 >= 3) add('dieces', 2.5 + Math.min(2, n10 / 3), [
    `Lleva ${n10} partidos de 10 puntos o más.`,
    `De sus ${pj.length} partidos, ${n10} han sido de 10 puntos o más.`,
    `Tiene ${n10} actuaciones de dos cifras esta temporada.`]);
  if (pj.length >= 6 && n1 >= 4) add('irregular', 2.5, [
    `Ojo con la regularidad: ${n1} de sus ${pj.length} partidos se quedaron en 1 punto o menos.`,
    `En ${n1} de los ${pj.length} partidos que ha jugado no pasó de 1 punto.`]);

  // la forma: las tres últimas jornadas frente a su media
  const u3 = x.jornadas.slice(-3);
  if (x.jugados >= 6 && x.media >= 2 && u3.length === 3 && u3.every((r) => r.min > 0 && r.pts != null)) {
    const m3 = u3.reduce((a, r) => a + r.pts, 0) / 3;
    if (m3 >= x.media * 1.5 && m3 - x.media >= 2) add('forma', 4, [
      `Está en racha: ${u3.map((r) => r.pts).join(', ')} puntos en las tres últimas jornadas, ${coma(m3)} de media frente a los ${coma(x.media)} de toda la temporada.`,
      `Llega a tope: en las jornadas ${u3[0].J} a ${u3[2].J} ha sumado ${u3.reduce((a, r) => a + r.pts, 0)} puntos, muy por encima de lo que suele.`]);
    else if (m3 <= x.media * 0.5 && x.media - m3 >= 2) add('forma', 4, [
      `Viene de un bajón: ${u3.map((r) => r.pts).join(', ')} en las tres últimas jornadas, cuando su media es de ${coma(x.media)}.`,
      `Sus tres últimos partidos (${u3.map((r) => r.pts).join(', ')} puntos) están muy por debajo de su media de ${coma(x.media)}.`]);
  }
  // su mejor partido, con el rival y lo que hizo
  if (pj.length >= 3) {
    const mj = [...pj].sort((a, c) => c.pts - a.pts || c.min - a.min)[0];
    const que = [mj.g ? `${mj.g === 1 ? 'un gol' : `${mj.g} goles`}` : '', mj.a ? `${mj.a === 1 ? 'una asistencia' : `${mj.a} asistencias`}` : '', x.pos === 1 && mj.par ? `${mj.par} paradas` : '', x.pos <= 2 && mj.enc === 0 && mj.min >= 60 ? 'la portería a cero' : ''].filter(Boolean);
    const con = que.length ? (que.length > 1 ? `${que.slice(0, -1).join(', ')} y ${que[que.length - 1]}` : que[0]) : null;
    if (mj.pts >= 8 && !(x.mejorPuesto || []).some((r) => r.J === mj.J)) add('mejorPartido', 2, [
      `Su mejor día fue la jornada ${mj.J}, ${mj.casa ? 'en casa' : 'fuera'} contra ${el(mj.rival)}: ${mj.pts} puntos${con ? ` con ${con}` : ''}.`,
      `${mj.pts} puntos ante ${el(mj.rival)} en la jornada ${mj.J}${con ? ` (${con})` : ''}: es su tope esta temporada.`,
      `Lo máximo que ha dado son ${mj.pts} puntos, en la jornada ${mj.J}${con ? `, con ${con},` : ','} ${mj.r === 'G' ? 'en una victoria' : mj.r === 'E' ? 'en un empate' : 'aunque su equipo perdió'} contra ${el(mj.rival)}.`,
      `Si hay que quedarse con un partido, el de la jornada ${mj.J} ${mj.casa ? 'en casa' : 'fuera'} ante ${el(mj.rival)}: ${mj.pts} puntos${con ? ` con ${con}` : ''}.`,
      `Su techo está en ${mj.pts} puntos${con ? `, con ${con},` : ''} y lo tocó en la jornada ${mj.J} contra ${el(mj.rival)}.`]);
  }

  // en casa y fuera, y contra los de arriba (la tabla de hoy)
  const media = (xs) => xs.reduce((a, r) => a + r.pts, 0) / xs.length;
  const enCasa = pj.filter((r) => r.casa), fuera = pj.filter((r) => !r.casa);
  if (enCasa.length >= 3 && fuera.length >= 3) {
    const mc = media(enCasa), mf = media(fuera);
    if (mc - mf >= 2.5 && mc >= mf * 1.5) add('casa', 3, [
      `En casa es otro: ${coma(mc)} puntos de media por ${coma(mf)} fuera.`,
      `Puntúa mucho más en su estadio (${coma(mc)} de media) que lejos de él (${coma(mf)}).`]);
    else if (mf - mc >= 2.5 && mf >= mc * 1.5) add('casa', 3, [
      `Rinde más fuera (${coma(mf)} de media) que en casa (${coma(mc)}).`,
      `Curioso: lejos de casa saca ${coma(mf)} puntos por partido y en casa ${coma(mc)}.`]);
  }
  const arriba = new Set(Object.values(H.tabla.porId || {}).filter((t) => t.pos <= 6).map((t) => String(t.id)));
  const vsA = pj.filter((r) => arriba.has(String(r.rivalId))), vsR = pj.filter((r) => !arriba.has(String(r.rivalId)));
  if (vsA.length >= 2 && vsR.length >= 3) {
    const ma = media(vsA), mr = media(vsR);
    if (ma - mr >= 3) add('grandes', 3, [`Se crece contra los de arriba: ${coma(ma)} puntos de media ante los seis primeros de la tabla y ${coma(mr)} contra el resto.`, `Ante los seis primeros de LaLiga promedia ${coma(ma)} puntos, más que contra los demás (${coma(mr)}).`]);
    else if (mr - ma >= 3) add('grandes', 3, [`Contra los seis primeros de la tabla baja mucho: ${coma(ma)} de media, por ${coma(mr)} ante el resto.`, `Los rivales de arriba se le atragantan (${coma(ma)} puntos de media frente a ${coma(mr)} contra los demás).`]);
  }
  // minutos: el que casi siempre sale desde el banquillo
  if (x.jugados >= 5 && x.minutos / x.jugados < 45 && !o.some((h) => h.k === 'ganaSitio')) add('banquillo', 2.5, [
    `Juega poco cada vez: ${Math.round(x.minutos / x.jugados)} minutos de media en los partidos en que sale.`,
    `Sus ${x.jugados} partidos suman ${x.minutos} minutos: lo normal es que entre desde el banquillo.`]);
  if (x.rojas >= 1) add('rojas', 2, [`Ha visto ${x.rojas === 1 ? 'una roja' : `${x.rojas} rojas`} esta temporada.`, `Cuidado con su disciplina: ${x.rojas === 1 ? 'una expulsión' : `${x.rojas} expulsiones`} ya.`]);
  // lo de hoy en el mercado, si es de lo más fuerte del día
  if (H.rangoDif && H.rangoDif[x.id] && H.rangoDif[x.id] <= 10 && Math.abs(x.pct) >= 3) add('hoy', 3.5, x.dif > 0 ? [
    `Hoy es de los diez que más suben en todo el mercado: ${dif(x.dif)} (${pct(x.pct)}).`,
    `Con el último cambio ha ganado ${dinero(x.dif)}, una de las diez mayores subidas del día.`]
    : [
      `Hoy es de los diez que más bajan: ${dif(x.dif)} (${pct(x.pct)}).`,
      `El último cambio de mercado le quitó ${dinero(x.dif)}, de las diez mayores bajadas del día.`]);

  // goles, asistencias y portería
  if (x.pos === 1 && x.aCero >= 4) add('aCero', 3, [
    `Lleva ${x.aCero} porterías a cero siendo titular; con 0 goles encajados, un portero titular saca de media ${coma(PORTERO_GOLES[0])} puntos.`,
    `${x.aCero} partidos sin encajar de titular, y eso es lo que más da a un portero en este juego (${coma(PORTERO_GOLES[0])} de media con la portería a cero).`]);
  if (x.pos === 1 && x.titular >= 4 && x.paradas / x.titular >= 3.5) add('paradas', 3, [
    `Para mucho: ${x.paradas} paradas, unas ${coma(x.paradas / x.titular)} por partido de titular.`,
    `Sus ${x.paradas} paradas (${coma(x.paradas / x.titular)} por partido) le dan puntos incluso cuando le marcan.`]);
  if ((x.pos === 3 || x.pos === 4) && x.goles >= 5) add('goles', 3 + Math.min(2, x.goles / 5), [
    `Lleva ${x.goles} goles en ${x.jugados} partidos.`,
    `Con ${x.goles} goles, marca de media uno cada ${Math.round(x.minutos / x.goles)} minutos.`]);
  else if (x.pos === 2 && x.goles >= 2) add('goles', 3, [
    `Para ser defensa, marca: ${x.goles} goles esta temporada.`,
    `${x.goles} goles de un defensa, algo que se paga bien en puntos.`]);
  if (x.asist >= 4) add('asist', 2.5, [
    `Suma ${x.asist} asistencias.`,
    `Ha dado ${x.asist} pases de gol.`]);

  // vuelve tras no jugar, o lleva jornadas sin jugar estando disponible
  const js = x.jornadas;
  if (js.length >= 4) {
    const u = js[js.length - 1];
    let k = 0;
    for (let i = js.length - 2; i >= 0 && js[i].min === 0; i--) k++;
    let sin = 0;
    for (let i = js.length - 1; i >= 0 && js[i].min === 0; i--) sin++;
    if (u.min > 0 && k >= 2) add('vuelve', 3.5, [
      `Volvió a jugar en la jornada ${u.J} después de ${k} jornadas sin hacerlo.`,
      `Tras ${k} jornadas fuera, en la ${u.J} ya jugó ${u.min} minutos.`]);
    else if (sin >= 2 && x.ok && x.jugados >= 3) add('sinJugar', 3, [
      `No juega desde la jornada ${js[js.length - 1 - sin].J}, aunque LaLiga lo da como disponible.`,
      `Lleva ${sin} jornadas sin jugar ni un minuto, y ahora mismo LaLiga no lo da como lesionado ni sancionado.`]);
  }

  // lo que pesa en su equipo
  if (eq && eq.puntosTotal > 0 && x.puntos > 0) {
    const top = [...eq.jugadores].sort((a, c) => c.puntos - a.puntos)[0];
    const r = x.puntos / eq.puntosTotal * 100;
    if (top && top.id === x.id && r >= 15) add('pesoEquipo', 3, [
      `Es el que más puntos lleva ${del(eq.nombre)}: el ${pctTxt(r)} de lo que suma toda la plantilla.`,
      `De cada 100 puntos que da ${el(eq.nombre)}, ${Math.round(r)} son suyos; nadie de su equipo suma más.`]);
  }

  // el calendario de su equipo, solo si es de los más fáciles o difíciles
  if (eq && eq.proximos.length >= 2 && eq.puestoCal && H.nCalendario >= 10) {
    const ps = eq.proximos.map(rivalTxt).join(', ');
    if (eq.puestoCal <= 3) add('calendario', 2.5, [
      `${may(el(eq.nombre))} tiene uno de los tres calendarios más fáciles de las próximas jornadas: ${ps}.`,
      `Le viene un tramo cómodo: ${ps}. Es el ${ordinal(eq.puestoCal)} calendario más fácil de los ${H.nCalendario}.`], false);
    else if (eq.puestoCal > H.nCalendario - 3) add('calendario', 2.5, [
      `Lo que viene es duro: ${ps}, de los tres calendarios más difíciles de los ${H.nCalendario}.`,
      `${may(el(eq.nombre))} afronta uno de los peores calendarios de las próximas jornadas: ${ps}.`], false);
  }

  // (sesión 4) más hechos propios, cada uno con su umbral (lista en web/metodo.html#fichas)
  const ya = (k) => o.some((h) => h.k === k);
  // cómo le ha ido por tramos: la primera mitad de las jornadas jugadas frente a la segunda
  const mitad = Math.floor(H.ultimaJugada / 2);
  const t1 = pj.filter((r) => r.J <= mitad), t2 = pj.filter((r) => r.J > mitad);
  if (mitad >= 4 && t1.length >= 3 && t2.length >= 3 && !ya('forma')) {
    const m1 = media(t1), m2 = media(t2);
    if (m2 - m1 >= 2 && m2 >= m1 * 1.4) add('tramos', 3.5, [
      `Va de menos a más: ${coma(m1)} puntos de media hasta la jornada ${mitad} y ${coma(m2)} desde entonces.`,
      `Su temporada tiene dos caras, y la buena es la de ahora: de la jornada ${mitad + 1} en adelante promedia ${coma(m2)}, cuando antes se quedaba en ${coma(m1)}.`,
      `Ha ido a mejor según avanzaba el curso (${coma(m1)} de media en las ${mitad} primeras jornadas, ${coma(m2)} en las siguientes).`]);
    else if (m1 - m2 >= 2 && m1 >= m2 * 1.4) add('tramos', 3.5, [
      `Empezó mejor de lo que va ahora: ${coma(m1)} puntos de media hasta la jornada ${mitad} y ${coma(m2)} después.`,
      `Su arranque fue lo mejor (${coma(m1)} por partido en las ${mitad} primeras jornadas); desde la ${mitad + 1}, ${coma(m2)}.`,
      `La primera parte de la temporada le salió bastante mejor que la segunda: de ${coma(m1)} de media ha pasado a ${coma(m2)}.`]);
  }
  // dónde está su precio entre los de su puesto
  if (x.rangoValor && x.rangoValor <= 5 && x.valor >= 10e6 && !ya('caro')) add('rangoValor', 3, x.rangoValor === 1 ? [
    `No hay ${p} más caro en todo el juego.`,
    `Es el ${p} que más vale de LaLiga Fantasy.`,
    `Ningún otro ${p} cuesta tanto como él.`]
    : [
      `Solo ${['', 'un', 'dos', 'tres', 'cuatro'][x.rangoValor - 1]} ${x.rangoValor - 1 === 1 ? p : pl} ${x.rangoValor - 1 === 1 ? 'vale' : 'valen'} más que él en todo el juego.`,
      `Por precio, es el ${ordinal(x.rangoValor)} ${p} de LaLiga Fantasy.`,
      `Está en el top 5 de los ${pl} más caros: ${ordinal(x.rangoValor)} de ${x.deValor}.`]);
  // puntos por millón (lo que da por lo que cuesta) y por cada 90 minutos, frente a los de su puesto
  if (x.rangoMillon && x.rangoMillon <= 5 && !ya('barato')) add('porMillon', 3.5, [
    `Por cada millón que vale ha sumado ${coma(x.ptsMillon)} puntos: ${x.rangoMillon === 1 ? `ningún ${p} da más por su precio` : `el ${ordinal(x.rangoMillon)} ${p} que más rinde por lo que cuesta`}.`,
    `Pocos fichajes salen tan rentables: ${coma(x.ptsMillon)} puntos por millón de valor, ${ordinal(x.rangoMillon)} entre los ${pl} con cinco partidos.`]);
  if (x.rango90 && x.rango90 <= 5 && x.de90 >= 15 && !ya('topMedia')) add('por90', 3, [
    `Si se cuenta por minuto, rinde como pocos: ${coma(x.pts90)} puntos por cada 90 minutos en el campo, ${ordinal(x.rango90)} de los ${x.de90} ${pl} con 450 minutos o más.`,
    `Aprovecha el tiempo que juega: ${coma(x.pts90)} puntos por cada 90 minutos, de los cinco mejores de su puesto.`]);
  else if (x.rango90 && x.de90 >= 15 && x.rango90 > x.de90 - 5 && x.jugados >= 6) add('por90', 2.5, [
    `Juega minutos pero puntúa poco con ellos: ${coma(x.pts90)} puntos por cada 90, de lo más bajo de los ${pl} con 450 minutos.`,
    `Por minuto en el campo está a la cola de su puesto (${coma(x.pts90)} puntos por cada 90).`]);
  // el total de puntos entre los de su puesto, si no lo dice ya la media
  if (x.rangoPuntos && x.rangoPuntos <= 8 && !ya('topMedia') && !ya('bajaConPuntos')) add('rangoPuntos', 3, [
    `Con ${x.puntos} puntos es el ${ordinal(x.rangoPuntos)} ${p} que más suma en LaLiga Fantasy.`,
    `En puntos totales va ${ordinal(x.rangoPuntos)} entre todos los ${pl}: ${x.puntos}.`,
    `${x.puntos} puntos le ponen ${ordinal(x.rangoPuntos)} en la tabla de ${pl} del juego.`]);
  // frente a los de su puesto en su equipo: el más caro que no es el que más puntúa, o al revés
  if (eq && x.jugados >= 5) {
    const mismos = eq.jugadores.filter((y) => y.pos === x.pos && y.jugados >= 5);
    if (mismos.length >= 2) {
      const caro = [...mismos].sort((a, c) => c.valor - a.valor)[0], top = [...mismos].sort((a, c) => c.puntos - a.puntos)[0];
      if (caro.id === x.id && top.id !== x.id && top.puntos - x.puntos >= 10) add('enSuEquipo', 3, [
        `Es el ${p} más caro ${del(eq.nombre)}, pero no el que más puntúa: ${top.nombre} lleva ${top.puntos} y él ${x.puntos}.`,
        `En ${el(eq.nombre)} nadie de su puesto vale más, aunque ${top.nombre} le saca ${top.puntos - x.puntos} puntos.`]);
      else if (top.id === x.id && caro.id !== x.id && caro.valor >= x.valor * 1.2) add('enSuEquipo', 3, [
        `Ningún ${p} ${del(eq.nombre)} suma más que él (${x.puntos}), y eso que ${caro.nombre} cuesta ${dinero(caro.valor)}.`,
        `Le gana en puntos a ${caro.nombre} (${x.puntos} frente a ${caro.puntos}) valiendo ${dinero(caro.valor - x.valor)} menos.`]);
    }
  }
  // los partidos en negativo
  const neg = pj.filter((r) => r.pts < 0);
  if (neg.length >= 2) {
    const peor = [...neg].sort((a, c) => a.pts - c.pts)[0];
    add('negativos', 2.5, [
      `Ha restado puntos en ${neg.length} partidos; el peor, ${peor.pts} en la jornada ${peor.J} contra ${el(peor.rival)}.`,
      `${may(enLetraA(neg.length))} veces ha terminado en negativo, con un ${peor.pts} ante ${el(peor.rival)} como tope.`]);
  }
  // cuando su equipo gana o pierde
  const enG = pj.filter((r) => r.r === 'G'), enP = pj.filter((r) => r.r === 'P');
  if (enG.length >= 3 && enP.length >= 3) {
    const mg = media(enG), mp = media(enP);
    if (mg - mp >= 3.5) add('resultado', 3, [
      `Sus puntos van con los resultados ${del(eq ? eq.nombre : x.equipo)}: ${coma(mg)} de media cuando gana y ${coma(mp)} cuando pierde.`,
      `Depende mucho de cómo le vaya al equipo: con victoria saca ${coma(mg)}; con derrota, ${coma(mp)}.`]);
    else if (mp - mg >= 1.5) add('resultado', 3, [
      `Rara vez pasa, pero puntúa más en las derrotas de su equipo (${coma(mp)}) que en las victorias (${coma(mg)}).`,
      `Aunque su equipo pierda, él suma: ${coma(mp)} de media en las derrotas, más que en las victorias (${coma(mg)}).`]);
  }
  // la racha de partidos buenos que sigue abierta
  let buenos = 0;
  for (let i = x.jornadas.length - 1; i >= 0 && x.jornadas[i].min > 0 && x.jornadas[i].pts != null && x.jornadas[i].pts >= 6; i--) buenos++;
  if (buenos >= 4 && !ya('forma') && !ya('tramos')) add('seguidas', 3.5, [
    `Lleva ${buenos} jornadas seguidas con 6 puntos o más.`,
    `No baja de 6 puntos desde la jornada ${x.jornadas[x.jornadas.length - buenos].J}: ${buenos} partidos así seguidos.`]);
  // los defensas con portería a cero
  if (x.pos === 2 && x.aCero >= 4) add('aCeroDef', 2.5, [
    `Con él de titular, su equipo ha dejado la portería a cero ${veces(x.aCero)}, y eso da puntos a un defensa.`,
    `${x.aCero} de sus partidos de titular terminaron sin goles en contra.`]);

  // avisos (no cuentan como propios: no dicen nada de cómo juega)
  if (!x.ok && ESTADOS[x.estado]) add('estado', 10, [`LaLiga lo da ahora como ${ESTADOS[x.estado]}${x.motivo ? ` (${x.motivo.txt.charAt(0).toLowerCase() + x.motivo.txt.slice(1)})` : ''}.`], false);
  if (x.amarillas % 5 === 4 && x.ok) add('amarillas', 6, [
    `Lleva ${x.amarillas} amarillas: con una más se pierde la jornada siguiente.`,
    `Está a una amarilla de la sanción (lleva ${x.amarillas}).`]);
  return o.sort((a, c) => c.peso - a.peso);
}

/** el próximo partido, con lo que dice el rival (goles que marca o encaja por partido, su racha): va siempre al final */
function proximoJugador(x, H, eq) {
  const px = eq && eq.proximos[0];
  if (!px) return null;
  const t = H.tabla.porId && H.tabla.porId[px.rivalId];
  const rr = (H.equipos.find((q) => q.id === px.rivalId) || {}).resultados || [];
  const u = rr.slice(-3).map((r) => r.r);
  const forma = u.length === 3 ? (u.every((r) => r === 'G') ? 'viene de ganar sus tres últimos partidos' : u.every((r) => r === 'P') ? 'viene de perder sus tres últimos partidos' : !u.includes('G') ? 'no ha ganado ninguno de sus tres últimos partidos' : null) : null;
  const donde = px.casa ? 'en casa' : 'fuera';
  const nombre = el(px.rival);
  let dato = null;
  if (t && t.pj >= 3) {
    const gpp = (v) => (coma(v) === '1' ? '1 gol' : `${coma(v)} goles`);
    if (x.pos <= 2) dato = `marca ${gpp(t.gf / t.pj)} por partido`;
    else dato = `encaja ${gpp(t.gc / t.pj)} por partido`;
  }
  const nivel = NIVEL_TXT[px.nivel] || 'un rival de nivel medio';
  return elige(`${x.id}|px${px.J}`, [
    `En la jornada ${px.J} juega ${donde} contra ${nombre}${px.pos ? `, ${px.pos}.º` : ''}${dato ? `, que ${dato}` : ''}${forma ? ` y ${forma}` : ''}.`,
    `Lo siguiente: ${nombre} ${donde}, en la jornada ${px.J}; ${nivel}${dato ? ` que ${dato}` : ''}.`,
    `Su próximo rival es ${nombre} (jornada ${px.J}, ${donde})${forma || dato ? `, que ${[forma, dato].filter(Boolean).join(' y ')}` : ''}.`]);
}

/** la entrada del análisis: lo básico, dicho de varias formas */
function entradaJugador(x) {
  const p = PUESTO[x.pos];
  const nombre = `${x.nombreCompleto}${!x.nombreCompleto.includes(x.nombre.replace(/\.$/, '')) ? ` (${x.nombre} en el juego)` : ''}`;
  if (!x.jugados) return `${nombre}, ${p} ${del(x.equipo)}, vale ${dinero(x.valor)} y todavía no ha jugado esta temporada.`;
  return elige(`${x.id}|entrada`, [
    `${nombre}, ${p} ${del(x.equipo)}, vale ${dinero(x.valor)} y lleva ${x.puntos} puntos en ${partidosTxt(x.jugados)} (${coma(x.media)} de media).`,
    `${x.puntos} puntos en ${partidosTxt(x.jugados)} y ${dinero(x.valor)} de valor: así llega ${nombre}, ${p} ${del(x.equipo)}.`,
    `${nombre} juega de ${p} en ${el(x.equipo)}, cuesta ${dinero(x.valor)} y promedia ${coma(x.media)} puntos por partido.`,
    `Con ${coma(x.media)} puntos de media en ${partidosTxt(x.jugados)}, ${nombre}${nombre.includes('(') ? `, ${p} ${del(x.equipo)},` : ` (${p}, ${x.equipo})`} vale hoy ${dinero(x.valor)}.`]);
}

/** cuántos hechos se escriben como mucho, y lo mínimo para que la ficha vaya a Google (si no, noindex, follow) */
const MAX_HECHOS = 11, MIN_PROPIOS = 3, MIN_PARTIDOS = 5;
export function analisisJugador(x, H, eq) {
  const hs = hechosJugador(x, H, eq);
  const elegidos = hs.slice(0, MAX_HECHOS);
  const propios = hs.filter((h) => h.propio).length;
  const px = proximoJugador(x, H, eq);
  return { frases: [entradaJugador(x), ...elegidos.map((h) => h.txt), ...(px ? [px] : [])], propios, indexar: x.jugados >= MIN_PARTIDOS && propios >= MIN_PROPIOS, claves: elegidos.map((h) => h.k) };
}

/** los hechos de un equipo, igual que los de un jugador */
export function hechosEquipo(q, H) {
  const o = [];
  // quien: el jugador del que habla (si lo hay); un mismo jugador sale en un solo hecho, el que más pesa
  const add = (k, peso, formas, quien = null) => o.push({ k, peso, quien, txt: elige(`e${q.id}|${k}`, formas) });
  const t = q.tabla, n = H.equipos.length;
  const r = q.resultados;
  // racha de resultados
  if (r.length >= 3) {
    const u = r[r.length - 1].r;
    let k = 0;
    for (let i = r.length - 1; i >= 0 && r[i].r === u; i--) k++;
    let inv = 0;
    for (let i = r.length - 1; i >= 0 && r[i].r !== 'P'; i--) inv++;
    if (u === 'G' && k >= 3) add('racha', 3 + k / 2, [`Llega con ${k} victorias seguidas.`, `Encadena ${k} partidos ganados.`]);
    else if (u === 'P' && k >= 3) add('racha', 3 + k / 2, [`Viene de perder ${k} partidos seguidos.`, `Lleva ${k} derrotas consecutivas.`]);
    else if (inv >= 5) add('invicto', 3.5, [`No pierde desde hace ${inv} jornadas.`, `${inv} partidos seguidos sin perder.`]);
    else if (u !== 'G' && r.length >= 5) {
      let sinG = 0;
      for (let i = r.length - 1; i >= 0 && r[i].r !== 'G'; i--) sinG++;
      if (sinG >= 5) add('sinGanar', 3.5, [`Lleva ${sinG} jornadas sin ganar.`, `No gana desde hace ${sinG} partidos.`]);
    }
  }
  // ataque y defensa
  const T = Object.values(H.tabla.porId || {});
  if (t && T.length >= 10) {
    const gfR = [...T].sort((a, b) => b.gf - a.gf).findIndex((x) => x.id === t.id) + 1;
    const gcR = [...T].sort((a, b) => a.gc - b.gc).findIndex((x) => x.id === t.id) + 1;
    if (gfR && gfR <= 3) add('ataque', 3, [`Es el ${gfR === 1 ? "" : `${ordinal(gfR)} `}equipo que más goles marca (${t.gf}).`, `Con ${t.gf} goles, tiene uno de los tres mejores ataques de LaLiga.`]);
    else if (gfR >= T.length - 2) add('ataque', 3, [`Le cuesta marcar: ${t.gf} goles, de los más bajos de la liga.`, `Solo ${t.gf} goles a favor, de los ataques más pobres.`]);
    if (gcR && gcR <= 3) add('defensa', 3, [`Encaja poco: ${t.gc} goles, la ${gcR === 1 ? '' : `${ordinalA(gcR)} `}defensa menos goleada.`, `Solo le han marcado ${t.gc} goles, de lo mejor de LaLiga atrás.`]);
    else if (gcR >= T.length - 2) add('defensa', 3, [`Su defensa sufre: ${t.gc} goles en contra, de los que más.`, `Ha encajado ${t.gc} goles, entre los tres peores registros.`]);
  }
  // fantasy frente a la clasificación
  if (t && q.puestoPuntos && Math.abs(q.puestoPuntos - t.pos) >= 5) add('fantasyVsLiga', 4, q.puestoPuntos < t.pos ? [
    `Da más puntos fantasy de lo que dice la tabla: es ${ordinal(t.pos)} en LaLiga, pero ${ordinal(q.puestoPuntos)} en puntos de sus jugadores.`,
    `Sus jugadores puntúan por encima de su clasificación (${ordinal(q.puestoPuntos)} en puntos fantasy, ${ordinal(t.pos)} en la liga).`]
    : [
      `Va ${ordinal(t.pos)} en LaLiga, pero sus jugadores son solo los ${ordinal(q.puestoPuntos)} que más puntos fantasy suman.`,
      `Su clasificación es mejor que sus puntos fantasy: ${ordinal(t.pos)} en la tabla y ${ordinal(q.puestoPuntos)} en lo que suman sus jugadores.`]);
  // el valor de la plantilla en 7 días
  const d7 = [...H.equipos].sort((a, b) => b.dif7 - a.dif7);
  const rk = d7.findIndex((x) => x.id === q.id) + 1;
  if (rk && rk <= 3 && q.dif7 > 0) add('valor7', 3, [`Su plantilla es de las que más valor han ganado esta semana: ${dif(q.dif7)}.`, `En siete días sus jugadores valen ${dinero(q.dif7)} más, el ${rk === 1 ? '' : `${ordinal(rk)} `}que más sube.`]);
  else if (rk >= n - 2 && q.dif7 < 0) add('valor7', 3, [`Su plantilla es de las que más valor han perdido esta semana: ${dif(q.dif7)}.`, `En siete días ha perdido ${dif(q.dif7).replace(/^-/, '')} de valor, de los peores datos de los ${n}.`]);
  // dependencia de un jugador
  const top = [...q.jugadores].sort((a, b) => b.puntos - a.puntos)[0];
  if (top && q.puntosTotal > 0 && top.puntos / q.puntosTotal >= 0.18) add('depende', 3.5, [
    `Depende mucho de ${top.nombre}: el ${pctTxt(top.puntos / q.puntosTotal * 100)} de los puntos fantasy del equipo son suyos.`,
    `${top.nombre} pone ${top.puntos} de sus ${q.puntosTotal} puntos fantasy.`], top.id);
  // jornadas por encima de la media
  if (q.ptsJ.length >= 6) {
    const enc = q.ptsJ.filter(([j, p]) => p > H.mediaJornada[j]).length;
    if (enc >= q.ptsJ.length * 0.75) add('regular', 3, [`Ha dado más puntos que la media de los equipos en ${enc} de ${q.ptsJ.length} jornadas.`, `Fiable: por encima de la media en ${enc} de las ${q.ptsJ.length} jornadas.`]);
    else if (enc <= q.ptsJ.length * 0.25) add('regular', 3, [`Solo en ${enc} de ${q.ptsJ.length} jornadas ha dado más puntos que la media.`, `Ha quedado por debajo de la media de puntos en ${q.ptsJ.length - enc} de ${q.ptsJ.length} jornadas.`]);
    // casa y fuera
    const res = new Map(r.map((x) => [x.J, x]));
    const casa = q.ptsJ.filter(([j]) => res.get(j) && res.get(j).casa).map(([, p]) => p), fuera = q.ptsJ.filter(([j]) => res.get(j) && !res.get(j).casa).map(([, p]) => p);
    const m = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    if (casa.length >= 3 && fuera.length >= 3) {
      const mc = m(casa), mf = m(fuera);
      if (mc >= mf * 1.35 && mc - mf >= 8) add('casa', 3, [`En casa sus jugadores suman ${Math.round(mc)} puntos por jornada; fuera, ${Math.round(mf)}.`, `Se nota mucho dónde juega: ${Math.round(mc)} puntos de media en casa y ${Math.round(mf)} fuera.`]);
      else if (mf >= mc * 1.35 && mf - mc >= 8) add('casa', 3, [`Raro: puntúa más fuera (${Math.round(mf)} por jornada) que en casa (${Math.round(mc)}).`, `Fuera de casa sus jugadores dan más: ${Math.round(mf)} puntos por jornada frente a ${Math.round(mc)} en casa.`]);
    }
  }
  // portería a cero
  const ac = [...H.equipos].sort((a, b) => b.aCero - a.aCero);
  const rkA = ac.findIndex((x) => x.id === q.id) + 1;
  if (rkA && rkA <= 3 && q.aCero >= 3) add('aCero', 3, [`Es de los que más porterías a cero dejan (${q.aCero})${q.portero ? `: buena señal para ${q.portero.nombre}` : ''}.`, `${q.aCero} partidos sin encajar, entre los tres mejores.`]);
  // bajas
  const bj = q.bajas.filter((x) => x.pesa || x.jugados >= 3);
  if (bj.length >= 3) add('bajas', 4, [`Tiene ${bj.length} jugadores habituales de baja o en duda ahora mismo.`, `La enfermería está llena: ${bj.length} de los que suelen jugar están lesionados, en duda o sancionados.`]);
  // calendario
  if (q.proximos.length >= 2 && q.puestoCal && H.nCalendario >= 10) {
    const ps = q.proximos.map(rivalTxt).join(', ');
    if (q.puestoCal <= 3) add('calendario', 3, [`Tiene por delante uno de los tres calendarios más fáciles: ${ps}.`, `Lo que le viene es asequible (${ordinal(q.puestoCal)} más fácil de ${H.nCalendario}): ${ps}.`]);
    else if (q.puestoCal > H.nCalendario - 3) add('calendario', 3, [`Le espera uno de los calendarios más duros: ${ps}.`, `Viene un tramo difícil (${ordinal(q.puestoCal)} de ${H.nCalendario} en facilidad): ${ps}.`]);
  }
  // los que más puntos dan, el que más se revaloriza y cómo ha ido el valor de la plantilla desde agosto
  const tops = [...q.jugadores].filter((x) => x.puntos > 0).sort((a, b) => b.puntos - a.puntos).slice(0, 3);
  if (tops.length >= 3 && !o.some((h) => h.k === 'depende')) add('tops', 2.2, [
    `Los que más puntos dan: ${tops[0].nombre} (${tops[0].puntos}), ${tops[1].nombre} (${tops[1].puntos}) y ${tops[2].nombre} (${tops[2].puntos}).`,
    `${tops[0].nombre} es su jugador con más puntos (${tops[0].puntos}); detrás, ${tops[1].nombre} y ${tops[2].nombre}.`,
    `En puntos manda ${tops[0].nombre}, con ${tops[0].puntos}, por delante de ${tops[1].nombre} (${tops[1].puntos}).`]);
  const sube = [...q.jugadores].filter((x) => x.dif7 > 0).sort((a, b) => b.dif7 - a.dif7)[0];
  if (sube && sube.dif7 >= 1e6) add('subeSemana', 2.5, [
    `El que más se ha revalorizado esta semana es ${sube.nombre}: ${dif(sube.dif7)}.`,
    `${sube.nombre} vale ${dinero(sube.dif7)} más que hace siete días, más que nadie de su equipo.`], sube.id);
  if (q.serie.length > 30) {
    const a0 = q.serie[0].v, z = q.serie[q.serie.length - 1].v, r0 = (z - a0) / a0 * 100;
    if (Math.abs(r0) >= 15) add('valorTemporada', 3, r0 > 0 ? [
      `La plantilla que tiene hoy valía ${dinero(a0)} a principios de agosto; desde entonces ha ganado un ${pctTxt(r0)}.`,
      `Desde agosto, lo que vale su plantilla ha subido un ${pctTxt(r0)}.`]
      : [`Sus jugadores de hoy valían ${dinero(a0)} en agosto: han perdido un ${pctTxt(r0)} desde entonces.`, `La plantilla vale un ${pctTxt(r0)} menos que al empezar la temporada.`]);
  }
  // la portería, contada de distinta forma según lo que haya
  const pr = q.portero;
  if (pr && pr.titular >= 4 && !o.some((h) => h.k === 'aCero')) add('portero', 2, [
    `En la portería juega ${pr.nombre}: ${partidosTxt(pr.titular)} de titular, ${coma(pr.mediaTit)} puntos de media cuando sale de inicio.`,
    `${pr.nombre} es su portero titular (${pr.titular} partidos de inicio) y saca ${coma(pr.mediaTit)} de media en esos partidos.`,
    `Bajo palos, ${pr.nombre}: ${q.paradas} paradas entre todos sus porteros y ${q.aCero} ${q.aCero === 1 ? 'portería' : 'porterías'} a cero.`], pr.id);
  // su mejor jornada
  const mj = [...q.ptsJ].sort((a, b) => b[1] - a[1])[0];
  if (mj) {
    const rj = r.find((x) => x.J === mj[0]);
    add('mejorJornada', 1.8, [
      `Su mejor jornada fue la ${mj[0]}, con ${mj[1]} puntos entre todos${rj ? ` (${rj.gf}-${rj.gc} ${rj.casa ? 'en casa' : 'fuera'} contra ${el(rj.rival)})` : ''}.`,
      `Nunca han sumado más que en la jornada ${mj[0]}: ${mj[1]} puntos${rj ? `, el día que ${rj.r === 'G' ? 'ganó' : rj.r === 'E' ? 'empató' : 'perdió'} ${rj.gf}-${rj.gc} contra ${el(rj.rival)}` : ''}.`,
      `El techo de la temporada, ${mj[1]} puntos, llegó en la jornada ${mj[0]}${rj ? ` ${rj.casa ? 'en casa' : 'fuera'} ante ${el(rj.rival)}` : ''}.`]);
  }
  // (sesión 4) más hechos de equipo, con su umbral (lista en web/metodo.html#fichas)
  const ya = (k) => o.some((h) => h.k === k);
  const jug = q.jugadores.filter((x) => x.jugados > 0);
  // el que más marca de verdad (goles, no puntos)
  const gol = [...jug].sort((a, b) => b.goles - a.goles || b.minutos - a.minutos)[0];
  if (gol && gol.goles >= 3 && t && t.gf > 0) {
    const r2 = [...jug].sort((a, b) => b.goles - a.goles)[1];
    add('goleador', 3, [
      `Su máximo goleador es ${gol.nombre}, con ${gol.goles} de los ${t.gf} goles del equipo.`,
      `Los goles los pone sobre todo ${gol.nombre} (${gol.goles})${r2 && r2.goles >= 2 ? `, por delante de ${r2.nombre} (${r2.goles})` : ''}.`,
      `${gol.nombre} ha marcado ${gol.goles} veces: el ${pctTxt(gol.goles / t.gf * 100)} de lo que lleva el equipo.`,
      `Cuando hay que mirar quién marca, el nombre es ${gol.nombre}: ${gol.goles} goles en ${partidosTxt(gol.jugados)}.`], gol.id);
  }
  // el mejor de cada puesto por media (5 partidos o más)
  const mejorDe = [2, 3, 4].map((p) => [...jug].filter((x) => x.pos === p && x.jugados >= 5).sort((a, b) => b.media - a.media)[0]).filter(Boolean);
  if (mejorDe.length >= 3) {
    const que = mejorDe.map((x) => `${x.nombre} ${x.pos === 1 ? 'en la portería' : x.pos === 2 ? 'en defensa' : x.pos === 3 ? 'en el centro del campo' : 'arriba'} (${coma(x.media)})`);
    add('porPuesto', 2.4, [
      `Por puestos, la mejor media es la de ${que.slice(0, -1).join(', ')} y ${que[que.length - 1]}.`,
      `Si se mira la media de cada línea, mandan ${que.slice(0, -1).join(', ')} y ${que[que.length - 1]}.`,
      `Línea a línea, quien más puntúa por partido es ${que.slice(0, -1).join(', ')} y ${que[que.length - 1]}.`]);
  }
  // contra los seis primeros de la tabla de hoy
  const arriba = new Set(T.filter((x) => x.pos <= 6).map((x) => String(x.id)));
  const vsA = r.filter((x) => arriba.has(String(x.rivalId)));
  if (vsA.length >= 3 && t && t.pos > 6) {
    const g = vsA.filter((x) => x.r === 'G').length, pp = vsA.filter((x) => x.r === 'P').length;
    if (g >= 2) add('vsArriba', 3, [`Contra los seis primeros da la talla: ha ganado ${g} de ${vsA.length}.`, `A los de arriba les ha sacado ${g} victorias en ${partidosTxt(vsA.length)}.`]);
    else if (pp === vsA.length) add('vsArriba', 3, [`Contra los seis primeros no ha puntuado: ${vsA.length} partidos, ${vsA.length} derrotas.`, `Los de arriba se le dan mal: ha perdido los ${vsA.length} partidos que ha jugado contra ellos.`]);
  } else if (vsA.length >= 3 && t && t.pos <= 6) {
    const g = vsA.filter((x) => x.r === 'G').length;
    if (g === 0) add('vsArriba', 3, [`Contra sus rivales directos de arriba no ha ganado todavía (${partidosTxt(vsA.length)}).`, `Gana a los de abajo, pero contra el resto de los seis primeros lleva 0 victorias en ${vsA.length}.`]);
    else if (g === vsA.length) add('vsArriba', 3, [`Ha ganado todos sus partidos contra los otros equipos de arriba (${vsA.length}).`, `Contra los que pelean con él por arriba, pleno: ${g} de ${g}.`]);
  }
  // los tramos de la temporada: puntos fantasy por jornada en la primera mitad y en la segunda
  if (q.ptsJ.length >= 8) {
    const mi = Math.floor(q.ptsJ.length / 2), a1 = q.ptsJ.slice(0, mi), a2 = q.ptsJ.slice(mi);
    const m = (xs) => xs.reduce((s, [, p]) => s + p, 0) / xs.length, m1 = m(a1), m2 = m(a2);
    if (m2 >= m1 * 1.25 && m2 - m1 >= 12) add('tramos', 3, [`Sus jugadores van a más: ${Math.round(m1)} puntos por jornada hasta la ${a1[a1.length - 1][0]} y ${Math.round(m2)} desde entonces.`, `De la jornada ${a2[0][0]} en adelante suma ${Math.round(m2)} puntos por jornada, bastante más que en el arranque (${Math.round(m1)}).`]);
    else if (m1 >= m2 * 1.25 && m1 - m2 >= 12) add('tramos', 3, [`Empezó dando más puntos que ahora: ${Math.round(m1)} por jornada hasta la ${a1[a1.length - 1][0]} y ${Math.round(m2)} después.`, `Ha ido a menos: de ${Math.round(m1)} puntos por jornada en el arranque a ${Math.round(m2)} desde la jornada ${a2[0][0]}.`]);
  }
  // cuántos fijos tiene: los que han jugado 60 minutos en tres de cada cuatro jornadas o más
  if (r.length >= 8) {
    const fijos = jug.filter((x) => x.titular >= r.length * 0.75);
    if (fijos.length <= 5) add('fijos', 3, [`Rota mucho: solo ${fijos.length} jugadores han sido titulares en tres de cada cuatro jornadas.`, `Pocos fijos: ${fijos.length} han jugado 60 minutos en al menos ${Math.ceil(r.length * 0.75)} de las ${r.length} jornadas.`]);
    else if (fijos.length >= 10) add('fijos', 3, [`Su once se adivina fácil: ${fijos.length} jugadores han sido titulares en tres de cada cuatro jornadas o más.`, `Casi no rota: ${fijos.length} fijos con 60 minutos en ${Math.ceil(r.length * 0.75)} jornadas o más.`]);
  }
  // muchos empates
  // el más caro y lo que pesa en el valor de la plantilla
  const caro = [...q.jugadores].sort((a, b) => b.valor - a.valor)[0];
  if (caro && q.valor > 0) {
    const pc = caro.valor / q.valor * 100;
    add('masCaro', pc >= 20 ? 2.8 : 1.9, pc >= 20 ? [
      `Buena parte de lo que vale la plantilla es ${caro.nombre}: ${dinero(caro.valor)}, el ${pctTxt(pc)} del total.`,
      `${caro.nombre} cuesta ${dinero(caro.valor)} y él solo es el ${pctTxt(pc)} del valor del equipo.`]
      : [
        `Su jugador más caro es ${caro.nombre} (${dinero(caro.valor)}), aunque el valor está repartido: no llega al ${pctTxt(Math.ceil(pc / 5) * 5)} del total.`,
        `El que más vale es ${caro.nombre}, ${dinero(caro.valor)}, en una plantilla sin un jugador que se lleve todo el valor.`,
        `${caro.nombre} encabeza la lista de precios del equipo con ${dinero(caro.valor)}.`], caro.id);
  }
  // las tarjetas: los que más amarillas suman y los apercibidos (a una de la sanción)
  const amE = H.equipos.map((y) => ({ id: y.id, n: y.jugadores.reduce((a, x) => a + x.amarillas, 0) })).sort((a, b) => b.n - a.n);
  const rkAm = amE.findIndex((y) => y.id === q.id) + 1, nAm = (amE[rkAm - 1] || {}).n || 0;
  if (rkAm && rkAm <= 3 && nAm >= 15) add('tarjetas', 2.6, [`Es de los equipos que más amarillas ven: ${nAm} entre todos sus jugadores.`, `Juega al límite: ${nAm} amarillas, ${rkAm === 1 ? 'el equipo que más tiene' : `${ordinal(rkAm)} equipo con más`}.`]);
  else if (rkAm && rkAm > n - 3) add('tarjetas', 2.2, [`Es de los más limpios: ${nAm} amarillas entre todos.`, `Apenas ve tarjetas (${nAm} amarillas, de las cifras más bajas).`]);
  const aperc = jug.filter((x) => x.amarillas % 5 === 4 && x.ok);
  if (aperc.length >= 2) add('apercibidos', 3.2, [`Tiene ${aperc.length} apercibidos: ${aperc.map((x) => x.nombre).join(', ')}.`, `${aperc.map((x) => x.nombre).join(', ')}: a una amarilla de perderse un partido.`]);
  // la portería a cero que sigue abierta
  let imb = 0;
  for (let i = r.length - 1; i >= 0 && r[i].gc === 0; i--) imb++;
  if (imb >= 3) add('imbatido', 3.5, [`No le marcan desde hace ${imb} partidos.`, `Lleva ${imb} jornadas seguidas con la portería a cero.`]);
  // los defensas que marcan
  const gDef = jug.filter((x) => x.pos === 2).reduce((a, x) => a + x.goles, 0);
  if (gDef >= 4) add('golesDefensa', 2.6, [`Sus defensas han marcado ${gDef} goles, y en este juego un gol de defensa se paga caro.`, `${gDef} goles de sus defensas: un plus de puntos que no tienen muchos equipos.`]);
  // la última jornada: el resultado y quién dio más puntos ese día
  const u = r[r.length - 1];
  if (u) {
    const mvp = [...jug].map((x) => ({ x, r: x.jornadas.find((y) => y.J === u.J) })).filter((y) => y.r && y.r.min > 0 && y.r.pts != null).sort((a, b) => b.r.pts - a.r.pts)[0];
    if (mvp && mvp.r.pts >= 6) {
      const res = `${u.gf}-${u.gc} ${u.casa ? 'en casa' : 'fuera'} contra ${el(u.rival)}`;
      add('ultima', 2, u.r === 'G' ? [`En la jornada ${u.J} ganó ${res}, y el que más puntos dio fue ${mvp.x.nombre} (${mvp.r.pts}).`, `Viene de ganar ${res}; ${mvp.x.nombre} se llevó ${mvp.r.pts} puntos ese día.`]
        : u.r === 'E' ? [`Su último partido, ${res}, acabó en empate; lo mejor, los ${mvp.r.pts} puntos de ${mvp.x.nombre}.`, `Empató ${res} en la jornada ${u.J}, con ${mvp.x.nombre} como el que más sumó (${mvp.r.pts}).`]
        : [`Perdió ${res} en la jornada ${u.J}, aunque ${mvp.x.nombre} sacó ${mvp.r.pts} puntos.`, `De la derrota ${res} se salvó ${mvp.x.nombre}, con ${mvp.r.pts} puntos.`], mvp.x.id);
    }
  }
  const iTops = o.findIndex((h) => h.k === 'tops');
  if (ya('porPuesto') && iTops >= 0) o.splice(iTops, 1);
  const emp = r.filter((x) => x.r === 'E').length;
  if (r.length >= 8 && emp >= Math.max(5, r.length * 0.4)) add('empates', 2.5, [`Empata mucho: ${emp} de sus ${r.length} partidos.`, `${emp} empates en ${r.length} jornadas, de los equipos que más reparten puntos.`]);
  const vistos = new Set();
  return o.sort((a, b) => b.peso - a.peso).filter((h) => !h.quien || (!vistos.has(h.quien) && vistos.add(h.quien)));
}

function entradaEquipo(q, H) {
  const t = q.tabla;
  const liga = t ? `${ordinal(t.pos)} en LaLiga con ${t.pts} puntos` : null;
  return may(elige(`e${q.id}|entrada`, [
    `${q.club}${liga ? ` va ${liga}` : ''} y su plantilla vale ${dinero(q.valor)} en LaLiga Fantasy, la ${q.puestoValor === 1 ? '' : `${ordinalA(q.puestoValor)} `}más cara.`,
    `La plantilla ${del(q.nombre)} cuesta ${dinero(q.valor)} en el juego (${ordinalA(q.puestoValor)} de ${H.equipos.length})${liga ? ` y el equipo es ${liga}` : ''}.`,
    `${liga ? `${liga.charAt(0).toUpperCase() + liga.slice(1)}, ` : ''}${el(q.nombre)} suma ${miles(q.puntosTotal)} puntos fantasy entre todos sus jugadores (${ordinal(q.puestoPuntos)} de ${H.equipos.length}).`]));
}
export function analisisEquipo(q, H) {
  return [entradaEquipo(q, H), ...hechosEquipo(q, H).slice(0, MAX_HECHOS).map((h) => h.txt)];
}

// ---------------------------------------------------------------- el HTML (fase 2b: cabecera compacta de cifras, saltos, tablas densas; el texto, abajo)

/** la gráfica de los puntos de un equipo por jornada (como `barras` de web/js/graficos.js: barras redondeadas con la cifra encima y
    la jornada debajo), con la media de los equipos de cada jornada en discontinua y el resultado debajo de la jornada */
function graficaEquipo(ptsJ, media, res, { ancho = 400, alto = 170 } = {}) {
  if (!ptsJ.length) return '';
  const max = Math.max(...ptsJ.map(([, p]) => p), ...ptsJ.map(([j]) => media[j] || 0), 1), min = Math.min(0, ...ptsJ.map(([, p]) => p));
  const arr = 18, aba = 28, h = alto - arr - aba, paso = (ancho - 8) / ptsJ.length, bw = paso * 0.66;
  const y = (v) => arr + h - ((v - min) * h) / (max - min);
  const barras = ptsJ.map(([j, p], i) => {
    const x = 4 + i * paso + (paso - bw) / 2, r = res.get(j);
    const y0 = y(Math.max(0, p)), hh = Math.max(3, Math.abs(y(p) - y(0)));
    return `<rect class="${claseEquipo(p, media[j])}" x="${x.toFixed(1)}" y="${(p >= 0 ? y0 : y(0)).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="4"><title>J${j}: ${p} puntos (media ${Math.round(media[j])})${r ? ` · ${r.r === 'G' ? 'ganó' : r.r === 'E' ? 'empató' : 'perdió'} ${r.gf}-${r.gc} ${r.casa ? 'en casa' : 'fuera'} contra ${el(r.rival)}` : ''}</title></rect>`
      + `<text class="g-et" x="${(x + bw / 2).toFixed(1)}" y="${(Math.min(y0, y(media[j] || 0)) - 5).toFixed(1)}" text-anchor="middle">${p}</text>`
      + `<text x="${(x + bw / 2).toFixed(1)}" y="${alto - 15}" text-anchor="middle">J${j}</text>`
      + (r ? `<text class="g-res r-${r.r}" x="${(x + bw / 2).toFixed(1)}" y="${alto - 4}" text-anchor="middle">${r.gf}-${r.gc}</text>` : '');
  }).join('');
  const m = ptsJ.map(([j], i) => `M${(4 + i * paso + 2).toFixed(1)} ${y(media[j] || 0).toFixed(1)}L${(4 + (i + 1) * paso - 2).toFixed(1)} ${y(media[j] || 0).toFixed(1)}`).join('');
  return `<svg class="barras barras-eq" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${e(`Puntos fantasy por jornada: ${ptsJ.map(([j, p]) => `J${j} ${p}`).join(', ')}`)}">${barras}<path class="media" d="${m}"/></svg>`;
}

/** debajo del análisis: dónde se explica cada cifra */
const metodoLinea = (raiz) => `\n  <p class="bq-l"><a href="${raiz}metodo.html#fichas">Cómo calculamos estas cifras</a>.</p>`;

/** el texto de análisis (abajo): párrafos de dos frases */
const parrafos = (fr) => { const o = []; for (let i = 0; i < fr.length; i += 2) o.push(`  <p>${e(fr.slice(i, i + 2).join(' ').replace(/\.\./g, '.'))}</p>`); return o.join('\n'); };

/** los puntos de un equipo en una jornada frente a la media de los 20 esa jornada (los mismos colores que los de un jugador) */
const claseEquipo = (p, m) => (p >= m * 1.2 ? 'p10' : p >= m ? 'p6' : p >= m * 0.8 ? 'p2' : 'p1');
/** «9 victorias, 0 empates y 3 derrotas; 48 goles a favor y 14 en contra» */
const balance = (rs) => {
  const n = (k) => rs.filter((r) => r.r === k).length, g = rs.reduce((a, r) => a + r.gf, 0), c = rs.reduce((a, r) => a + r.gc, 0);
  const pl = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`;
  return `${may(pl(n('G'), 'victoria', 'victorias'))}, ${pl(n('E'), 'empate', 'empates')} y ${pl(n('P'), 'derrota', 'derrotas')}; ${g} goles a favor y ${c} en contra.`;
};
const resChip = (r) => `<span class="res-c res-${r.r}" title="${r.r === 'G' ? 'Ganó' : r.r === 'E' ? 'Empate' : 'Perdió'}">${r.r}</span>`;
/** «dom 22 nov, 21:00» o «dom 22 nov, hora por confirmar» (LaLiga pone las 00:00 UTC cuando aún no la sabe) */
const cuandoCorto = (t) => { const d = new Date(t); return `${diaCorto(t).split(' ')[0]} ${fechaCorta(t)}, ${d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? 'por confirmar' : hora(t)}`; };
const fresco = (H) => `  <p class="fresco">Datos del ${e(fechaDia(H.dia))}, hasta la jornada ${H.ultimaJugada}</p>`;
const rivalCelda = (p) => `<td><span class="eq-c">${escudo(p.escRival, p.rival, 22)}<span>${e(p.casa ? 'vs' : 'en')} ${e(p.rival)}${p.pos != null ? ` <small>${p.pos}.º</small>` : ''}</span></span></td>`;

/** los próximos partidos de un equipo en tabla: jornada, rival (vs, en casa; en, fuera), cuándo y la dificultad */
function proximosTabla(q) {
  if (!q.proximos.length) return '';
  return tabla([{ t: 'J', c: 'n' }, { t: 'Rival' }, { t: 'Cuándo', c: 'm' }, { t: 'Dificultad', c: 'd' }],
    q.proximos.map((p) => `<td class="n">${p.J}</td>${rivalCelda(p)}<td class="m">${e(cuandoCorto(p.t))}</td><td class="d">${nivelChip(p.nivel)}</td>`), { clase: 'td-cal' });
}

/** la caja de «Próximo» de una cabecera: escudo, rival, jornada y dificultad */
const proximoCab = (p) => (p ? `<div class="fcab-px"><span class="fcab-l">Próximo</span>${escudo(p.escRival, p.rival, 22)}<b>${e(p.casa ? 'vs' : 'en')} ${e(p.rival)}</b><small>J${p.J}</small>${nivelChip(p.nivel)}</div>` : '');

/** equipos/<club>.html */
export function contenidoEquipo(q, H) {
  const raiz = '../';
  const rj = (x) => (H.rutas.jugador(x.id) ? `${raiz}${H.rutas.jugador(x.id)}` : null);
  const t = q.tabla;
  const o = [];
  // la cabecera: escudo y nombre, las cuatro cifras, la racha de resultados y el próximo rival
  o.push(`  <div class="fcab">\n  <div class="fcab-a">${escudo(q.escudoUrl, q.nombre, 64)}<div class="fcab-t"><h1>${e(q.nombre)} <span>en LaLiga Fantasy</span></h1><p class="fcab-s">${e(q.club)}${q.entrenador ? ` · Entrenador: ${e(q.entrenador.nombre)}` : ''}</p></div></div>`);
  o.push(kpis([
    { v: t ? ordinal(t.pos) : '—', l: 'En LaLiga', s: t ? `${t.pts} pts · ${t.pj} PJ` : '' },
    { v: e(dinero(q.valor)), l: 'Plantilla', s: `${ordinalA(q.puestoValor)} más cara` },
    { v: miles(q.puntosTotal), l: 'Pts fantasy', s: `${ordinal(q.puestoPuntos)} de ${H.equipos.length}` },
    { v: String(q.aCero), l: 'A cero', s: `en ${partidosTxt(q.resultados.length)}` },
  ], 'k4'));
  const f5 = q.resultados.slice(-5);
  o.push(`  <div class="fcab-f">${f5.length ? `<div class="fcab-u"><span class="fcab-l">Últimos</span>${forma(f5)}</div>` : ''}${proximoCab(q.proximos[0])}</div>\n  </div>`);
  o.push(fresco(H));
  const hayPort = !!q.portero;
  const mov = q.jugadores.filter((x) => x.dif7);
  const bj = q.bajas.filter((x) => x.pesa || x.jugados >= 3);
  o.push(subnav([['plantilla', 'Plantilla'], H.onces && H.onces.equipos.some((y) => y.id === q.id) && ['once', 'Once probable'], q.proximos.length && ['calendario', 'Calendario'], q.ptsJ.length && ['puntos', 'Puntos'], q.resultados.length && ['resultados', 'Resultados'],
    q.serie.length > 10 && ['valor', 'Valor'], hayPort && ['porteria', 'Portería'], mov.length && ['mercado', 'Suben y bajan'], ['bajas', 'Bajas'], ['analisis', 'Análisis']]));

  // la plantilla por puestos, en una tabla
  const filaP = (x) => celdaJug({ ...x, escudoUrl: null }, { enlace: rj(x), sub: `${x.jugados ? partidosTxt(x.jugados) : 'sin jugar'}${!x.ok && ESTADOS[x.estado] ? ` · ${ESTADOS[x.estado]}` : ''}` })
    + `<td class="n">${e(dinero(x.valor))}</td><td class="n m">${cambio(x.dif, dif(x.dif))}</td><td class="n">${x.puntos}</td><td class="n">${e(coma(x.media))}</td>`;
  const grupos = [1, 2, 3, 4].map((p) => ({ t: PLURAL[p].charAt(0).toUpperCase() + PLURAL[p].slice(1), filas: q.jugadores.filter((x) => x.pos === p).sort((a, b) => b.puntos - a.puntos || b.valor - a.valor).map(filaP) }));
  o.push(bloque('La plantilla', tabla([{ t: 'Jugador', c: 'j' }, { t: 'Valor', c: 'n' }, { t: 'Hoy', c: 'n m' }, { t: 'Pts', c: 'n' }, { t: 'Media', c: 'n' }], null, { grupos, clase: 'td-plant' }),
    { id: 'plantilla' }));

  // (sesión 3, idea 12) el once probable de la próxima jornada (jornada/onces.html tiene los 20)
  const yOnce = H.onces && H.onces.equipos.find((y) => y.id === q.id);
  if (yOnce) o.push(bloqueFicha(yOnce, H.onces.J, { ruta: (id) => rj({ id }) }));

  if (q.proximos.length) o.push(bloque('Próximos rivales', proximosTabla(q),
    { id: 'calendario', linea: (q.puestoCal ? e(elige(`e${q.id}|lcal`, [`El ${ordinal(q.puestoCal)} calendario más fácil de los ${H.nCalendario}. `, `Por dificultad, ${ordinal(q.puestoCal)} de ${H.nCalendario} (1.º, el más fácil). `])) : '') + `<a href="${raiz}metodo.html#rivales">Cómo medimos la dificultad</a>.` }));

  if (q.ptsJ.length) {
    const media = H.mediaJornada;
    const encima = q.ptsJ.filter(([j, p]) => p > media[j]).length;
    o.push(bloque('Puntos fantasy por jornada', `  ${graficaEquipo(q.ptsJ, media, new Map(q.resultados.map((r) => [r.J, r])))}`,
      { id: 'puntos', linea: e(elige(`e${q.id}|lpts`, [`Por encima de la media de los equipos (la discontinua) en ${encima} de ${q.ptsJ.length} jornadas.`, `${encima} de ${q.ptsJ.length} jornadas por encima de la discontinua, que es la media de los ${H.equipos.length}.`])) }));
  }

  if (q.resultados.length) {
    const filas = [...q.resultados].reverse().map((r) => {
      const pt = q.ptsJ.find(([j]) => j === r.J);
      return `<td class="n">${r.J}</td>${rivalCelda({ ...r, pos: null })}<td>${resChip(r)} ${r.gf}-${r.gc}</td><td class="n">${pt ? `<span class="pts ${claseEquipo(pt[1], H.mediaJornada[r.J])}">${pt[1]}</span>` : ''}</td>`;
    });
    o.push(bloque('Resultados', tabla([{ t: 'J', c: 'n' }, { t: 'Rival' }, { t: 'Res.' }, { t: 'Pts', c: 'n', titulo: 'Puntos fantasy de todos sus jugadores' }], filas, { clase: 'td-res' }),
      { id: 'resultados', linea: e(balance(q.resultados)) }));
  }

  if (q.serie.length > 10) {
    const a = q.serie[0], z = q.serie[q.serie.length - 1];
    o.push(bloque('El valor de la plantilla', `  ${graficaValor(q.serie, { fecha: fechaCorta })}`,
      { id: 'valor', linea: e(`Desde el ${fechaCorta(a.t)}: de ${dinero(a.v)} a ${dinero(z.v)} (${dif(z.v - a.v)}).`) }));
  }

  // la portería
  const pr = q.portero;
  if (pr) {
    o.push(bloque('La portería', kpis([
      { v: t ? String(t.gc) : '—', l: 'Encajados', s: t && t.pj ? `${coma(t.gc / t.pj)} por partido` : '' },
      { v: String(q.paradas), l: 'Paradas', s: 'de sus porteros' },
      { v: e(coma(pr.media)), l: 'Media', s: rj(pr) ? `<a href="${e(rj(pr))}">${e(pr.nombre)}</a>` : e(pr.nombre) },
    ], 'k3') + `\n  <p class="bq-l"><a href="${raiz}guias/puntos-porteros-laliga-fantasy.html">Cómo puntúan los porteros</a>.</p>`, { id: 'porteria' }));
  }

  // suben y bajan del equipo en 7 días
  const sub = [...mov].sort((a, b) => b.dif7 - a.dif7).filter((x) => x.dif7 > 0).slice(0, 5), baj = [...mov].sort((a, b) => a.dif7 - b.dif7).filter((x) => x.dif7 < 0).slice(0, 5);
  const t7 = (xs) => (xs.length ? tabla([{ t: 'Jugador', c: 'j' }, { t: '7 días', c: 'n' }, { t: 'Valor', c: 'n' }], xs.map((x) => celdaJug(x, { enlace: rj(x), sub: `${POS[x.pos]} · ${pct(x.pct7)}` }) + `<td class="n">${cambio(x.dif7, dif(x.dif7))}</td><td class="n">${e(dinero(x.valor))}</td>`)) : '');
  if (sub.length || baj.length) o.push(bloque('Los que más suben y bajan en 7 días', pestanas('mov', [['Suben', t7(sub)], ['Bajan', t7(baj)]]),
    { id: 'mercado' }));

  // bajas
  o.push(bloque('Bajas y sancionados', bj.length ? tabla([{ t: 'Jugador', c: 'j' }, { t: 'Estado' }], bj.map((x) => celdaJug(x, { enlace: rj(x) }) + `<td><b class="baja-t">${e(ESTADOS[x.estado] || x.estado)}</b>${x.motivo ? `<br><small>${e(x.motivo.txt)}</small>` : ''}</td>`))
    : `  <p>${e(elige(`e${q.id}|sinbajas`, ['Ahora mismo no tiene ningún habitual lesionado, en duda ni sancionado.', `Sin bajas que pesen: LaLiga no da a nadie importante ${del(q.nombre)} como lesionado o sancionado.`, 'Todos los que suelen jugar están disponibles.']))}</p>`,
  { id: 'bajas', linea: bj.length ? elige(`e${q.id}|lbaj`, [`Las de los 20 equipos, con apercibidos y quién vuelve, en <a href="${raiz}bajas/">las bajas de la jornada</a>.`, `<a href="${raiz}bajas/">Todas las bajas de LaLiga</a>, al día.`]) : '' }));

  o.push(bloque(`${el(q.nombre).charAt(0).toUpperCase() + el(q.nombre).slice(1)} en LaLiga Fantasy`, parrafos(analisisEquipo(q, H)) + metodoLinea(raiz), { id: 'analisis' }));
  return o.join('\n');
}

/** jugadores/<nombre>.html */
export function contenidoJugador(x, H) {
  const raiz = '../';
  const eq = H.equipos.find((q) => q.id === x.teamId) || null;
  const re = H.rutas.equipo(x.teamId);
  const o = [];
  // la cabecera: cara, nombre, puesto y club, las cuatro cifras, las últimas cinco jornadas y el próximo rival
  const estado = !x.ok && ESTADOS[x.estado] ? `<span class="estado mal">${e(ESTADOS[x.estado])}</span>` : '<span class="estado">Disponible</span>';
  o.push(`  <div class="fcab">\n  <div class="fcab-a">${cara(x, 'g')}<div class="fcab-t"><h1>${e(x.nombre)} <span>en LaLiga Fantasy</span></h1><p class="fcab-s">${chapaPos(x.pos)}${re ? `<a href="${raiz}${e(re)}">${e(x.club)}</a>` : e(x.club)}${estado}</p></div></div>`);
  if (x.motivo) o.push(`  <p class="fcab-m">${e(x.motivo.txt)}</p>`);
  o.push(kpis([
    { v: e(dinero(x.valor)), l: 'Valor', s: `${cambio(x.dif, dif(x.dif))} hoy` },
    { v: String(x.puntos), l: 'Puntos', s: partidosTxt(x.jugados) },
    { v: e(coma(x.media)), l: 'Media', s: x.rangoMedia ? `${ordinalA(x.rangoMedia)} de ${x.deRango} ${PLURAL[x.pos]}` : e(PUESTO[x.pos]) },
    { v: x.pctTit != null ? `${x.pctTit} %` : '—', l: 'Titular', s: `${x.titular} de ${H.ultimaJugada} con 60'` },
  ], 'k4'));
  const ult = x.jornadas.slice(-5).map((r) => ({ J: r.J, pts: r.min > 0 && r.pts != null ? r.pts : null, titulo: r.min > 0 && r.pts != null ? `J${r.J}: ${r.pts} pts · ${r.min} min · ${r.casa ? 'vs' : 'en'} ${r.rival}` : `J${r.J}: no jugó` }));
  o.push(`  <div class="fcab-f">${ult.length ? `<div class="fcab-u"><span class="fcab-l">Últimas</span>${fichasJornada(ult, { mini: true })}</div>` : ''}${proximoCab(eq && eq.proximos[0])}</div>\n  </div>`);
  o.push(fresco(H));
  const comp = eq ? eq.jugadores.filter((y) => y.id !== x.id && H.rutas.jugador(y.id)).sort((a, b) => (a.pos === x.pos ? 0 : 1) - (b.pos === x.pos ? 0 : 1) || b.valor - a.valor).slice(0, 6) : [];
  const pj = x.jornadas.filter((r) => r.pts != null && r.min > 0).map((r) => [r.J, r.pts]);
  const conValor = x.temporada && x.temporada.length > 5;
  o.push(subnav([conValor && ['valor', 'Valor'], pj.length && ['puntos', 'Puntos'], x.jornadas.length && ['partidos', 'Partidos'], eq && eq.proximos.length && ['rivales', 'Rivales'], ['analisis', 'Análisis'], comp.length && ['companeros', 'Compañeros']]));

  // el valor
  if (conValor) {
    const s = x.temporada;
    const max = s.reduce((a, b) => (b.v > a.v ? b : a)), min = s.reduce((a, b) => (b.v < a.v ? b : a));
    const v30 = s[Math.max(0, s.length - 31)];
    o.push(bloque('Valor de mercado', `  ${graficaValor(s, { fecha: fechaCorta })}\n${kpis([
      { v: cambio(x.dif7, dif(x.dif7)), l: '7 días' },
      { v: cambio(x.valor - v30.v, dif(x.valor - v30.v)), l: '30 días' },
      { v: e(dinero(max.v)), l: 'Máximo', s: e(fechaCorta(max.t)) },
      { v: e(dinero(min.v)), l: 'Mínimo', s: e(fechaCorta(min.t)) }], 'k4 kpi-p')}`,
    { id: 'valor', linea: e(`Desde el ${fechaCorta(s[0].t)}.`) + ` <a href="${raiz}guias/valor-de-mercado.html">Cómo se mueve el valor</a>.` }));
  }

  // los puntos: una ficha por jornada, como en la app (web/js/hojas.js, `jornadasPtsHTML`): la jornada, los puntos con el color
  // de lo buenos que son (10+, 6-9, 2-5, 1 o menos) y los minutos; las que no jugó, «–» y «no jugó»; el balón o la roja en la esquina
  if (pj.length) {
    const sorted = [...pj].sort((a, b) => b[1] - a[1]);
    const n10 = pj.filter(([, p]) => p >= 10).length, n1 = pj.filter(([, p]) => p <= 1).length;
    o.push(bloque('Puntos por jornada', '  ' + fichasJornada(x.jornadas.map((r) => {
      const jugo = r.min > 0 && r.pts != null;
      const extra = [r.g ? `${r.g} gol${r.g > 1 ? 'es' : ''}` : '', r.a ? `${r.a} asist.` : '', r.roja ? 'roja' : r.am ? 'amarilla' : ''].filter(Boolean).join(', ');
      return { J: r.J, pts: jugo ? r.pts : null, abajo: jugo ? `${r.min}'` : null, icono: jugo ? (r.g ? '⚽' : r.roja ? '🟥' : '') : '',
        titulo: jugo ? `J${r.J}: ${r.pts} pts · ${r.min} min${extra ? ` · ${extra}` : ''} · ${r.casa ? 'en casa' : 'fuera'} contra ${el(r.rival)}` : `J${r.J}: no jugó` };
    })), { id: 'puntos' }));
  }

  // jornada a jornada
  if (x.jornadas.length) {
    const gk = x.pos === 1;
    const filas = [...x.jornadas].reverse().map((r) => `<td class="n">${r.J}</td>${rivalCelda({ ...r, pos: null })}<td>${resChip(r)} ${r.gf}-${r.gc}</td><td class="n">${r.min ? `${r.min}'` : '—'}</td><td class="n">${r.min && r.pts != null ? chipPuntos(r.pts) : '—'}</td><td class="m">${gk ? (r.min ? `${r.par} par. · ${r.enc} enc.` : '') : [r.g ? `${r.g} gol${r.g > 1 ? 'es' : ''}` : '', r.a ? `${r.a} asist.` : '', r.roja ? 'roja' : r.am ? 'amarilla' : ''].filter(Boolean).join(' · ')}</td>`);
    o.push(bloque('Jornada a jornada', tabla([{ t: 'J', c: 'n' }, { t: 'Rival' }, { t: 'Res.' }, { t: 'Min', c: 'n' }, { t: 'Pts', c: 'n' }, { t: gk ? 'Portería' : 'Detalle', c: 'm' }], filas, { clase: 'td-jj' }),
      { id: 'partidos' }));
  }

  if (eq && eq.proximos.length) o.push(bloque(`Próximos rivales ${del(eq.nombre)}`, proximosTabla(eq),
    { id: 'rivales', linea: `<a href="${raiz}metodo.html#rivales">Cómo medimos la dificultad</a>.` }));

  // el análisis: solo los hechos que se cumplen en este jugador (hechosJugador)
  o.push(bloque(`${x.nombre} en LaLiga Fantasy`, parrafos(analisisJugador(x, H, eq).frases) + metodoLinea(raiz), { id: 'analisis' }));

  // compañeros con ficha
  if (comp.length) o.push(bloque(`Más del ${eq.nombre}`, tabla([{ t: 'Jugador', c: 'j' }, { t: 'Valor', c: 'n' }, { t: 'Media', c: 'n' }],
    comp.map((y) => celdaJug(y, { enlace: `${raiz}${H.rutas.jugador(y.id)}`, sub: POS[y.pos] }) + `<td class="n">${e(dinero(y.valor))}</td><td class="n">${e(coma(y.media))}</td>`))
    + (re ? `\n  <p><a class="btn sec" href="${raiz}${e(re)}">Toda la plantilla ${e(del(eq.nombre))}</a></p>` : ''), { id: 'companeros' }));

  return o.join('\n');
}

// ---------------------------------------------------------------- ficha para todos (rework de la web, 21 nov)

/** cuántas fichas nuevas entran en el sitemap cada noche como mucho (Carlos: «nada de cientos de páginas de golpe») */
export const CUPO_INDEXABLES = 25;

/**
 * Qué fichas de jugador se indexan. Todas se ven y se enlazan; al sitemap (y sin noindex) solo van las que tienen qué contar
 * (5 partidos o más y 3 hechos propios, como siempre) Y ya están admitidas. La primera vez se admiten las que ya eran indexables;
 * después, cada noche, hasta `cupo` nuevas por minutos jugados (y, a igualdad, por valor). Las admitidas se apuntan con su día en
 * `H.slugs.indexables` (va a estado.json, `fichas.indexables`) y no se sacan: si una deja de tener qué contar (menos de 5 partidos
 * o dos hechos propios menos de los que hacen falta para entrar), pasa a noindex ella sola.
 * `viejas`: Map ruta → entrada de .github/portal/fichas.json antes de esta pasada. Devuelve { nuevas, total, espera }.
 */
export function admitirIndexables(H, viejas = new Map(), { cupo = CUPO_INDEXABLES } = {}) {
  const eqDe = (x) => H.equipos.find((q) => q.id === x.teamId) || null;
  const an = new Map(H.jugadores.map((x) => [x.id, analisisJugador(x, H, eqDe(x))]));
  const vale = { get: (id) => an.get(id).indexar };
  // una ficha ya admitida (Google la tiene) no sale del sitemap porque una noche se quede con un hecho propio de menos: para
  // seguir le basta con los 5 partidos y un hecho menos que para entrar (así no entra y sale según el día)
  const sigue = (x) => x.jugados >= MIN_PARTIDOS && an.get(x.id).propios >= MIN_PROPIOS - 1;
  const ad = { ...(H.slugs.indexables || {}) };
  if (!H.slugs.indexables) {
    for (const x of H.jugadores) { const v = viejas.get(`jugadores/${x.slug}.html`); if (v && v.indexar !== false) ad[x.id] = 'antes'; }
  }
  const deHoy = Object.values(ad).filter((d) => d === H.dia).length;
  const nuevas = H.jugadores.filter((x) => vale.get(x.id) && !ad[x.id]).sort((a, b) => b.minutos - a.minutos || b.valor - a.valor).slice(0, Math.max(0, cupo - deHoy));
  for (const x of nuevas) ad[x.id] = H.dia;
  H.slugs.indexables = ad;
  H.indexable = (x) => !!ad[x.id] && (vale.get(x.id) || sigue(x));
  return { nuevas: nuevas.length, total: H.jugadores.filter((x) => H.indexable(x)).length, espera: H.jugadores.filter((x) => vale.get(x.id) && !ad[x.id]).length };
}

/** al cambiar cómo se pinta una ficha de jugador se sube, y la noche siguiente se reescriben todas */
const VERSION_FICHA = 2;
/** las fichas de los que más valen se rehacen cada noche, como hasta ahora (su valor de hoy es lo que se busca) */
export const FICHAS_FINAS = 150;
/** cuánto tiene que moverse el valor de las demás para rehacerlas: [parte de su valor, mínimo en €] si se indexa o si no */
const TOLERANCIA = { indexable: [0.02, 20000], resto: [0.05, 50000] };

/**
 * Lo propio de un jugador que hace que su ficha tenga que rehacerse: quién es, dónde juega, si está disponible, cada jornada de su
 * equipo (minutos, puntos, goles…), el próximo rival y si se indexa. El valor va aparte (`v`): cambia casi cada noche en casi todos.
 */
export function huellaJugador(x, H) {
  const eq = H.equipos.find((q) => q.id === x.teamId) || null;
  const px = eq && eq.proximos[0];
  return { h: String(huella([VERSION_FICHA, x.nombre, x.club, x.pos, x.estado, x.ok ? 1 : 0, x.motivo ? x.motivo.txt : '', H.indexable ? Number(H.indexable(x)) : '',
    px ? `${px.J}.${px.rivalId}` : '', x.jornadas.map((r) => [r.J, r.min, r.pts, r.g, r.a, r.am, r.roja, r.par, r.enc].join('.')).join('|')].join('~'))), v: Math.round(x.valor) };
}

/**
 * Qué fichas de jugador se reescriben esta noche (para que el repo no crezca con 576 páginas cada noche: ESTADO, punto 70). Las
 * `FICHAS_FINAS` que más valen, siempre que cambie su valor (como hasta ahora). Las demás, solo si cambia lo suyo (`huellaJugador`:
 * su equipo ha jugado, se lesiona, cambia de club, entra en el sitemap…) o si su valor se ha movido desde la última vez más de un
 * 2 % (las que se indexan) o de un 5 % (las que no). Así cada ficha se rehace como poco tras cada partido de su equipo, y en la
 * página pone de qué día son los datos. `huellas`: { id: { h, v, d } } de la vez anterior (estado.json, `huellas`); `existe(ruta)`:
 * si la página está en el disco. Devuelve { escribir: [jugadores], huellas: las de después }.
 */
export function fichasQueCambian(H, huellas = {}, { forzar = false, existe = () => true } = {}) {
  const finas = new Set([...H.jugadores].sort((a, b) => b.valor - a.valor).slice(0, FICHAS_FINAS).map((x) => x.id));
  const despues = {}, escribir = [];
  for (const x of H.jugadores) {
    const n = huellaJugador(x, H), v = huellas[x.id];
    const [parte, minimo] = TOLERANCIA[H.indexable && H.indexable(x) ? 'indexable' : 'resto'];
    const seMueve = v && (finas.has(x.id) ? n.v !== v.v : Math.abs(n.v - v.v) > Math.max(v.v * parte, minimo));
    if (forzar || !v || v.h !== n.h || seMueve || !existe(`jugadores/${x.slug}.html`)) { escribir.push(x); despues[x.id] = { ...n, d: H.dia }; } else despues[x.id] = v;
  }
  return { escribir, huellas: despues };
}

/** para el buscador y los filtros: el nombre sin tildes ni mayúsculas */
const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** cuántos jugadores por página en jugadores/ (sin JS se lee por páginas; con JS, la tabla entera de jugadores/todos.json) */
export const POR_PAGINA = 150;
export const nPaginasJugadores = (H) => Math.max(1, Math.ceil(H.todos.length / POR_PAGINA));
const rutaPagina = (n) => (n === 1 ? './' : `pagina-${n}.html`);

/** la celda del jugador en la tabla de todos: sin cara ni escudo (16 nov, idea 9: 1.173 imágenes hacían la página de 18 s en un móvil) */
const celdaLigera = (x, enlace, sub) => `<td class="c-j"><span class="tjug-t"><b>${enlace ? `<a href="${e(enlace)}">${e(x.nombre)}</a>` : e(x.nombre)}</b><small>${e(sub)}</small></span></td>`;
const subJug = (x) => `${POS[x.pos]} · ${x.equipo}${!x.ok && ESTADOS[x.estado] ? ` · ${ESTADOS[x.estado]}` : ''}`;

/**
 * jugadores/ (y jugadores/pagina-N.html): TODOS los jugadores de LaLiga, por valor, de 150 en 150, cada uno enlazado a su ficha.
 * Con JavaScript (web/portal/portal.js) la tabla se rehace con los 576 de jugadores/todos.json, con sus caras, y se filtra por puesto,
 * equipo y nombre y se ordena por valor, puntos, media o subida; sin él se lee por páginas. Las páginas 2 en adelante, sin indexar.
 */
export function contenidoJugadores(H, pag = 1) {
  const o = [];
  const todos = [...H.todos].sort((a, b) => b.valor - a.valor);
  const n = H.jugadores.length, np = nPaginasJugadores(H);
  const desde = (pag - 1) * POR_PAGINA, trozo = todos.slice(desde, desde + POR_PAGINA);
  const caro = todos[0];
  const mejor = [...todos].filter((x) => x.jugados >= 5).sort((a, b) => b.media - a.media)[0];
  const sube = [...todos].sort((a, b) => b.dif - a.dif)[0];
  o.push(pag === 1 ? `  <h1>Jugadores de <span>LaLiga Fantasy</span></h1>` : `  <h1>Jugadores de <span>LaLiga Fantasy</span>: del ${desde + 1} al ${desde + trozo.length}</h1>`);
  o.push(`  <p class="fresco">Los ${todos.length} jugadores de LaLiga, por valor · valores del ${e(fechaDia(H.dia))} · se rehace cada noche</p>`);
  const eqs = [...H.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  // los filtros (solo con JS: sin él no harían nada; la tabla ya va ordenada por valor)
  o.push(`  <form class="filtros" id="filtros" hidden>
    <label class="f-q"><span>Buscar</span><input type="search" name="q" placeholder="Nombre del jugador" autocomplete="off"></label>
    <div class="f-pos" role="group" aria-label="Puesto"><button type="button" data-p="" aria-pressed="true">Todos</button>${[1, 2, 3, 4].map((p) => `<button type="button" data-p="${p}" aria-pressed="false">${POS[p]}</button>`).join('')}</div>
    <label><span>Equipo</span><select name="e"><option value="">Todos los equipos</option>${eqs.map((q) => `<option value="${e(q.slug)}">${e(q.nombre)}</option>`).join('')}</select></label>
    <label><span>Ordenar por</span><select name="o"><option value="v">Valor</option><option value="pt">Puntos</option><option value="m">Media</option><option value="d">Subida de hoy</option><option value="d7">Subida en 7 días</option></select></label>
  </form>
  <p class="cuenta" id="cuenta" aria-live="polite"></p>`);
  const filas = trozo.map((x) => {
    const r = H.rutas.jugador(x.id);
    return { attrs: ` data-p="${x.pos}" data-e="${e(x.equipoSlug || '')}" data-v="${Math.round(x.valor)}" data-pt="${x.puntos}" data-m="${x.media}" data-d="${Math.round(x.dif)}" data-d7="${Math.round(x.dif7)}" data-n="${e(plano(`${x.nombre} ${x.nombreCompleto}`))}"`,
      td: celdaLigera(x, r ? r.split('/').pop() : null, subJug(x))
        + `<td class="n">${e(dinero(x.valor))}</td><td class="n c-d">${cambio(x.dif, dif(x.dif))}</td><td class="n m c-d7">${cambio(x.dif7, dif(x.dif7))}</td><td class="n c-pt">${x.puntos}</td><td class="n c-me">${e(coma(x.media))}</td>` };
  });
  o.push(tabla([{ t: 'Jugador', c: 'j' }, { t: 'Valor', c: 'n' }, { t: 'Hoy', c: 'n c-d' }, { t: '7 días', c: 'n m c-d7' }, { t: 'Pts', c: 'n c-pt' }, { t: 'Media', c: 'n c-me' }], filas, { clase: 'td-todos', id: 'todos' })
    .replace('id="todos">', 'id="todos" data-todos="todos.json">'));
  o.push(`  <p class="mas-f"><button type="button" class="btn sec" id="ver-mas" hidden>Ver más jugadores</button></p>`);
  if (np > 1) {
    const enl = Array.from({ length: np }, (_, i) => i + 1).map((k) => (k === pag ? `<b aria-current="page">${k}</b>` : `<a href="${rutaPagina(k)}">${k}</a>`)).join(' ');
    o.push(`  <nav class="paginas" id="paginas" aria-label="Páginas">${pag > 1 ? `<a href="${rutaPagina(pag - 1)}">‹ Anteriores</a> ` : ''}${enl}${pag < np ? ` <a href="${rutaPagina(pag + 1)}">Siguientes ›</a>` : ''}</nav>`);
  }
  if (pag === 1) {
    o.push(bloque('Quién vale más y quién puntúa más', `  <p>${e(`Aquí están los ${todos.length} jugadores que siguen en LaLiga Fantasy, de ${POR_PAGINA} en ${POR_PAGINA} y del más caro al más barato, con su valor de mercado de hoy, lo que han ganado o perdido en el último cambio y en siete días, sus puntos de la temporada y su media por partido jugado. El que más vale hoy es ${caro.nombre} (${caro.equipo}), con ${dinero(caro.valor)}${mejor ? `; el de mejor media entre los que llevan cinco partidos o más, ${mejor.nombre}, con ${coma(mejor.media)}` : ''}${sube && sube.dif > 0 ? `, y el que más ha subido hoy, ${sube.nombre} (${dif(sube.dif)})` : ''}.`)}</p>\n  <p>${e(`Todos tienen ficha propia, con su valor día a día, sus puntos de cada jornada, los minutos, la titularidad y sus próximos rivales: van enlazados en la tabla.`)} Cómo se calcula cada cifra, en <a href="../metodo.html">cómo calculamos</a>.</p>`, { id: 'analisis' }));
  }
  return o.join('\n');
}

/** jugadores/todos.json: los de la tabla con JS (web/portal/portal.js), en listas cortas:
    [ficha, nombre, sub, puesto, equipo (slug), valor, puntos, media, dif, dif7, buscar, valor txt, dif txt, dif7 txt, media txt, cara, encuadre, escudo, club] */
export function jugadoresJson(H) {
  return [...H.todos].sort((a, b) => b.valor - a.valor).map((x) => {
    const r = H.rutas.jugador(x.id);
    const c = cara(x, 'p');
    const u = (c.match(/<img class="cara[^"]*" src="([^"]+)"/) || [])[1] || '';
    const st = (c.match(/<img class="cara[^"]*"[^>]* style="([^"]+)"/) || [])[1] || '';
    const es = (c.match(/<img class="esc" src="([^"]+)"/) || [])[1] || '';
    const des = (s) => s.replace(/&amp;/g, '&');
    return [r ? r.split('/').pop() : '', x.nombre, subJug(x), x.pos, x.equipoSlug || '', Math.round(x.valor), x.puntos, x.media, Math.round(x.dif), Math.round(x.dif7),
      plano(`${x.nombre} ${x.nombreCompleto}`), dinero(x.valor), dif(x.dif), dif(x.dif7), coma(x.media), des(u), st, des(es), x.equipo];
  });
}

/** lo que lee el buscador del menú (web/portal/portal.js): los jugadores con ficha y los 20 equipos, rutas desde la raíz */
export function indiceBuscador(H) {
  return {
    j: H.jugadores.map((x) => [x.nombre, x.nombreCompleto !== x.nombre ? x.nombreCompleto : '', H.rutas.jugador(x.id), x.equipo, x.pos]),
    e: [...H.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((q) => [q.nombre, q.club !== q.nombre ? q.club : '', H.rutas.equipo(q.id)]),
  };
}

/** la tira de los 20 escudos (la pinta paginas.py encima del pie de todas las páginas) */
export const escudosPie = (H) => [...H.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((q) => ({ n: q.nombre, r: H.rutas.equipo(q.id), u: q.escudoUrl }));

/** las entradas de paginas.json (en .github/portal/fichas.json) de cada página */
export function metasEquipo(q) {
  return { ruta: `equipos/${q.slug}.html`, seccion: 'equipos', grupo: 'equipo', id: q.id,
    titulo: `${q.nombre} en LaLiga Fantasy: plantilla, valor y puntos`, h1: `${q.nombre} en LaLiga Fantasy`,
    descripcion: `${q.club} en LaLiga Fantasy: lo que vale su plantilla, los puntos de cada jornada, sus próximos rivales, la portería y las bajas. Se pone al día cada noche.`,
    migas: [['Inicio', ''], ['Equipos', 'equipos/']], sobre: { '@type': 'SportsTeam', name: q.club, sport: 'Fútbol' } };
}
export function metasJugador(x, H = null) {
  // (16 nov) con menos de 5 partidos o menos de 3 cosas propias que contar, la ficha sigue abierta pero sin indexar y fuera del sitemap
  // (rework, 21 nov) y, de las que sí tienen qué contar, solo las ya admitidas en el sitemap (`admitirIndexables`: unas pocas nuevas por noche)
  const ix = H ? (H.indexable ? H.indexable(x) : analisisJugador(x, H, H.equipos.find((q) => q.id === x.teamId) || null).indexar) : true;
  return { ruta: `jugadores/${x.slug}.html`, seccion: 'equipos', grupo: 'jugador', id: x.id, ...(ix ? {} : { indexar: false }),
    titulo: `${x.nombre}: valor de mercado y puntos en LaLiga Fantasy`, h1: `${x.nombre} en LaLiga Fantasy`,
    descripcion: `Valor de mercado de ${x.nombreCompleto} (${x.club}) en LaLiga Fantasy día a día, sus puntos de cada jornada, media, minutos, titularidad y próximos rivales.`,
    migas: [['Inicio', ''], ['Equipos', 'equipos/'], [x.club, `equipos/${x.equipoSlug}.html`]],
    sobre: { '@type': 'Person', name: x.nombreCompleto, memberOf: { '@type': 'SportsTeam', name: x.club } } };
}
export const metasPaginaJugadores = (n) => ({ ruta: `jugadores/pagina-${n}.html`, seccion: 'equipos', grupo: 'jugadores', indexar: false,
  titulo: `Jugadores de LaLiga Fantasy por valor (página ${n})`, h1: `Jugadores de LaLiga Fantasy (página ${n})`,
  descripcion: `Los jugadores de LaLiga Fantasy del ${(n - 1) * POR_PAGINA + 1} al ${n * POR_PAGINA} por valor de mercado, con lo que suben o bajan hoy, sus puntos y su media.`,
  migas: [['Inicio', ''], ['Equipos', 'equipos/'], ['Jugadores', 'jugadores/']] });
export const metasJugadores = () => ({ ruta: 'jugadores/index.html', seccion: 'equipos', grupo: 'jugadores',
  titulo: 'Jugadores de LaLiga Fantasy: valor y puntos de cada uno', h1: 'Jugadores de LaLiga Fantasy',
  descripcion: 'Todos los jugadores de LaLiga Fantasy con su valor de mercado, lo que suben o bajan hoy, sus puntos y su media, con filtros por puesto y equipo. Se pone al día cada noche.',
  migas: [['Inicio', ''], ['Equipos', 'equipos/']] });
