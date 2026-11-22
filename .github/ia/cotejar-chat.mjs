// El comprobador de las respuestas del chat (19 nov, tercera parte de la revisión de la IA). Saca de cada respuesta las
// cifras (M, mil, %, horas, fechas, puntos) y los nombres, y los busca en lo que se le mandó a la IA (los datos de su liga
// de esa escena, la pregunta y la conversación). Lo que no está ahí, ni sale de sumar o restar dos cifras que sí están, es
// inventado. Marca además lo que no puede salir nunca: códigos internos, notas sin quitar, nombres de modelos de IA,
// «función top», más de 6 frases, una pregunta al final y lo que contradice el veredicto de la app o el plan.
//
// Uso como módulo: cotejar(r) con r = { texto, pregunta, hist, datos, nombres, clubes, equipos, apodos, plan, recomiendo }.
// Uso suelto: node .github/ia/cotejar-chat.mjs respuestas-chat.json  (las de chat-haiku.mjs, que lleva todo eso dentro)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sinT = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MENOS = /[−–-]/;

/** las cifras de dinero de un texto: [{ v (euros), p (precisión en euros), aprox, txt }] */
export function dineros(t) {
  const o = [];
  const re = /(~|unos?\s+|sobre\s+|cerca de\s+|casi\s+|alrededor de\s+|rondar[áa]?\s+|hasta\s+|m[áa]s de\s+|menos de\s+)?([+−–-]\s?)?(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s?(M\b|millones|mill?\.?\b|mil\b|k\b|€)/gi;
  for (const m of String(t).matchAll(re)) {
    const ent = m[3].replace(/\./g, ''), dec = (ent.split(',')[1] || '').length;
    const n = Number(ent.replace(',', '.'));
    if (!Number.isFinite(n)) continue;
    const u = m[4].toLowerCase();
    const mult = u === 'm' || u.startsWith('mill') ? 1e6 : u === 'mil' || u === 'k' ? 1e3 : 1;
    if (mult === 1 && n < 1000) continue; // «3 €» no es una cifra de la liga
    const signo = m[2] && MENOS.test(m[2]) ? -1 : 1;
    o.push({ v: signo * n * mult, p: mult * Math.pow(10, -dec), aprox: !!m[1], txt: m[0].trim() });
  }
  return o;
}
/** los porcentajes: [{ v, p, txt }] */
export function porcentajes(t) {
  const o = [];
  for (const m of String(t).matchAll(/([+−–-]\s?)?(\d+(?:,\d+)?)\s?%/g)) {
    const dec = (m[2].split(',')[1] || '').length;
    o.push({ v: (m[1] && MENOS.test(m[1]) ? -1 : 1) * Number(m[2].replace(',', '.')), p: Math.pow(10, -dec), txt: m[0].trim() });
  }
  return o;
}
export const horas = (t) => [...String(t).matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b(?!\s?(?:M|mil|%))/g)].map((m) => `${Number(m[1])}:${m[2]}`);
const DIAS = { lunes: 'lun', martes: 'mar', miercoles: 'mie', jueves: 'jue', viernes: 'vie', sabado: 'sab', domingo: 'dom', lun: 'lun', mar: 'mar', mie: 'mie', jue: 'jue', vie: 'vie', sab: 'sab', dom: 'dom' };
const MESES = { enero: 'ene', febrero: 'feb', marzo: 'mar', abril: 'abr', mayo: 'may', junio: 'jun', julio: 'jul', agosto: 'ago', septiembre: 'sep', octubre: 'oct', noviembre: 'nov', diciembre: 'dic', ene: 'ene', feb: 'feb', abr: 'abr', may: 'may', jun: 'jun', jul: 'jul', ago: 'ago', sep: 'sep', oct: 'oct', nov: 'nov', dic: 'dic' };
/** fechas: [{ d, mes?, wd? }] («el sábado 7», «13 nov», «el 21 de noviembre») */
export function fechas(t) {
  const s = sinT(t), o = [];
  for (const m of s.matchAll(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|lun|mar|mie|jue|vie|sab|dom)\.?,?\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?:m\b|mil|%|:|pts|puntos))/g)) o.push({ d: Number(m[2]), wd: DIAS[m[1]] });
  for (const m of s.matchAll(/\b(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/g)) o.push({ d: Number(m[1]), mes: MESES[m[2]] });
  return o;
}
export const puntosDe = (t) => [...String(t).matchAll(/(\d+(?:,\d+)?)\s?(?:pts|puntos|pt)\b/gi)].map((m) => Number(m[1].replace(',', '.')));

/** lo que hay en los datos, para buscar rápido */
export function indice({ datos = '', pregunta = '', hist = [] }) {
  const fuente = [datos, pregunta, ...(hist || []).map((m) => (m.r === 'yo' ? m.t : ''))].join('\n');
  // lo que dijo la IA antes en la conversación también vale como fuente de cifras (si era mentira, ya se marcó allí)
  const antes = (hist || []).filter((m) => m.r !== 'yo').map((m) => m.t).join('\n');
  const din = [...dineros(fuente), ...dineros(antes)].map((x) => x.v);
  const vals = [...new Set(din.flatMap((v) => [v, Math.abs(v)]))].sort((a, b) => a - b);
  const pcts = [...new Set([...porcentajes(fuente), ...porcentajes(antes)].map((x) => Math.abs(x.v)))].sort((a, b) => a - b);
  const hs = new Set([...horas(fuente), ...horas(antes)]);
  const MES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 }, WD = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
  const fs = fechas(fuente + '\n' + antes).map((g) => (g.mes && !g.wd ? { ...g, wd: WD[new Date(Date.UTC(g.mes === 'ene' || g.mes === 'feb' ? 2027 : 2026, MES[g.mes], g.d)).getUTCDay()] } : g));
  const pts = new Set([...puntosDe(fuente + '\n' + antes), ...[...String(fuente).matchAll(/(\d+(?:,\d+)?)\s?PTS/g)].map((m) => Number(m[1].replace(',', '.'))), ...[...String(fuente).matchAll(/~(\d+(?:,\d+)?)/g)].map((m) => Number(m[1].replace(',', '.')))]);
  const nums = new Set([...sinT(fuente + ' ' + antes).matchAll(/\d+(?:,\d+)?/g)].map((m) => Number(m[0].replace(',', '.'))));
  return { vals, pcts, hs, fs, nums, pts, texto: sinT(fuente), antes: sinT(antes) };
}
const hay = (arr, v, tol) => { // binaria
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] < v - tol) lo = mid + 1; else if (arr[mid] > v + tol) hi = mid - 1; else return true; }
  return false;
};
/** ¿sale la cifra de los datos? Tal cual (redondeada a como la escribe), aproximada (2 %) o de sumar/restar dos */
function dineroValido(x, I, propias) {
  const a = Math.abs(x.v), tol = Math.max(x.p / 2 + 1, x.aprox ? a * 0.03 : 0) + 5e3;
  if (hay(I.vals, a, tol)) return true;
  // de una cuenta: a = b ± c, con b y c de los datos o de la propia respuesta
  const otras = [...new Set([...I.vals, ...propias.filter((y) => Math.abs(y) !== a).map(Math.abs)])].sort((p, q) => p - q);
  const tol2 = tol + 2e4;
  for (const b of propias.map(Math.abs)) {
    if (!b || b === a) continue;
    if (hay(otras, a - b, tol2) || hay(otras, b - a, tol2) || hay(otras, a + b, tol2)) return true;
  }
  // la mitad, el doble (subir una cláusula: pagar X la sube 2X)
  return hay(I.vals, a * 2, tol * 2) || hay(I.vals, a / 2, tol);
}
function pctValido(x, I, propiasM) {
  const a = Math.abs(x.v), tol = x.p / 2 + 0.06;
  if (hay(I.pcts, a, tol)) return true;
  // de dividir dos cifras (de la respuesta o de los datos): a = (b/c − 1) · 100
  const base = [...new Set([...propiasM.map(Math.abs), ...I.vals])].filter((v) => v > 0).sort((p, q) => p - q);
  for (const c of propiasM.map(Math.abs).filter((v) => v > 0)) {
    for (const f of [1 + a / 100, 1 - a / 100, a / 100]) if (hay(base, c * f, Math.max(2e4, c * f * (tol / 100 + 0.002)))) return true;
    for (const f of [1 + a / 100, 1 - a / 100, a / 100]) if (f > 0 && hay(base, c / f, Math.max(2e4, (c / f) * (tol / 100 + 0.002)))) return true;
  }
  return false;
}

// palabras con mayúscula que no son nombres
const COMUNES = new Set(sinT(`sí no la el los las un una ojo vale pero y o si mejor con sin para por que qué cuando cómo como
  hoy mañana ayer laliga fantasy premium m mil var tu tus su sus mi yo te él ella ellos nada todo esto eso este esa ese
  lunes martes miércoles jueves viernes sábado domingo enero febrero marzo abril mayo junio julio agosto septiembre octubre
  noviembre diciembre por def med del pos portero defensa medio delantero jornada parón app ia nba nfl liga real club fc cf
  ud cd sd rcd ca atlético barcelona madrid primera segunda champions europa conference copa rey barça barca atleti`).split(/\s+/));

/** los nombres con mayúscula de la respuesta que no están en ninguna parte (ni en los datos, ni en la liga entera) */
function nombresRaros(texto, I, conocidos) {
  const o = new Set();
  for (const m of String(texto).matchAll(/\p{Lu}[\p{Ll}'’]{2,}(?:\s+(?:de\s+|del\s+|la\s+)?\p{Lu}[\p{Ll}'’]{2,}){0,3}/gu)) {
    // solo en mitad de una frase (lo de detrás de un punto o al empezar una línea puede ser cualquier palabra)
    const antes = String(texto).slice(0, m.index).replace(/[\s*_«"(]+$/, '');
    if (!antes || /[.!?¿¡:…\n\-•]$/.test(antes)) continue;
    const n = m[0], s = sinT(n);
    if (COMUNES.has(s) || s.split(/\s+/).every((w) => COMUNES.has(w))) continue;
    if (I.texto.includes(s) || conocidos.some((c) => c.includes(s) || s.includes(c))) continue;
    o.add(n);
  }
  return [...o];
}

/** las frases del texto principal (sin «Revisado por la app»); cada punto de una lista cuenta como una */
export function frases(t) {
  const s = String(t).replace(/\n\n\*\*Revisado por la app:\*\*[\s\S]*$/, '').replace(/\*\*/g, '').trim();
  return s.split(/(?<=[.!?…])\s+(?=[\p{Lu}¿¡«"(\d•*-])|\n+/u).map((x) => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter((x) => x.length > 3);
}

const INTERNO = /\b[PMTCAVB]-\d{2,6}\b|índice de sobrecoste|OPERACIONES POSIBLES|CUENTAS HECHAS|LA APP:|DATOS DE SU LIGA|MIS JUGADORES|PLANTILLAS DE LOS RIVALES|\bRival \d+\b|\bEquipo \d+\b|limites\.json|\bWorker\b/;
const NOTAS = /```|~~~|<\/?notas>|\{\s*"(?:recomiendo|apuntar|olvidar|ref|accion)"|\bnotas\s*[:{]/i;
const MODELOS = /\b(Claude|Haiku|Sonnet|Opus|Anthropic|Gemini|Gemma|GPT|OpenAI|ChatGPT|Flash[- ]Lite)\b/i;
const ASISTENTE = /¡Claro!|Espero que te ayude|Aquí tienes|En resumen|Cabe destacar|Es importante (señalar|destacar)|No dudes en|Si necesitas (algo|más)|¿Quieres que te|¿Te (lo )?(miro|comparo|preparo)|dime si quieres/i;

/**
 * Coteja una respuesta. Devuelve { inventadas: [texto], marcas: [texto], frases, palabras } con:
 *   inventadas: cifras, fechas, horas, puntos o nombres que no salen de lo que se le mandó
 *   marcas: forma (código interno, notas, modelo, función top, largo, pregunta al final, asistente) y contradicciones
 */
export function cotejar(r) {
  const texto = String(r.texto || '');
  const principal = texto.replace(/\n\n\*\*Revisado por la app:\*\*[\s\S]*$/, '');
  const I = indice(r);
  const inventadas = [], marcas = [];
  const ds = dineros(principal);
  const propias = ds.map((x) => x.v);
  for (const x of ds) if (!dineroValido(x, I, propias)) inventadas.push(`cifra ${x.txt}`);
  for (const x of porcentajes(principal)) if (!pctValido(x, I, propias)) inventadas.push(`porcentaje ${x.txt}`);
  for (const h of horas(principal)) if (!I.hs.has(h)) inventadas.push(`hora ${h}`);
  for (const f of fechas(principal)) if (!I.fs.some((g) => g.d === f.d && (!f.wd || !g.wd || g.wd === f.wd) && (!f.mes || !g.mes || g.mes === f.mes))) inventadas.push(`fecha ${f.wd || ''} ${f.d}${f.mes ? ` ${f.mes}` : ''}`.replace(/\s+/g, ' '));
  // (21 nov) también la diferencia de dos que sí están («le sacas 110 puntos»: 697 − 587), como con el dinero
  const ptsL = [...I.pts].filter((q) => q >= 10);
  const resta = (p) => p >= 2 && ptsL.some((a) => ptsL.some((b) => a !== b && Math.abs(a - b - p) < 0.06));
  for (const p of puntosDe(principal)) if (!I.pts.has(p) && !I.pts.has(Math.round(p)) && ![...I.pts].some((q) => Math.abs(q - p) < 0.06 || Math.round(q) === p) && !resta(p)) inventadas.push(`puntos ${String(p).replace('.', ',')}`);
  // jugadores de LaLiga que nombra y no le hemos pasado; nombres que no son de nadie
  const conocidos = [...(r.nombres || []), ...(r.clubes || []), ...(r.equipos || []), ...(r.apodos || [])].map(sinT).filter((x) => x.length >= 3);
  const tp = sinT(principal);
  for (const n of r.nombres || []) {
    const s = sinT(n);
    if (s.length < 4 || !new RegExp(`(^|[^a-z])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(tp)) continue;
    if (!I.texto.includes(s)) inventadas.push(`jugador ${n} (no está en los datos)`);
  }
  for (const n of nombresRaros(principal, I, conocidos)) inventadas.push(`nombre ${n}`);
  // forma
  if (INTERNO.test(principal)) marcas.push(`código o nombre interno («${principal.match(INTERNO)[0]}»)`);
  if (NOTAS.test(principal)) marcas.push('notas sin quitar');
  if (MODELOS.test(principal)) marcas.push(`nombra un modelo («${principal.match(MODELOS)[0]}»)`);
  if (/funci[oó]n top|desbloque|bloquead/i.test(principal)) marcas.push('«función top» o «desbloquear»');
  if (ASISTENTE.test(principal)) marcas.push(`frase de asistente («${principal.match(ASISTENTE)[0]}»)`);
  if (/<\/?[a-z]+[^>]*>/i.test(principal)) marcas.push('etiquetas HTML');
  const fr = frases(principal), palabras = principal.split(/\s+/).filter(Boolean).length;
  // (22 nov) si pide una lista entera (toda una plantilla, todas sus cláusulas), una línea por jugador no es irse de largo
  const pideLista = /toda su plantilla|todos sus jugadores|todas (mis|sus|las) cl[aá]usulas|qu[eé] cl[aá]usulas|lista entera|uno por uno/i.test(r.pregunta || '') && /^\s*[-•]/m.test(principal);
  if (fr.length > 6 && !pideLista) marcas.push(`largo: ${fr.length} frases`);
  if (/\?\s*$/.test(principal.trim())) marcas.push('acaba en pregunta');
  if (!principal.trim()) marcas.push('VACÍA');
  if (/no (tengo|veo) (acceso|la plantilla|el listado)|p[áa]same (la lista|sus jugadores)/i.test(principal)) marcas.push('dice que no ve los datos');
  // contra el veredicto de la app (sus ofertas y lo que no vendería hoy)
  const dt = String(r.datos || '');
  const noVender = [...dt.matchAll(/^- \w{3} \| ([^|]+?) \|[^\n]*LA APP: NO LO VENDER[ÍI]A HOY/gm)].map((m) => m[1].trim());
  const aconseja = [...dt.matchAll(/^- ([^(\n]+?) \(vale [^\n]*?→ la app aconseja ([A-ZÁÉÍÓÚ ]+?)(?=[:.]|$)/gm)].map((m) => ({ j: m[1].trim(), v: m[2].trim() }));
  const frasesDe = (n) => fr.filter((f) => sinT(f).includes(sinT(n).split(' ').pop()));
  for (const n of noVender) for (const f of frasesDe(n)) if (/\b(v[eé]ndelo|ponlo a la venta|vende a|lo vendes ya|vender ya)\b/i.test(f) && !/\bno\b/i.test(f)) marcas.push(`contradice a la app: manda vender a ${n} («NO LO VENDERÍA HOY»)`);
  // (la primera frase, si la pregunta va de ese jugador: «Sí, acéptala ahora.» no lo nombra)
  const enPregunta = (n) => sinT(r.pregunta || '').includes(sinT(n).split(' ').pop());
  for (const a of aconseja) for (const f of [...new Set([...frasesDe(a.j), ...(enPregunta(a.j) && fr[0] ? [fr[0]] : [])])]) {
    // (22 nov) «si aceptas la oferta, tendrías…» cuenta lo que pasaría, no manda aceptarla
    if (/ESPERAR|NO/.test(a.v) && /(ac[eé]ptal[ao]|acepta (ya|la oferta)|aceptar[ií]a|aceptarla)/i.test(f) && !/\bno\b/i.test(f.split(/[,;]/)[0]) && !/\b(si|aunque|cuando) (la |lo |no )?(acept|quier)/i.test(f)) marcas.push(`contradice a la app: manda aceptar la oferta por ${a.j} (la app: ${a.v})`);
    if (/ACEPTAR/.test(a.v) && /\b(no (la )?aceptes|rech[aá]zal[ao]|espera)\b/i.test(f)) marcas.push(`contradice a la app: no acepta la oferta por ${a.j} (la app: ${a.v})`);
  }
  // contra el plan: lo que le dice que haga hoy (sus notas) y no está en el plan de la app
  if (r.plan && r.plan.length && r.recomiendo && r.recomiendo.length && r.planCuenta) {
    // (22 nov) alinear no es un paso del plan: el once va aparte
    for (const x of r.recomiendo.filter((y) => y.accion !== 'alinear')) if (!r.plan.some((o) => sinT(o.jugador) === sinT(x.jugador) && (o.accion === x.accion || (o.accion === 'vender' && x.accion === 'aceptar_oferta')))) marcas.push(`fuera del plan: ${x.accion} ${x.jugador}`);
  }
  // lo que tiene que decir (o no) ese caso
  if (r.debe && !new RegExp(r.debe.source || r.debe, 'i').test(sinT(principal)) && !new RegExp(r.debe.source || r.debe, 'i').test(principal)) marcas.push(`no dice lo que debe (${r.debe.source || r.debe})`);
  if (r.noDebe && (new RegExp(r.noDebe.source || r.noDebe, 'i').test(principal))) marcas.push(`dice lo que no debe (${r.noDebe.source || r.noDebe})`);
  // (22 nov) lo que le cuenta el mánager: un hecho claro tiene que quedar apuntado de forma que mande en el plan, y no se
  // promete apuntar, quitar del plan o «tenerlo en cuenta» si no se ha guardado nada
  if (r.contado && !(r.corr || []).includes(r.contado)) marcas.push(`lo contado no manda en el plan (${r.contado})`);
  if (r.promete) marcas.push('promete apuntar o tenerlo en cuenta y no se guarda nada');
  return { inventadas: [...new Set(inventadas)], marcas: [...new Set(marcas)], frases: fr.length, palabras };
}

// suelto: un resumen de un respuestas-chat.json
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const L = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  let inv = 0, mar = 0;
  for (const x of L) {
    const c = cotejar(x);
    if (c.inventadas.length) inv++;
    if (c.marcas.length) mar++;
    if (c.inventadas.length || c.marcas.length) console.log(`${x.escena}/${x.id}: ${[...c.inventadas, ...c.marcas].join(' · ')}`);
  }
  console.log(`${L.length} respuestas: ${inv} con algo inventado, ${mar} con marcas`);
}
