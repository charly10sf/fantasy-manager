// SOLO EN LA RAMA pruebas-redaccion-ab. Lo que se mide solo en la prueba de Haiku (claude/bot-haiku-25nov.md del proyecto), sobre lo que
// deja bot/prueba/ab-modelos.mjs: por variante y tipo de tuit,
//   - errores de datos: cada cifra, marcador, minuto, nombre y club del tuit tiene que estar en los hechos (o en la prensa que se le dio);
//     y en una frase con un solo jugador, «N puntos» tienen que ser los suyos; en el directo, el marcador y el minuto, los de la jugada.
//   - tics y reglas fijas: los de ab-redaccion.mjs y los de Carlos (equipos con artículo, «de titularidad» en el primer %, «se va 0-2»,
//     «LaLiga Fantasy pone a X como…», hora del reloj en los onces, «LaLiga Fantasy J11» arriba, emojis de club por pareja y sin 🟢, el largo).
//   - que no se parezcan entre sí: misma entrada (4 primeras palabras sin nombres ni cifras) y parejas con el mismo esqueleto (≥ 30 %,
//     el umbral del validador del bot).
//   - rechazos del revisor, plantilla, tarde (el directo tiene 25 s) y coste por tuit publicado.
//   node bot/prueba/haiku-medir.mjs .github/ia/haiku/pasada.json .github/ia/haiku/medida
import { readFileSync, writeFileSync } from 'node:fs';
import { parecido, conApodos } from '../lib/redaccion.mjs';
import { peso, norm, SE_VA_MARCADOR } from '../lib/texto.mjs';
import { ARRANQUES } from '../lib/pulir.mjs';

const [, , fEntrada, fSalida = 'medida', fMaterial = ''] = process.argv;
const P = JSON.parse(readFileSync(fEntrada, 'utf8'));
// los nombres de jugadores y clubes de LaLiga: al principio de una frase solo se mira una palabra con mayúscula si es uno de ellos
const MAT = fMaterial ? JSON.parse(readFileSync(fMaterial, 'utf8')) : { jugadores: [], equipos: {} };
const CONOCIDOS = new Set([...(MAT.jugadores || []).flatMap((j) => norm(j.nickname || '').split(' ')), ...Object.values(MAT.equipos || {}).flatMap((e) => norm(typeof e === 'string' ? e : (e.name || e.nombre || '')).split(' '))].filter((x) => x.length > 2));
const VS = Object.keys(P.variantes);
const EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]{2}/gu;

// ---------- lo que hay en los hechos ----------
const textos = (o, out = []) => { if (o == null) return out; if (typeof o === 'string') out.push(o); else if (typeof o === 'number') out.push(String(o)); else if (Array.isArray(o)) o.forEach((x) => textos(x, out)); else if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.push(k); textos(v, out); } return out; };
const num = (s) => Number(String(s).replace(',', '.'));
const HORA = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
function permitidos(hechos, prensa = []) {
  const ns = new Set(), marc = new Set(), minutos = new Set();
  const corpus = [...textos(hechos), ...prensa.flatMap((c) => [c.titulo || '', c.entradilla || '', c.medio || ''])];
  const add = (x) => { if (Number.isFinite(x)) { ns.add(Math.round(Math.abs(x) * 100) / 100); } };
  const anda = (o) => {
    if (typeof o === 'number') {
      add(o);
      if (Math.abs(o) >= 1e5) { add(Math.round(o / 1e5) / 10); add(Math.round(o / 1e4) / 100); add(Math.round(o / 1e3)); }
      if (Math.abs(o) < 1 && o !== 0) add(Math.round(o * 1000) / 10);
    } else if (typeof o === 'string') {
      for (const m of o.matchAll(/\d+(?:[.,]\d+)?/g)) add(num(m[0]));
      for (const m of o.matchAll(/(?<![\d-])(\d{1,2})\s?-\s?(\d{1,2})(?![\d-])/g)) marc.add(`${m[1]}-${m[2]}`);
      for (const m of o.matchAll(/(\d{1,3})(?:\s?\+\s?(\d{1,2}))?\s?'/g)) minutos.add(m[2] ? `${m[1]}+${m[2]}` : m[1]);
      if (/^\d{4}-\d\d-\d\dT/.test(o)) { const d = new Date(o); if (!isNaN(d)) for (const p of HORA.formatToParts(d)) if (p.type !== 'literal') add(Number(p.value)); }
    } else if (Array.isArray(o)) o.forEach(anda);
    else if (o && typeof o === 'object') Object.values(o).forEach(anda);
  };
  anda(hechos);
  for (const c of prensa) anda(`${c.titulo || ''} ${c.entradilla || ''}`);
  if (hechos.jornada) { add(hechos.jornada); add(hechos.jornada + 1); }
  return { ns, marc, minutos, corpus: ` ${norm(corpus.join(' '))} ` };
}
// palabras con mayúscula que no hace falta que estén en los hechos
const COMUNES = new Set(['laliga', 'liga', 'fantasy', 'manager', 'champions', 'copa', 'rey', 'europa', 'conference', 'mvp', 'var', 'premier', 'mundial',
  'jornada', 'mercado', 'novedades', 'baja', 'duda', 'disponible', 'chollo', 'venta', 'lloros', 'golazo', 'gol', 'roja', 'penalti', 'ojo', 'hoy', 'mañana',
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'ok', 'top', 'once', 'onces', 'ideal', 'posibles', 'confirmado', 'confirmados',
  'tu', 'mago', 'selecciones', 'seleccion', 'espana', 'parte', 'app', 'bio', 'enlace', 'todo', 'cuidado', 'atentos', 'pendientes', 'sorpresa', 'sube', 'baja',
  'remontada', 'empate', 'victoria', 'derrota', 'final', 'previa', 'caidas', 'sancionados', 'apercibidos', 'resumen', 'mejores', 'peores', 'subidas', 'bajadas']);
const esMayus = (w) => /^\p{Lu}/u.test(w);
function erroresDatos(texto, hechos, prensa) {
  const { ns, marc, minutos, corpus } = permitidos(hechos, prensa);
  const out = [];
  const t = texto.replace(EMOJI, ' ').replace(/[️‍]/g, '');
  // marcadores (no las formaciones, 4-4-2)
  const tMarc = [];
  for (const m of t.matchAll(/(?<![\d-])(\d{1,2})\s?-\s?(\d{1,2})(?![\d-])/g)) {
    const k = `${m[1]}-${m[2]}`; tMarc.push(k);
    if (!marc.has(k)) out.push(marc.has(`${m[2]}-${m[1]}`) ? `marcador al revés: ${k}` : `marcador que no está en los hechos: ${k}`);
  }
  // minutos
  for (const m of t.matchAll(/(\d{1,3})(?:\s?\+\s?(\d{1,2}))?\s?'|\bminuto (\d{1,3})\b/g)) {
    const k = m[3] || (m[2] ? `${m[1]}+${m[2]}` : m[1]);
    if (!minutos.has(k) && !(m[2] && minutos.has(m[1]))) out.push(`minuto que no está en los hechos: ${k}'`);
  }
  // cifras sueltas (las de los marcadores y minutos ya están)
  // (sin los marcadores ni los minutos, que ya se han mirado)
  const tCifras = t.replace(/(?<![\d-])\d{1,2}\s?-\s?\d{1,2}(?![\d-])/g, ' ').replace(/\d{1,3}(?:\s?\+\s?\d{1,2})?\s?'|\bminuto \d{1,3}\b/g, ' ');
  for (const m of tCifras.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const x = Math.round(num(m[0]) * 100) / 100;
    if (!ns.has(x)) out.push(`cifra que no está en los hechos: ${m[0]}`);
  }
  // nombres y clubes: cada palabra con mayúscula (salvo la primera de una frase si es una palabra corriente)
  const frases = t.split(/(?<=[.!?:])\s+|\n+/);
  for (const f of frases) {
    const ws = f.split(/[\s,;()«»"“”¿¡!?.:]+/).filter(Boolean);
    ws.forEach((w, i) => {
      if (!esMayus(w)) return;
      const n = norm(w);
      if (!n || COMUNES.has(n) || /^\d/.test(n)) return;
      if (i === 0 && (ARRANQUES.has(n) || !CONOCIDOS.has(n))) return;
      // (las palabras en mayúsculas, «¡GOLAZO DE LEJOS!», solo si son el nombre de alguien)
      if (w.length > 2 && w === w.toUpperCase() && !CONOCIDOS.has(n)) return;
      if (n.length <= 1) return;
      // (el nombre de pila que pone `retocar` delante de una inicial de los hechos: «Y. Zabiri» → «Yassir Zabiri»)
      const sig = norm(ws[i + 1] || '');
      if (sig && corpus.includes(` ${n[0]} ${sig} `)) return;
      for (const parte of n.split(' ')) if (parte.length > 1 && !corpus.includes(` ${parte} `) && !corpus.includes(` ${parte}`) && !COMUNES.has(parte)) { out.push(`nombre que no está en los hechos: ${w}`); return; }
    });
  }
  // «N puntos» en una frase con un solo jugador: los suyos
  const jug = (hechos.jugadores || []).filter((j) => j && j.nombre);
  const claves = (j) => [j.nombre, ...(j.apodos || []), j.comoLeLlaman, ...(String(j.nombre).split(' ').filter((p) => p.length > 3 && !/^\p{Ll}/u.test(p)))].filter(Boolean).map((x) => norm(String(x).replace(/^[A-Z]\.\s*/, '')));
  for (const f of t.split(/(?<=[.!?;])\s+|\n+/)) {
    const nf = ` ${norm(f)} `;
    const dentro = jug.filter((j) => claves(j).some((c) => c.length > 2 && nf.includes(` ${c} `)));
    if (dentro.length !== 1) continue;
    const j = dentro[0];
    const suyos = new Set(textos(j).flatMap((s) => [...String(s).matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Math.abs(num(m[0])))));
    for (const m of f.matchAll(/(-?\d+(?:[.,]\d+)?)\s+puntos?\b/g)) if (!suyos.has(Math.abs(num(m[1])))) out.push(`${m[1]} puntos para ${j.nombre}, que no son los suyos`);
  }
  // el directo: el marcador y el minuto, los de la jugada
  if (hechos.tipo === 'directo') {
    const p = hechos.partido || {};
    const bueno = p.marcadorEnEseMomento || p.marcador;
    for (const k of tMarc) if (bueno && k !== bueno) out.push(`en el directo, el marcador tiene que ser ${bueno} y dice ${k}`);
    const min = String(hechos.minuto || '').replace(/'/g, '');
    for (const m of t.matchAll(/(\d{1,3}(?:\s?\+\s?\d{1,2})?)\s?'/g)) if (min && m[1].replace(/\s/g, '') !== min) out.push(`en el directo, el minuto es ${min}' y dice ${m[1]}'`);
  }
  return [...new Set(out)];
}

// ---------- tics y reglas fijas ----------
const TICS = {
  '«si lo tienes» / «quien lo tenga»': /\bsi l[oa]s? (?:tienes|tenías)\b|\bquien(?:es)? l[oa]s? tenga\b|\bquien tenga\b/i,
  '«ya suma»': /\bya suma\b/i,
  '«de momento» / «por ahora»': /\bde momento\b|\bpor ahora\b/i,
  '«el pase es de»': /\bel pase es de\b|\bpone el pase\b/i,
  '«la mete» / «la manda dentro»': /\bla mete\b|\bla manda dentro\b/i,
  '«más del doble» / «de lo que suele»': /\b(?:más del|casi el) (?:doble|triple)\b|\blo que suele\b|\b(?:dobla|triplica)\b/i,
  '«Liga, Champions…» / «primer gol»': /Liga, Champions|primer gol/i,
  '«en racha» / «jornadas seguidas»': /\ben racha\b|jornadas seguidas/i,
  '«el mejor de los dos equipos»': /el mejor de los dos equipos/i,
  '«se va a N»': /\bse va a \d/i,
  '«sin sorpresas»': /sin sorpresas?|ninguna sorpresa|cambio raro/i,
  'inicial con punto («Y. Zabiri»)': /(?<![\p{L}.])\p{Lu}\.\s\p{Lu}\p{Ll}/u,
  '«más papeletas» / «lo normal es que salga»': /más papeletas|lo normal es que salga/i,
  '«60 minutos o más»': /60 minutos o más/i,
};
// de los TICS, estos dos son reglas de Carlos (cuentan como las fijas); el resto son muletillas (cuentan aparte)
const DURAS_TICS = new Set(['«si lo tienes» / «quien lo tenga»', 'inicial con punto («Y. Zabiri»)']);
const esMuletilla = (k) => k in TICS && !DURAS_TICS.has(k);
const ARTICULO = /(?:\b(?:el|la|los|las|del|al|un|una|este|ese|aquel|su|otro)\s+)$/i;
function reglas(texto, hechos, tipo) {
  const out = [];
  const sin = texto.replace(/[️‍]/g, '');
  for (const [k, re] of Object.entries(TICS)) if (re.test(sin)) out.push(k);
  if (SE_VA_MARCADOR.test(sin)) out.push('«se va» con un marcador');
  if (/LaLiga Fantasy (?:le |lo |la )?(?:pone|da|tiene|marca|considera|cataloga|ya lo da)/i.test(sin)) out.push('«LaLiga Fantasy pone a X como…»');
  if (tipo === 'onces' && /\b\d{1,2}:\d{2}\b|\ba las \d/i.test(sin)) out.push('hora del reloj en los onces');
  if (/LaLiga Fantasy J\d+|\bJ\d{1,2}\b/.test(sin.split('\n')[0])) out.push('«LaLiga Fantasy J11» en la cabecera');
  if (/🟢/u.test(sin)) out.push('🟢');
  // el primer %, «de titularidad» (solo si el tuit habla de titularidad)
  const i = sin.indexOf('%');
  if (i >= 0 && /"titularidad"/.test(JSON.stringify(hechos)) && !/(?:mercado|selecciones)/.test(tipo)) {
    const alrededor = sin.slice(Math.max(0, i - 40), i + 30);
    if (!/titularidad|titular/i.test(alrededor)) out.push('el primer % sin «de titularidad»');
  }
  // equipos con artículo (fuera de «Athletic 0-1 Espanyol», «Real Madrid-Celta» y la línea de arriba de un final)
  const clubes = hechos.clubes || {};
  for (const c of Object.keys(clubes)) {
    const re = new RegExp(`(?<![\\p{L}-])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'gu');
    for (const m of sin.matchAll(re)) {
      const antes = sin.slice(0, m.index), despues = sin.slice(m.index + c.length);
      if (ARTICULO.test(antes) || /-\s*$/.test(antes) || /^\s*-/.test(despues) || /\d\s*-\s*\d\s*$/.test(antes) || /^\s*\d\s*-\s*\d/.test(despues)) continue;
      if (/Real\s+$/.test(antes) || /(?:de|del)\s+$/i.test(antes) && /^\s*\p{Lu}/u.test(despues)) continue;
      out.push(`club sin artículo: «${(antes.slice(-12) + c).trim()}»`); break;
    }
  }
  // emojis de club: si va uno, el de los dos; y solo con clubes que lo tengan
  const conEmoji = Object.entries(clubes).filter(([, v]) => v && v.emoji);
  const puestos = conEmoji.filter(([, v]) => sin.includes(v.emoji));
  if (puestos.length) {
    const nombrados = Object.keys(clubes).filter((c) => norm(sin).includes(norm(c)) || ((clubes[c].nombres || []).some((n) => norm(sin).includes(norm(n).replace(/^(el|la) /, '')))));
    if (nombrados.some((c) => !(clubes[c].emoji && sin.includes(clubes[c].emoji)))) out.push('emoji de un club y no del otro');
  }
  if (peso(texto) > 1000) out.push(`largo: ${peso(texto)} de 1000`);
  return out;
}

// ---------- parecido dentro de cada variante y tipo ----------
const tapar = (s) => String(s).replace(EMOJI, ' ').replace(/[️‍]/g, '').replace(/(?:\p{Lu}[\p{L}'’.-]*)(?:\s+(?:de\s+|del\s+)?\p{Lu}[\p{L}'’.-]*)*/gu, (m, i, all) => {
  const antes = all.slice(0, i).trimEnd(); const w = m.split(/\s+/);
  return (!antes || /[.!?:\n¡¿]$/.test(antes)) && ARRANQUES.has(norm(w[0])) ? (w.length > 1 ? `${w[0]} X` : m) : 'X';
}).replace(/\d+(?:[.,]\d+)?/g, 'N');
const entrada = (s) => norm(tapar(s)).split(' ').slice(0, 4).join(' ');
const nombresDe = (h) => [...new Set(textos(h).flatMap((s) => String(s).match(/\p{Lu}[\p{L}'’.-]+/gu) || []).map(norm).filter((x) => x.length >= 3))];

// ---------- por variante y tipo ----------
const filas = P.filas;
const tipos = [...new Set(filas.map((f) => f.tipo))];
const R = {};
const detalle = [];
for (const v of VS) {
  R[v] = {};
  for (const tipo of tipos) {
    const fs = filas.filter((f) => f.tipo === tipo && f[v] && !f[v].igualQue);
    if (!fs.length) continue;
    const x = { tuits: fs.length, redactados: 0, plantilla: 0, erroresDatos: 0, tuitsConError: 0, tics: 0, muletillas: 0, rechazosRevisor: 0, rechazosValidador: 0, tarde: 0, dolares: 0, segundos: [], sinEsfuerzo: 0, palabras: [] };
    const txs = [];
    for (const f of fs) {
      const y = f[v];
      const hechos = JSON.parse(JSON.stringify(f.hechos));
      conApodos(hechos);
      // (un tuit que cruzó la medianoche de Madrid sale con el gasto en negativo: el registro empieza el día nuevo a cero; no se cuenta)
      if ((y.dolares || 0) < 0) x.costeSinMedir = (x.costeSinMedir || 0) + 1; else { x.dolares += y.dolares || 0; x.conCoste = (x.conCoste || 0) + 1; if (y.redactado) x.redactadosConCoste = (x.redactadosConCoste || 0) + 1; }
      x.segundos.push(y.segundos || 0);
      x.rechazosRevisor += y.rechazosRevisor || 0; x.rechazosValidador += y.rechazosValidador || 0;
      if (y.sinEsfuerzo) x.sinEsfuerzo++;
      if (y.redactado) x.redactados++; else x.plantilla++;
      if (tipo === 'directo' && (y.segundos > 25 || /ia-no|sin-tiempo/.test(y.causa || ''))) x.tarde++;
      // los datos y los tics se miden en lo que sale (también si sale con la plantilla: es lo que vería la gente)
      const prensa = (f.prensaDada || []);
      // (los datos, solo en lo redactado: la plantilla la escribe el código con todos los datos, y es la misma en todas las variantes)
      const ed = y.redactado ? erroresDatos(y.texto || '', hechos, prensa) : [];
      const rg = reglas(y.texto || '', hechos, tipo);
      y.erroresDatos = ed; y.reglas = rg;
      x.erroresDatos += ed.length; if (ed.length) x.tuitsConError++;
      x.tics += rg.filter((k) => !esMuletilla(k)).length; x.muletillas += rg.filter(esMuletilla).length;
      x.palabras.push(String(y.texto || '').split(/\s+/).length);
      if (ed.length || rg.length) detalle.push({ v, tipo, clave: f.clave, redactado: y.redactado, datos: ed, reglas: rg });
      if (y.redactado) txs.push({ texto: y.texto, nombres: nombresDe(hechos) });
    }
    const entradas = txs.map((t) => entrada(t.texto));
    x.mismaEntrada = entradas.length - new Set(entradas).size;
    let pares = 0, parecidos = 0;
    for (let i = 0; i < txs.length; i++) for (let j = i + 1; j < txs.length; j++) { pares++; if (parecido(txs[i].texto, txs[j].texto, [...txs[i].nombres, ...txs[j].nombres]) >= 0.3) parecidos++; }
    x.parejasParecidas = parecidos; x.parejas = pares;
    x.porPublicado = x.redactadosConCoste ? Math.round((x.dolares / x.redactadosConCoste) * 1e5) / 1e5 : null;
    x.porTuit = x.conCoste ? Math.round((x.dolares / x.conCoste) * 1e5) / 1e5 : null;
    x.dolares = Math.round(x.dolares * 1e5) / 1e5;
    x.segundosMax = Math.max(...x.segundos); x.segundos = Math.round((x.segundos.reduce((a, b) => a + b, 0) / x.segundos.length) * 10) / 10;
    x.palabras = Math.round(x.palabras.reduce((a, b) => a + b, 0) / x.palabras.length);
    R[v][tipo] = x;
  }
}
writeFileSync(`${fSalida}.json`, JSON.stringify({ R, detalle, filas }, null, 1));

// ---------- la tabla ----------
const out = [`# Lo medido solo (${P.fecha.slice(0, 16).replace('T', ' ')} UTC, ${filas.length} tuits, ${P.total} $)`, ''];
out.push('Por tipo: tuits · redactados · errores de datos (en cuántos tuits; solo en lo redactado) · reglas de Carlos rotas · muletillas · misma entrada / parejas parecidas · rechazos del revisor · rechazos del validador · plantilla · tarde · coste por tuit publicado · segundos de media (máx.)', '');
for (const tipo of tipos) {
  out.push(`## ${tipo}`, '', '| | tuits | redact. | errores datos | reglas | muletillas | entrada rep. / parecidas | revisor tumba | validador tumba | plantilla | tarde | $ por publicado | s (máx.) |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const v of VS) {
    const x = R[v][tipo];
    if (!x) { out.push(`| ${v} | igual que C | | | | | | | | | | | |`); continue; }
    out.push(`| ${v} | ${x.tuits} | ${x.redactados} | ${x.erroresDatos} (${x.tuitsConError}) | ${x.tics} | ${x.muletillas} | ${x.mismaEntrada} / ${x.parejasParecidas} de ${x.parejas} | ${x.rechazosRevisor} | ${x.rechazosValidador} | ${x.plantilla} | ${x.tarde} | ${x.porPublicado ?? (x.costeSinMedir ? 'sin medir' : '—')} | ${x.segundos} (${x.segundosMax}) |`);
  }
  out.push('');
}
out.push('## Lo que marca el comprobador, tuit a tuit', '');
for (const d of detalle) out.push(`- ${d.v} · ${d.clave}${d.redactado ? '' : ' (plantilla)'}: ${[...d.datos.map((s) => `DATO: ${s}`), ...d.reglas].join('; ')}`);
writeFileSync(`${fSalida}.md`, out.join('\n'));
console.log(out.slice(0, 200).join('\n'));
