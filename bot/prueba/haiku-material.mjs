// SOLO EN LA RAMA pruebas-redaccion-ab. El material de la prueba de Haiku (claude/bot-haiku-25nov.md del proyecto): tuits reales
// con sus hechos (lo que dejó `ejecutar.mjs --volcar`), por tipo y en rondas (uno de cada tipo antes del segundo de ninguno), con la
// prensa de cada uno ya elegida (la misma para todas las variantes), la hora a la que salió (para el validador) y de qué registro
// salen sus «recientes» (los de antes de esos tuits).
//   node bot/prueba/haiku-material.mjs .github/ia/haiku [noticias.json]  → .github/ia/haiku/material.json
//   (con --solo-noticias: deja lo que ya hay en material.json, con su prensa, y solo le añade las noticias; lo usa la Action, que
//   es la que tiene la IA para clasificarlas)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { crearCronicas } from '../lib/cronicas.mjs';

const dir = process.argv[2] || '.github/ia/haiku';
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const leer = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const j13 = leer('j13.json'), hoy = leer('semana.json'), s24 = leer('semana2.json');
const noticias = process.argv[3] && existsSync(process.argv[3]) ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : { tuits: [] };
const deTipo = (t) => (t.hechos && t.hechos.tipo) || t.tipo;
const busca = (vol, clave) => { const t = vol.tuits.find((x) => x.clave === clave); if (!t) throw new Error(`no está ${clave}`); return t; };

// la hora de cada partido de la J13 sale de su final
const fechaDe = new Map(j13.tuits.filter((t) => t.tipo === 'final').map((t) => [t.clave.split('|')[1], Date.parse(t.hechos.partido.fecha)]));
const minutoDe = (h) => Number(String(h.minuto || '').replace(/'.*$/, '').split('+').reduce((a, b) => Number(a) + Number(b || 0), 0)) || 45;
const ahoraJ13 = (t) => {
  const id = t.clave.split('|')[1], f = fechaDe.get(id);
  if (t.tipo === 'directo') return f + (minutoDe(t.hechos) + 12) * 60e3;
  if (t.tipo === 'resumen') return Math.max(...fechaDe.values()) + 3 * 3600e3;
  return f + 135 * 60e3;   // final y MVP: unos 10-15 min después del pitido, con los puntos ya puestos
};

// lo que se prueba, por tipo y en orden de importancia (dentro de cada tipo, el primero es el que entra en la primera ronda)
const LISTA = {
  directo: [['j13', 'directo|128|Tajon Buchanan|gol1'], ['j13', 'directo|128|Pau Navarro|roja'], ['j13', 'directo|124|Yassir Zabiri|gol2'],
    ['j13', 'directo|130|Lucas Boyé|penalti parado'], ['j13', 'directo|122|Carlos Espí|gol1']],
  final: [['j13', 'final|128'], ['j13', 'final|122'], ['j13', 'final|129']],
  mvp: [['j13', 'mvp|128'], ['j13', 'mvp|122'], ['j13', 'mvp|129']],
  previa: [['hoy', 'previa|133'], ['hoy', 'previa|134'], ['hoy', 'previa|135']],
  caidas: [['24', 'caidas|14|1715-3208'], ['24', 'caidas|14|1033-2005']],
  noticias: [],
  mercado: [['hoy', 'mercado|2026-11-25']],
  novedades: [['24', 'novedades|3077:vuelve,3182:lesion,356:vuelve|2026-11-25']],
  sancionados: [['24', 'sancionados|14|2785']],
  resumen: [['j13', 'resumen|13|mejores|10']],
  onceideal: [['hoy', 'onceideal|14']],
  selecciones: [['hoy', 'selecciones|13']],
};
// las noticias, de la pasada de la Action (con la IA que las clasifica): las 3 primeras de jugadores distintos
const vistosN = new Set();
for (const t of noticias.tuits.filter((x) => deTipo(x) === 'noticias')) {
  const quien = ((t.hechos.jugadores || [])[0] || {}).nombre || t.clave;
  if (vistosN.has(quien) || LISTA.noticias.length >= 3) continue;
  vistosN.add(quien); LISTA.noticias.push(['not', t.clave]);
}
const VOL = { j13, hoy, '24': s24, not: noticias };
const REG = { j13: 'j13', hoy: 'hoy', '24': '24', not: '24' };

const SOLO_NOTICIAS = process.argv.includes('--solo-noticias');
const previo = SOLO_NOTICIAS ? JSON.parse(readFileSync(join(dir, 'material.json'), 'utf8')).tuits.filter((t) => t.tipo !== 'noticias') : [];
if (SOLO_NOTICIAS) for (const k of Object.keys(LISTA)) if (k !== 'noticias') LISTA[k] = [];
const cronicas = crearCronicas({ config, log: () => {} });
const rondas = Math.max(0, ...Object.values(LISTA).map((xs) => xs.length));
const material = [];
for (let r = 0; r < rondas; r++) {
  for (const [tipo, xs] of Object.entries(LISTA)) {
    if (!xs[r]) continue;
    const [de, clave] = xs[r];
    const t = JSON.parse(JSON.stringify(busca(VOL[de], clave)));
    const ahora = de === 'j13' ? ahoraJ13(t) : Date.parse(VOL[de].hora || '') || Date.now();
    let prensa = [];
    try { prensa = await cronicas.de(t); } catch { prensa = []; }
    material.push({ ronda: r + 1, tipo: deTipo(t), modulo: t.modulo || t.tipo, de, registro: REG[de], ahora, prensa, ...t });
  }
}
if (SOLO_NOTICIAS) {
  const orden = ['directo', 'final', 'mvp', 'previa', 'caidas', 'noticias', 'mercado', 'novedades', 'sancionados', 'resumen', 'onceideal', 'selecciones'];
  material.push(...previo);
  material.sort((a, b) => a.ronda - b.ronda || orden.indexOf(a.tipo) - orden.indexOf(b.tipo));
}
const cuenta = {};
for (const t of material) cuenta[t.tipo] = (cuenta[t.tipo] || 0) + 1;
writeFileSync(join(dir, 'material.json'), JSON.stringify({ tuits: material, jugadores: j13.jugadores, equipos: j13.equipos }, null, 1));
console.log(`${material.length} tuits: ${Object.entries(cuenta).map(([k, n]) => `${k} ${n}`).join(', ')}; con prensa: ${material.filter((t) => t.prensa.length).map((t) => t.clave).join(', ') || 'ninguno'}`);
