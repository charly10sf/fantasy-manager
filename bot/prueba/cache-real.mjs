// SOLO EN LA RAMA pruebas-cache (no se fusiona). La caché de 1 hora con la IA de verdad (26 nov, claude/prompt-cache-bot.md del
// proyecto): 5 tuits reales de la prueba de Haiku (material de pruebas-redaccion-ab, variante A: Sonnet redacta y revisa, como en el
// bot) redactados con el código de la rama bot-cache, en este orden:
//   1. un directo (escribe la guía y los ejemplos del directo);
//   2. ESPERA de 5,5 min (más que la caché de 5 min: lo que se lea después solo puede venir de la de 1 hora);
//   3. y 4. otros dos directos (leen la guía y los ejemplos del directo);
//   5. y 6. dos finales (el primero lee la guía y escribe sus ejemplos; el editor escribe lo suyo; el segundo lee todo).
// Apunta, de cada llamada, los tokens de entrada, leídos y escritos en caché (5 min y 1 hora) y lo que cuesta, y lo que habrían costado
// esos mismos tokens sin caché. Para en cuanto lo gastado pasa de --tope.
//   node bot/prueba/cache-real.mjs --material=.github/ia/cache/material.json --dir=.github/ia/cache --salida=.github/ia/cache/pasada.json --tope=0.8 [--espera=330]
// Sin ANTHROPIC_API_KEY (o con --seco=1) usa una IA de mentira: sirve para ver que el script funciona sin gastar.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as red from '../lib/redaccion.mjs';
import * as tx from '../lib/texto.mjs';
import { preguntar } from '../lib/ia.mjs';
import { revisarConIA } from '../lib/revisor.mjs';
import { coste, PRECIOS, SONNET } from '../lib/claude.mjs';

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const { tuits, jugadores = [], equipos = {}, pasadaA = {} } = JSON.parse(readFileSync(arg('material'), 'utf8'));
const DIR = arg('dir', '.github/ia/cache'), TOPE = Number(arg('tope', '0.8')), ESPERA = Number(arg('espera', '330'));
const SECO = arg('seco') === '1' || !process.env.ANTHROPIC_API_KEY;
const base = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const config = { ...base,
  ia: { ...base.ia, topeDolaresDia: TOPE, reservaPartidos: 0, porDia: { clasificar: 999, redactar: 999, revisar: 999, pulir: 999 } },
  redactar: { ...base.redactar, activo: true, segundosEjecucion: 1e9 } };
process.env.BOT_IA = 'claude';
if (SECO) process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'seco';
console.log(`cacheTTL: ${config.ia.cacheTTL}; ${SECO ? 'EN SECO (IA de mentira)' : 'con la IA de verdad'}; tope ${TOPE} $`);

const llamadas = [];
let actual = null, gastado = 0;
const P = PRECIOS[SONNET];
// el fetch que se usa: el de verdad (o uno de mentira en seco) y apunta el uso de cada respuesta
const espia = async (url, op) => {
  const cuerpo = JSON.parse(op.body);
  if (gastado > TOPE) throw new Error(`tope de la prueba (${gastado.toFixed(3)} $)`);
  let r, texto;
  if (SECO) {
    const esRev = /editor/i.test(JSON.stringify(cuerpo.system || '').slice(0, 300));
    texto = JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(esRev ? { publicable: true, problemas: [] } : { texto: 'Gol de prueba en seco.', cronicas: [] }) }], stop_reason: 'end_turn',
      usage: { input_tokens: 800, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
    r = { status: 200, text: async () => texto };
  } else {
    r = await fetch(url, op);
    texto = await r.text();
  }
  let u = null;
  try { u = JSON.parse(texto).usage || null; } catch { /* nada */ }
  const marcas = (cuerpo.system || []).map((b) => (b.cache_control ? (b.cache_control.ttl || '5m') : '-'));
  const sinCache = u ? ((u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)) * P.entrada / 1e6 + (u.output_tokens || 0) * P.salida / 1e6 : 0;
  const dolares = u ? coste(cuerpo.model, u, '1h') : 0;
  gastado += dolares;
  const fila = { tuit: actual, uso: /editor/i.test(JSON.stringify(cuerpo.system || '').slice(0, 300)) ? 'revisar' : 'redactar', modelo: cuerpo.model, status: r.status,
    bloques: (cuerpo.system || []).map((b) => b.text.length), marcas, usage: u, dolares: Math.round(dolares * 1e6) / 1e6, sinCache: Math.round(sinCache * 1e6) / 1e6,
    t: new Date().toISOString() };
  if (r.status !== 200) fila.error = texto.slice(0, 300);
  llamadas.push(fila);
  console.log(`  ${fila.uso.padEnd(8)} ${String(r.status)} marcas ${marcas.join('/')} entrada ${u ? u.input_tokens : '?'} · leído ${u ? u.cache_read_input_tokens : '?'} · escrito ${u ? u.cache_creation_input_tokens : '?'} ${u && u.cache_creation ? `(5m ${u.cache_creation.ephemeral_5m_input_tokens}, 1h ${u.cache_creation.ephemeral_1h_input_tokens})` : ''} · salida ${u ? u.output_tokens : '?'} · ${fila.dolares} $ (sin caché ${fila.sinCache} $)`);
  return { status: r.status, text: async () => texto };
};
const pedir = (op) => preguntar({ ...op, pedir: espia });
const revisor = (a) => revisarConIA({ ...a, pedir });
const recientes = JSON.parse(readFileSync(join(DIR, 'recientes-j13.json'), 'utf8'));

// el orden: directos primero (el de en medio tras la espera), luego los finales
const orden = [...tuits.filter((t) => t.tipo === 'directo'), ...tuits.filter((t) => t.tipo !== 'directo')];
const filas = [];
for (let i = 0; i < orden.length; i++) {
  const t0 = orden[i];
  if (i === 1 && ESPERA > 0) { console.log(`espero ${ESPERA} s (más que la caché de 5 min)…`); await new Promise((ok) => setTimeout(ok, ESPERA * 1000)); }
  if (gastado > TOPE) { console.log(`paro: ${gastado.toFixed(3)} $ gastados`); break; }
  actual = t0.clave;
  console.log(`\n${t0.clave}`);
  const t = JSON.parse(JSON.stringify({ tipo: t0.tipo, modulo: t0.modulo, clave: t0.clave, jornada: t0.jornada, texto: t0.texto, hechos: t0.hechos, numeros: t0.numeros }));
  const reg = { datos: { enviados: [], fallosRedaccion: {}, recientes: JSON.parse(JSON.stringify(recientes)) }, fichero: null, guardar() {} };
  const log = [];
  tx.fijarLimite(1000);
  const antes = llamadas.length;
  try {
    await red.redactar([t], { tipo: t0.modulo || t0.tipo, registro: reg, config, jugadores, equipos, log: (s) => log.push(s), forzar: true, ahora: t0.ahora,
      cronicasDe: () => t0.prensa || [], pedir, revisor });
  } catch (e) { log.push(`ERROR ${e.message}`); }
  const mias = llamadas.slice(antes);
  const suma = (k) => mias.reduce((a, c) => a + ((c.usage && c.usage[k]) || 0), 0);
  const fila = { clave: t0.clave, tipo: t0.tipo, redactado: !!t.redactado, texto: t.texto, llamadas: mias.length,
    redactar: mias.filter((c) => c.uso === 'redactar').length, revisar: mias.filter((c) => c.uso === 'revisar').length,
    entrada: suma('input_tokens'), leido: suma('cache_read_input_tokens'), escrito: suma('cache_creation_input_tokens'), salida: suma('output_tokens'),
    dolares: Math.round(mias.reduce((a, c) => a + c.dolares, 0) * 1e6) / 1e6, sinCache: Math.round(mias.reduce((a, c) => a + c.sinCache, 0) * 1e6) / 1e6,
    pasadaA: pasadaA[t0.clave] || null, log: log.slice(-12) };
  filas.push(fila);
  console.log(`  → ${fila.redactado ? 'redactado' : 'plantilla'}: ${fila.llamadas} llamadas, ${fila.dolares} $ (sin caché ${fila.sinCache} $; el 25 nov, A: ${fila.pasadaA ? `${fila.pasadaA.dolares} $ en ${fila.pasadaA.llamadas.redactar + fila.pasadaA.llamadas.revisar} llamadas` : '?'})`);
}
const total = { dolares: Math.round(gastado * 1e6) / 1e6, sinCache: Math.round(llamadas.reduce((a, c) => a + c.sinCache, 0) * 1e6) / 1e6, llamadas: llamadas.length,
  errores: llamadas.filter((c) => c.status !== 200).length };
console.log(`\nTOTAL: ${total.llamadas} llamadas (${total.errores} con error), ${total.dolares} $; los mismos tokens sin caché, ${total.sinCache} $`);
writeFileSync(arg('salida', join(DIR, 'pasada.json')), JSON.stringify({ fecha: new Date().toISOString(), seco: SECO, cacheTTL: config.ia.cacheTTL, espera: ESPERA, total, filas, llamadas }, null, 1));
