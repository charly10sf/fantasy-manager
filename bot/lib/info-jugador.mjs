// Más información en los tweets de un jugador (Carlos, 5 nov 13:33, con el de Zaid Romero de las 13:32): si pinta a titular (el % de
// titularidad de la app, lib/onces.mjs) y lo difícil que es su próximo rival (su puesto en la tabla y fácil, media o difícil, igual
// que `nivelDe` de web/js/motor.js), con lo que le sirve al que lo tiene o lo quiere fichar: si el rival marca o encaja mucho.
// Solo datos sacados de LaLiga (la tabla sale de stats/week) y del % de la app: el validador de siempre manda.
// Las frases rotan (`turno`) por cuántos tweets de un jugador llevamos hoy, para que dos seguidos no salgan con el mismo esqueleto.
import { statsSemana } from './laliga.mjs';
import { probabilidades } from './onces.mjs';
import { fmt, partes, el, del, al, turno } from './texto.mjs';
import { cap, aparte } from './redactar.mjs';

/**
 * La clasificación con los partidos acabados (matchState 7) de stats/week, como la de la app (motor.js): puntos, diferencia de goles
 * y goles a favor. { porId: { [id]: { id, pos, pj, pts, gf, gc, rgf, rgc } }, n, mediaPts, mediaGoles }; rgf/rgc: el puesto del
 * equipo en goles a favor y en contra por partido (1 = el que más).
 */
export function tablaDe(partidos) {
  const t = {};
  const vistos = new Set();
  for (const m of partidos || []) {
    if (!m || m.matchState !== 7 || !m.local || !m.visitor || vistos.has(String(m.id))) continue;
    const gl = Number(m.localScore), gv = Number(m.visitorScore);
    if (!Number.isFinite(gl) || !Number.isFinite(gv)) continue;
    vistos.add(String(m.id));
    for (const [id, gf, gc] of [[m.local.id, gl, gv], [m.visitor.id, gv, gl]]) {
      const x = (t[String(id)] ||= { id: String(id), pj: 0, pts: 0, gf: 0, gc: 0 });
      x.pj++; x.gf += gf; x.gc += gc; x.pts += gf > gc ? 3 : gf === gc ? 1 : 0;
    }
  }
  const filas = Object.values(t).filter((x) => x.pj > 0).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);
  filas.forEach((x, i) => { x.pos = i + 1; });
  const puesto = (k) => { const o = [...filas].sort((a, b) => b[k] / b.pj - a[k] / a.pj); o.forEach((x, i) => { x[`r${k}`] = i + 1; }); };
  puesto('gf'); puesto('gc');
  const pj = filas.reduce((s, x) => s + x.pj, 0);
  return { porId: t, n: filas.length, mediaPts: pj ? filas.reduce((s, x) => s + x.pts, 0) / pj : 1.4, mediaGoles: pj ? filas.reduce((s, x) => s + x.gf, 0) / pj : 1.3 };
}

/** «difícil», «media» o «fácil», como `nivelDe` de la app (null con menos de 3 partidos jugados) */
export function nivelDe(r, tabla) {
  if (!r || r.pj < 3) return null;
  const fuerza = r.pts / r.pj / tabla.mediaPts;
  return fuerza >= 1.25 || r.pos <= 4 ? 'difícil' : fuerza <= 0.8 || r.pos >= tabla.n - 3 ? 'fácil' : 'media';
}

/**
 * Lo que hace falta pedir (con red), una vez por ejecución: la tabla (las jornadas 1 a la actual) y el % de titularidad de cada equipo.
 * Va en el contexto de ejecutar.mjs (`ctx.info`); sin él (las pruebas sin red), los tweets salen como antes.
 */
export function crearInfo({ jugadores = [], equipos = {}, semana = null, log = () => {}, pedirSemana = statsSemana, probs = probabilidades } = {}) {
  let tabla = null, planos = null;
  // los partidos de las jornadas 1 a la actual, una sola vez (la tabla y `tablaSin` salen de aquí)
  const planosP = () => (planos ||= (async () => {
    const n = Number(semana && semana.weekNumber) || 0;
    if (!n) return [];
    const ws = await Promise.all(Array.from({ length: n }, (_, i) => pedirSemana(i + 1).catch(() => [])));
    return ws.flat();
  })());
  const tablaP = () => (tabla ||= (async () => {
    if (!Number(semana && semana.weekNumber)) return null;
    const t = tablaDe(await planosP());
    if (t.n < 10) { log(`  (info) la tabla sale con ${t.n} equipos: no la uso`); return null; }
    return t;
  })().catch((e) => { log(`  (info) tabla: ${e.message || e}`); return null; }));
  const porEquipo = new Map();
  return {
    /** la clasificación entera (`tablaDe`), o null si no sale con 10 equipos o más (la previa la usa para valorar el partido) */
    tabla: () => tablaP(),
    /** la clasificación SIN un partido (como estaba antes de jugarlo: la usa el final para ver si fue una sorpresa), o null */
    async tablaSin(id) { const t = tablaDe((await planosP()).filter((x) => String(x.id) !== String(id))); return t.n >= 10 ? t : null; },
    /** { pos, n, nivel, gf, gc, rgf, rgc } del rival del próximo partido, o null */
    async rival(pp) {
      if (!pp || pp.rivalId == null) return null;
      const t = await tablaP();
      const r = t && t.porId[String(pp.rivalId)];
      const nivel = r && nivelDe(r, t);
      if (!nivel) return null;
      return { pos: r.pos, n: t.n, nivel, gf: r.gf / r.pj, gc: r.gc / r.pj, rgf: r.rgf, rgc: r.rgc };
    },
    /** { [idJugador]: { id, nombre, pos, p, duda, estado, tit } } de todo un equipo (lo de `probabilidades`), o null si falla: una
     * sola vez por equipo y ejecución, la misma que usa `titularidad` (el once ideal necesita a todos los equipos) */
    probsDe(teamId, pp) {
      const k = String(teamId);
      if (!porEquipo.has(k)) {
        const ult = (pp ? pp.jornada : Number(semana && semana.weekNumber) || 1) - 1;
        porEquipo.set(k, probs(teamId, jugadores, ult, { equipo: equipos[k] || null, log }).catch((e) => { log(`  (info) titularidad de ${equipos[k] || k}: ${e.message || e}`); return null; }));
      }
      return porEquipo.get(k);
    },
    /** { p, pct } del % de titularidad de la app para su próximo partido, o null (0 % o sin datos) */
    async titularidad(j, pp) {
      const x = ((await this.probsDe(j.teamId, pp)) || {})[j.id];
      if (!x || !(x.p > 0)) return null;
      return { p: x.p, pct: Math.round(x.p * 100) };
    },
  };
}

/** cuántos tweets de un jugador (noticias y novedades) van hoy: para rotar las frases entre unos y otros */
export function vecesHoy(registro, dia, tipos = ['noticias', 'novedades']) {
  if (!registro || !registro.todos) return 0;
  const d = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));
  return registro.todos().filter((x) => x && tipos.includes(x.tipo) && x.t && d(Date.parse(x.t)) === dia).length;
}

// Cómo se escribe (Carlos, 5 nov 17:42, con el tweet de Yuri: «el lenguaje debe ser más humano, no hace falta que haya tantos puntos,
// las oraciones pueden ser más largas y con lenguaje más entendible»): dos frases largas en vez de cinco cortas. Una del jugador (su
// media y su % de titularidad juntos) y otra del partido (cuándo, contra quién, qué puesto lleva y si es asequible o duro); los goles
// del rival, si destacan, en una tercera. Cada una con tres esqueletos que rotan.

/** el tramo del % de titularidad: 'alta' (65 o más), 'media' (45 o más), 'baja'; en una duda, 'duda' (el % ya lleva la duda) */
const tramo = (tit, tipo) => (tipo === 'duda' ? 'duda' : tit.p >= 0.65 ? 'alta' : tit.p >= 0.45 ? 'media' : 'baja');

/**
 * La frase del jugador: «El defensa del Athletic suma 5,3 puntos de media y tiene un 72 % de titularidad». (Carlos, 9 nov: el % a secas,
 * sin «en Fantasy Manager», que suena raro.)
 * quien: «El defensa del Athletic». media: su media (sale si es 3 o más). tit: { p, pct } o null. f: el esqueleto (0, 1 o 2).
 * { t, numeros } o null si no hay nada que decir.
 */
export function fraseJugador({ quien, media = 0, tit = null, tipo = 'vuelve', f = 0, dato = null }) {
  // (Carlos, 9 nov: no siempre la media) con otro dato del jugador (lib/datos-jugador.mjs: racha, valor, goles…), ese en vez de la media
  if (dato && dato.que !== 'media') {
    const numeros = [...(dato.numeros || []), ...(tit ? [tit.pct] : [])];
    if (!tit) return { t: `‼️ ${quien} ${dato.dice}`, numeros };
    const pct = tit.pct, T = tramo(tit, tipo);
    const cola = { alta: `y tiene un ${pct} % de titularidad`, media: `y tiene un ${pct} % de titularidad, así que no es fijo`, baja: `aunque de momento solo tiene un ${pct} % de titularidad`, duda: `y con la duda se queda en un ${pct} % de titularidad` }[T];
    return { t: `📊 ${quien} ${dato.dice} ${cola}`, numeros };
  }
  const m = media >= 3 ? fmt(media) : null, ql = quien.replace(/^./, (c) => c.toLowerCase());
  const numeros = [...(m ? partes(media) : []), ...(tit ? [tit.pct] : [])];
  if (!tit && !m) return null;
  if (!tit) return { t: `‼️ ${[`${quien} suma ${m} puntos de media`, `${quien} lleva ${m} puntos de media`, `${quien} va a ${m} puntos por partido`][f]}`, numeros };
  const pct = tit.pct;
  const P = {
    alta: [` y tiene un ${pct} % de titularidad`, `pinta a titular: tiene un ${pct} % de titularidad`, `cuenta con un ${pct} % de titularidad`],
    media: [` y tiene un ${pct} % de titularidad, así que no es fijo`, `no es fijo en el once: un ${pct} % de titularidad`, `tiene un ${pct} % de titularidad, así que el once está por ver`],
    baja: [`, aunque de momento solo tiene un ${pct} % de titularidad`, `lo tiene difícil para ser titular: un ${pct} % de titularidad`, `se queda de momento en un ${pct} % de titularidad`],
    duda: [` y con la duda se queda en un ${pct} % de titularidad`, `tiene un ${pct} % de titularidad con la duda`, `queda en un ${pct} % de titularidad por la duda`],
  }[tramo(tit, tipo)];
  if (!m) return { t: `📊 ${[`${quien} tiene un ${pct} % de titularidad`, `${quien} ${P[1]}`, `${quien} ${P[2]}`][f]}`, numeros };
  return { t: `📊 ${[`${quien} suma ${m} puntos de media${P[0]}`, `${quien}, que suma ${m} puntos de media, ${P[1]}`, `Con ${m} puntos de media, ${ql} ${P[2]}`][f]}`, numeros };
}

/**
 * La frase del partido: «El sábado a las 18:30 visita a Osasuna, que va 15º, y es un partido asequible». r: lo que da rival().
 * cuando: «el sábado a las 18:30» (con tweets largos) o null. f: el esqueleto (0, 1 o 2).
 */
export function frasePartido(r, { equipo, rival, casa, cuando = null }, f = 0) {
  const vs = `${casa ? 'recibe' : 'visita'} ${al(rival)}`;
  const que = r.pos === 1 ? 'el líder' : r.pos === r.n ? 'el colista' : `que va ${r.pos}º`;
  const va = r.pos === 1 ? 'es el líder' : r.pos === r.n ? 'es el colista' : `va ${r.pos}º`;
  const N = { 'difícil': 'un partido duro', 'fácil': 'un partido asequible', media: 'un partido de nivel medio' }[r.nivel];
  const pred = { 'difícil': 'el partido se pone cuesta arriba', 'fácil': 'el partido pinta bien para puntuar', media: 'el partido es de nivel medio' }[r.nivel];
  const emo = r.nivel === 'difícil' ? '📉' : r.nivel === 'fácil' ? '📈' : 'ℹ️';
  // (Carlos, 6 nov 12:58, con el tweet de Eric: «hay partes que no se entienden apenas») siempre con los dos nombres a la vista:
  // quién juega contra quién, sin «el equipo» ni un sujeto que haya que adivinar
  return [`${emo} ${cuando ? `${cap(cuando)}, ${el(equipo)} ${vs}` : `${cap(el(equipo))} ${vs}`}, ${que}, y es ${N}`,
    `${emo} Le toca ${N}${cuando ? ` ${cuando}` : ''}: ${el(equipo)} ${vs}, ${que}`,
    `${emo} ${cap(el(rival))}, el rival ${del(equipo)}${cuando ? ` ${cuando}` : ''}, ${va}, así que ${pred}`][f];
}

/** lo que marca o encaja el rival, solo si está entre los 4 primeros o los 4 últimos (lo que le importa a un portero o defensa: lo que
 * marca; a un centrocampista o delantero: lo que encaja). Con el nombre del rival (6 nov, Carlos: «el rival» a secas no se entendía) */
export function fraseGoles(r, posId, f, rival = null) {
  const atras = Number(posId) <= 2;
  const k = atras ? 'gf' : 'gc', g = r[k], rk = r[`r${k}`];
  const mucho = rk <= 4, poco = rk >= r.n - 3;
  if (!mucho && !poco) return null;
  const G = fmt(g), goles = G === '1' ? 'gol' : 'goles';
  const rv = rival ? el(rival) : 'el rival', Rv = cap(rv);
  const t = atras
    ? (mucho ? [`⚠️ Ojo con la portería a cero: ${rv} es de los que más marcan, con ${G} ${goles} por partido`, `⚠️ Dejar la portería a cero se complica: ${rv} marca ${G} ${goles} por partido`]
      : [`📈 Buena pinta para la portería a cero: ${rv} solo marca ${G} ${goles} por partido`, `📈 ${Rv} es de los que menos marcan, con ${G} ${goles} por partido, así que hay opciones de portería a cero`])
    : (mucho ? [`📈 ${Rv} es de los que más encajan, con ${G} ${goles} por partido`, `📈 Hay sitio para el gol: ${rv} encaja ${G} ${goles} por partido`]
      : [`⚠️ Eso sí, ${rv} es de los que menos encajan, con ${G} ${goles} por partido`, `⚠️ Ojo, que ${rv} solo encaja ${G} ${goles} por partido`]);
  return { t: t[f % 2], numeros: partes(g) };
}

/**
 * Lo que le sirve al mánager en un tweet de un jugador (para tweet() de lib/redactar.mjs), en un párrafo aparte con tweets largos:
 * la frase del jugador (media y % de titularidad), la del partido (cuándo, rival, puesto y nivel) y, si destacan, los goles del rival.
 * Sin rival, la hora sola («El partido es…»). quien: «El defensa del Athletic». tit, riv: lo que dan titularidad() y rival() (o null).
 * hr: lo que da cuando() (o null). k: cuántos tweets de un jugador van hoy. Devuelve { ideas, numeros }.
 */
export function ideasInfo({ posId, equipo, pp, quien, media = 0, tit = null, riv = null, tipo = 'vuelve', hr = null, k = 0, dia = '', largo = false, dato = null }) {
  const ideas = [], numeros = [];
  const A = quien ? fraseJugador({ quien, media, tit, tipo, f: turno(3, `infA${dia}`, k), dato }) : null;
  if (A) { ideas.push({ t: A.t, prio: 5 }); numeros.push(...A.numeros); }
  if (riv && pp) {
    const P = frasePartido(riv, { equipo, rival: pp.rival, casa: !!pp.enCasa, cuando: hr ? hr.t : null }, turno(3, `infB${dia}`, k));
    // con tweets largos, el jugador en un párrafo y el partido (con los goles del rival) en otro: tres frases en uno solo se leían como un bloque
    // (9 nov) en el parón, cuándo vuelve la liga pesa más que la media o el %: en 280 no se cae
    ideas.push({ t: largo && A ? aparte(P) : P, prio: hr && hr.trasElParon ? 6 : 4 });
    numeros.push(riv.pos, ...(hr ? hr.numeros : []));
    const g = fraseGoles(riv, posId, turno(2, `infG${dia}`, k), pp.rival);
    if (g) { ideas.push({ t: g.t, prio: 3 }); numeros.push(...g.numeros); }
  } else if (hr) { ideas.push({ t: `🗓️ El partido es ${hr.t}`, prio: hr.trasElParon ? 6 : 2 }); numeros.push(...hr.numeros); }
  // con tweets largos, lo que le sirve al mánager en su párrafo (la noticia arriba)
  if (largo && ideas.length >= 2) ideas[0] = { ...ideas[0], t: aparte(ideas[0].t) };
  return { ideas, numeros };
}
