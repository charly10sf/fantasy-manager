/* Lo que el mánager cuenta en Pregunta y MANDA en el motor (22 nov, Carlos: «le dije a la IA que no me quedan blindajes
   y el plan rehecho volvió a mandar blindar a Thiago»).

   Hasta ahora una nota era solo texto para la IA: el plan lo monta el motor con los datos de LaLiga, así que lo que el
   mánager decía no cambiaba nada. Aquí están los hechos claros que el motor entiende (una nota con `corr`):
     - 'blindajes': los blindajes gratis que le quedan (`n`: 0, 1 o 2), hasta que se recarguen;
     - 'blindado' : ya ha blindado a ese jugador (cuenta como un blindaje gastado y lo protege desde que lo dijo);
     - 'no-vender': a ese jugador suyo no lo vende mientras dure la nota;
     - 'puja'     : ya ha pujado por ese jugador del mercado (se da por hecha: no se le vuelve a mandar).
   La corrección sale SIEMPRE de lo que escribe él (leerDicho), nunca de lo que entiende la IA: la IA solo puede poner
   el jugador cuando él no lo ha nombrado («a ese no lo vendo»). Una opinión o una preferencia vaga no es un hecho:
   se queda como nota de texto, como antes. */
import { norm } from './util.js';

const DIA = 86400e3, HORA = 3600e3;
/** lo que dura cada corrección si quien la apunta no sabe una fecha mejor */
export const DURA_DICHO = { 'no-vender': 14 * DIA, puja: DIA, blindado: 2 * DIA, blindajes: 7 * DIA };

const B = '(?:blindajes?|escudos?)';
const R = {
  dos: new RegExp(`\\bme quedan (?:aun |todavia )?(?:los |mis )?(?:dos|2) ${B}\\b|\\b(?:aun |todavia )?tengo (?:los |mis )?(?:dos|2) ${B}\\b|\\bno he (?:gastado|usado|puesto|utilizado) (?:ningun|ninguno de los|ninguno de mis|ni un) ${B}\\b`),
  uno: new RegExp(`\\bme queda (?:ya )?(?:solo |solamente |aun |todavia )?(?:un|1|uno) (?:solo |unico )?${B}\\b|\\b(?:solo |aun |todavia )?tengo (?:solo )?(?:un|1) (?:solo |unico )?${B}\\b|\\b(?:he|llevo) (?:ya )?(?:gastado|usado|puesto|utilizado) (?:ya )?(?:un|1|uno) (?:de los (?:dos |2 )?)?${B}\\b`),
  cero: new RegExp(`\\b(?:ya )?no (?:me )?(?:queda|quedan|tengo|hay) (?:ya )?(?:mas |ningun |ni un |ni 1 |otro |un |ni uno de los |ninguno de los )?${B}\\b|\\b(?:quedado |quede |estoy |voy |ando )sin (?:mas |ningun )?${B}\\b|\\b(?:he|tengo|llevo) (?:ya )?(?:gastado|usado|utilizado|puesto|agotado)s? (?:ya )?(?:los|mis|todos los|todos mis|ambos|los 2|los dos) (?:dos |2 )?${B}\\b|\\b${B} (?:ya )?(?:gastados|usados|agotados)\\b|\\b(?:cero|0) ${B}\\b`),
  blindado: /\b(?:ya )?(?:he|tengo) (?:ya )?blindado\b|\bya (?:lo |la |le )?blinde\b|\bya esta blindad[oa]\b|\b(?:le|les) he puesto (?:ya )?(?:el|un|mi) (?:blindaje|escudo)\b|\blo tengo (?:ya )?blindado\b/,
  noVender: /\bno (?:lo |la |los |las |le |les |me lo |me la )?(?:vendo|vendere|vendemos|vendas|voy a vender|vamos a vender|quiero vender|quiero venderl[oa]s?|pienso vender|pongo en venta|voy a poner en venta|pongas en venta|quiero que (?:lo |la |los |me lo )?vendas)\b|\bno se vend(?:e|en)\b|\bintocables?\b|\bno esta(?:n)? en venta\b/,
  // «no lo vendo por menos de 30 M», «no lo vendo salvo que…»: es un precio o una condición, no un veto
  condicion: /\bpor menos de\b|\ba menos que\b|\bsalvo\b|\ba no ser\b|\bsi no (?:me|llega|sube|baja)\b|\bhasta que\b|\bsin que\b|\bmenos de \d/,
  puja: /\b(?:ya )?(?:he|hemos) (?:ya )?pujado\b|\bya puje\b|\b(?:ya )?(?:he hecho|hice|tengo hecha|esta hecha|he puesto|he metido|puse|meti) (?:ya )?(?:la|esa|esta|una|mi) puja\b|\bpuja (?:ya )?(?:hecha|puesta|metida)\b|\b(?:le|les) he (?:ya )?(?:pujado|metido)\b/,
};

/** el texto en trozos: cada frase, y lo de después de un «pero» aparte; `p` dice si el trozo es una pregunta */
function trozos(texto) {
  const out = [];
  for (const f of String(texto || '').split(/(?<=[.!?…])\s+|\n+|(?=¿)/)) {
    const p = /\?\s*$/.test(f.trim()) || /^\s*¿/.test(f);
    for (const g of f.split(/[,;]?\s+(?:pero|aunque)\s+/i)) if (g.trim()) out.push({ t: g, q: norm(g), p });
  }
  return out;
}

/** una cifra de dinero en el texto («12,5 M», «8 millones», «900 mil», «7.500.000»), en euros; null si no hay */
export function cifraDe(texto) {
  const t = String(texto || '');
  let m = t.match(/(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:M\b|millones|mill[oó]n|kilos?\b|mill\b)/i);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e6);
  m = t.match(/(\d{1,3})\s*(?:mil\b|k\b)/i);
  if (m) return +m[1] * 1e3;
  m = t.match(/\b(\d{1,3}(?:\.\d{3}){1,2})\b/);
  if (m) return +m[1].replace(/\./g, '');
  return null;
}

/**
 * Los hechos claros de un mensaje del mánager. `jugadores(texto)` devuelve los jugadores que nombra un texto.
 * Devuelve [{ corr, n?, pids: [], importe? }]; `pids` vacío en las que piden jugador = no ha dicho a quién.
 */
export function leerDicho(texto, jugadores = () => []) {
  const out = [];
  const ya = (corr) => out.find((x) => x.corr === corr);
  const ts = trozos(texto);
  const todos = () => jugadores(texto).map((j) => j.id);
  for (const { t, q, p } of ts) {
    if (p || !q) continue;
    // los blindajes que quedan («no tengo un blindaje» es cero: la negación se mira antes que «tengo un blindaje»)
    if (!ya('blindajes')) {
      const n = R.dos.test(q) ? 2 : R.cero.test(q) ? 0 : R.uno.test(q) ? 1 : null;
      if (n != null) out.push({ corr: 'blindajes', n, pids: [] });
    }
    const aqui = () => jugadores(t).map((j) => j.id);
    if (R.blindado.test(q)) {
      const x = ya('blindado') || (out.push({ corr: 'blindado', pids: [] }), out.at(-1));
      for (const pid of aqui()) if (!x.pids.includes(pid)) x.pids.push(pid);
    }
    if (R.noVender.test(q) && !R.condicion.test(q)) {
      const x = ya('no-vender') || (out.push({ corr: 'no-vender', pids: [] }), out.at(-1));
      for (const pid of aqui()) if (!x.pids.includes(pid)) x.pids.push(pid);
    }
    if (R.puja.test(q)) {
      const x = ya('puja') || (out.push({ corr: 'puja', pids: [], importe: null }), out.at(-1));
      const ps = aqui();
      for (const pid of ps) if (!x.pids.includes(pid)) x.pids.push(pid);
      // la cifra solo vale si habla de uno solo: con dos nombres no se sabe de cuál es
      if (ps.length <= 1 && x.importe == null) x.importe = cifraDe(t);
    }
  }
  // no ha nombrado a nadie en esa frase: si en todo el mensaje nombra a uno solo, es ese
  for (const x of out) if (x.corr !== 'blindajes' && !x.pids.length) { const ps = todos(); if (ps.length === 1) x.pids = ps; }
  return out;
}

/**
 * Las notas vigentes que corrigen al motor, ordenadas para él:
 * { blindajes: nota | null, blindados: Map(pid → nota), noVender: Map(pid → nota), pujas: Map(pid → nota) }
 * De cada cosa manda la última que dijo.
 */
export function correcciones(notas, ahora = Date.now()) {
  const C = { blindajes: null, blindados: new Map(), noVender: new Map(), pujas: new Map() };
  const vivas = (notas || []).filter((n) => n && n.corr && n.t && (!n.caduca || n.caduca > ahora)).sort((a, b) => a.t - b.t);
  for (const n of vivas) {
    if (n.corr === 'blindajes' && [0, 1, 2].includes(n.n)) C.blindajes = n;
    else if (n.corr === 'blindado' && n.pid) C.blindados.set(n.pid, n);
    else if (n.corr === 'no-vender' && n.pid) C.noVender.set(n.pid, n);
    else if (n.corr === 'puja' && n.pid) C.pujas.set(n.pid, n);
  }
  return C;
}

/** la nota, como se le enseña al mánager en el plan (corta, de tú) */
export function dichoTxt(n, nombre = '') {
  const quien = nombre || n.jugador || 'ese jugador';
  if (n.corr === 'blindajes') return n.n === 0 ? 'No te quedan blindajes' : n.n === 1 ? 'Te queda 1 blindaje' : 'Te quedan los 2 blindajes';
  if (n.corr === 'blindado') return `Ya has blindado a ${quien}`;
  if (n.corr === 'no-vender') return `A ${quien} no lo vendes`;
  if (n.corr === 'puja') return `Ya has pujado por ${quien}`;
  return String(n.texto || '');
}

export const HORA_DICHO = HORA;
