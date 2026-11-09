// El calendario después del parón (Carlos, 9 nov 08:58): qué equipos lo tienen más fácil y más difícil en las jornadas que vienen tras
// el parón (`paronTuits.jornadasCalendario`, 4 por defecto), para planificar fichajes. La dificultad de cada partido es la fuerza del
// rival (sus puntos por partido frente a la media de la liga, de la clasificación: `tablaDe` de lib/info-jugador.mjs) y si se juega
// en casa o fuera; la de cada equipo, la media de sus partidos. Ningún tuit manda revisar ni cambiar el once (regla #83): esto es para
// fichar. Un tuit por parón, con tarjeta (lib/tarjetas.mjs, svgCalendario).
import { statsSemana } from '../lib/laliga.mjs';
import { tablaDe, nivelDe } from '../lib/info-jugador.mjs';
import { clubes as clubesH } from '../lib/hechos.mjs';
import { corto, el, al, hash } from '../lib/texto.mjs';
import { tweet, aparte, cap } from '../lib/redactar.mjs';
import { lista } from '../lib/agrupar.mjs';
import { ventanaParon, imagenesDe } from '../lib/paron-tuits.mjs';

const CASA = 0.85, FUERA = 1.15;

/**
 * El calendario de cada equipo en las jornadas `semanas` ([stats de cada una]) con la tabla de ahora.
 * [{ id, equipo, partidos: [{ jornada, rivalId, rival, casa, pos, nivel, d }], d (la media), n }] de más fácil a más difícil.
 */
export function calendarios(semanas, tabla, numeros) {
  const eqs = new Map();
  semanas.forEach((st, k) => {
    for (const m of st || []) for (const [yo, otro, casa] of [[m.local, m.visitor, true], [m.visitor, m.local, false]]) {
      if (!yo || !otro || yo.id == null) continue;
      const r = tabla.porId[String(otro.id)];
      if (!r || !r.pj) continue;
      const fuerza = (r.pts / r.pj) / tabla.mediaPts;
      const e = eqs.get(String(yo.id)) || { id: String(yo.id), equipo: corto(yo.mainName), nombre: yo.mainName, partidos: [] };
      e.partidos.push({ jornada: numeros[k], rivalId: String(otro.id), rival: corto(otro.mainName), casa, pos: r.pos, nivel: nivelDe(r, tabla) || 'media', d: fuerza * (casa ? CASA : FUERA) });
      eqs.set(String(yo.id), e);
    }
  });
  const xs = [...eqs.values()].filter((e) => e.partidos.length >= Math.max(2, semanas.length - 1));
  for (const e of xs) { e.d = e.partidos.reduce((s, p) => s + p.d, 0) / e.partidos.length; e.n = e.partidos.length; }
  return xs.sort((a, b) => a.d - b.d);
}

export async function generar(ctx) {
  const { jugadores = [], stats = [], config = {}, log = console.log, info = null, pedirSemana = statsSemana } = ctx;
  const v = ventanaParon('calendario', ctx);
  if (!v.ok) { log(`  (calendario) ${v.motivo}`); return []; }
  const K = (config.paronTuits || {}).jornadasCalendario ?? 4;
  const numeros = Array.from({ length: K }, (_, i) => v.siguiente + i);
  const semanas = await Promise.all(numeros.map((n) => (ctx.paron && n === ctx.paron.siguiente && ctx.paron.statsSiguiente ? ctx.paron.statsSiguiente : pedirSemana(n).catch(() => []))));
  if (semanas.filter((s) => s.length).length < 2) { log('  (calendario) no hay partidos de las jornadas que vienen'); return []; }
  // la tabla de ahora: la de lib/info-jugador.mjs (jornadas 1 a la actual) o, sin ella, la de las jornadas jugadas
  let tabla = info ? await info.tabla().catch(() => null) : null;
  if (!tabla) tabla = tablaDe((await Promise.all(Array.from({ length: v.jugada }, (_, i) => pedirSemana(i + 1).catch(() => [])))).flat());
  if (!tabla || tabla.n < 10) { log('  (calendario) sin clasificación'); return []; }
  const cal = calendarios(semanas, tabla, numeros);
  if (cal.length < 12) { log(`  (calendario) solo ${cal.length} equipos con partidos: espero`); return []; }
  const im = imagenesDe(jugadores, stats, ...semanas);
  const N = 5, mejor = cal.slice(0, N), peor = cal.slice(-N).reverse();
  const J1 = numeros[0], JN = numeros[numeros.length - 1];
  const V = (xs, k) => xs[hash(`cal${J1}${k}`) % xs.length];
  const rivalTxt = (p) => `${p.casa ? 'recibe' : 'visita'} ${al(p.rival)} (${p.pos}º)`;

  // la plantilla (último recurso)
  const a = mejor[0], b = peor[0];
  const num = [J1, JN, ...a.partidos.map((p) => p.pos), ...b.partidos.map((p) => p.pos)];
  const cab = V([`🗓️ El calendario después del parón: quién lo tiene más fácil de la jornada ${J1} a la ${JN}`, `🗓️ Para fichar con la vuelta de la liga: los calendarios de la jornada ${J1} a la ${JN}`], 'cab');
  const ideas = [
    { t: aparte(`📈 ${cap(el(a.equipo))} es el que mejor lo tiene: ${a.partidos.map(rivalTxt).join(', ')}`), prio: 9 },
    { t: aparte(`📉 Lo más duro le toca ${al(b.equipo)}: ${b.partidos.map(rivalTxt).join(', ')}`), prio: 8 },
    { t: aparte(`También tienen un calendario amable ${lista(mejor.slice(1, 4).map((e) => el(e.equipo)))}`), prio: 5 },
  ];
  const { texto } = tweet(cab, ideas);

  // la tarjeta
  const fila = (e) => ({ equipo: e.equipo, club: e.nombre, escudoUrl: im.escudoDe(e.id),
    rivales: e.partidos.map((p) => ({ corto: p.rival, escudoUrl: im.escudoDe(p.rivalId), casa: p.casa, puesto: `${p.pos}º`, nivel: p.nivel })) });
  const d = { titulo: 'CALENDARIO', sub: `JORNADAS ${J1} A ${JN}`, sub2: 'DESPUÉS DEL PARÓN', mejor: mejor.map(fila), peor: peor.map(fila) };
  const todas = [...d.mejor, ...d.peor];
  const tarjeta = { tipo: 'calendario', nombre: `calendario-${J1}`, d,
    permitidos: { numeros: [J1, JN, ...todas.flatMap((f) => f.rivales.map((r) => r.puesto))].map(String),
      palabras: ['º', 'CALENDARIO', 'JORNADAS', 'A', 'DESPUÉS', 'DEL', 'PARÓN', 'LOS', 'MÁS', 'FÁCILES', 'DIFÍCILES', 'CASA', 'FUERA', ...todas.map((f) => f.equipo.toUpperCase())] } };

  // los hechos para la IA
  // el recuento ya hecho (la IA contaba mal: «tres de cuatro asequibles» con uno de dificultad media; simulacro del 9 nov)
  const enLetra = (n) => ['ninguno', 'uno', 'dos', 'tres', 'cuatro', 'cinco'][n] || String(n);
  const resumenDe = (e) => { const casa = e.partidos.filter((p) => p.casa).length, arriba = e.partidos.filter((p) => p.pos <= 6).length, abajo = e.partidos.filter((p) => p.pos > tabla.n - 6).length;
    return `${enLetra(casa)} en casa y ${enLetra(e.partidos.length - casa)} fuera; contra los seis primeros, ${enLetra(arriba)}; contra los seis últimos, ${enLetra(abajo)}`; };
  const equipoH = (e, lectura) => ({ club: e.equipo, lectura, recuento: resumenDe(e), partidos: e.partidos.map((p) => ({ jornada: p.jornada, rival: el(p.rival), juega: p.casa ? 'en casa' : 'fuera', rivalVa: `${p.pos}º de ${tabla.n}`, dificultad: p.nivel })) });
  const hechos = { tipo: 'calendario', noticia: `los calendarios de la jornada ${J1} a la ${JN}, las que vienen después del parón de selecciones: qué equipos lo tienen más fácil y más difícil`,
    paraQuien: 'para el que planifica fichajes de cara a la vuelta de la liga: a qué equipos les conviene tener jugadores y de cuáles cuesta más sacar puntos. Nada de revisar o cambiar el once: es para fichar',
    comoSeMide: 'la fuerza de cada rival por sus puntos por partido en la clasificación, y si se juega en casa o fuera',
    aviso: 'la imagen adjunta lleva los cinco calendarios más fáciles y los cinco más difíciles con cada rival: el texto habla del más fácil y del más difícil (los primeros de cada lista) con su recuento y lo que significa para fichar; de los segundos, como mucho el nombre',
    mejorCalendario: mejor.slice(0, 2).map((e, i) => equipoH(e, i === 0 ? 'el más fácil' : 'de los más fáciles')),
    peorCalendario: peor.slice(0, 2).map((e, i) => equipoH(e, i === 0 ? 'el más difícil' : 'de los más difíciles')),
    // sin emojis de club: con tantos clubes, la IA ponía uno y se dejaba los demás (y los rechazaba el validador; simulacro del 9 nov)
    emojis: 'sin emojis de club en este tuit',
    clubes: Object.fromEntries(Object.entries(clubesH(...[...mejor.slice(0, 2), ...peor.slice(0, 2)].flatMap((e) => [e.equipo, ...e.partidos.map((p) => p.rival)]))).map(([k, c]) => [k, { ...c, emoji: null }])) };
  log(`  (calendario) J${J1}-J${JN}: fácil ${mejor.map((e) => `${e.equipo} ${e.d.toFixed(2)}`).join(', ')} · difícil ${peor.map((e) => `${e.equipo} ${e.d.toFixed(2)}`).join(', ')}`);
  return [{ tipo: 'calendario', clave: `calendario|${v.jugada}`, jornada: v.jugada, texto, hechos, numeros: num, partido: null, tarjeta }];
}
