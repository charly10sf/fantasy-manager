// La política de emojis (22 nov, auditoría de la redacción: los 78 tuits revisados empezaban por emoji y en 29 había un club con el
// suyo y otro sin él). Carlos: «que no todos los párrafos empiecen con emoji, que es lo que más huele a plantilla»; lo que ya había
// decidido no cambia: el ⚪ del Madrid sí, nada de 🟢 ni círculos, fuera los del Barça y el Atleti, el de un club con el del otro y no
// siempre, balón en los goles y tarjeta roja en las rojas.
//   1. Como mucho TOPE por tuit, contando la etiqueta de abajo; las banderas de selecciones, aparte (TOPE_BANDERAS).
//   2. El de arriba, solo al principio del primer párrafo. En el directo, siempre; en el resto, más o menos la mitad de los tuits sin
//      él (lo decide `decidirEmojis` con la clave del tuit: la IA no elige). Nunca el mismo que el de la etiqueta de abajo.
//   3. Los de club, detrás del nombre la primera vez, solo si en el tuit salen exactamente dos clubes y los dos tienen emoji; y aun
//      así, la mitad de las veces sin.
// `decidirEmojis` lo decide para un tuit; redaccion.mjs se lo pasa a la IA en los hechos («emojiArriba» y el «emoji» de cada club, o
// nada) y `erroresEmojis` lo comprueba; `aplicarEmojis` lo deja así en lo que sale de plantilla (ejecutar.mjs, antes de publicar).
import { hash, APODOS, norm } from './texto.mjs';
import { banderasEn } from './nacionalidad.mjs';

export const TOPE = 3, TOPE_BANDERAS = 4;
// el de arriba de cada tipo (el primero, si el de la plantilla no es de la lista)
export const ARRIBA = {
  directo: ['⚽', '🟥', '🧤', '❌'], final: ['🏁'], mvp: ['⭐'], onceideal: ['⭐'], previa: ['🗓️'], calendario: ['🗓️'], previaweb: ['🗓️'],
  onces: ['👀'], noticias: ['🚨', '❌', '⁉️', '✅', '👀'], novedades: ['🚨', '❌', '⁉️', '✅', '🟥'], caidas: ['❌', '⁉️', '🚨'],
  sancionados: ['🟥', '🟨'], mercado: ['📈', '📉'], revalorizaciones: ['📈', '📉'], balance: ['📊'], resumen: ['⭐', '📉'],
  selecciones: ['🌍'], 'selecciones-dia': ['🌍'], lloros: ['💔'], liga: ['🗞️'],
};
// los de las plantillas que ya no van arriba, por cuál se cambian
const CAMBIO = { 'ℹ️': '👀', 'ℹ': '👀', '🔥': '⭐', '📋': '🗓️', '💸': '📈', '🏆': '⭐', '⬇️': '📉', '🗣️': '🗞️', '🗣': '🗞️' };
// todos los que pueden ir arriba (sin la marca de variante, para comparar)
const sinVar = (e) => String(e || '').replace(/️/g, '');
const VARIOS = new Set(['mercado', 'revalorizaciones', 'resumen']);
export const EMOJIS_ARRIBA = new Set(Object.values(ARRIBA).flat().map(sinVar));
export const EMOJIS_CLUB = new Set(Object.values(APODOS).flatMap((a) => a.e).map(sinVar));

const PICTO = /\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*/gu;
const BANDERA = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F}/gu;
/** los emojis de un texto (sin las banderas de selecciones), en orden */
export const emojisDe = (s) => [...String(s || '').replace(BANDERA, ' ').matchAll(PICTO)].map((m) => m[0]);
/** el emoji con el que empieza un texto, o '' */
export const primero = (s) => { const m = String(s || '').match(/^\s*(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)/u); return m ? m[1] : ''; };

/**
 * Lo que lleva un tuit: { arriba: el emoji de arriba o '', clubes: si van los de club }. `t`: { tipo, clave, texto (la plantilla),
 * hechos }. La etiqueta, de `t.hechos.etiqueta`. Siempre lo mismo para el mismo tuit (la semilla es su clave).
 */
export function decidirEmojis(t) {
  const tipo = t.tipo || (t.hechos && t.hechos.tipo) || '';
  const lista = ARRIBA[tipo] || [];
  const semilla = String(t.clave || t.texto || '');
  const etq = primero((t.hechos && t.hechos.etiqueta) || t.etiqueta || '');
  // el de arriba: el que decidió la plantilla por lo que pasa (❌ baja, ⁉️ duda…), si es de los de su tipo
  const dePlantilla = CAMBIO[primero(t.texto)] || primero(t.texto);
  // (un tipo que no está en ARRIBA, como las respuestas, se queda con el suyo)
  let arriba = !(tipo in ARRIBA) ? dePlantilla : lista.find((e) => sinVar(e) === sinVar(dePlantilla)) || lista[0] || '';
  // (en el mercado y los rankings la plantilla no sabe por dónde va a empezar la IA: ella elige entre los de su tipo)
  if (VARIOS.has(tipo) && t.hechos && !t.redactado) arriba = lista;
  // clubes: dos, y los dos con emoji
  const cl = Object.values((t.hechos && t.hechos.clubes) || {});
  const dos = cl.length === 2 && cl.every((c) => c && c.emoji);
  let clubes = dos && hash(`${semilla}:club`) % 2 === 0;
  if (tipo !== 'directo' && tipo in ARRIBA) {
    if (hash(`${semilla}:arriba`) % 2 === 1) arriba = '';
    if (etq && (Array.isArray(arriba) ? arriba.length === 1 && sinVar(arriba[0]) === sinVar(etq) : sinVar(etq) === sinVar(arriba))) arriba = '';
    if (Array.isArray(arriba) && etq) arriba = arriba.filter((x) => sinVar(x) !== sinVar(etq));
  }
  // el tope: la etiqueta cuenta; si no caben, fuera el de arriba (menos en el directo) y, si aun así no, los de club
  const cuenta = () => (arriba && arriba.length ? 1 : 0) + (clubes ? 2 : 0) + (etq ? 1 : 0);
  if (cuenta() > TOPE && tipo !== 'directo') arriba = '';
  if (cuenta() > TOPE) clubes = false;
  return { arriba, clubes };
}

/** los hechos para la IA con la decisión: «emojiArriba» y el emoji de cada club solo si van (los cambia en el sitio) */
export function conEmojis(t) {
  const d = decidirEmojis(t);
  if (!t.hechos) return d;
  // (una copia: los hechos de un tuit los pueden compartir otros)
  const cl = Object.fromEntries(Object.entries(t.hechos.clubes || {}).map(([k, c]) => [k, d.clubes || !c ? c : { ...c, emoji: null }]));
  t.hechos = { ...t.hechos, emojiArriba: d.arriba, clubes: cl };
  return d;
}

/** lo que se arregla sin pedir otra versión: el de arriba que tocaba y la IA no puso, o el que puso sin tocarle */
export function ajustarArriba(texto, hechos = {}) {
  const t = String(texto || ''), ini = primero(t);
  const quitar = (x) => x.replace(/^\s*\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*\s*/u, '').replace(/^\p{Ll}/u, (c) => c.toUpperCase());
  if (hechos.emojiArriba === '' && ini && !EMOJIS_CLUB.has(sinVar(ini))) return quitar(t);
  if (typeof hechos.emojiArriba === 'string' && hechos.emojiArriba && !ini) return `${hechos.emojiArriba} ${t}`;
  if (typeof hechos.emojiArriba === 'string' && hechos.emojiArriba && ini && sinVar(ini) !== sinVar(hechos.emojiArriba) && EMOJIS_ARRIBA.has(sinVar(ini))) return `${hechos.emojiArriba} ${quitar(t)}`;
  return t;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** lo que no cumple la política en un texto redactado (lista vacía si nada). `hechos` con la decisión ya puesta (conEmojis). */
export function erroresEmojis(texto, hechos = {}) {
  const t = String(texto || '').trim(), e = [];
  const em = emojisDe(t);
  const etq = primero(hechos.etiqueta || '');
  if (em.length + (etq ? 1 : 0) > TOPE) e.push(`${em.length + (etq ? 1 : 0)} emojis contando la etiqueta de abajo: como mucho ${TOPE}`);
  const bs = banderasEn(t);
  if (bs.length > TOPE_BANDERAS) e.push(`${bs.length} banderas: como mucho ${TOPE_BANDERAS}`);
  const ini = primero(t);
  if (hechos.emojiArriba === '') { if (ini && !EMOJIS_CLUB.has(sinVar(ini))) e.push(`este tuit va sin emoji arriba: empieza por el texto, sin «${ini}»`); }
  else if (Array.isArray(hechos.emojiArriba)) { if (hechos.emojiArriba.length && !hechos.emojiArriba.some((x) => sinVar(x) === sinVar(ini))) e.push(`el tuit empieza por uno de estos: ${hechos.emojiArriba.join(' ')}`); }
  else if (hechos.emojiArriba && sinVar(ini) !== sinVar(hechos.emojiArriba)) e.push(`el tuit empieza por «${hechos.emojiArriba}» y por ningún otro`);
  // ningún otro párrafo empieza por emoji
  const ps = t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  if (ps.slice(1).some((p) => primero(p))) e.push('solo el primer párrafo puede empezar por emoji');
  // un emoji de tipo, solo el de arriba: ni en medio ni al final
  const resto = ini ? t.slice(t.indexOf(ini) + ini.length) : t;
  const dentro = emojisDe(resto).filter((x) => EMOJIS_ARRIBA.has(sinVar(x)) && !EMOJIS_CLUB.has(sinVar(x)));
  if (dentro.length) e.push(`emoji en medio del texto (${dentro.join(' ')}): solo el de arriba, al principio`);
  // los de club que no tocan (la decisión los quitó de los hechos)
  const deHechos = new Set(Object.values(hechos.clubes || {}).map((c) => c && c.emoji).filter(Boolean).map(sinVar));
  const clubSobra = em.filter((x) => EMOJIS_CLUB.has(sinVar(x)) && !deHechos.has(sinVar(x)));
  if (clubSobra.length) e.push(`emojis de club que no van en este tuit (${clubSobra.join(' ')}): sin ninguno`);
  return e;
}

/**
 * La política aplicada a un texto de plantilla (o pulido): el de arriba, el que toca o ninguno; los de club, solo si van y si en el
 * texto salen dos clubes con el suyo; nada que pase del tope. La etiqueta y las listas de su línea no se tocan.
 */
export function aplicarEmojis(texto, t = {}) {
  let s = String(texto || '');
  if (!s.trim()) return s;
  const d = decidirEmojis({ ...t, texto: s });
  const ps = s.split(/\n\s*\n/);
  const ult = ps.length > 1 ? ps[ps.length - 1] : null;
  const etq = ult && primero(ult) && (t.hechos && t.hechos.etiqueta ? ult.trim() === String(t.hechos.etiqueta).trim() : /para la|Fantasy|de la jornada|Venta obligatoria/.test(ult)) ? ult : null;
  // arriba
  const ini = primero(ps[0]);
  const arriba = Array.isArray(d.arriba) ? (d.arriba.find((e) => sinVar(e) === sinVar(CAMBIO[ini] || ini)) || d.arriba[0] || '') : d.arriba;
  if (ini) ps[0] = arriba ? ps[0].replace(ini, arriba) : ps[0].replace(/^\s*\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*\s*/u, '').replace(/^\p{Ll}/u, (c) => c.toUpperCase());
  // de club: los quita si no van, o si no salen dos clubes que los tengan los dos
  const cuerpo = etq ? ps.slice(0, -1) : ps;
  // ningún otro párrafo empieza por emoji (menos las listas de su línea, «🥇 … · 🥈 …»)
  for (let i = 1; i < cuerpo.length; i++) if (primero(cuerpo[i]) && !/ · /.test(cuerpo[i])) cuerpo[i] = cuerpo[i].replace(/^\s*\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*\s*/u, '').replace(/^\p{Ll}/u, (c) => c.toUpperCase());
  const enTexto = [...new Set(Object.entries(APODOS).filter(([c, a]) => a.a.some((n) => ` ${norm(cuerpo.join(' '))} `.includes(` ${norm(n).replace(/^(el|la) /, '')} `)) || ` ${norm(cuerpo.join(' '))} `.includes(` ${norm(c)} `)).map(([c]) => c))];
  const conE = enTexto.filter((c) => APODOS[c].e.length);
  const van = d.clubes && enTexto.length === 2 && conE.length === 2;
  if (!van) for (let i = 0; i < cuerpo.length; i++) for (const e of EMOJIS_CLUB) cuerpo[i] = cuerpo[i].replace(new RegExp(` ?${esc(e)}\\uFE0F?`, 'gu'), '');
  return [...cuerpo, ...(etq ? [etq] : [])].join('\n\n');
}
