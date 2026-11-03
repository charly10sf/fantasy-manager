// Cómo se redactan los tweets desde el 3 nov 2026 (Carlos, 06:40: «que suene más natural y humano y menos robótico»). Las reglas
// salen de leer 297 tweets de @JoseCarrasco_98, @AnaliticaLaLiga y @futbol_fantasy (claude/estilo-tweets.md del proyecto):
//   - una idea por línea y una línea en blanco entre ideas; el emoji solo como etiqueta al principio de la línea
//     (🚨 la noticia, ⚠️ el detalle, ‼️ el dato que cambia algo, 👀 lectura, ⁉️ duda, ✅ buena noticia, ❌ baja);
//   - frase corta de periodista: sujeto, verbo y dato;
//   - la segunda vez que sale un jugador, por su puesto («el delantero»);
//   - dudar con palabras según el % («en principio juega», «está en el aire»…), con el número al lado;
//   - siempre la jornada y el rival, y una etiqueta final con «Fantasy» («Duda Fantasy para la jornada 12 contra el Valencia»).
// El validador de siempre sigue mandando: cada número tiene que estar en los datos, «fantasy» en todos y 280 como mucho.
import { peso, el, corto } from './texto.mjs';
import { statsSemana } from './laliga.mjs';

/** el tweet con aire: cabecera, cada idea separada por una línea en blanco y el cierre (si lo hay) */
export const armarAire = (cab, ideas, pie) => [cab, ...ideas, ...(pie ? [pie] : [])].join('\n\n');

/**
 * Elige las ideas que caben. ideas: [{ t, prio }] o textos sueltos (prio 9, imprescindibles), en el orden en que se leen.
 * Si no cabe todo, quita primero la de menos prio (y, entre iguales, la de más abajo). Devuelve las que quedan, en su orden.
 */
export function ajustar(cab, ideas, pie, max = 280) {
  let xs = ideas.filter(Boolean).map((x, i) => (typeof x === 'string' ? { t: x, prio: 9, i } : { ...x, i }));
  while (xs.length && peso(armarAire(cab, xs.map((x) => x.t), pie)) > max) {
    const quitar = [...xs].sort((a, b) => a.prio - b.prio || b.i - a.i)[0];
    xs = xs.filter((x) => x !== quitar);
  }
  return xs.map((x) => x.t);
}

/** sin el cierre de la app: si el texto no lleva «fantasy», acaba en #LaLigaFantasy (como sinCierre de texto.mjs) */
export function tweet(cab, ideas, { pie = null, max = 280 } = {}) {
  let usadas = ajustar(cab, ideas, pie, max);
  if (!pie && !/fantasy/i.test([cab, ...usadas].join('\n'))) {
    usadas = ajustar(cab, ideas, '#LaLigaFantasy', max);
    return { usadas, texto: armarAire(cab, usadas, '#LaLigaFantasy') };
  }
  return { usadas, texto: armarAire(cab, usadas, pie) };
}

export const cap = (s) => String(s).replace(/^./, (c) => c.toUpperCase());

// El puesto, para la segunda vez que sale un jugador («el delantero marcó…»). positionId de LaLiga.
const PUESTO = { 1: 'portero', 2: 'defensa', 3: 'centrocampista', 4: 'delantero' };
export const puesto = (posId) => PUESTO[Number(posId)] || null;
/** «el delantero» o, si no se sabe el puesto, el nombre */
export const segunda = (posId, nombre) => (puesto(posId) ? `el ${puesto(posId)}` : nombre);

/**
 * Dudar con palabras (regla 4): el % de titularidad de la app (0-1) en lo que diría una persona.
 * Los tramos son de partida; se ajustan viendo los tweets de verdad.
 */
export function enPalabras(p) {
  if (p >= 0.85) return 'titular casi seguro';
  if (p >= 0.65) return 'en principio, titular';
  if (p >= 0.45) return 'en principio juega, pero no es seguro';
  if (p >= 0.25) return 'en el aire';
  if (p >= 0.1) return 'lo tiene complicado';
  return 'muy difícil que juegue';
}

/**
 * El próximo partido de un equipo: el de la jornada en curso si aún no lo ha jugado y, si no, el de la siguiente.
 * Devuelve { jornada, rival (nombre corto), enCasa } o null. Guarda las jornadas pedidas durante la ejecución.
 */
const jornadas = new Map();
const semanaDe = (n) => { if (!jornadas.has(n)) jornadas.set(n, statsSemana(n).catch(() => [])); return jornadas.get(n); };
export async function proximoPartido(teamId, { stats = null, semana = null, jornada = null } = {}) {
  // la jornada que ya se tiene en memoria (la del contexto) no se vuelve a pedir
  if (stats && stats.length && (jornada || semana)) { const n = jornada || semana.weekNumber; if (!jornadas.has(n)) jornadas.set(n, Promise.resolve(stats)); }
  const candidatas = [...new Set([jornada, semana && semana.weekNumber, semana && semana.nextWeek].filter(Boolean))].sort((a, b) => a - b);
  for (const n of candidatas) {
    const m = (await semanaDe(n)).find((x) => String(x.local.id) === String(teamId) || String(x.visitor.id) === String(teamId));
    if (!m || m.matchState === 7) continue;
    const enCasa = String(m.local.id) === String(teamId);
    const r = enCasa ? m.visitor : m.local;
    return { jornada: n, rival: corto(r.mainName), rivalNombre: r.mainName, rivalEscudo: r.badgeColor || null, enCasa };
  }
  return null;
}
/** «para la jornada 12 contra el Valencia» (o solo «para la jornada 12» si no se sabe el rival) */
export const paraLa = (pp, jornada) => (pp ? `para la jornada ${pp.jornada} contra ${el(pp.rival)}` : jornada ? `para la jornada ${jornada}` : 'para la próxima jornada');
