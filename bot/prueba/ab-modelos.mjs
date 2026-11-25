// SOLO EN LA RAMA pruebas-redaccion-ab. La prueba de Haiku (claude/bot-haiku-25nov.md del proyecto): los mismos tuits reales, con los
// mismos hechos y la misma prensa, redactados por cuatro variantes del bot con la IA de verdad, cada uno con su segunda lectura como en
// el bot y con el código de ahora (el modelo se elige con `ia.modelosPorTipo`, el cambio de la rama bot-haiku):
//   A: como ahora (Sonnet redacta, revisa y pule)       B: Haiku redacta, Sonnet revisa y pule
//   C: Haiku en todo                                   D: Haiku en todo con más esfuerzo (redactar high, revisar y pulir medium)
// (Pensar no es otra variante: a Haiku no se le manda `thinking` ni con pensar ni sin él, lib/claude.mjs, SIN_BETWEEN.)
// El directo no lleva revisor: B sería igual que C, así que en el directo B no se gasta.
//   node bot/prueba/ab-modelos.mjs --material=.github/ia/haiku/material.json --dir=.github/ia/haiku --salida=.github/ia/haiku/pasada --tope=1.9
// Para en cuanto lo gastado más lo que se espera del siguiente tuit pasa de --tope dólares (antes de empezarlo: todas las variantes
// tienen los mismos tuits). Deja <salida>.json con todo (textos, borradores, lo que tiró el validador o el editor, coste, tiempos).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as red from '../lib/redaccion.mjs';
import * as tx from '../lib/texto.mjs';
import * as ia from '../lib/ia.mjs';
import * as em from '../lib/emojis.mjs';

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const { tuits, jugadores = [], equipos = {} } = JSON.parse(readFileSync(arg('material'), 'utf8'));
const DIR = arg('dir', '.github/ia/haiku'), TOPE = Number(arg('tope', '1.9'));
const base = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const TIPOS = [...new Set(tuits.map((t) => t.tipo))];
const porTipo = (cosa) => Object.fromEntries([...new Set([...TIPOS, ...(base.redactar.tipos || [])])].map((t) => [t, cosa]));
const VARIANTES = {
  A: {},
  B: { redactar: 'haiku' },
  C: { redactar: 'haiku', revisar: 'haiku', pulir: 'haiku' },
  D: { redactar: 'haiku', revisar: 'haiku', pulir: 'haiku', esfuerzo: { redactar: 'high', revisar: 'medium', pulir: 'medium' } },
};
const nombres = (arg('variantes', 'A,B,C,D')).split(',');
const cfgDe = (v) => ({
  ...base,
  // el gasto de la prueba no es el del bot: sin reserva para partidos ni topes de preguntas; el tope es el de la prueba
  ia: { ...base.ia, topeDolaresDia: TOPE, reservaPartidos: 0, porDia: { clasificar: 999, redactar: 999, revisar: 999, pulir: 999 },
    ...(Object.keys(VARIANTES[v]).length ? { modelosPorTipo: porTipo(VARIANTES[v]) } : {}) },
  redactar: { ...base.redactar, activo: true, cacheSiempre: false, segundosEjecucion: 1e9 },
});
// lo que se espera que cueste un tuit en cada variante antes de tenerlo medido (de las pasadas del 22 nov)
const ESPERADO = { A: 0.06, B: 0.035, C: 0.006, D: 0.009 };
const ESPERADO_DIRECTO = { A: 0.025, B: 0, C: 0.002, D: 0.003 };
const recientes = { j13: 'recientes-j13.json', '24': 'recientes-24.json', hoy: 'recientes-hoy.json' };
const recBase = Object.fromEntries(Object.entries(recientes).map(([k, f]) => [k, JSON.parse(readFileSync(join(DIR, f), 'utf8'))]));

const V = Object.fromEntries(nombres.map((n) => [n, {
  config: cfgDe(n), reg: { datos: { enviados: [], fallosRedaccion: {} }, fichero: null, guardar() {} },
  rec: JSON.parse(JSON.stringify(recBase)), medido: [], medidoDirecto: [],
}]));
const gastoDe = (v) => ((V[v].reg.datos.ia || {}).dolares || 0);
const llamadasDe = (v) => ({ ...(((V[v].reg.datos.ia || {}).llamadas) || {}) });
const total = () => nombres.reduce((a, v) => a + gastoDe(v), 0);
const media = (xs, d) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : d);
const esperado = (v, tipo) => (tipo === 'directo' ? media(V[v].medidoDirecto, ESPERADO_DIRECTO[v]) : media(V[v].medido, ESPERADO[v]));

process.env.BOT_IA = 'claude';
const filas = [];
let parado = '';
for (const t0 of tuits) {
  const usa = nombres.filter((v) => !(v === 'B' && t0.tipo === 'directo'));
  const prev = usa.reduce((a, v) => a + esperado(v, t0.tipo) * 1.3, 0);
  if (total() + prev > TOPE) { parado = `paro antes de ${t0.clave}: ${total().toFixed(3)} $ gastados y este costaría unos ${prev.toFixed(3)} $`; console.log(parado); break; }
  const fila = { tipo: t0.tipo, clave: t0.clave, ronda: t0.ronda, plantilla: t0.texto, hechos: t0.hechos, numeros: t0.numeros, prensaDada: t0.prensa };
  for (const v of nombres) {
    if (!usa.includes(v)) { fila[v] = { igualQue: 'C' }; continue; }
    const X = V[v];
    const t = JSON.parse(JSON.stringify({ tipo: t0.tipo, modulo: t0.modulo, clave: t0.clave, jornada: t0.jornada, texto: t0.texto, hechos: t0.hechos, numeros: t0.numeros }));
    X.reg.datos.recientes = X.rec[t0.registro];
    const antes = gastoDe(v), llAntes = llamadasDe(v), ini = Date.now(), log = [];
    tx.fijarLimite(1000);
    try {
      await red.redactar([t], { tipo: t0.modulo || t0.tipo, registro: X.reg, config: X.config, jugadores, equipos, log: (s) => log.push(s), forzar: true, ahora: t0.ahora,
        cronicasDe: () => t0.prensa || [] });
    } catch (e) { log.push(`ERROR ${e.message}`); }
    const seg = Math.round((Date.now() - ini) / 100) / 10;
    let texto = t.texto;
    if (em.aplicarEmojis) texto = em.aplicarEmojis(texto, t);
    texto = tx.retocar(texto);
    if (tx.conTitularidad && !t.redactado && /"titularidad":/.test(JSON.stringify(t.hechos))) texto = tx.conTitularidad(texto);
    if (t.redactado) red.apuntarReciente(X.reg, t.tipo, texto, new Date(t0.ahora).toISOString());
    X.rec[t0.registro] = X.reg.datos.recientes;
    const dolares = Math.round((gastoDe(v) - antes) * 1e5) / 1e5;
    (t0.tipo === 'directo' ? X.medidoDirecto : X.medido).push(dolares);
    const ll = llamadasDe(v);
    fila[v] = {
      texto, redactado: !!t.redactado, causa: t.redaccion || '', modelo: t.redactado || '', revisadoPor: t.revisado || '', prensa: t.prensa || [],
      dolares, segundos: seg, llamadas: Object.fromEntries(['redactar', 'revisar', 'pulir'].map((u) => [u, (ll[u] || 0) - (llAntes[u] || 0)])),
      rechazosRevisor: log.filter((s) => /el revisor no lo publicaría/.test(s)).length,
      rechazosValidador: log.filter((s) => /, intento \d+: /.test(s) && !/el revisor/.test(s)).length,
      sinEsfuerzo: log.some((s) => /effort/i.test(s)),
      errores: log.filter((s) => /\(claude\)|\(ia\)|ERROR/.test(s)).slice(0, 6),
      fallos: log.filter((s) => /intento \d|no lo publicaría|no ha pasado|último intento|paso por alto/.test(s)).map((s) => s.replace(/\n\s+«[\s\S]*$/, '').slice(0, 900)),
      borradores: log.filter((s) => /intento \d/.test(s)).map((s) => (s.match(/\n\s+«([\s\S]*)»\s*$/) || [])[1]).filter(Boolean),
    };
    console.log(`${v} ${t0.clave}: ${t.redactado ? 'redactado' : `plantilla (${t.redaccion})`} · ${dolares} $ · ${seg} s · ${JSON.stringify(fila[v].llamadas)}${fila[v].rechazosRevisor ? ` · ${fila[v].rechazosRevisor} del revisor` : ''}`);
  }
  filas.push(fila);
}
const gasto = Object.fromEntries(nombres.map((v) => [v, Math.round(gastoDe(v) * 1e5) / 1e5]));
writeFileSync(`${arg('salida', join(DIR, 'pasada'))}.json`, JSON.stringify({ fecha: new Date().toISOString(), variantes: VARIANTES, tope: TOPE, parado, gasto, total: Math.round(total() * 1e5) / 1e5, filas }, null, 1));
console.log(`\nGastado: ${total().toFixed(4)} $ (${nombres.map((v) => `${v} ${gasto[v]}`).join(', ')})${parado ? ` · ${parado}` : ''}`);
