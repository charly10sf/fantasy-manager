// La redacción con la guía de antes y con la nueva, lado a lado y con la IA de verdad (22 nov, fase 4 de la auditoría de la redacción:
// claude/auditoria-redaccion-bot.md del proyecto). Solo en la rama de pruebas: necesita ANTHROPIC_API_KEY y gasta.
//   node bot/prueba/ab-redaccion.mjs --tuits=/tmp/tuits.json --registro=/tmp/registro.json --antes=/tmp/antes/bot --salida=ab --n=26 --tope=2.6
// --tuits: lo que deja `ejecutar.mjs --volcar=` (los tuits de cada tipo con sus hechos, antes de la IA); --registro: el de bot-estado
// (de él salen los últimos tuits de cada tipo, como en el bot de verdad); --antes: la carpeta bot/ del código de antes (un worktree).
// Cada tuit se redacta solo (sin caché, igual en los dos) y con su segunda lectura, como en el bot; el final de un partido queda
// apuntado antes de redactar su MVP. Para en cuanto lo gastado entre los dos pasa de --tope dólares. Deja salida.md y salida.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const { tuits, jugadores = [], equipos = {} } = JSON.parse(readFileSync(arg('tuits'), 'utf8'));
const registroReal = JSON.parse(readFileSync(arg('registro'), 'utf8'));
const N = Number(arg('n', '26')), TOPE = Number(arg('tope', '2.6'));
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
// el gasto de la prueba no es el del bot: un tope propio por versión y sin reserva para partidos
config.ia = { ...config.ia, topeDolaresDia: TOPE / 2, reservaPartidos: 0, porDia: { clasificar: 999, redactar: 999, revisar: 999, pulir: 999 } };
config.redactar = { ...config.redactar, activo: true, cacheSiempre: false };

// --- qué tuits: los tipos de la auditoría, en su proporción ---
const CUPO = { directo: 8, final: 4, mvp: 4, noticias: 3, novedades: 2, caidas: 2, previa: 2, onces: 1, sancionados: 1, mercado: 1, lloros: 1, resumen: 1 };
const deTipo = (t) => (t.hechos && t.hechos.tipo) || t.tipo;
const vistos = new Set();
const candidatos = tuits.filter((t) => t.hechos && (config.redactar.tipos || []).includes(t.modulo || t.tipo) && !vistos.has(t.clave) && vistos.add(t.clave));
const elegidos = [];
// los finales y MVP, de los mismos partidos (para ver si cuentan lo mismo)
const partidoDe = (t) => (t.hechos.partido || {}).partido || '';
const finales = candidatos.filter((t) => deTipo(t) === 'final').slice(-CUPO.final);
elegidos.push(...finales);
const mvps = candidatos.filter((t) => deTipo(t) === 'mvp');
elegidos.push(...finales.map((f) => mvps.find((m) => partidoDe(m) === partidoDe(f))).filter(Boolean));
// los directos, repartidos entre partidos y en orden
const dir = candidatos.filter((t) => deTipo(t) === 'directo');
const porPartido = new Map();
for (const t of dir) { const p = partidoDe(t); if (!porPartido.has(p)) porPartido.set(p, []); porPartido.get(p).push(t); }
const ronda = [];
for (let i = 0; ronda.length < CUPO.directo && i < 20; i++) for (const xs of porPartido.values()) if (xs[i] && ronda.length < CUPO.directo) ronda.push(xs[i]);
elegidos.push(...ronda);
for (const [tipo, n] of Object.entries(CUPO)) {
  if (['final', 'mvp', 'directo'].includes(tipo)) continue;
  elegidos.push(...candidatos.filter((t) => deTipo(t) === tipo && !elegidos.includes(t)).slice(0, n));
}
for (const t of candidatos) if (elegidos.length < N && !elegidos.includes(t)) elegidos.push(t);
const lista = elegidos.slice(0, N);
console.log(`# ${lista.length} tuits de ${candidatos.length}: ${[...new Set(lista.map(deTipo))].map((x) => `${x} ${lista.filter((t) => deTipo(t) === x).length}`).join(', ')}`);

// --- las dos versiones ---
const dir_ = (p) => pathToFileURL(resolve(p)).href;
const ahoraDir = new URL('../', import.meta.url).href, antesDir = `${dir_(arg('antes'))}/`;
async function version(base, nombre) {
  const red = await import(`${base}lib/redaccion.mjs`);
  const tx = await import(`${base}lib/texto.mjs`);
  const ia = await import(`${base}lib/ia.mjs`);
  let em = null;
  try { em = await import(`${base}lib/emojis.mjs`); } catch { em = null; }
  const pulir = await import(`${base}lib/pulir.mjs`);
  return { nombre, red, tx, ia, em, pulir };
}
const V = [await version(antesDir, 'antes'), await version(ahoraDir, 'ahora')];
const reg = () => ({ datos: { recientes: JSON.parse(JSON.stringify(registroReal.recientes || {})), enviados: [], fallosRedaccion: {} }, fichero: null, guardar() {} });
const gasto = (r) => ((r.datos.ia || {}).dolares || 0);
// el orden en que salen en el bot: los finales antes que los MVP
const ORDEN = ['directo', 'resumen', 'final', 'mvp', 'caidas', 'mercado', 'liga', 'previa', 'onces', 'onceideal', 'novedades', 'noticias', 'sancionados', 'lloros'];
lista.sort((a, b) => ORDEN.indexOf(deTipo(a)) - ORDEN.indexOf(deTipo(b)) || (a.hechos.minuto && b.hechos.minuto ? 0 : 0));

const filas = lista.map((t) => ({ tipo: deTipo(t), clave: t.clave, plantilla: t.texto }));
let total = 0;
for (const v of V) {
  const r = reg();
  v.tx.fijarLimite(1000);
  for (let i = 0; i < lista.length; i++) {
    if (total + gasto(r) > TOPE) { filas[i][v.nombre] = { estado: 'sin probar (tope)' }; continue; }
    const t = JSON.parse(JSON.stringify(lista[i]));
    let llamadas = 0;
    const pedir = async (op) => { llamadas++; return v.ia.preguntar(op); };
    const antesGasto = gasto(r), t0 = Date.now();
    const log = [];
    try {
      // (con el tipo del módulo, como ejecutar.mjs: los onces confirmados salen del de las previas)
      await v.red.redactar([t], { tipo: t.modulo || t.tipo, registro: r, config, jugadores, equipos, log: (s) => log.push(s), forzar: true, pedir, cronicasDe: () => [] });
    } catch (e) { log.push(`ERROR ${e.message}`); }
    let texto = t.texto;
    // lo que el bot le hace antes de publicar (ejecutar.mjs): en la versión nueva, la política de emojis; en las dos, retocar
    if (v.em && v.em.aplicarEmojis) texto = v.em.aplicarEmojis(texto, t);
    texto = v.tx.retocar ? v.tx.retocar(texto) : texto;
    if (v.tx.conTitularidad && !t.redactado && /"titularidad":/.test(JSON.stringify(t.hechos))) texto = v.tx.conTitularidad(texto);
    if (t.redactado) v.red.apuntarReciente(r, t.tipo, texto);
    filas[i][v.nombre] = { texto, estado: t.redactado ? 'redactado' : `plantilla (${t.redaccion || '?'})`, llamadas, dolares: Math.round((gasto(r) - antesGasto) * 1e4) / 1e4, segundos: Math.round((Date.now() - t0) / 100) / 10,
      fallos: log.filter((s) => /intento \d|no lo publicaría|no ha pasado/.test(s)).map((s) => s.replace(/\s+«[\s\S]*$/, '').slice(0, 300)) };
    console.log(`${v.nombre} ${i + 1}/${lista.length} ${filas[i].tipo} ${filas[i][v.nombre].estado} ${filas[i][v.nombre].dolares} $`);
  }
  total += gasto(r);
  v.gasto = gasto(r);
}

// --- los tics, contados en las dos ---
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
  '«se va» con marcador': /\bse (?:va|iba|fue)\s+(?!a\s)[^.,;:\n]{0,30}?\d{1,2}\s?-\s?\d{1,2}/i,
  '«se va a N»': /\bse va a \d/i,
  '«sin sorpresas»': /sin sorpresas?|ninguna sorpresa|cambio raro/i,
  'la hora del reloj': /\b\d{1,2}:\d{2}\b|\ba las \d/i,
  'inicial con punto («Y. Zabiri»)': /(?<![\p{L}.])\p{Lu}\.\s\p{Lu}\p{Ll}/u,
};
const EMOJI = /\p{Extended_Pictographic}/gu;
const textos = (n) => filas.map((f) => f[n] && f[n].texto).filter(Boolean);
const empiezaEmoji = (s) => /^\p{Extended_Pictographic}/u.test(s);
const resumen = Object.fromEntries(V.map((v) => {
  const xs = textos(v.nombre), fs = filas.map((f) => f[v.nombre]).filter((x) => x && x.estado !== 'sin probar (tope)');
  return [v.nombre, {
    tuits: fs.length, redactados: fs.filter((x) => x.estado === 'redactado').length, llamadas: fs.reduce((a, x) => a + (x.llamadas || 0), 0),
    dolares: Math.round(v.gasto * 1e4) / 1e4, porTuit: fs.length ? Math.round((v.gasto / fs.length) * 1e4) / 1e4 : 0,
    porRedactado: fs.filter((x) => x.estado === 'redactado').length ? Math.round((v.gasto / fs.filter((x) => x.estado === 'redactado').length) * 1e4) / 1e4 : 0,
    palabras: xs.length ? Math.round(xs.reduce((a, s) => a + s.split(/\s+/).length, 0) / xs.length) : 0,
    emojis: xs.length ? Math.round((xs.reduce((a, s) => a + (s.match(EMOJI) || []).length, 0) / xs.length) * 10) / 10 : 0,
    sinEmojiArriba: xs.filter((s) => !empiezaEmoji(s)).length,
    tics: Object.fromEntries(Object.entries(TICS).map(([k, re]) => [k, xs.filter((s) => re.test(s)).length])),
  }];
}));
const sistema = Object.fromEntries(V.map((v) => [v.nombre, v.red.sistemaDe ? v.red.sistemaDe('final').length : 0]));

// --- la salida ---
const out = [];
out.push(`# Redacción con la guía de antes y con la nueva (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`, '');
out.push(`${lista.length} tuits reales de ahora (los hechos de \`ejecutar.mjs --volcar\`), redactados con Sonnet cada uno con su segunda lectura, como en el bot, y con los últimos tuits de cada tipo del registro de bot-estado. Antes: el código de f8df132 (\`pendiente\` del 22 nov). Ahora: \`bot-redaccion\`.`, '');
out.push('| | antes | ahora |', '|---|---|---|');
const fila = (k, f) => out.push(`| ${k} | ${f(resumen.antes)} | ${f(resumen.ahora)} |`);
fila('redactados', (x) => `${x.redactados} de ${x.tuits}`);
fila('llamadas a la IA', (x) => x.llamadas);
fila('gasto', (x) => `${x.dolares} $`);
fila('por tuit', (x) => `${x.porTuit} $`);
fila('por tuit redactado', (x) => `${x.porRedactado} $`);
out.push(`| instrucciones fijas (final) | ${sistema.antes} car. | ${sistema.ahora} car. |`);
fila('palabras por tuit', (x) => x.palabras);
fila('emojis por tuit', (x) => x.emojis);
fila('sin emoji arriba', (x) => x.sinEmojiArriba);
for (const k of Object.keys(TICS)) fila(k, (x) => x.tics[k]);
out.push('');
filas.forEach((f, i) => {
  out.push(`## ${i + 1}. ${f.tipo} · \`${f.clave}\``, '');
  for (const n of ['antes', 'ahora']) {
    const x = f[n] || {};
    out.push(`**${n === 'antes' ? 'Antes' : 'Ahora'}** (${x.estado || '?'}${x.llamadas != null ? `, ${x.llamadas} llamada${x.llamadas === 1 ? '' : 's'}, ${x.dolares} $` : ''})`, '');
    if (x.texto) out.push(x.texto.split('\n').map((l) => `> ${l}`).join('\n'), '');
    if (x.fallos && x.fallos.length) out.push(`<details><summary>lo que tiró el validador o el editor</summary>\n\n${x.fallos.map((s) => `- ${s}`).join('\n')}\n</details>`, '');
  }
});
writeFileSync(`${arg('salida', 'ab-redaccion')}.md`, out.join('\n'));
writeFileSync(`${arg('salida', 'ab-redaccion')}.json`, JSON.stringify({ resumen, sistema, filas }, null, 1));
console.log(`\nGastado: ${Math.round(total * 1e4) / 1e4} $ (antes ${resumen.antes.dolares}, ahora ${resumen.ahora.dolares})`);
