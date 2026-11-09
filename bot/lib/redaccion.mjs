// Redactar desde los hechos (6 nov, Carlos: «que no se note que es automático»). En vez de pulir una plantilla (lib/pulir.mjs), la IA
// recibe los hechos ya comprobados de cada tuit (`t.hechos`, los saca cada tipo), la guía de voz y los ejemplos (lib/voz.mjs), los
// últimos tuits del mismo tipo y, si los hay, titulares y entradillas de prensa del partido, y escribe el tuit. La etiqueta final («✅
// Disponible para la jornada 12 contra el Valencia», el cierre…) la pone el código debajo. El validador ya no compara con la plantilla
// (ni líneas, ni orden): comprueba que lo que dice cuadra con los hechos. Lo que no pasa se pregunta otra vez con los errores; si
// tampoco, sale la plantilla. Con Claude (lib/ia.mjs, uso «redactar»); sin Claude, no hace nada.
import { limitarDatos, apuntarTexto, MEDIA } from './datos-jugador.mjs';
import { norm, peso, limite, copia, trozoCopiado, APODOS, corto, esEtiquetaFinal, CIERRES } from './texto.mjs';
import { validar } from './validar.mjs';
import { preguntar, conClaude, sinCupo, estimarCoste, MODELOS } from './ia.mjs';
import { GUIA, EJEMPLOS, ejemplosPara } from './voz.mjs';
import { ARRANQUES, VAGAS, PROHIBIDO, EMOJIS_GUIA, segunTrasCifra, nombresEn, nombresDe } from './pulir.mjs';
import { NOMBRES_MEDIOS, PRENSA_SIN_MEDIO, reglaPrensa } from './prensa.mjs';
import { ESTADIOS } from './hechos.mjs';
import { revisarConIA, SISTEMA as SISTEMA_REVISOR } from './revisor.mjs';
import { comoLeLlaman } from './apodos-jugadores.mjs';
import { banderasEn } from './nacionalidad.mjs';

const EMOJI = /\p{Extended_Pictographic}/gu;
const emojis = (s) => [...String(s).matchAll(EMOJI)].map((m) => m[0]);
const CIRCULOS = /[🔴🟠🟡🟢🔵🟣🟤⚫]/u;
// lo que no se le pasa a la IA ni cuenta para las cifras (la fecha del partido va como «cuando»)
const sinFecha = (k, v) => (k === 'fecha' || k === 'etiqueta' ? undefined : v);
const TOPES_CIFRAS = { previa: { pct: 2, media: 1 }, noticias: { pct: 1, media: 1 }, novedades: { pct: 1, media: 1 }, mercado: { pct: 4, media: 1 }, otro: { pct: 2, media: 1 } };
const COMUNES = new Set(['blanco', 'moreno', 'rubio', 'bueno', 'leal', 'santos', 'alba', 'luna']);
const frases = (s) => String(s).split(/(?<=[.!?:;])\s+|\n+/).map((x) => x.trim()).filter(Boolean);

export const TIPOS_SELECCIONES = new Set(['selecciones', 'selecciones-dia']);
/** las banderas de los hechos con el nombre de su selección: Map(bandera → nombre) (claves `bandera` con `seleccion` y `banderaRival` con `rival`) */
export function banderasDe(hechos) {
  const m = new Map();
  const ver = (o) => {
    if (Array.isArray(o)) { o.forEach(ver); return; }
    if (!o || typeof o !== 'object') return;
    if (o.bandera && o.seleccion) m.set(o.bandera, o.seleccion);
    if (o.banderaRival && o.rival) m.set(o.banderaRival, o.rival);
    Object.values(o).forEach(ver);
  };
  ver(hechos);
  return m;
}
/** lo que está mal en las banderas de un tuit (lista vacía si nada) */
export function erroresBanderas(t, hechos = {}) {
  const bs = banderasEn(t);
  if (!bs.length) return [];
  if (!TIPOS_SELECCIONES.has(hechos.tipo)) return ['banderas de países: solo en los tuits de selecciones'];
  const e = [], de = banderasDe(hechos), vistas = new Map();
  for (const m of String(t).matchAll(/[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F}/gu)) {
    const b = m[0], nombre = de.get(b);
    vistas.set(b, (vistas.get(b) || 0) + 1);
    if (!nombre) { e.push(`la bandera ${b} no es de ninguna selección de los hechos`); continue; }
    if (vistas.get(b) === 2) e.push(`la bandera de ${nombre} sale más de una vez (una sola, la primera vez que la nombras)`);
    const antes = ` ${norm(String(t).slice(Math.max(0, m.index - 40), m.index))} `;
    if (!antes.endsWith(` ${norm(nombre)} `)) e.push(`la bandera ${b} va justo detrás del nombre de su selección («${nombre} ${b}»), no suelta ni detrás de otra palabra`);
  }
  return e;
}

/** los nombres con los que se puede llamar a un club en el tuit (y su emoji, si tiene uno que se entienda) */
export function nombresClub(eq) {
  const c = corto(eq);
  const ap = APODOS[c];
  return ap ? { nombres: ap.a, emoji: ap.e[0] || null } : { nombres: [`el ${c}`], emoji: null };
}

// --- el validador ---------------------------------------------------------------------------------------------------------

// las palabras de estado, por familia: lo que no puede decirse de un jugador que está en otra
const PALABRAS = {
  baja: /\b(baja|bajas|se cae|se caen|descartad[oa]s?|no estar[áa]n?|se pierden?|fuera de la convocatoria|no jugar[áa]n?)\b/iu,
  duda: /\b(duda|dudas|en el aire|tocad[oa]s?)\b/iu,
  disponible: /\b(disponibles?|recuperad[oa]s?|de vuelta|recibe el alta|ya est[áa] listo)\b/iu,
};
// lo que no puede decirse de cada estado (las familias de arriba)
const CHOCA = { disponible: ['baja', 'duda'], vuelve: ['baja'], duda: ['baja', 'disponible'], baja: ['disponible', 'duda'], lesionado: ['disponible'], sancionado: ['disponible', 'duda'] };
// «no está descartado», «ya no es duda», «sin dudas»: la negación cambia el sentido
const negada = (frase, re) => {
  const m = frase.match(re);
  if (!m) return true;
  const antes = norm(frase.slice(Math.max(0, m.index - 22), m.index));
  return /\b(no|ni|sin|ya no|deja de estar en|deja de ser|dejar atras la|tras la|tras su|despues de la|adios a la)\s*$/.test(antes) || /\b(no|sin)\b/.test(antes.split(' ').slice(-3).join(' '));
};

/** todas las cifras de los hechos y de las crónicas (lo único que puede salir en el texto) */
export function cifrasDe(...cosas) {
  const out = new Set();
  for (const c of cosas) for (const n of JSON.stringify(c ?? '', sinFecha).match(/\d+/g) || []) out.add(Number(n));
  return [...out];
}

/** los otros nombres de cada jugador de los hechos (`tambienSeLeLlama`, lib/apodos-jugadores.mjs), aunque el tipo no los haya puesto */
export function conApodos(hechos) {
  for (const j of (hechos && hechos.jugadores) || []) if (j && j.nombre && !j.tambienSeLeLlama) { const xs = comoLeLlaman(j.nombre); if (xs.length) j.tambienSeLeLlama = xs; }
  return hechos;
}
// siglas que pueden ir en mayúsculas siempre, y las palabras de un grito de gol (con momentoParaCelebrar)
const SIGLAS = new Set(['var', 'mvp', 'rcd', 'ud', 'cf', 'ca', 'fc', 'sd', 'cd', 'rc', 'ad', 'pts', 'j']);
const GRITOS = new Set(['golazo', 'gol', 'golito', 'que', 'en', 'el', 'la', 'lo', 'los', 'las', 'de', 'del', 'al', 'a', 'y', 'su', 'se', 'le', 'da', 'con', 'por', 'sobre', 'ultimo', 'ultima',
  'minuto', 'descuento', 'bocina', 'final', 'falta', 'volea', 'cabeza', 'vuelta', 'remontada', 'remonta', 'triplete', 'doblete', 'empata', 'empate', 'gana', 'locura', 'tremendo',
  'brutal', 'lejos', 'toma', 'vaya', 'ojo', 'agonico', 'agonica', 'clava', 'mete', 'joya', 'obra', 'arte', 'tiro', 'zapatazo']);
/** los textos de unos hechos (los valores, no las claves: «gol» o «pts» como clave no permiten un nombre; A10) */
export function textosDe(o, out = []) {
  if (Array.isArray(o)) o.forEach((x) => textosDe(x, out));
  else if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) if (k !== 'fecha' && k !== 'etiqueta') textosDe(v, out); }
  else if (o != null) out.push(String(o));
  return out;
}
/** las palabras con mayúscula que pueden salir: las de los hechos, las crónicas usadas, los medios y unas fijas */
function vocabulario(hechos, cronicas) {
  const s = new Set(['laliga', 'fantasy', 'manager', 'primera', 'segunda', 'champions', 'copa', 'europa', 'conference', 'liga', 'rey', 'var', 'mvp',
    'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre', 'all', 'in']);
  const txt = textosDe(hechos).join(' ') + ' ' + cronicas.map((c) => `${c.medio} ${c.titulo} ${c.entradilla}`).join(' ') + ' ' + NOMBRES_MEDIOS.join(' ');
  for (const w of norm(txt).split(' ')) if (w) s.add(w);
  return s;
}

/** el esqueleto de un tuit para compararlo con otros: sin nombres, sin cifras, sin emojis y sin la primera palabra de cada párrafo
    que sea un nombre */
export function esqueleto(texto, nombres = []) {
  let t = ` ${norm(texto.replace(EMOJI, ' '))} `;
  // (los estadios también cuentan como nombre: «La Rosaleda recibe…» y «El Sadar recibe…» son la misma entrada; 6 nov)
  nombres = [...nombres, ...Object.values(ESTADIOS).map((x) => norm(x).replace(/^(el|la) /, ''))];
  for (const n of [...nombres].sort((a, b) => b.length - a.length)) if (n.length >= 3) t = t.split(` ${n} `).join(' X ');
  return t.replace(/\b\d+\b/g, 'N').replace(/\b(el|la|los|las|del|al)\b/g, 'A').replace(/\s+/g, ' ').trim();
}
const gramas = (t, n = 4) => { const w = t.split(' '); const s = new Set(); for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' ')); return s; };
/** cuánto se parecen dos tuits (0 a 1): grupos de 4 palabras en común sobre los del más corto, sin nombres ni cifras */
export function parecido(a, b, nombres = []) {
  const ga = gramas(esqueleto(a, nombres)), gb = gramas(esqueleto(b, nombres));
  if (!ga.size || !gb.size) return 0;
  let c = 0; for (const x of ga) if (gb.has(x)) c++;
  return c / Math.min(ga.size, gb.size);
}
/** las muletillas de los recientes: grupos de 5 palabras (sin nombres ni cifras, con al menos tres palabras de verdad) que se repiten en
    3 o más de ellos. [{ esq, txt }] (txt, para decírselo a la IA) */
export function muletillas(recientes, nombres = []) {
  if (recientes.length < 3) return [];
  const real = (g) => g.split(' ').filter((w) => !['X', 'N', 'A'].includes(w) && w.length > 2).length >= 3;
  const cuenta = new Map();
  for (const r of recientes) for (const g of gramas(esqueleto(r, nombres), 5)) if (real(g)) cuenta.set(g, (cuenta.get(g) || 0) + 1);
  return [...cuenta].filter(([, n]) => n >= 3).map(([esq]) => ({ esq, txt: esq.replace(/\bX\b/g, '…').replace(/\bA\b/g, 'el').replace(/\bN\b/g, 'n') }));
}
const entrada = (t, nombres) => esqueleto(t, nombres).split(' ').slice(0, 3).join(' ');

/**
 * ¿vale el texto redactado? [] si sí; si no, los motivos (se le devuelven a la IA para que lo arregle).
 * `todos`: los nombres de todos los jugadores y clubes de LaLiga (nombresDe); `recientes`: los últimos textos del mismo tipo.
 */
// atribuir a un medio con un verbo («cuenta que», «informa el…»): en un final o un MVP no hay medio al que atribuir nada
const ATRIBUYE = /\b(cuenta|cuentan|informa|informan|asegura|aseguran|avanza|avanzan|desvela|desvelan|revela|revelan|apunta|apuntan)\s+(que|el|la|los|las)\b/i;
// una lesión: solo si los hechos la traen (un jugador lesionado, unas molestias, un parte); en cualquier tipo de tuit
const LESION_DICE = /\b(?:lesion|lesiones|lesionad[oa]s?|se lesiona\w*|molestias|en camilla|cojeando)\b/;
const LESION_HAY = /\b(?:lesion\w*|molestias|tocad\w*|rotura|esguince|parte medico|retirad\w*|lesionad\w*|injured|doubtful|vuelve|vuelta|recuperad\w*|alta)\b/;
// sucesos de un partido que solo pueden salir si están en los hechos: [lo que dice el texto, lo que tiene que haber en los hechos, cómo se llama]
const SUCESOS = [
  [/\bpenalt(?:i|is|y)\b/, /\bpenalti\b/, 'penalti'],
  [/\b(?:parad[ao]s?|paro|paraba|paraban|detuvo|detuvieron|detiene|ataj\w+)\b/, /\bpenalti parado\b/, 'una parada'],
  [/\b(?:expuls\w+|roja|rojas)\b/, /\b(?:roja|expuls\w+)\b/, 'una expulsión'],
  [/\b(?:autogol\w*|propia puerta)\b/, /\b(?:enpropia|autogol)\b/, 'un autogol'],
  [/\bvar\b/, /\bvar\b/, 'el VAR'],
  // (revisión total, A10: «Mbappé se marchó lesionado» pasaba en un final sin ninguna lesión en los hechos)
  [LESION_DICE, LESION_HAY, 'una lesión'],
];
// el directo también mira el doblete y el triplete: solo si el gol lo es (subtipo, «golNumeroDelJugador»)
const SUCESOS_DIRECTO = [[/\b(?:doblete|triplete|hat ?trick|su segundo gol|su tercer gol)\b/, /\b(?:doblete|triplete|golnumerodeljugador|segundo gol|tercer gol)\b/, 'un doblete o un triplete']];
/** los sucesos que cuenta el texto y no están en los hechos (vacío si todo lo que cuenta está) */
export function sucesosSinHechos(texto, hechos) {
  const t = norm(texto), h = norm(JSON.stringify(hechos, sinFecha));
  const lista = (hechos && hechos.tipo) === 'directo' ? [...SUCESOS, ...SUCESOS_DIRECTO] : SUCESOS;
  return lista.filter(([dice, hay]) => dice.test(t) && !hay.test(h)).map((x) => x[2]);
}

// --- las cifras, con sus decimales y con su jugador (revisión total, A10) ---------------------------------------------------
// El validador de siempre (validar.mjs) parte «3,6» en 3 y 6, así que «3,6 de media» pasaba con un 6,3 en los hechos; y daba por buena
// cualquier cifra que estuviera en algún sitio de los hechos, sin mirar de quién era: con el Valencia 0-3 Madrid del 7 nov, los puntos
// de Valverde puestos a Arda Güler pasaban.
const valorDe = (s) => String(Number(String(s).replace(',', '.')));
/** los números de unos datos (objetos o textos), con sus decimales enteros: «6,3» y 6.3 → '6.3'; 30 → '30' */
export function numerosDe(...cosas) {
  const out = new Set();
  for (const c of cosas) for (const m of (typeof c === 'string' ? c : JSON.stringify(c ?? '', sinFecha)).match(/\d+(?:[.,]\d+)?/g) || []) out.add(valorDe(m));
  return out;
}
const sinTeclas = (s) => String(s).replace(/[0-9#*]️?⃣/g, ' ');
/** los decimales del texto que no están en los hechos ni en la prensa (un «3,6» por un 6,3) */
export function decimalesSinHechos(texto, hechos = {}, cronicas = []) {
  const hay = numerosDe(hechos, ...cronicas.map((c) => `${c.titulo} ${c.entradilla}`));
  return [...new Set(sinTeclas(texto).match(/\d+,\d+/g) || [])].filter((d) => !hay.has(valorDe(d)));
}
// el texto en minúsculas y sin tildes con el mismo largo (para buscar nombres y saber dónde caen)
const plegar = (s) => [...String(s)].map((c) => { const x = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return x.length === c.length ? x : c; }).join('');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const palabraRe = (k) => new RegExp(`(?<![\\p{L}\\d])${escRe(k)}(?![\\p{L}\\d])`, 'gu');
const PARTICULAS = new Set(['el', 'la', 'los', 'las', 'del', 'de', 'da', 'do', 'dos', 'van', 'von', 'der', 'den', 'ben']);
/** con qué palabras se nombra a cada jugador (las que solo son suyas: dos «Williams» no cuentan) */
function clavesDe(js) {
  const de = js.map((j) => {
    const ks = new Set();
    for (const n of [j.nombre, ...(j.tambienSeLeLlama || [])]) {
      const x = norm(n);
      if (x.length >= 3) ks.add(x);
      for (const w of x.split(' ')) if (w.length >= 3 && !PARTICULAS.has(w)) ks.add(w);
    }
    return ks;
  });
  const cuenta = new Map();
  for (const ks of de) for (const k of ks) cuenta.set(k, (cuenta.get(k) || 0) + 1);
  return de.map((ks) => [...ks].filter((k) => cuenta.get(k) === 1));
}
/** dónde se nombra a cada jugador en una frase: [{ ini, fin, i }] por orden, sin solapes (gana el nombre más largo) */
function menciones(frase, claves) {
  const f = plegar(frase), ms = [];
  claves.forEach((ks, i) => { for (const k of ks) for (const m of f.matchAll(palabraRe(k))) ms.push({ ini: m.index, fin: m.index + m[0].length, i }); });
  ms.sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  const out = [];
  for (const m of ms) if (!out.length || m.ini >= out[out.length - 1].fin) out.push(m);
  return { ms: out, f };
}
// una lista de nombres («Valverde y Arda suman…», «Mbappé, Vinícius y Bellingham»): lo que va con ellos vale para cualquiera
const LISTA = /^[\s,]*(?:y|e)?[\s,]*$/;
function grupo(ms, k, f) {
  const g = new Set([ms[k].i]);
  for (let a = k; a > 0 && LISTA.test(f.slice(ms[a - 1].fin, ms[a].ini)); a--) g.add(ms[a - 1].i);
  for (let a = k; a < ms.length - 1 && LISTA.test(f.slice(ms[a].fin, ms[a + 1].ini)); a++) g.add(ms[a + 1].i);
  return [...g];
}
/**
 * Las cifras puestas a otro jugador: cada número que solo es de un jugador de los hechos (no del partido, de los clubes ni de la prensa)
 * tiene que ir con él. Con quién va: el último jugador nombrado antes en la frase (o, si no hay, el primero de después; y si la frase no
 * nombra a nadie, el de la frase de antes). Devuelve los motivos (vacío si todo cuadra).
 */
export function cifrasCambiadas(texto, hechos = {}, cronicas = []) {
  const js = ((hechos && hechos.jugadores) || []).filter((j) => j && j.nombre);
  if (js.length < 2) return [];
  const { jugadores, ...resto } = hechos;
  const general = numerosDe(resto, ...cronicas.map((c) => `${c.titulo} ${c.entradilla}`));
  const suyas = js.map((j) => numerosDe(j));
  const claves = clavesDe(js);
  const e = [];
  let antes = null;
  for (const fr of frases(sinTeclas(texto))) {
    const { ms, f } = menciones(fr, claves);
    for (const m of fr.matchAll(/\d+(?:,\d+)?/g)) {
      const x = valorDe(m[0]);
      if (general.has(x)) continue;
      const duenos = suyas.map((s, i) => (s.has(x) ? i : -1)).filter((i) => i >= 0);
      if (!duenos.length) continue;
      let k = -1;
      for (let a = 0; a < ms.length && ms[a].fin <= m.index; a++) k = a;
      if (k < 0 && ms.length) k = 0;
      const con = k >= 0 ? grupo(ms, k, f) : antes;
      if (!con || con.some((i) => duenos.includes(i))) continue;
      e.push(`«${fr.slice(0, 90)}»: el ${m[0]} es de ${duenos.map((i) => js[i].nombre).join(' o ')}, no de ${con.map((i) => js[i].nombre).join(' ni ')}: cada cifra con su jugador`);
    }
    if (ms.length) antes = grupo(ms, ms.length - 1, f);
  }
  return [...new Set(e)];
}
/** ¿sale el nombre con mayúscula en algún sitio? («Partido redondo» no es Redondo, del Elche: M12) */
export function conMayuscula(texto, nombre) {
  const t = String(texto), f = plegar(t);
  for (const m of f.matchAll(palabraRe(nombre))) if (/\p{Lu}/u.test(t[m.index])) return true;
  return false;
}

// lo que es un hecho del club y no de un medio: «es oficial», «lo ha comunicado el club» (A10: «Es oficial» salía con solo AS)
const OFICIAL = /\b(?:es oficial|ya es oficial|oficialmente|de forma oficial|comunicado oficial|parte medico oficial|(?:lo )?ha(?:n)? (?:comunicado|confirmado|anunciado|informado) el club|(?:confirma|comunica|anuncia|informa) el club|segun (?:ha comunicado )?el club)\b/;
// «el club» de una fuente no es una palabra vaga (M12: «lo ha comunicado el club» se tiraba por «el club»)
const CLUB_FUENTE = /\b(?:(?:lo |y así lo |como lo )?ha(?:n)? (?:comunicado|confirmado|anunciado|informado)|como ha (?:comunicado|confirmado|informado)|seg[uú]n (?:ha comunicado )?|(?:confirma|comunica|anuncia|informa))\s+el club\b|\bel club\s+(?:lo\s+)?ha\s+(?:comunicado|confirmado|anunciado|informado)\b/giu;
// frases hechas que llevan «baja» o «duda» y no hablan del estado de nadie (M12: «baja los brazos», «sin ninguna duda»)
const FRASES_HECHAS = /\b(?:baj(?:a|an|ar|o|ó)\s+(?:los\s+brazos|el\s+ritmo|el\s+pist[oó]n|la\s+guardia|el\s+nivel|de\s+(?:rendimiento|nivel|intensidad))|(?:sin|no hay|no cabe)\s+(?:ninguna\s+)?duda)\b/giu;
// faltar al respeto a una persona (M14: «entrada criminal» pasaba): se cuenta lo que pasa sin insultar ni descalificar a nadie
const SIN_RESPETO = /\b(?:criminal(?:es)?|asesin[oa]s?|carnicer[oa]s?|mat[oó]n(?:es)?|salvajada|sinverg[uü]enzas?|vergonzos[oa]s?|payas[oa]s?|ladr[oó]n(?:es|a)?|tongo|atraco|robo arbitral|impresentables?|pat[eé]tic[oa]s?)\b/iu;
// los puntos de un partido en juego son de momento (M12: «Roja para Gayá… se queda en -5 puntos» y en el final fueron -3)
// un % de titularidad atribuido a la app: «58 % de titularidad en Fantasy Manager», «según Fantasy Manager», «Fantasy Manager le da un 72 %»
export const FM_PCT = /\d\s?%[^.\n]{0,40}?\b(?:en|seg[uú]n|de)\s+Fantasy Manager\b|\bFantasy Manager\s+(?:solo\s+)?(?:le|lo|la)\s+(?:da|daba|otorga|concede|pone)\b[^.\n]{0,25}?\d\s?%/iu;
const PROVISIONAL = /\b(?:de momento|por ahora|hasta ahora|ya suma|ya va por|ya lleva|lleva -?\d|provisional(?:es)?|a falta de|mientras tanto)\b/iu;

// «hoy», «esta tarde», «esta noche» de un partido que ya ha empezado (8 nov, Barrenetxea: «llega con dudas al partido de esta tarde» a las
// 18:06 de un partido de las 16:15). Y si el equipo ya jugó hoy (`partido.yaJugoHoy`), nada de «esta tarde», «esta noche» ni «hoy a las».
const HOY = /\b(hoy|esta tarde|esta noche|esta mañana)\b/i, HOY_HORA = /\b(esta tarde|esta noche|hoy a las)\b/i;
export function deHoyMal(texto, hechos, ahora = Date.now()) {
  const p = (hechos && hechos.partido) || {};
  const f = Date.parse(p.fecha || '');
  if (Number.isFinite(f) && f <= ahora && HOY.test(texto)) return `habla de «${texto.match(HOY)[0]}» de un partido que ya ha empezado`;
  if (p.yaJugoHoy && HOY_HORA.test(texto)) return `dice «${texto.match(HOY_HORA)[0]}» y su equipo ya ha jugado hoy: el partido del que se habla es el siguiente`;
  return null;
}
// (9 nov, Lamine Yamal con la J13 a 11 días) con la jornada a más de 3 días, nada de esperar o mirar los onces ni de «este finde»
export const ONCES_YA = /\b(?:esperar?|espera|aguarda(?:r)?|aguanta(?:r)?\s+hasta|hasta\s+que\s+(?:salgan|se\s+conozcan|haya))\b[^.\n]{0,25}?\bonces?\b|\b(?:mira(?:r)?|revisa(?:r)?|consulta(?:r)?|ver|vigila(?:r)?|atento\s+a)\s+(?:a\s+)?(?:los|el|tu)\s+onces?\b|\bonces?\s+(?:probables|confirmados)\b|\bpendientes?\s+de(?:l|\s+los)\s+onces?\b|\beste\s+(?:fin\s+de\s+semana|finde)\b|\bantes\s+de\s+(?:cerrar|hacer|tocar)\s+(?:el|tu)\s+once\b/iu;
// cuándo es el partido, dicho de alguna forma: una fecha, «tras el parón», «dentro de 11 días»…
const FECHA_DICHA = /\b(?:tras|despu[eé]s\s+del?)\s+(?:el\s+)?par[oó]n\b|\ba\s+la\s+vuelta\b|\bcuando\s+vuelva\s+la\s+liga\b|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d{1,2}\b|\b(?:dentro\s+de|en|faltan|quedan)\s+(?:\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince)\s+d[ií]as\b/iu;
/** el partido del que hablan los hechos si está a más de 3 días, o null */
export function partidoLejos(hechos, ahora = Date.now()) {
  const p = (hechos && hechos.partido) || null, f = Date.parse((p && p.fecha) || '');
  return p && Number.isFinite(f) && f - ahora > 3 * 864e5 ? p : null;
}
/** los fallos de un tuit que habla de un partido lejano (el parón) como si fuera ya */
export function erroresLejos(t, hechos, ahora = Date.now()) {
  const p = partidoLejos(hechos, ahora);
  if (!p) return [];
  // sin la etiqueta del final («⁉️ Duda para la jornada 13 contra el Villarreal»), que pone el sistema
  t = cuerpoDe(t);
  const e = [], dias = Math.round((Date.parse(p.fecha) - ahora) / 864e5), J = p.jornada != null ? `la jornada ${p.jornada}` : 'el partido';
  const m = t.match(ONCES_YA);
  if (m) e.push(`«${m[0]}» con ${J} a ${dias} días: no hay onces que esperar; di la fecha o «tras el parón» y nada de qué hacer antes de la jornada`);
  // el rival sin decir cuándo («lo normal es que salga contra el Villarreal» a 11 días)
  const mios = new Set((hechos.jugadores || []).map((j) => corto(j.club || '')));
  const rivales = [p.local, p.visitante].filter((x) => x && !mios.has(corto(x)));
  const nombres = rivales.flatMap((r) => [corto(r), ...((((hechos.clubes || {})[corto(r)]) || {}).nombres || [])]).map((n) => norm(n).replace(/^(?:el|la|los|las)\s+/, '')).filter((n) => n.length >= 3);
  const nt = ` ${norm(t)} `;
  // (solo en el parón o a más de 6 días: entre semana, «el sábado contra el Villarreal» ya se entiende sin fecha)
  if ((p.trasElParon || dias > 6) && nombres.some((n) => nt.includes(` ${n} `)) && !FECHA_DICHA.test(t)) e.push(`nombra al rival de ${J} sin decir cuándo es: faltan ${dias} días, di la fecha («${p.fechaDelPartido || 'el día'}») o «tras el parón»`);
  return e;
}
// lo de la selección («se pierde los partidos con su selección»): no es una baja para LaLiga (9 nov)
const DE_SELECCION = /\b(?:se\s+pierde|se\s+perder[aá]|no\s+estar[aá]|no\s+jugar[aá]|se\s+cae\s+de|baja\s+(?:con|en|para))\s+[^.\n]{0,30}?\b(?:selecci[oó]n|concentraci[oó]n|par[oó]n)\b/giu;

export function revisar(texto, { hechos, cronicas = [], recientes = [], todos = [], max = limite(), numeros = [], ahora = Date.now() } = {}) {
  const e = [];
  const t = String(texto || '').trim();
  if (!t) return ['texto vacío'];
  const hoyMal = deHoyMal(t, hechos, ahora);
  if (hoyMal) e.push(hoyMal);
  e.push(...erroresLejos(t, hechos, ahora));
  const v = validar(t, { numeros: [...new Set([...numeros, ...cifrasDe(hechos, cronicas)])], max });
  if (!v.ok) e.push(...v.errores);
  // los decimales, enteros («3,6» no es un 6,3) y cada cifra con su jugador (revisión total, A10)
  const decs = decimalesSinHechos(t, hechos, cronicas);
  if (decs.length) e.push(`decimales que no están en los hechos: ${decs.join(', ')} (¿le has dado la vuelta a una cifra?)`);
  e.push(...cifrasCambiadas(t, hechos, cronicas));
  // el directo no pasa por el revisor: solo las cifras del tuit de partida (marcador, minuto, puntos, su temporada) y la jornada
  if (hechos.tipo === 'directo' && numeros.length) {
    const deLaPlantilla = new Set([...numeros, hechos.jornada].filter((x) => x != null).map((x) => String(Math.abs(Number(x)))));
    const nuevas = [...new Set((sinTeclas(t).match(/\d+/g) || []).map((x) => String(Number(x))))].filter((x) => !deLaPlantilla.has(x));
    if (nuevas.length) e.push(`en directo solo van las cifras del tuit de partida: ${nuevas.join(', ')} no sale en él`);
  }
  const tn = norm(t), hn = norm(textosDe(hechos).join(' '));
  // nombres: solo los de los hechos (jugadores y clubes, con los nombres permitidos de cada club)
  const permitidos = new Set();
  for (const j of hechos.jugadores || []) { permitidos.add(norm(j.nombre)); for (const w of norm(j.nombre).split(' ')) if (w.length >= 4) permitidos.add(w); }
  for (const c of Object.values(hechos.clubes || {})) for (const n of c.nombres || []) { const x = norm(n).replace(/^(el|la) /, ''); permitidos.add(x); }
  for (const c of Object.keys(hechos.clubes || {})) permitidos.add(norm(c));
  for (const c of cronicas) for (const w of norm(`${c.titulo} ${c.entradilla}`).split(' ')) permitidos.add(w);
  // (de los demás textos de los hechos, las palabras de 4 letras o más: con las de 3, cualquier «Gil» o «Rui» pasaba; A10)
  for (const x of textosDe(hechos)) { const nx = norm(x); if (nx.length >= 3) permitidos.add(nx); for (const w of nx.split(' ')) if (w.length >= 4) permitidos.add(w); }
  for (const j of hechos.jugadores || []) for (const n of j.tambienSeLeLlama || []) { permitidos.add(norm(n)); for (const w of norm(n).split(' ')) if (w.length >= 3) permitidos.add(w); }
  // (sin los nombres de los medios: «Mundo Deportivo» no es el Deportivo; primera prueba del 6 nov)
  const sinMedios = NOMBRES_MEDIOS.reduce((x, m) => x.split(m).join('·'.repeat(m.length)), t);
  // (un apodo de una palabra, solo con mayúscula: «Partido redondo» no es Redondo, del Elche, ni «baja los brazos» es nadie; M12)
  const fuera = nombresEn(sinMedios, todos).filter((n) => !permitidos.has(n) && !n.split(' ').every((w) => permitidos.has(w)) && (n.includes(' ') || conMayuscula(sinMedios, n)));
  if (fuera.length) e.push(`nombra a quien no está en los hechos: ${fuera.join(', ')}`);
  for (const j of (hechos.jugadores || []).filter((x) => x.principal)) {
    // vale cualquiera de sus nombres: el de LaLiga o los de `tambienSeLeLlama` («el Cuti», «Borja Iglesias»)
    const ws = [j.nombre, ...(j.tambienSeLeLlama || [])].flatMap((x) => norm(x).split(' ')).filter((w) => w.length >= 3 && !['el', 'la'].includes(w));
    if (!ws.some((w) => ` ${norm(t)} `.includes(` ${w} `))) e.push(`no nombra a ${j.nombre}`);
  }
  // palabras con mayúscula que no salen de ninguna parte (un entrenador, un estadio, un club que no está)
  const voc = vocabulario(hechos, cronicas);
  // la primera palabra de una frase también, si es un nombre de LaLiga (A10: «Arda Güler, sin marcar» o un «Mendy» de arranque no se miraban)
  const deLaLiga = new Set(todos.flatMap((n) => (n.includes(' ') ? n.split(' ').filter((w) => w.length >= 5) : [n])).filter((w) => w.length >= 3 && !ARRANQUES.has(w) && !COMUNES.has(w)));
  const raras = new Set();
  for (const f of frases(t.replace(EMOJI, ' ').replace(/[️‍]/g, ''))) {
    const ws = f.replace(/^[^\p{L}]+/u, '').split(/[^\p{L}]+/u).filter(Boolean);
    ws.forEach((w, i) => {
      if (!/^\p{Lu}/u.test(w)) return;
      if (/^\p{Lu}{2,}$/u.test(w)) return;              // las palabras enteras en mayúsculas se miran aparte (gritos, más abajo)
      const n = norm(w);
      if (voc.has(n) || (i === 0 && ARRANQUES.has(n))) return;
      if (i === 0 && !/^\p{Lu}{2,}/u.test(w) && !deLaLiga.has(n)) return;   // primera palabra de la frase: solo si es un nombre de LaLiga
      raras.add(w);
    });
  }
  if (raras.size) e.push(`palabras con mayúscula que no están en los hechos: ${[...raras].join(', ')}`);
  // (las que ya vienen en mayúsculas en los hechos, las crónicas o los medios valen: AS, MARCA, ESPN…)
  const enMayusFuente = new Set((`${JSON.stringify(hechos, sinFecha)} ${cronicas.map((c) => `${c.medio} ${c.titulo} ${c.entradilla}`).join(' ')} ${NOMBRES_MEDIOS.join(' ')}`).match(/\p{Lu}{2,}/gu) || []);
  // palabras enteras en MAYÚSCULAS (7 nov): solo en un directo con momentoParaCelebrar, una tanda corta al principio y con palabras de
  // grito o de los hechos; sin ese momento, ninguna (salvo siglas como VAR o MVP)
  const gritos = (t.replace(EMOJI, ' ').match(/\p{Lu}{2,}(?:\s+\p{Lu}{2,})*/gu) || []).map((x) => x.split(/\s+/)).flat().filter((w) => !SIGLAS.has(norm(w)) && !enMayusFuente.has(w));
  if (gritos.length) {
    if (!(hechos.momentoParaCelebrar && hechos.momentoParaCelebrar.length)) e.push(`mayúsculas sin un momento que lo merezca: ${gritos.join(' ')}`);
    else {
      if (gritos.length > 4) e.push(`demasiadas palabras en mayúsculas: ${gritos.join(' ')}`);
      const malas = gritos.filter((w) => !GRITOS.has(norm(w)) && !voc.has(norm(w)));
      if (malas.length) e.push(`mayúsculas con palabras que no salen de los hechos: ${malas.join(' ')}`);
    }
  }
  if (/[¡!?¿]{2,}/.test(t)) e.push('signos de exclamación o interrogación dobles');
  // el estado de cada jugador: en las frases que solo hablan de él, nada de otra familia
  const nombreDe = (j) => norm(j.nombre).split(' ').filter((w) => w.length >= 3);
  for (const f0 of frases(t)) {
    const f = f0.replace(FRASES_HECHAS, ' ').replace(DE_SELECCION, ' ');
    const nf = ` ${norm(f)} `;
    const suyos = (hechos.jugadores || []).filter((j) => j.estado && nombreDe(j).some((w) => nf.includes(` ${w} `)));
    if (suyos.length !== 1) continue;
    const j = suyos[0];
    for (const fam of CHOCA[j.estado] || []) if (PALABRAS[fam].test(f) && !negada(f, PALABRAS[fam])) e.push(`a ${j.nombre} (${j.estado}) se le llama «${f.match(PALABRAS[fam])[0]}»`);
  }
  // un estado que no es de nadie: «baja» sin ningún jugador de baja en los hechos
  const estados = new Set((hechos.jugadores || []).map((j) => j.estado));
  // (en el mercado «baja» es lo que baja de precio)
  // (y tampoco cuando lo que baja es un valor: «su valor baja 1,5 M», «baja 6 M»; los tuits de selecciones hablan del valor, 9 nov)
  const tBaja = t.replace(FRASES_HECHAS, ' ').replace(DE_SELECCION, ' ').replace(/\b(?:valor|valores|precio|precios|nota|notas)\b[^.\n]{0,30}?\bbajas?\b/giu, ' ').replace(/\bm[aá]s\s+bajas?\b/giu, ' ').replace(/\bbaja\s+(?:de\s+)?\d/giu, ' ');
  if (hechos.tipo !== 'mercado' && PALABRAS.baja.test(tBaja) && !negada(tBaja, PALABRAS.baja) && ![...estados].some((x) => ['baja', 'lesionado', 'sancionado', 'apercibido'].includes(x))) e.push(`dice «${tBaja.match(PALABRAS.baja)[0]}» y nadie está de baja`);
  // los equipos, con artículo (Carlos, 6 nov: «no es Osasuna, es el Osasuna»); en un marcador o un «Betis-Mallorca», no
  for (const c of Object.keys(APODOS)) {
    const re = new RegExp(`(^|[^\\p{L}-])(${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\p{L}-])`, 'gu');
    for (const m of sinMedios.matchAll(re)) {
      const antes = t.slice(Math.max(0, m.index - 7), m.index + m[1].length);
      const despues = t.slice(m.index + m[0].length, m.index + m[0].length + 4);
      if (/(\bel|\bla|\bdel|\bal|\bun|\buna|\bEl|\bLa|\bDel|\bAl|\bUn|\bUna)\s$/u.test(antes) || /-\s?$/.test(antes) || /^\s?(-|\d)/.test(despues) || /\d\s$/.test(antes)) continue;
      if (/\bReal\s$/.test(antes)) continue;
      e.push(`«${c}» sin artículo`);
      break;
    }
  }
  // «colista» y «líder» solo si hay un equipo en los hechos que lo es (6 nov: «el Levante, colista de hecho (18º)»)
  // (y en el final, el puesto de antes del partido, `antesDelPartido`: M12, «colista» y «líder» verdaderos se tiraban)
  const puestos = [...(hechos.equipos || []).map((x) => String(x.va || '').match(/^(\d+)º de (\d+)/)),
    ...Object.values(hechos.antesDelPartido || {}).map((x) => { const m = String(x).match(/^(\d+)º/); return m ? [m[0], m[1], '20'] : null; })].filter(Boolean);
  if (/\bcolista\b/i.test(t) && !puestos.some((m) => m[1] === m[2])) e.push('dice «colista» y ningún equipo de los hechos va último');
  if (/\bl[ií]der\b/i.test(t) && !puestos.some((m) => m[1] === '1')) e.push('dice «líder» y ningún equipo de los hechos va primero');
  // (Carlos, 6 nov: «lo de poner el % de titularidad siempre y los puntos medios no haría falta, suena demasiado a plantilla»)
  const tope = TOPES_CIFRAS[hechos.tipo] || TOPES_CIFRAS.otro;
  const nPct = (t.match(/\d\s?%/g) || []).length, nMedia = (t.match(/\bde media\b|\bpuntos por partido\b|\bmedia de \d/gi) || []).length;
  // (Carlos, 9 nov 09:12: «lo de que siempre diga los puntos de media no es bueno tampoco. Podría dar otros datos») dos tuits seguidos
  // del mismo tipo no dan los dos la media: si el último la llevaba, este cuenta otra cosa (lib/datos-jugador.mjs)
  if (nMedia && recientes.length && MEDIA.test(String(recientes[recientes.length - 1] || ''))) e.push('el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de «datoDestacado») o dilo con palabras, sin la cifra de la media');
  // (Carlos, 6 nov, con «Fantasy Manager le da un 97 %»: «falta DE TITULARIDAD») un % sin decir de qué no se entiende
  // y solo el primero (Carlos, 6 nov: «si pones varios porcentajes, que solo sea en el primero, que se entienda humano»): la frase del
  // primer % lleva «titularidad» detrás de él; los demás, sin repetirlo
  const pcts = [...t.matchAll(/\d\s?%/g)];
  // (solo si los hechos traen un % de titularidad: en el mercado los % son lo que sube o baja un valor)
  if (pcts.length && /"titularidad":/.test(JSON.stringify(hechos))) {
    const resto = t.slice(pcts[0].index).split(/(?<=[.!?])\s|\n/)[0];
    if (!/titularidad/i.test(resto)) e.push('el primer porcentaje va con «de titularidad» («un 97 % de titularidad»): un «97 %» suelto no se entiende');
    const repes = pcts.slice(1).filter((m) => /^\s?%\s+de\s+titularidad/i.test(t.slice(m.index + 1)));
    if (repes.length) e.push('«de titularidad» solo con el primer porcentaje; en los demás, el número solo («Ramon, con un 51 %»)');
  }
  // (Carlos, 9 nov, con Lamine Yamal: «58 % de titularidad en Fantasy Manager suena raro») el % a secas o nada
  if (FM_PCT.test(t)) e.push('el % de titularidad va a secas («un 58 % de titularidad»), sin «en Fantasy Manager», «según Fantasy Manager» ni «Fantasy Manager le da»');
  if (nPct > tope.pct) e.push(`${nPct} porcentajes: como mucho ${tope.pct}; el resto, con palabras («fijo», «lo tiene difícil», «en el aire»)`);
  if (nMedia > tope.media) e.push(`${nMedia} medias: como mucho ${tope.media}`);
  const tVaga = t.replace(CLUB_FUENTE, ' ');
  if (VAGAS.test(tVaga)) { VAGAS.lastIndex = 0; e.push(`nombra un club o un jugador con una palabra vaga («${(tVaga.match(VAGAS) || [])[0]}»)`); }
  VAGAS.lastIndex = 0;
  if (/conjunto\s+\p{Ll}/u.test(t)) e.push('«el conjunto…» en vez del nombre del club');
  if (/LaLiga Fantasy ya lo da/i.test(t)) e.push('«LaLiga Fantasy ya lo da…»');
  // (Carlos, 7 nov, con el de Zaid Romero: «LaLiga Fantasy pone a X como lesionado»… «nunca más digas eso») el estado es del jugador
  if (/LaLiga Fantasy\s+(?:ya\s+)?(?:le\s+|lo\s+|la\s+|los\s+|las\s+)?(?:pone|marca|da|deja|tiene|considera|cambia|saca|coloca|actualiza|incluye)\b[^.\n]{0,40}?\b(?:como|en duda|de baja|disponible|lesionad|sancionad)|LaLiga Fantasy\s+pone\s+a\b|(?:en|para)\s+LaLiga Fantasy\s+(?:ya\s+)?(?:sale|aparece|figura|está|lo\s+marcan|lo\s+dan)|(?:sale|aparece|figura|marcado)\s+(?:ya\s+)?como\s+\w+\s+en\s+LaLiga Fantasy/i.test(t)) e.push('el estado se atribuye a LaLiga Fantasy («LaLiga Fantasy pone a X como lesionado»): di lo que le pasa al jugador («está lesionado»)');
  // la previa (7 nov): primera frase corta y «en el aire» una sola vez
  if (hechos.tipo === 'previa') {
    const f1 = (t.replace(EMOJI, ' ').replace(/[\uFE0F\u200D]/g, '').trim().split(/(?<=[.!?])\s|\n/)[0]) || '';   // hasta el punto: los dos puntos no cortan
    const n1 = f1.split(/\s+/).filter(Boolean).length;
    if (n1 > 35) e.push(`la primera frase tiene ${n1} palabras: que sean 25 como mucho y con una sola idea (parte la hora, el estadio, la clasificación o la noticia en otra frase)`);
    if (/^\W*La (gran duda|duda más grande|mayor duda|clave)\b/i.test(f1)) e.push('abre con «La gran duda del X-Y» (o «la clave»): fórmula de plantilla; empieza por el jugador, el cruce o la baja, con tus palabras');
    if ((t.match(/\ben el aire\b/gi) || []).length > 1) e.push('«en el aire» más de una vez: solo una, y las demás con otras palabras («no tiene el puesto asegurado», «puede quedarse fuera»)');
  }
  if (/\b(disponible|duda|baja|sancionado|lesionado)s? fantasy\b/i.test(t)) e.push('«Fantasy» pegado a un estado');
  if (/\b(promedia|el encuentro se disputa|seg[uú]n informan|cabe destacar)\b/i.test(t)) e.push(`muletilla de nota de prensa («${t.match(/\b(promedia|el encuentro se disputa|seg[uú]n informan|cabe destacar)\b/i)[0]}»)`);
  // «según X» pegado a una cifra nuestra (la media, el %, la hora, el puesto): el trozo de frase justo antes del «según» (desde la última
  // coma, dos puntos o punto) no puede llevar una cifra de los hechos que no esté también en la prensa (el «0-6 ante el PSG, según la
  // SER» es del medio y vale)
  const deLosHechos = new Set(cifrasDe(hechos).map(String)), deLaPrensa = new Set(cifrasDe(cronicas).map(String));
  for (const m of t.matchAll(/\bseg[uú]n\s/gi)) {
    const antes = t.slice(0, m.index).replace(/[\s,]+$/, '').split(/[,.;:!?\n(]/).pop();
    const nuestras = (antes.match(/\d+/g) || []).filter((d) => deLosHechos.has(String(Number(d))) && !deLaPrensa.has(String(Number(d))));
    if (nuestras.length) { e.push(`«${antes.trim().slice(-60)}, según…»: el medio va pegado a una cifra que no es suya (la media, el %, la hora o el puesto son de los hechos); pon la fuente en otra frase o delante`); break; }
  }
  if (PROHIBIDO.test(t)) e.push('@, #, enlace, primera persona o adjetivo de anuncio');
  if ((t.match(/¡/g) || []).length > 1) e.push('demasiados «¡»');
  // los medios que nombra tienen que estar en los hechos o en las crónicas usadas
  const medios = NOMBRES_MEDIOS.filter((m) => new RegExp(`(^|[^\\p{L}])${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u').test(t));
  const fuentes = ` ${norm(JSON.stringify(hechos.fuente || '') + ' ' + cronicas.map((c) => c.medio).join(' '))} `;
  const sinFuente = medios.filter((m) => !fuentes.includes(` ${norm(m)} `));
  if (sinFuente.length) e.push(`nombra un medio que no es la fuente: ${sinFuente.join(', ')}`);
  // rigor (Carlos, 6 nov, final del Sevilla-Alavés: «Cuenta COPE que Sivera ha parado un penalti»): lo que pasa en un partido es un hecho y
  // no se le pone un medio delante (suena a que nadie lo ha comprobado), y un suceso (penalti, parada, roja, autogol, VAR) solo sale si está
  // en los hechos (goles o incidencias, de ESPN). Solo en finales y MVP: en noticias y previas el medio sí es la fuente.
  // los onces confirmados tampoco llevan medio (7 nov, Málaga-Racing: «Ya hay onces confirmados en La Rosaleda, según ESPN»)
  if (hechos.tipo === 'onces' && /\b(?:a las|sobre las|hacia las)\s+\d{1,2}(?::\d{2})?\b|\b\d{1,2}:\d{2}\b/i.test(t)) e.push('en unos onces confirmados no va la hora del reloj («a las 18:30»): si los hechos traen «empiezaEn», di lo que falta con esas palabras; si no, nada de la hora');
  if (hechos.tipo === 'onces' && /^\W*Ya hay onces\b/i.test(t) && recientes.some((r) => /^\W*Ya hay onces\b/i.test(r))) e.push('empieza por «Ya hay onces…» como otro tuit reciente: empieza por donde dice «abreCon», con tus palabras');
  if (hechos.tipo === 'onces' && (medios.length || ATRIBUYE.test(t) || /\bESPN\b|\bseg[uú]n\b/i.test(t))) e.push('en unos onces confirmados no se nombra ninguna fuente («según ESPN», «según MARCA»…): la alineación es un hecho y se cuenta tal cual');
  if (hechos.tipo === 'final' || hechos.tipo === 'mvp' || hechos.tipo === 'directo') {
    if (medios.length || ATRIBUYE.test(t)) e.push('en un final o un MVP no se atribuye nada a un medio («cuenta COPE», «según MARCA»…): lo que pasa en el partido es un hecho y se cuenta tal cual');
    const sucesos = sucesosSinHechos(t, hechos);
    if (sucesos.length) e.push(`cuenta sucesos que no están en los hechos (${sucesos.join(', ')}): no lo insinúes, ni siquiera atribuido a un medio`);
  }
  // «sin marcar» de uno que ha marcado en este partido (A10: «Arda Güler, sin marcar» con su gol en los hechos)
  const goleadores = (hechos.goles || []).map((g) => norm(g.goleador || '')).filter(Boolean);
  if (goleadores.length) for (const f of frases(t)) {
    const nf = ` ${norm(f)} `;
    if (!/\b(?:sin marcar|sin ver puerta|no marco|no vio puerta|se quedo sin marcar|se fue sin marcar)\b/.test(nf)) continue;
    const g = goleadores.find((x) => x.split(' ').some((w) => w.length >= 4 && nf.includes(` ${w} `)));
    if (g) e.push(`«${f.slice(0, 80)}»: dice que no marcó y en los hechos marca`);
  }
  // «es oficial» o «lo ha comunicado el club» solo si los hechos lo dan como del club (A10: «Es oficial» con solo AS)
  if (OFICIAL.test(tn) && !/\b(?:oficial\w*|comunicad[oa]|comunicado el club|parte medico|confirmad[oa] por el club)\b/.test(hn)) e.push('dice que es oficial o que lo ha comunicado el club y los hechos no lo dan como oficial: di de dónde sale de verdad');
  // respeto a las personas (M14)
  if (SIN_RESPETO.test(t)) e.push(`falta al respeto a una persona («${t.match(SIN_RESPETO)[0]}»): cuenta lo que pasa sin insultar ni descalificar a nadie`);
  // una lesión, solo si los hechos la traen (en final, MVP y directo lo mira sucesosSinHechos, más abajo)
  if (!['final', 'mvp', 'directo'].includes(hechos.tipo) && LESION_DICE.test(tn) && !LESION_HAY.test(hn)) e.push('habla de una lesión y los hechos no traen ninguna');
  // en juego, los puntos son de momento (M12)
  if (hechos.tipo === 'directo' && (hechos.partido || {}).estadoDelPartido === 'en juego' && /-?\d+\s*(?:puntos|pts)\b/i.test(t) && !PROVISIONAL.test(t)) e.push('con el partido en juego los puntos son de momento: dilo («de momento», «ya suma», «por ahora»)');
  // banderas (Carlos, 9 nov 10:13): solo en los tuits de selecciones, la de una selección de los hechos, justo detrás de su nombre y una
  // vez cada una. No cuentan como emojis de la guía ni de club (las dos letras regionales no son pictogramas; la negra de Inglaterra sí)
  e.push(...erroresBanderas(t, hechos));
  // emojis: uno de la guía al principio del primer párrafo, el de un club de los hechos detrás de su nombre (uno) y nada más
  const em = emojis(banderasEn(t).reduce((x, b) => x.split(b).join(' '), t));
  const deClub = new Set(Object.values(hechos.clubes || {}).map((c) => c.emoji).filter(Boolean));
  if (em.some((x) => CIRCULOS.test(x))) e.push('círculos de colores');
  const raros = em.filter((x) => !EMOJIS_GUIA.has(x) && !deClub.has(x) && !CIRCULOS.test(x));
  if (raros.length) e.push(`emojis que no están en la guía: ${raros.join(' ')}`);
  // emojis de club: o ninguno o el de cada club nombrado que tenga uno, una vez cada uno (Carlos, 7 nov 18:01: el Osasuna llevó 🐂 y el
  // Athletic se quedó sin 🦁; antes valía uno solo por tuit)
  const usados = em.filter((x) => deClub.has(x));
  if (usados.length) {
    const tn = ` ${norm(t)} `;
    for (const [c, d] of Object.entries(hechos.clubes || {})) {
      if (!d.emoji) continue;
      const n = usados.filter((x) => x === d.emoji).length;
      const nombrado = [c, ...(d.nombres || [])].some((x) => tn.includes(` ${norm(x).replace(/^(el|la|los|las) /, '')} `));
      if (n > 1) e.push(`el emoji ${d.emoji} sale más de una vez (una sola, la primera vez que nombras a ${c})`);
      else if (!n && nombrado) e.push(`si pones emojis de club, pon también el de ${c} (${d.emoji}) detrás de su nombre, o ninguno`);
    }
  }
  // el de un club, justo detrás de su nombre (en la prueba del 6 nov quedaban sueltos al final del párrafo: «…no es lo más apetecible. 🐟»)
  for (const [c, d] of Object.entries(hechos.clubes || {})) {
    if (!d.emoji) continue;
    for (const m of t.matchAll(new RegExp(d.emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gu'))) {
      const antes = ` ${norm(t.slice(Math.max(0, m.index - 40), m.index))} `;
      const nombres = [c, ...(d.nombres || [])].map((n) => norm(n).replace(/^(el|la) /, ''));
      if (!nombres.some((n) => antes.endsWith(` ${n} `))) e.push(`el emoji ${d.emoji} va justo detrás del nombre de su club, no suelto`);
    }
  }
  if (em.filter((x) => EMOJIS_GUIA.has(x)).length > 1) e.push('más de un emoji de la guía (solo uno, al principio)');
  if (hechos.sobrio && em.length) e.push('tono sobrio: sin emojis');
  // nada copiado: ni de las crónicas (6 palabras seguidas, como en tipos/noticias.mjs) ni de los ejemplos de la guía (8)
  for (const c of cronicas) { const g = trozoCopiado(t, `${c.titulo} ${c.entradilla}`, 6); if (g) e.push(`copia 6 palabras seguidas de ${c.medio} («${g}»): cuéntalo con tus palabras`); }
  for (const x of EJEMPLOS) { const g = trozoCopiado(t, x.texto, 8); if (g) { e.push(`copia un ejemplo de la guía («${g}…»): dilo con tus palabras`); break; } }
  // variedad: ni la misma entrada ni el mismo esqueleto que los últimos del tipo
  const nom = [...permitidos];
  // ni una muletilla que ya va en dos de los últimos («es el seguro bajo palos», «si dudas, mejor esperar a los onces»; 6 nov): un grupo de
  // 4 palabras (sin nombres ni cifras, con al menos dos palabras de verdad) que se repite en 2 o más de los recientes
  const mul = muletillas(recientes, nom).find((g) => gramas(esqueleto(t, nom), 5).has(g.esq));
  if (mul) e.push(`repite una muletilla que ya va en varios tuits recientes («${mul.txt}»): dilo de otra forma`);
  for (const r of recientes) {
    if (entrada(t, nom) && entrada(t, nom) === entrada(r, nom)) { e.push(`empieza igual que un tuit reciente («${r.split('\n')[0].slice(0, 60)}…»)`); break; }
    const p = parecido(t, r, nom);
    if (p >= 0.35) { e.push(`se parece demasiado a un tuit reciente (${Math.round(p * 100)} %: «${r.split('\n')[0].slice(0, 60)}…»)`); break; }
  }
  return [...new Set(e)];
}

// --- la pregunta ------------------------------------------------------------------------------------------------------------

const ESQUEMA = { type: 'OBJECT', required: ['texto'], properties: { texto: { type: 'STRING' }, cronicas: { type: 'ARRAY', items: { type: 'INTEGER' } } } };

export const sistemaDe = (tipo) => `${GUIA}\n\nEJEMPLOS (jugadores inventados: sirven por la forma; no copies frases ni datos):\n\n${ejemplosPara(tipo)}`;

export function prompt({ hechos, max, recientes = [], cronicas = [], errores = [], anterior = '', gastadas = [] }) {
  return [`Escribe el tuit de tipo «${hechos.tipo}» con estos hechos. Como mucho ${max} caracteres, mejor menos (sin contar la etiqueta, que va aparte: «${hechos.etiqueta || '(ninguna)'}»).`,
    `HECHOS:\n${JSON.stringify(hechos, sinFecha, 1)}`,
    // lo que más tumbaba los borradores en la prueba del 7 nov (19 previas): se recuerda justo antes de escribir
    (() => { const tp = TOPES_CIFRAS[hechos.tipo] || TOPES_CIFRAS.otro; return `ANTES DE ESCRIBIR: como mucho ${tp.pct} porcentaje${tp.pct > 1 ? 's' : ''} y ${tp.media} media en todo el tuit (el resto, con palabras); si un jugador trae «datoDestacado», ese es SU dato: cuéntalo con tus palabras y no le pongas además la media; ni «el equipo», «el club», «el rival» ni «enfrente»: el nombre; nada que no esté en los hechos${cronicas.length ? ' o en la prensa (y de la prensa, con tus palabras: ni seis seguidas iguales)' : ''}; ${hechos.tipo === 'resumen' ? 'lo que sí puedes contar es el ranking de los hechos (quién va primero, a cuánto de la media)' : 'ninguna comparación con el resto de la jornada'}.`; })(),
    recientes.length ? `ÚLTIMOS TUITS DE ESTE TIPO (no empieces igual ni sigas su orden):\n${recientes.map((r, i) => `${i + 1}. """${r}"""`).join('\n')}` : '',
    gastadas.length ? `FRASES YA GASTADAS (salen en varios de esos tuits; no las uses): ${gastadas.map((g) => `«${g.txt}»`).join(', ')}` : '',
    // (la regla, la misma que lee el revisor: lib/prensa.mjs, reglaPrensa; M12)
    cronicas.length ? `PRENSA DE ESTE PARTIDO (opcional). ${reglaPrensa(hechos.tipo)} Si usas algo, apunta en «cronicas» los números de las noticias que lo dicen${PRENSA_SIN_MEDIO.has(hechos.tipo) ? ' (mínimo dos)' : ''}:\n${cronicas.map((c, i) => `[${i}] ${c.medio}: ${c.titulo}. ${c.entradilla}`).join('\n')}` : '',
    // los puntos del directo, de momento (M12)
    hechos.tipo === 'directo' && (hechos.partido || {}).estadoDelPartido === 'en juego' ? 'EL PARTIDO SIGUE EN JUEGO: si das puntos, son de momento («ya suma», «de momento», «por ahora»), nunca como definitivos («se queda en»). Y ninguna cifra ni suceso que no venga en los hechos.' : '',
    errores.length ? `Tu versión anterior no vale:\n"""${anterior}"""\nPor esto: ${errores.join('; ')}. Escríbela otra vez arreglando eso.` : '',
  ].filter(Boolean).join('\n\n');
}

const nombresHechos = (h) => [...(h.jugadores || []).map((j) => norm(j.nombre)), ...Object.keys(h.clubes || {}).map(norm)];
/** los últimos textos publicados de un tipo (registro.datos.recientes, sin la etiqueta) y los de esta misma ejecución */
export function recientesDe(registro, tipo, n = 5) {
  const r = ((registro && registro.datos && registro.datos.recientes) || {})[tipo] || [];
  return r.slice(-n).map((x) => x.texto);
}
/** apunta un texto en los recientes de su tipo (al publicar, y en simulacro para la misma ejecución) */
export function apuntarReciente(registro, tipo, texto, t = new Date().toISOString()) {
  if (!registro || !registro.datos) return;
  const r = (registro.datos.recientes ||= {});
  r[tipo] = [...(r[tipo] || []), { t, texto: cuerpoDe(texto) }].slice(-5);
}
/** el tuit sin su última línea si es la etiqueta, el cierre o el pie de los % (lo que se compara para no repetir esqueleto) */
export function cuerpoDe(texto) {
  const ps = String(texto || '').trim().split(/\n\s*\n/);
  const ult = (ps[ps.length - 1] || '').trim();
  if (ps.length > 1 && (esEtiquetaFinal(ult) || CIERRES.includes(ult) || /fantasy manager/i.test(ult) && ult.length < 90)) ps.pop();
  return ps.join('\n\n');
}

/**
 * Redacta en el sitio los tweets que traen `hechos` (t.texto pasa a ser el redactado, t.plantilla guarda el de antes).
 * `cronicasDe(t)` da la prensa del partido de un tweet (o []). Devuelve cuántos ha redactado.
 */
export async function redactar(tweets, { tipo, registro = null, config = {}, jugadores = [], equipos = {}, log = console.log, ahora = Date.now(),
  pedir = preguntar, cronicasDe = () => [], forzar = false, revisor = revisarConIA } = {}) {
  const cfg = config.redactar || {};
  const activo = forzar || process.env.BOT_REDACTAR === '1' || cfg.activo === true;
  const xs = tweets.filter((t) => t && t.hechos);
  if (!activo || !xs.length || !(cfg.tipos || []).includes(tipo)) return 0;
  if (!conClaude(config) && !(config.ia || {}).geminiRedacta) { for (const t of xs) t.redaccion = 'sin-ia'; log(`  (redactar) sin Claude: ${tipo} sale con la plantilla`); return 0; }
  // sin registro guardado (el simulacro del cron, o sin BOT_MODO) no se gasta cupo, salvo que se fuerce, como en pulir: el gasto arrancaba
  // en 0 en cada ejecución y nada quedaba marcado, así que cada 5 min se redactaban otra vez los mismos tuits (revisión total, C5)
  if (!forzar && !(registro && registro.fichero)) { for (const t of xs) t.redaccion = 'sin-ia'; log(`  (redactar) sin registro guardado (simulacro): ${tipo} sale con la plantilla, sin gastar IA`); return 0; }
  // (los apodos que son palabras corrientes no cuentan como nombre: Blanco, del Alavés, y «el Madrid, el equipo blanco»)
  const todos = nombresDe(jugadores, equipos).filter((n) => !COMUNES.has(n));
  const sistema = sistemaDe(tipo);
  // la caché solo compensa si hay más de una pregunta con el mismo sistema en esta ejecución (lib/claude.mjs)
  const cache = xs.length > 1 || cfg.cacheSiempre === true;
  const recientes = recientesDe(registro, tipo);
  const conRevisor = !(cfg.sinRevisor || []).includes(tipo) && (config.revisor || {}).activo !== false;
  let hechos = 0;
  for (const t of xs) {
    conApodos(t.hechos);
    // un dato del jugador por tuit (dos en los largos), sin repetir el tipo de los últimos; la media, solo si no hay otro (9 nov)
    const datos = limitarDatos(t.hechos, { n: limite() > 280 ? 2 : 1 });
    if (datos.length) log(`  (datos) ${t.clave}: ${datos.map((d) => `${d.nombre}, ${d.que}`).join('; ')}`);
    const etiqueta = t.hechos.etiqueta || '';
    const sep = etiqueta ? 2 : 0;
    const max = limite() - (etiqueta ? peso(etiqueta) + sep : 0);
    // lo que se le pide (más corto: «no tienen por qué ser muy largos», Carlos, 4 nov) y el máximo de verdad, que el validador mira
    const pide = Math.min(max - 40, ((cfg.largo || {})[t.hechos.tipo] || (cfg.largo || {})[tipo]) || max - 40);
    // la prensa es un adorno: si ya ha fallado la redacción de este tuit `sinPrensaTrasFallos` ejecuciones, se prueba sin ella (la
    // mayoría de los rechazos de la previa eran por copiar al medio o por contar mal lo que dice; 7 nov)
    const fallosPrevios = ((registro && registro.datos && registro.datos.fallosRedaccion) || {})[t.clave]?.n || 0;
    const sinPrensa = (cfg.sinPrensaTrasFallos || 0) > 0 && fallosPrevios >= cfg.sinPrensaTrasFallos;
    if (sinPrensa) log(`  (redactar) ${t.clave}: sin prensa (ya ha fallado ${fallosPrevios} ${fallosPrevios === 1 ? 'vez' : 'veces'})`);
    const cronicas = sinPrensa ? [] : ((await Promise.resolve(cronicasDe(t)).catch(() => [])) || []);
    // ¿queda cupo para redactar Y para la segunda lectura? Sin ella no sale, así que no se gasta en redactar (A10)
    if (conRevisor && pedir === preguntar && conClaude(config)) {
      const json = JSON.stringify(t.hechos, sinFecha);
      const estimado = estimarCoste({ modelo: MODELOS.redactar, prompt: json, sistema, uso: 'redactar', config })
        + estimarCoste({ modelo: MODELOS.revisar, prompt: json + ' '.repeat(900), sistema: SISTEMA_REVISOR, uso: 'revisar', config });
      const motivo = sinCupo('revisar', { registro, config, tipo, estimado });
      if (motivo) { t.redaccion = 'sin-ia'; log(`  (redactar) ${t.clave}: sin cupo para redactar y revisar (${motivo}): sale con la plantilla`); continue; }
    }
    let anterior = '', errores = [], final = null, rechazos = 0, causa = 'rechazada';
    const inicioTuit = Date.now();
    // presupuesto de tiempo de la ejecución (el trabajo de Actions tiene un tope de 10 min): pasado, sale la plantilla
    if (process.uptime() > (cfg.segundosEjecucion ?? 330)) { log(`  (redactar) ${t.clave}: sin tiempo en esta ejecución (${Math.round(process.uptime())} s)`); t.redaccion = 'sin-tiempo'; continue; }
    // `intentos` versiones como mucho que lleguen al revisor, y una más si alguna se cae antes, en el validador de código (es gratis
    // y casi siempre es un porcentaje de más o un «enfrente»)
    const intentos = cfg.intentos ?? 3;
    for (let intento = 0; intento < intentos + 1 && rechazos < intentos && !final; intento++) {
      if (intento > 0 && process.uptime() > (cfg.segundosEjecucion ?? 330)) { log(`  (redactar) ${t.clave}: sin tiempo para otro intento`); break; }
      // (el directo lleva prisa: una sola llamada, sin reintentos; `redactar.intentosPorTipo`)
      if (intento >= ((cfg.intentosPorTipo || {})[tipo] ?? Infinity)) break;
      // otro intento solo si el primero fue rápido (7 nov, el «baja» de Iker Luque: un fallo del validador en el directo tiraba el tuit a la plantilla)
      if (intento > 0 && cfg.reintentoSegundos && cfg.reintentoSegundos[tipo] != null && Date.now() - inicioTuit > cfg.reintentoSegundos[tipo] * 1000) { log(`  (redactar) ${t.clave}: el primer intento tardó demasiado para otro`); break; }
      const r = await pedir({ uso: 'redactar', tipo, registro, config, sistema, cache, esquema: ESQUEMA, log,
        prompt: prompt({ hechos: t.hechos, max: pide, recientes, cronicas, errores, anterior, gastadas: muletillas(recientes, nombresHechos(t.hechos)) }), tiempo: 40000, hasta: Date.now() + (((cfg.segundosPorTipo || {})[tipo]) ?? cfg.segundos ?? 60) * 1000 });
      if (!r.ok) { log(`  (redactar) ${t.clave}: ${r.error}`); causa = /^(tope|sin Claude)/.test(String(r.error)) ? 'sin-ia' : 'ia-no'; break; }
      const texto = String((r.datos && r.datos.texto) || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      const usadas = ((r.datos && r.datos.cronicas) || []).map((i) => cronicas[i]).filter(Boolean);
      const malos = revisar(texto, { hechos: t.hechos, cronicas: usadas.length ? usadas : cronicas, recientes, todos, max, numeros: t.numeros || [], ahora });
      // final y MVP: lo que sale de la prensa tiene que decirlo al menos dos medios distintos (Carlos, 7 nov); sin dos, no vale como fuente
      if (PRENSA_SIN_MEDIO.has(tipo) && usadas.length && new Set(usadas.map((c) => norm(c.medio))).size < 2) malos.push('has usado la prensa con una sola noticia o un solo medio: en un final o un MVP solo vale lo que dicen al menos dos medios distintos (apunta las dos en «cronicas»); si no hay dos que lo digan, quítalo');
      // pasa el validador de código: segunda lectura con IA (lib/revisor.mjs), como un editor, con los hechos al lado
      if (!malos.length) {
        // (el directo no espera a un segundo editor: lo del validador de código basta, la jugada caduca en minutos)
        const rv = (cfg.sinRevisor || []).includes(tipo) ? { ok: true, revisado: false } : await revisor({ texto, hechos: t.hechos, cronicas: usadas.length ? usadas : cronicas, recientes, tipo, registro, config, log });
        if (rv.ok) { final = { texto, modelo: r.modelo, usadas, revisado: rv.revisado ? rv.modelo : null }; continue; }
        // el revisor caído (no contesta, sin cupo, sin Claude) no deja pasar el tuit: espera a la siguiente ejecución (A10)
        if (rv.caido) { causa = 'revisor-no'; log(`  (redactar) ${t.clave}: el revisor no contesta (${rv.error || '?'}): no sale sin segunda lectura`); break; }
        rechazos++;
        log(`  (redactar) ${t.clave}, intento ${intento + 1}: el revisor no lo publicaría: ${rv.problemas.slice(0, 4).join('; ')}\n     «${texto.replace(/\n+/g, ' / ').slice(0, 400)}»`);
        errores = rv.problemas.map((p) => `un editor lo ha leído con los hechos al lado y no lo publicaría: ${p}`); anterior = texto;
      } else { log(`  (redactar) ${t.clave}, intento ${intento + 1}: ${malos.slice(0, 4).join('; ')}\n     «${texto.replace(/\n+/g, ' / ').slice(0, 400)}»`); errores = malos; anterior = texto; }
    }
    if (!final) { t.redaccion = causa; log(`  (redactar) ${t.clave}: no ha pasado la redacción (${causa})`); continue; }
    t.redaccion = 'ok';
    t.plantilla = t.texto;
    t.texto = etiqueta ? `${final.texto}\n\n${etiqueta}` : final.texto;
    t.numeros = [...new Set([...(t.numeros || []), ...cifrasDe(t.hechos, final.usadas)])];
    t.redactado = final.modelo;
    if (final.revisado) t.revisado = final.revisado;
    if (final.usadas.length) t.prensa = final.usadas.map((c) => c.medio);
    recientes.push(final.texto);
    apuntarTexto(final.texto, tipo);
    hechos++;
  }
  log(`  (redactar) ${hechos} de ${xs.length} tweets de ${tipo} redactados`);
  if (registro && registro.fichero) registro.guardar();
  return hechos;
}
