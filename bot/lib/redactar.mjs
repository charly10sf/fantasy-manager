// Cómo se redactan los tweets desde el 3 nov 2026 (Carlos, 06:40: «que suene más natural y humano y menos robótico»). Las reglas
// salen de leer 297 tweets de @JoseCarrasco_98, @AnaliticaLaLiga y @futbol_fantasy (claude/estilo-tweets.md del proyecto):
//   - texto corrido desde el 4 nov (ver armarAire); el emoji, en la cabecera y en la etiqueta final
//     (🚨 la noticia, ⁉️ duda, ✅ buena noticia, ❌ baja, 👀 lectura);
//   - frase corta de periodista: sujeto, verbo y dato;
//   - la segunda vez que sale un jugador, por su puesto («el delantero»);
//   - dudar con palabras según el % («en principio juega», «está en el aire»…), con el número al lado;
//   - siempre la jornada y el rival, y una etiqueta final («⁉️ Duda para la jornada 12 contra el Valencia»; sin «Fantasy» desde el 5 nov).
// El validador de siempre sigue mandando: cada número tiene que estar en los datos y el largo, 280 (o el de X Premium, `limite()`).
import { peso, el, corto, limite } from './texto.mjs';
import { statsSemana } from './laliga.mjs';

// Desde el 4 nov (Carlos, 13:42: «que suene más humano; no hace falta una frase distinta por línea»): texto corrido. La cabecera y
// las ideas van en un párrafo, como frases seguidas, sin su emoji; solo la cabecera lleva emoji. Aparte, cada una en su línea: las
// listas (una línea con « · » o con más de un emoji, como el podio del final), la etiqueta final («❌ Baja para la
// jornada 12…», «👀 Revisa tu once…») y el cierre. «Según MARCA» se pega a la frase de antes («…, según MARCA») y lo que
// empieza por «tras», «por», «después de»… sigue la frase («Se estudia suspender la jornada tras el fallecimiento de…»).
const EMO = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u20E3]*\s*/u;
const EMO_DENTRO = /\p{Extended_Pictographic}/u;
const empiezaEmoji = (s) => EMO.test(s);
const sinEmoji = (s) => String(s).replace(EMO, '').trim();
const esLista = (s) => / · /.test(s) || EMO_DENTRO.test(sinEmoji(s));
// la etiqueta final: un emoji de veredicto al principio («⁉️ Duda para…», «💸 Venta obligatoria») o «Fantasy» con mayúscula («Lloros Fantasy…»)
const esEtiqueta = (s) => empiezaEmoji(s) && !esLista(s) && (/Fantasy/.test(s) || /^(✅|❌|⁉️|👀|💔|🟨|🟥|💸)/u.test(s));
const cierra = (s) => (/[.!?…:]$/.test(s) ? s : `${s}.`);
const SIGUE = /^(tras|por|despu[eé]s de|debido a|a ra[ií]z de|ante|para)\s/i;
/** junta las frases de un párrafo */
function parrafo(frases) {
  let out = '';
  for (const f of frases) {
    if (!out) { out = f; continue; }
    const previa = out.replace(/[.]$/, '');
    if (/^seg[uú]n /i.test(f) && !/:$/.test(out)) out = `${previa}, ${f[0].toLowerCase()}${f.slice(1)}`;
    else if (SIGUE.test(f) && !/[.:!?]$/.test(out)) out = `${out} ${f[0].toLowerCase()}${f.slice(1)}`;
    else out = `${cierra(out)} ${f}`;
  }
  return out;
}
/** marca de párrafo aparte para armarAire (no sale en el texto): `aparte('En el Sevilla…')` */
export const APARTE = '¶';
export const aparte = (s) => `${APARTE}${s}`;
/** el tweet: cabecera e ideas en párrafos de texto corrido, las listas y la etiqueta en su línea, y el cierre (si lo hay) */
export function armarAire(cab, ideas, pie) {
  const xs = [...ideas];
  const fin = xs.length && esEtiqueta(xs[xs.length - 1]) ? xs.pop() : null;
  const bloques = [];
  let frases = [cab];
  // con varias frases, el párrafo acaba en punto; una sola va sin él si es el titular (el primer párrafo) y con él si va después
  // (4 nov, con los tweets largos: «El Sevilla no podrá contar con Marcao» se quedaba sin punto en mitad del texto)
  const volcar = () => { if (frases.length) bloques.push(frases.length > 1 || bloques.length ? cierra(parrafo(frases)) : parrafo(frases)); frases = []; };
  for (const x0 of xs) {
    // «¶» al principio: empieza un párrafo nuevo (los tweets largos van por párrafos: uno por equipo o por jugador)
    const x = String(x0).startsWith(APARTE) ? (volcar(), String(x0).slice(APARTE.length)) : x0;
    if (esLista(x)) { volcar(); bloques.push(x); continue; }
    const f = sinEmoji(x);
    if (!f) continue;
    // un párrafo largo se parte en dos (más fácil de leer en el móvil)
    if (frases.length >= 3 && parrafo([...frases, f]).length > 190) volcar();
    frases.push(f);
  }
  volcar();
  return [...bloques, ...(fin ? [fin] : []), ...(pie ? [pie] : [])].join('\n\n');
}

/**
 * Elige las ideas que caben. ideas: [{ t, prio }] o textos sueltos (prio 9, imprescindibles), en el orden en que se leen.
 * Si no cabe todo, quita primero la de menos prio (y, entre iguales, la de más abajo). Devuelve las que quedan, en su orden.
 */
export function ajustar(cab, ideas, pie, max = limite()) {
  let xs = ideas.filter(Boolean).map((x, i) => (typeof x === 'string' ? { t: x, prio: 9, i } : { ...x, i }));
  while (xs.length && peso(armarAire(cab, xs.map((x) => x.t), pie)) > max) {
    const quitar = [...xs].sort((a, b) => a.prio - b.prio || b.i - a.i)[0];
    xs = xs.filter((x) => x !== quitar);
  }
  return xs.map((x) => x.t);
}

/** el tweet con las ideas que caben (sin #LaLigaFantasy de relleno: «fantasy» ya no es obligatoria, Carlos, 4 nov 13:00) */
export function tweet(cab, ideas, { pie = null, max = limite() } = {}) {
  const usadas = ajustar(cab, ideas, pie, max);
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
    return { jornada: n, rival: corto(r.mainName), rivalNombre: r.mainName, rivalEscudo: r.badgeColor || null, enCasa, fecha: m.date || null };
  }
  return null;
}
/** «para la jornada 12 contra el Valencia» (o solo «para la jornada 12» si no se sabe el rival) */
export const paraLa = (pp, jornada) => (pp ? `para la jornada ${pp.jornada} contra ${el(pp.rival)}` : jornada ? `para la jornada ${jornada}` : 'para la próxima jornada');

// Cuándo se juega, como lo diría una persona (para los tweets largos): «hoy a las 21:00», «mañana a las 18:30», «el sábado a las
// 16:15». Con la hora de Madrid. Devuelve { t, numeros } (las cifras de la hora, para el validador) o null si no hay fecha.
const DIA_SEM = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long' });
const HORA_MIN = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DIA_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
export function cuando(fecha, ahora = Date.now()) {
  const t = Date.parse(fecha);
  if (!Number.isFinite(t)) return null;
  const hm = HORA_MIN.format(new Date(t));
  const [h, mi] = hm.split(':').map(Number);
  const dias = Math.round((Date.parse(DIA_ISO.format(new Date(t))) - Date.parse(DIA_ISO.format(new Date(ahora)))) / 864e5);
  if (dias < 0 || dias > 6) return null;
  const dia = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `el ${DIA_SEM.format(new Date(t))}`;
  return { t: `${dia} a las ${hm}`, numeros: [h, mi] };
}
