// Redactar desde los hechos (6 nov, Carlos: «que no se note que es automático»). En vez de pulir una plantilla (lib/pulir.mjs), la IA
// recibe los hechos ya comprobados de cada tuit (`t.hechos`, los saca cada tipo), la guía de voz y los ejemplos (lib/voz.mjs), los
// últimos tuits del mismo tipo y, si los hay, titulares y entradillas de prensa del partido, y escribe el tuit. La etiqueta final («✅
// Disponible para la jornada 12 contra el Valencia», el cierre…) la pone el código debajo. El validador ya no compara con la plantilla
// (ni líneas, ni orden): comprueba que lo que dice cuadra con los hechos. Lo que no pasa se pregunta otra vez con los errores; si
// tampoco, sale la plantilla. Con Claude (lib/ia.mjs, uso «redactar»); sin Claude, no hace nada.
import { norm, peso, limite, copia, APODOS, corto, esEtiquetaFinal, CIERRES } from './texto.mjs';
import { validar } from './validar.mjs';
import { preguntar, conClaude } from './ia.mjs';
import { GUIA, EJEMPLOS, ejemplosPara } from './voz.mjs';
import { ARRANQUES, VAGAS, PROHIBIDO, EMOJIS_GUIA, segunTrasCifra, nombresEn, nombresDe } from './pulir.mjs';
import { NOMBRES_MEDIOS } from './prensa.mjs';
import { ESTADIOS } from './hechos.mjs';

const EMOJI = /\p{Extended_Pictographic}/gu;
const emojis = (s) => [...String(s).matchAll(EMOJI)].map((m) => m[0]);
const CIRCULOS = /[🔴🟠🟡🟢🔵🟣🟤⚫]/u;
// lo que no se le pasa a la IA ni cuenta para las cifras (la fecha del partido va como «cuando»)
const sinFecha = (k, v) => (k === 'fecha' || k === 'etiqueta' ? undefined : v);
const COMUNES = new Set(['blanco', 'moreno', 'rubio', 'bueno', 'leal', 'santos', 'alba', 'luna']);
const frases = (s) => String(s).split(/(?<=[.!?:;])\s+|\n+/).map((x) => x.trim()).filter(Boolean);

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

/** las palabras con mayúscula que pueden salir: las de los hechos, las crónicas usadas, los medios y unas fijas */
function vocabulario(hechos, cronicas) {
  const s = new Set(['laliga', 'fantasy', 'manager', 'primera', 'segunda', 'champions', 'copa', 'europa', 'conference', 'liga', 'rey', 'var', 'mvp',
    'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre', 'all', 'in']);
  const txt = JSON.stringify(hechos, sinFecha) + ' ' + cronicas.map((c) => `${c.medio} ${c.titulo} ${c.entradilla}`).join(' ') + ' ' + NOMBRES_MEDIOS.join(' ');
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
const entrada = (t, nombres) => esqueleto(t, nombres).split(' ').slice(0, 3).join(' ');

/**
 * ¿vale el texto redactado? [] si sí; si no, los motivos (se le devuelven a la IA para que lo arregle).
 * `todos`: los nombres de todos los jugadores y clubes de LaLiga (nombresDe); `recientes`: los últimos textos del mismo tipo.
 */
export function revisar(texto, { hechos, cronicas = [], recientes = [], todos = [], max = limite(), numeros = [] } = {}) {
  const e = [];
  const t = String(texto || '').trim();
  if (!t) return ['texto vacío'];
  const v = validar(t, { numeros: [...new Set([...numeros, ...cifrasDe(hechos, cronicas)])], max });
  if (!v.ok) e.push(...v.errores);
  // nombres: solo los de los hechos (jugadores y clubes, con los nombres permitidos de cada club)
  const permitidos = new Set();
  for (const j of hechos.jugadores || []) { permitidos.add(norm(j.nombre)); for (const w of norm(j.nombre).split(' ')) if (w.length >= 4) permitidos.add(w); }
  for (const c of Object.values(hechos.clubes || {})) for (const n of c.nombres || []) { const x = norm(n).replace(/^(el|la) /, ''); permitidos.add(x); }
  for (const c of Object.keys(hechos.clubes || {})) permitidos.add(norm(c));
  for (const c of cronicas) for (const w of norm(`${c.titulo} ${c.entradilla}`).split(' ')) permitidos.add(w);
  for (const w of norm(JSON.stringify(hechos, sinFecha)).split(' ')) if (w.length >= 3) permitidos.add(w);
  // (sin los nombres de los medios: «Mundo Deportivo» no es el Deportivo; primera prueba del 6 nov)
  const sinMedios = NOMBRES_MEDIOS.reduce((x, m) => x.split(m).join('·'.repeat(m.length)), t);
  const fuera = nombresEn(sinMedios, todos).filter((n) => !permitidos.has(n) && !n.split(' ').every((w) => permitidos.has(w)));
  if (fuera.length) e.push(`nombra a quien no está en los hechos: ${fuera.join(', ')}`);
  for (const j of (hechos.jugadores || []).filter((x) => x.principal)) {
    const ws = norm(j.nombre).split(' ').filter((w) => w.length >= 3);
    if (!ws.some((w) => ` ${norm(t)} `.includes(` ${w} `))) e.push(`no nombra a ${j.nombre}`);
  }
  // palabras con mayúscula que no salen de ninguna parte (un entrenador, un estadio, un club que no está)
  const voc = vocabulario(hechos, cronicas);
  const raras = new Set();
  for (const f of frases(t.replace(EMOJI, ' ').replace(/[️‍]/g, ''))) {
    const ws = f.replace(/^[^\p{L}]+/u, '').split(/[^\p{L}]+/u).filter(Boolean);
    ws.forEach((w, i) => {
      if (!/^\p{Lu}/u.test(w)) return;
      const n = norm(w);
      if (voc.has(n) || (i === 0 && ARRANQUES.has(n))) return;
      if (i === 0 && !/^\p{Lu}{2,}/u.test(w)) return;   // primera palabra de la frase: solo si no es una palabra corriente (ver ARRANQUES)
      raras.add(w);
    });
  }
  if (raras.size) e.push(`palabras con mayúscula que no están en los hechos: ${[...raras].join(', ')}`);
  // el estado de cada jugador: en las frases que solo hablan de él, nada de otra familia
  const nombreDe = (j) => norm(j.nombre).split(' ').filter((w) => w.length >= 3);
  for (const f of frases(t)) {
    const nf = ` ${norm(f)} `;
    const suyos = (hechos.jugadores || []).filter((j) => j.estado && nombreDe(j).some((w) => nf.includes(` ${w} `)));
    if (suyos.length !== 1) continue;
    const j = suyos[0];
    for (const fam of CHOCA[j.estado] || []) if (PALABRAS[fam].test(f) && !negada(f, PALABRAS[fam])) e.push(`a ${j.nombre} (${j.estado}) se le llama «${f.match(PALABRAS[fam])[0]}»`);
  }
  // un estado que no es de nadie: «baja» sin ningún jugador de baja en los hechos
  const estados = new Set((hechos.jugadores || []).map((j) => j.estado));
  if (PALABRAS.baja.test(t) && !negada(t, PALABRAS.baja) && ![...estados].some((x) => ['baja', 'lesionado', 'sancionado'].includes(x))) e.push(`dice «${t.match(PALABRAS.baja)[0]}» y nadie está de baja`);
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
  const puestos = (hechos.equipos || []).map((x) => String(x.va || '').match(/^(\d+)º de (\d+)/)).filter(Boolean);
  if (/\bcolista\b/i.test(t) && !puestos.some((m) => m[1] === m[2])) e.push('dice «colista» y ningún equipo de los hechos va último');
  if (/\bl[ií]der\b/i.test(t) && !puestos.some((m) => m[1] === '1')) e.push('dice «líder» y ningún equipo de los hechos va primero');
  if (VAGAS.test(t)) { VAGAS.lastIndex = 0; e.push(`nombra un club o un jugador con una palabra vaga («${(t.match(VAGAS) || [])[0]}»)`); }
  VAGAS.lastIndex = 0;
  if (/conjunto\s+\p{Ll}/u.test(t)) e.push('«el conjunto…» en vez del nombre del club');
  if (/LaLiga Fantasy ya lo da/i.test(t)) e.push('«LaLiga Fantasy ya lo da…»');
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
  // emojis: uno de la guía al principio del primer párrafo, el de un club de los hechos detrás de su nombre (uno) y nada más
  const em = emojis(t);
  const deClub = new Set(Object.values(hechos.clubes || {}).map((c) => c.emoji).filter(Boolean));
  if (em.some((x) => CIRCULOS.test(x))) e.push('círculos de colores');
  const raros = em.filter((x) => !EMOJIS_GUIA.has(x) && !deClub.has(x) && !CIRCULOS.test(x));
  if (raros.length) e.push(`emojis que no están en la guía: ${raros.join(' ')}`);
  if (em.filter((x) => deClub.has(x)).length > 1) e.push('más de un emoji de club');
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
  for (const c of cronicas) if (copia(t, `${c.titulo} ${c.entradilla}`, 6)) e.push(`copia 6 palabras seguidas de ${c.medio}`);
  for (const x of EJEMPLOS) if (copia(t, x.texto, 8)) { e.push('copia un ejemplo de la guía'); break; }
  // variedad: ni la misma entrada ni el mismo esqueleto que los últimos del tipo
  const nom = [...permitidos];
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

export function prompt({ hechos, max, recientes = [], cronicas = [], errores = [], anterior = '' }) {
  return [`Escribe el tuit de tipo «${hechos.tipo}» con estos hechos. Como mucho ${max} caracteres, mejor menos (sin contar la etiqueta, que va aparte: «${hechos.etiqueta || '(ninguna)'}»).`,
    `HECHOS:\n${JSON.stringify(hechos, sinFecha, 1)}`,
    recientes.length ? `ÚLTIMOS TUITS DE ESTE TIPO (no empieces igual ni sigas su orden):\n${recientes.map((r, i) => `${i + 1}. """${r}"""`).join('\n')}` : '',
    cronicas.length ? `PRENSA DE ESTE PARTIDO (puedes usar uno o dos hechos, con tus palabras):\n${cronicas.map((c, i) => `[${i}] ${c.medio}: ${c.titulo}. ${c.entradilla}`).join('\n')}` : '',
    errores.length ? `Tu versión anterior no vale:\n"""${anterior}"""\nPor esto: ${errores.join('; ')}. Escríbela otra vez arreglando eso.` : '',
  ].filter(Boolean).join('\n\n');
}

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
  pedir = preguntar, cronicasDe = () => [], forzar = false } = {}) {
  const cfg = config.redactar || {};
  const activo = forzar || process.env.BOT_REDACTAR === '1' || cfg.activo === true;
  const xs = tweets.filter((t) => t && t.hechos);
  if (!activo || !xs.length || !(cfg.tipos || []).includes(tipo)) return 0;
  if (!conClaude(config) && !(config.ia || {}).geminiRedacta) { log(`  (redactar) sin Claude: ${tipo} sale con la plantilla`); return 0; }
  // (los apodos que son palabras corrientes no cuentan como nombre: Blanco, del Alavés, y «el Madrid, el equipo blanco»)
  const todos = nombresDe(jugadores, equipos).filter((n) => !COMUNES.has(n));
  const sistema = sistemaDe(tipo);
  // la caché solo compensa si hay más de una pregunta con el mismo sistema en esta ejecución (lib/claude.mjs)
  const cache = xs.length > 1 || cfg.cacheSiempre === true;
  const recientes = recientesDe(registro, tipo);
  let hechos = 0;
  for (const t of xs) {
    const etiqueta = t.hechos.etiqueta || '';
    const sep = etiqueta ? 2 : 0;
    const max = limite() - (etiqueta ? peso(etiqueta) + sep : 0);
    // lo que se le pide (más corto: «no tienen por qué ser muy largos», Carlos, 4 nov) y el máximo de verdad, que el validador mira
    const pide = Math.min(max - 40, ((cfg.largo || {})[tipo]) || max - 40);
    const cronicas = (await Promise.resolve(cronicasDe(t)).catch(() => [])) || [];
    let anterior = '', errores = [], final = null;
    for (let intento = 0; intento < (cfg.intentos ?? 2) && !final; intento++) {
      const r = await pedir({ uso: 'redactar', registro, config, sistema, cache, esquema: ESQUEMA, log,
        prompt: prompt({ hechos: t.hechos, max: pide, recientes, cronicas, errores, anterior }), tiempo: 40000, hasta: Date.now() + (cfg.segundos ?? 60) * 1000 });
      if (!r.ok) { log(`  (redactar) ${t.clave}: ${r.error}`); break; }
      const texto = String((r.datos && r.datos.texto) || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      const usadas = ((r.datos && r.datos.cronicas) || []).map((i) => cronicas[i]).filter(Boolean);
      const malos = revisar(texto, { hechos: t.hechos, cronicas: usadas.length ? usadas : cronicas, recientes, todos, max, numeros: t.numeros || [] });
      if (!malos.length) final = { texto, modelo: r.modelo, usadas };
      else { log(`  (redactar) ${t.clave}, intento ${intento + 1}: ${malos.slice(0, 4).join('; ')}\n     «${texto.replace(/\n+/g, ' / ').slice(0, 400)}»`); errores = malos; anterior = texto; }
    }
    if (!final) { log(`  (redactar) ${t.clave}: sale la plantilla`); continue; }
    t.plantilla = t.texto;
    t.texto = etiqueta ? `${final.texto}\n\n${etiqueta}` : final.texto;
    t.numeros = [...new Set([...(t.numeros || []), ...cifrasDe(t.hechos, final.usadas)])];
    t.redactado = final.modelo;
    if (final.usadas.length) t.prensa = final.usadas.map((c) => c.medio);
    recientes.push(final.texto);
    hechos++;
  }
  log(`  (redactar) ${hechos} de ${xs.length} tweets de ${tipo} redactados`);
  if (registro && registro.fichero) registro.guardar();
  return hechos;
}
