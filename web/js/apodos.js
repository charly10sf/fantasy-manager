/* Apodos de los rivales (0.8a, Carlos 17 nov): el nombre con el que llamas a cada rival en tu liga, para que la IA y la
   voz lo reconozcan. Se guardan solo en este móvil, por liga y por id del equipo (no por nombre: si cambia el nombre de
   su equipo, el apodo sigue valiendo). Se pueden poner varios separados por comas.
   Y el reconocimiento aproximado de nombres (lo que escribe el dictado: «leao ere espabilado» por «Leao er Espabilao»):
   `aproximar` lo usa ia.js (seudonimos) para la pregunta y el historial del chat, nunca para los datos. */
import { LS } from './util.js';
import { K } from './datos.js';

const MAX = 4, LARGO = 60;

/** { tid: 'el Tito, Titón' } de la liga que estás viendo */
export const apodosLiga = () => { const a = LS.get(K('apodos'), null); return a && typeof a === 'object' ? a : {}; };
/** los apodos de un texto («el Tito, Titón» → ['el Tito', 'Titón']): de 3 a 60 caracteres, con alguna letra, 4 como mucho */
export const listaApodos = (s) => [...new Set(String(s || '').split(/[,;\n]/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 3 && x.length <= LARGO && /\p{L}/u.test(x)))].slice(0, MAX);
/** los de un rival */
export const apodosDe = (tid) => listaApodos(apodosLiga()[String(tid)]);
/** guarda (o borra, si va vacío) el apodo de un rival. Devuelve lo que queda guardado */
export function ponerApodo(tid, txt) {
  const a = { ...apodosLiga() }, l = listaApodos(txt);
  if (l.length) a[String(tid)] = l.join(', '); else delete a[String(tid)];
  LS.set(K('apodos'), a);
  return l;
}

/* ---------- nombres aproximados ---------- */
const sinTilde = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** una palabra, como suena: sin tildes ni letras dobles, «-ado» como «-ao» (espabilado → espabilao), «ere»/«el» → «er» */
export function canon(w) {
  let t = sinTilde(w).replace(/[^a-z0-9ñ]/g, '').replace(/(.)\1+/g, '$1');
  if (t === 'ere' || t === 'el') t = 'er';
  t = t.replace(/([a-z]{3})ado$/, '$1ao').replace(/([a-z]{3})ada$/, '$1a').replace(/([a-z]{3})ido$/, '$1io');
  t = t.replace(/^h(?=[aeiou])/, '').replace(/v/g, 'b').replace(/z/g, 's').replace(/c(?=[ei])/g, 's').replace(/qu/g, 'k').replace(/y$/, 'i');
  return t;
}
/** distancia de edición, cortando en cuanto pasa de `max` */
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let fila = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); fila = Math.min(fila, cur[j]); }
    if (fila > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
/** ¿suenan igual? Igual tal cual o, en palabras de 4 letras o más que empiezan igual, una letra de diferencia (dos desde 8) */
const parecida = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && a[0] === b[0] && lev(a, b, Math.max(a.length, b.length) >= 8 ? 2 : 1) <= (Math.max(a.length, b.length) >= 8 ? 2 : 1));
/** las palabras que cuentan (3 letras o más, tal como suenan), con dónde está cada una en el texto */
const RELLENO = new Set(['del', 'los', 'las', 'les', 'con', 'una', 'uno']);
function palabras(t) {
  const o = [];
  for (const m of String(t).matchAll(/[\p{L}\p{N}]+/gu)) { const c = canon(m[0]); if (c.length >= 3 && !RELLENO.has(c)) o.push({ c, i: m.index, f: m.index + m[0].length, raw: m[0] }); }
  return o;
}
/** sin el artículo de delante («el Tito» → «Tito»), para «al Tito», «del Tito»; null si no lleva o queda muy corto */
export const sinArticulo = (s) => { const m = /^(el|la|los|las|er)\s+(.{3,})$/i.exec(String(s || '').trim()); return m ? m[2] : null; };

/**
 * Busca en `t` los nombres de `nombres` ([{ nombre, clave }]: clave es a quién se refiere, el alias) escritos de forma
 * aproximada, y los cambia por el nombre bien escrito. `prohibidos`: nombres (con norm) que no se tocan nunca (jugadores,
 * clubes, el tuyo). Si un trozo vale para dos rivales distintos, no se cambia y va a `dudas`.
 * Devuelve { t, cambios: [clave], dudas: [[clave, clave]] }
 */
export function aproximar(t, nombres, { prohibidos = new Set(), norm = (x) => x } = {}) {
  if (typeof t !== 'string' || !t || !nombres || !nombres.length) return { t, cambios: [], dudas: [] };
  const ws = palabras(t);
  if (!ws.length) return { t, cambios: [], dudas: [] };
  const cands = [];
  for (const n of nombres) {
    const ps = palabras(n.nombre).map((x) => x.c);
    const letras = ps.join('').length;
    // un nombre de una sola palabra corta se confunde con cualquier cosa: solo de 6 letras o más
    if (!ps.length || letras < 5 || (ps.length === 1 && ps[0].length < 6)) continue;
    cands.push({ ps, n });
  }
  const trozos = new Map(); // «i-f» → { i, f, claves: Set, nombre }
  for (const { ps, n } of cands) {
    for (let s = 0; s + ps.length <= ws.length; s++) {
      let ok = true;
      for (let k = 0; k < ps.length && ok; k++) ok = parecida(ws[s + k].c, ps[k]);
      if (!ok) continue;
      const i = ws[s].i;
      let f = ws[s + ps.length - 1].f;
      // lo corto que el nombre lleva al final («FC») y va justo detrás: dentro del trozo
      const cola = /[\p{L}\p{N}]+$/u.exec(n.nombre), sig = /^\s+([\p{L}\p{N}]+)/u.exec(t.slice(f));
      if (cola && sig && cola[0].length <= 3 && sinTilde(sig[1]) === sinTilde(cola[0])) f += sig[0].length;
      const trozo = t.slice(i, f);
      // escrito ya bien (lo coge el paso exacto) o es un jugador o un club: tal cual
      if (norm(trozo) === norm(n.nombre) || prohibidos.has(norm(trozo))) continue;
      // con una sola palabra, que no sea una palabra cualquiera en minúscula de 6 o 7 letras con una letra cambiada
      if (ps.length === 1 && ws[s].c !== ps[0] && trozo[0] === trozo[0].toLowerCase() && ps[0].length < 8) continue;
      const k = `${i}-${f}`;
      const tz = trozos.get(k) || { i, f, claves: new Set(), nombre: n.nombre };
      tz.claves.add(n.clave);
      trozos.set(k, tz);
    }
  }
  if (!trozos.size) return { t, cambios: [], dudas: [] };
  // los más largos primero, sin pisarse
  const lista = [...trozos.values()].sort((a, b) => (b.f - b.i) - (a.f - a.i) || a.i - b.i);
  const usados = [], cambios = [], dudas = [];
  for (const tz of lista) {
    if (usados.some((u) => tz.i < u.f && u.i < tz.f)) continue;
    usados.push(tz);
    if (tz.claves.size > 1) { dudas.push([...tz.claves]); tz.dudosa = true; } else cambios.push([...tz.claves][0]);
  }
  let o = t;
  for (const tz of usados.filter((u) => !u.dudosa).sort((a, b) => b.i - a.i)) o = o.slice(0, tz.i) + tz.nombre + o.slice(tz.f);
  return { t: o, cambios: [...new Set(cambios)], dudas };
}
