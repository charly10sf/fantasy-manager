// Más información en los tweets de un jugador (Carlos, 5 nov 13:33, con el de Zaid Romero de las 13:32): si pinta a titular (el % de
// titularidad de la app, lib/onces.mjs) y lo difícil que es su próximo rival (su puesto en la tabla y fácil, media o difícil, igual
// que `nivelDe` de web/js/motor.js), con lo que le sirve al que lo tiene o lo quiere fichar: si el rival marca o encaja mucho.
// Solo datos sacados de LaLiga (la tabla sale de stats/week) y del % de la app: el validador de siempre manda.
// Las frases rotan (`turno`) por cuántos tweets de un jugador llevamos hoy, para que dos seguidos no salgan con el mismo esqueleto.
import { statsSemana } from './laliga.mjs';
import { probabilidades } from './onces.mjs';
import { fmt, partes, el, al, turno } from './texto.mjs';
import { enPalabras, cap, aparte } from './redactar.mjs';

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
  let tabla = null;
  const tablaP = () => (tabla ||= (async () => {
    const n = Number(semana && semana.weekNumber) || 0;
    if (!n) return null;
    const ws = await Promise.all(Array.from({ length: n }, (_, i) => pedirSemana(i + 1).catch(() => [])));
    const t = tablaDe(ws.flat());
    if (t.n < 10) { log(`  (info) la tabla sale con ${t.n} equipos: no la uso`); return null; }
    return t;
  })().catch((e) => { log(`  (info) tabla: ${e.message || e}`); return null; }));
  const porEquipo = new Map();
  return {
    /** { pos, n, nivel, gf, gc, rgf, rgc } del rival del próximo partido, o null */
    async rival(pp) {
      if (!pp || pp.rivalId == null) return null;
      const t = await tablaP();
      const r = t && t.porId[String(pp.rivalId)];
      const nivel = r && nivelDe(r, t);
      if (!nivel) return null;
      return { pos: r.pos, n: t.n, nivel, gf: r.gf / r.pj, gc: r.gc / r.pj, rgf: r.rgf, rgc: r.rgc };
    },
    /** { p, pct } del % de titularidad de la app para su próximo partido, o null (0 % o sin datos) */
    async titularidad(j, pp) {
      const k = String(j.teamId);
      if (!porEquipo.has(k)) {
        const ult = (pp ? pp.jornada : Number(semana && semana.weekNumber) || 1) - 1;
        porEquipo.set(k, probs(j.teamId, jugadores, ult, { equipo: equipos[k] || null, log }).catch((e) => { log(`  (info) titularidad de ${equipos[k] || k}: ${e.message || e}`); return null; }));
      }
      const x = ((await porEquipo.get(k)) || {})[j.id];
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

/** «el 9º» / «el líder» / «el colista» y sus formas */
const puestoTxt = (r) => (r.pos === 1 ? { va: 'es el líder', es: 'el líder', corto: 'líder' } : r.pos === r.n ? { va: 'es el colista', es: 'el colista', corto: 'colista' }
  : { va: `va ${r.pos}º`, es: `el ${r.pos}º`, corto: `${r.pos}º` });

/** la frase del % de titularidad: tipo «vuelve» (vuelve a estar disponible) o «duda» */
export function fraseTitularidad(tit, tipo, f) {
  const { p, pct } = tit;
  const w = enPalabras(p);
  if (tipo === 'duda') {
    return [`📊 ${cap(w)}: ${pct} % de titularidad`, `📊 Fantasy Manager lo deja en un ${pct} % de titularidad`, `📊 Con la duda, se queda en un ${pct} % de titularidad`][f];
  }
  if (p >= 0.65) {
    return [`📊 Y está para jugar: Fantasy Manager le da un ${pct} % de titularidad`, `📊 ${cap(w)}: ${pct} % de titularidad`, `📊 En Fantasy Manager ya tiene un ${pct} % de titularidad`][f];
  }
  if (p >= 0.45) {
    return [`📊 Lo del once está por ver: ${pct} % de titularidad`, `📊 ${cap(w)}: ${pct} % de titularidad`, `📊 Fantasy Manager le da un ${pct} % de titularidad, así que no es fijo`][f];
  }
  return [`📊 Otra cosa es que sea titular: de momento, un ${pct} % en Fantasy Manager`,
    `📊 Eso sí, ${p >= 0.25 ? 'su titularidad está en el aire' : 'lo tiene difícil para ser titular'}: ${pct} %`,
    `📊 De momento, ${w}: ${pct} % de titularidad`][f];
}

/** la frase del rival: tres esqueletos, y cada nivel con sus palabras */
export function fraseRival(r, { equipo, rival, casa }, f) {
  const P = puestoTxt(r);
  const verbo = casa ? 'recibe' : 'visita', donde = casa ? 'en casa' : 'fuera', donde2 = casa ? 'en casa' : 'a domicilio';
  const entre = r.pos === 1 || r.pos === r.n ? P.corto : `${r.pos}º`;
  const que = r.pos === 1 || r.pos === r.n ? P.es : `que va ${r.pos}º`;
  const emo = r.nivel === 'difícil' ? '📉' : r.nivel === 'fácil' ? '📈' : 'ℹ️';
  const [a, b, c] = r.nivel === 'difícil' ? ['Partido duro', 'El rival no ayuda', `Le toca ${r.pos <= 6 ? 'uno de los de arriba' : 'un rival duro'}`]
    : r.nivel === 'fácil' ? ['Buen partido para puntuar', 'El rival ayuda', `Le toca ${r.pos >= r.n - 5 ? 'uno de los de abajo' : 'un rival asequible'}`]
      : ['Ni fácil ni difícil', 'Partido de mitad de tabla', 'Rival de nivel medio'];
  return [`${emo} ${a}: ${el(equipo)} ${verbo} ${al(rival)}, ${que}`,
    `${emo} ${b}: ${el(rival)} ${P.va} y ${el(equipo)} juega ${donde}`,
    `${emo} ${c}: ${donde2}, ante ${el(rival)} (${entre})`][f];
}

/** lo que marca o encaja el rival, solo si está entre los 4 primeros o los 4 últimos (lo que le importa a un portero o defensa: lo que
 * marca; a un centrocampista o delantero: lo que encaja) */
export function fraseGoles(r, posId, f) {
  const atras = Number(posId) <= 2;
  const k = atras ? 'gf' : 'gc', g = r[k], rk = r[`r${k}`];
  const mucho = rk <= 4, poco = rk >= r.n - 3;
  if (!mucho && !poco) return null;
  const G = fmt(g), goles = G === '1' ? 'gol' : 'goles';
  const t = atras
    ? (mucho ? [`⚠️ Ojo con la portería a cero: el rival marca ${G} ${goles} por partido`, `⚠️ Y el rival es de los que más marcan: ${G} ${goles} por partido`]
      : [`📈 Buena pinta para la portería a cero: el rival marca ${G} ${goles} por partido`, `📈 Y el rival es de los que menos marcan: ${G} ${goles} por partido`])
    : (mucho ? [`📈 Y el rival es de los que más encajan: ${G} ${goles} por partido`, `📈 Hay sitio para el gol: el rival encaja ${G} por partido`]
      : [`⚠️ Eso sí, el rival es de los que menos encajan: ${G} ${goles} por partido`, `⚠️ Ojo, que el rival solo encaja ${G} ${goles} por partido`]);
  return { t: t[f % 2], numeros: partes(g) };
}

/**
 * Las ideas que se añaden a un tweet de un jugador (para tweet() de lib/redactar.mjs), en un párrafo aparte con tweets largos:
 * el % de titularidad, el rival y lo que marca o encaja, y la hora (con tweets largos; si va con el rival, con otras palabras).
 * tit, riv: lo que dan titularidad() y rival() (o null). hr: lo que da cuando() (o null). k: cuántos tweets de un jugador van hoy.
 * Devuelve { ideas, numeros }.
 */
export function ideasInfo({ posId, equipo, pp, tit = null, riv = null, tipo = 'vuelve', hr = null, k = 0, dia = '', largo = false }) {
  const ideas = [], numeros = [];
  if (tit) { ideas.push({ t: fraseTitularidad(tit, tipo, turno(3, `infT${dia}`, k)), prio: 5 }); numeros.push(tit.pct); }
  if (riv && pp) {
    ideas.push({ t: fraseRival(riv, { equipo, rival: pp.rival, casa: !!pp.enCasa }, turno(3, `infR${dia}`, k)), prio: 4 });
    numeros.push(riv.pos);
    const g = fraseGoles(riv, posId, turno(2, `infG${dia}`, k));
    if (g) { ideas.push({ t: g.t, prio: 3 }); numeros.push(...g.numeros); }
  }
  if (hr) {
    // con el rival ya dicho, «El partido es…» detrás de «Partido duro…» repetía la palabra
    const t = riv ? [`🗓️ Se juega ${hr.t}`, `🗓️ Será ${hr.t}`][turno(2, `infH${dia}`, k)] : `🗓️ El partido es ${hr.t}`;
    ideas.push({ t, prio: 2 }); numeros.push(...hr.numeros);
  }
  // con tweets largos, lo del partido en su párrafo (la noticia arriba; lo que le sirve al mánager, debajo)
  if (largo && ideas.length >= 2) ideas[0] = { ...ideas[0], t: aparte(ideas[0].t) };
  return { ideas, numeros };
}
