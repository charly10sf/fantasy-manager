// Cuenta lo que se repite en los tuits reales del bot (los de estado/registro.json, «recientes», y los de X si los hay).
// Uso: node bot/prueba/auditar-redaccion.mjs tuits.json [x.json] (tuits.json: [{ tipo, t, texto }], p. ej. los «recientes» de bot-estado)
import { readFileSync } from 'node:fs';
import { ARRANQUES } from '../lib/pulir.mjs';

const [, , fRec, fX] = process.argv;
const tuits = JSON.parse(readFileSync(fRec, 'utf8'));
const EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]{2}/gu;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ' %-]/g, ' ').replace(/\s+/g, ' ').trim();
// con nombres tapados: cada palabra con mayúscula que no va al principio de frase, y las cifras
const NOMB = /((?:\p{Lu}[\p{L}'’.-]*)(?:\s+(?:de\s+|del\s+)?\p{Lu}[\p{L}'’.-]*)*)/gu;
// (una palabra con mayúscula al principio de frase que sea corriente, «El», «Ya», «Si», se queda; los nombres, X)
const tapar = (s) => String(s).replace(EMOJI, ' ').replace(/[️‍]/g, '')
  .replace(NOMB, (m, _a, i, all) => {
    const antes = all.slice(0, i).trimEnd();
    const inicio = !antes || /[.!?:\n¡¿]$/.test(antes);
    const ws = m.split(/\s+/);
    if (inicio && ARRANQUES.has(norm(ws[0]))) return ws.length > 1 ? `${ws[0]} X` : m;
    return 'X';
  })
  .replace(/\d+(?:[.,]\d+)?/g, 'N');
const palabras = (s) => norm(s).split(' ').filter(Boolean);
const parrafos = (s) => String(s).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const frases = (s) => String(s).split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);

const cuenta = (xs) => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
const out = [];
const p = (s = '') => out.push(s);

p(`# ${tuits.length} tuits`);
const porTipo = cuenta(tuits.map((t) => t.tipo));
p(porTipo.map(([k, n]) => `${k} ${n}`).join(' · '));

// 1. aperturas: 4 primeras palabras del tuit y de cada párrafo
p('\n## Las 4 primeras palabras de cada tuit (con nombres y cifras tapados) que se repiten');
const ap = cuenta(tuits.map((t) => palabras(tapar(t.texto)).slice(0, 4).join(' ')));
for (const [k, n] of ap.filter(([, n]) => n > 1)) p(`- ${n} × «${k}»`);
p('\n## Las 4 primeras palabras de cada párrafo (tapadas) que se repiten');
const app = cuenta(tuits.flatMap((t) => parrafos(t.texto).map((x) => palabras(tapar(x)).slice(0, 4).join(' '))));
for (const [k, n] of app.filter(([, n]) => n > 1)) p(`- ${n} × «${k}»`);
p('\n## La primera palabra de cada párrafo (sin el emoji)');
p(cuenta(tuits.flatMap((t) => parrafos(t.texto).map((x) => palabras(tapar(x))[0] || ''))).slice(0, 15).map(([k, n]) => `${k} ${n}`).join(' · '));

// 2. muletillas: grupos de 3, 4 y 5 palabras (tapadas) que salen en 3 tuits o más
for (const n of [5, 4, 3]) {
  p(`\n## Grupos de ${n} palabras que salen en 3 tuits o más`);
  const m = new Map();
  for (const t of tuits) {
    const w = palabras(tapar(t.texto)), vistos = new Set();
    for (let i = 0; i + n <= w.length; i++) {
      const g = w.slice(i, i + n);
      if (g.filter((x) => !['x', 'n', 'el', 'la', 'de', 'del', 'y', 'en', 'a', 'al', 'los', 'las', 'que', 'con', 'se', 'un', 'una', 'lo', 'su', 'es'].includes(x)).length < Math.min(2, n - 1)) continue;
      vistos.add(g.join(' '));
    }
    for (const g of vistos) m.set(g, [...(m.get(g) || []), t.tipo]);
  }
  for (const [g, ts] of [...m].filter(([, ts]) => ts.length >= 3).sort((a, b) => b[1].length - a[1].length).slice(0, 40)) p(`- ${ts.length} × «${g}» (${cuenta(ts).map(([k, c]) => `${k}${c > 1 ? ` ${c}` : ''}`).join(', ')})`);
}

// 3. frases hechas que buscamos a mano
p('\n## Fórmulas concretas (en cuántos tuits)');
const FORMULAS = {
  'si lo tienes / si los tienes / quien lo tenga': /\bsi l[oa]s? tienes\b|\bquien l[oa]s? tenga\b|\bquien tenga\b/i,
  'más del doble / casi el doble / triple de su media': /\b(?:más del|casi el) (?:doble|triple)\b/i,
  'de media (cifra)': /\bde media\b|\bmedia de \d/i,
  'lo que suele (dar/hacer/sacar)': /\blo que suele\b|\bde lo que suele\b/i,
  '% de titularidad': /\d\s?% de titularidad/i,
  'con un N %': /\bcon un \d+\s?%/i,
  'en la imagen': /\ben la imagen\b/i,
  'sin sorpresas / ninguna sorpresa': /\bsin sorpresas\b|\bninguna sorpresa\b|\bno hay (ninguna )?sorpresa/i,
  'en una hora o así / falta una hora': /\buna hora o así\b|\bfalta una hora\b|\ben 1 ?h\b/i,
  'tiene más papeletas de jugar que de quedarse fuera': /más papeletas de jugar que de quedarse fuera/i,
  'lo normal es que salga': /lo normal es (?:que salga|verlo)/i,
  'puede estar tranquilo / respirar / relajarse': /\btranquilo|\brespirar|\brelajarse/i,
  'se va a N (puntos/M)': /\bse va a (?:\d|más)/i,
  'vale N M': /\bvale \d+(?:,\d+)? M\b/i,
  'ya suma N puntos': /\bya suma \d+/i,
  'de momento / por ahora': /\bde momento\b|\bpor ahora\b/i,
  'el mejor de los dos equipos': /\bel mejor de los dos equipos\b/i,
  'la nota mala / lo peor / la parte mala': /\bla (?:nota|parte) mala\b|\blo peor\b/i,
  'aunque pierde / pese a perder': /\baunque (?:el \S+ )?pierde\b|\bpese a perder\b/i,
  'jornada N (cifra)': /\bjornada \d+/i,
  'el domingo/sábado N de noviembre': /\b(?:lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d+ de \w+/i,
  'tras el parón / con la liga parada': /\btras el parón\b|\bcon la liga parada\b/i,
  'no hay plazo': /\bno hay plazo\b|\bsin plazo\b/i,
  'va Nº (clasificación)': /\bva \d+º|\b\d+º\b/i,
  'un rival de dificultad / partido asequible / cruce': /\bdificultad\b|\basequible\b|\bcruce\b/i,
  'el chollo / barato': /\bchollo\b|\bbarat[oa]\b/i,
  'días seguidos': /\bd[ií]as seguidos\b/i,
  'en el otro lado / al otro lado / en cambio / por su parte': /\b(?:en|al) el? ?otro lado\b|\ben cambio\b|\bpor su parte\b/i,
  '60 minutos o más': /\b60 minutos o más\b/i,
  'venta obligatoria': /\bventa obligatoria\b/i,
  'según (medio)': /\bseg[uú]n\b/i,
  'MAYÚSCULAS (grito)': /\b\p{Lu}{4,}\b/u,
  'fantasy (palabra)': /\bfantasy\b/i,
};
for (const [k, re] of Object.entries(FORMULAS)) {
  const ts = tuits.filter((t) => re.test(t.texto));
  if (ts.length) p(`- ${ts.length} × ${k} (${cuenta(ts.map((t) => t.tipo)).map(([a, c]) => `${a}${c > 1 ? ` ${c}` : ''}`).join(', ')})`);
}

// 4. largo: palabras y caracteres por tuit, por tipo
p('\n## Palabras por tuit (por tipo: media, mín–máx) y párrafos');
const porT = new Map();
for (const t of tuits) porT.set(t.tipo, [...(porT.get(t.tipo) || []), t]);
for (const [k, ts] of porT) {
  const ws = ts.map((t) => palabras(t.texto).length), ps = ts.map((t) => parrafos(t.texto).length);
  const fr = ts.map((t) => frases(t.texto).length);
  p(`- ${k}: ${Math.round(ws.reduce((a, b) => a + b, 0) / ws.length)} palabras (${Math.min(...ws)}–${Math.max(...ws)}), ${(ps.reduce((a, b) => a + b, 0) / ps.length).toFixed(1)} párrafos, ${(fr.reduce((a, b) => a + b, 0) / fr.length).toFixed(1)} frases`);
}
const todasW = tuits.map((t) => palabras(t.texto).length);
p(`- todos: ${Math.round(todasW.reduce((a, b) => a + b, 0) / todasW.length)} palabras de media`);
// largo de frase
const lf = tuits.flatMap((t) => frases(t.texto).map((f) => palabras(f).length));
p(`- frases: ${lf.length}, ${(lf.reduce((a, b) => a + b, 0) / lf.length).toFixed(1)} palabras de media; de 25 o más: ${lf.filter((x) => x >= 25).length}; de 5 o menos: ${lf.filter((x) => x <= 5).length}`);

// 5. emojis
p('\n## Emojis (en el cuerpo, sin la etiqueta)');
const ems = tuits.map((t) => [...String(t.texto).matchAll(EMOJI)].map((m) => m[0]));
p(`- por tuit: ${cuenta(ems.map((e) => e.length)).map(([k, n]) => `${k} emojis en ${n} tuits`).join(' · ')}`);
p(`- cuáles: ${cuenta(ems.flat()).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
const deClub = new Set(['⚪', '🦁', '🦇', '🚢', '🐂', '⚡', '🐸', '🌴', '🏝️', '🏝', '⚓', '🐟']);
const conClub = tuits.filter((t, i) => ems[i].some((e) => deClub.has(e)));
p(`- tuits con algún emoji de club: ${conClub.length} de ${tuits.length} (${cuenta(conClub.map((t) => t.tipo)).map(([a, c]) => `${a} ${c}`).join(', ')})`);
const parrEmoji = tuits.flatMap((t) => parrafos(t.texto).map((x, i) => ({ i, emoji: /^\p{Extended_Pictographic}/u.test(x) })));
p(`- párrafos que empiezan por emoji: primero ${parrEmoji.filter((x) => x.i === 0 && x.emoji).length}/${parrEmoji.filter((x) => x.i === 0).length}, los demás ${parrEmoji.filter((x) => x.i > 0 && x.emoji).length}/${parrEmoji.filter((x) => x.i > 0).length}`);
p(`- apertura por tipo: ${[...porT].map(([k, ts]) => `${k} ${cuenta(ts.map((t) => (String(t.texto).match(/^\p{Extended_Pictographic}️?/u) || ['—'])[0])).map(([e, n]) => `${e}${n > 1 ? `×${n}` : ''}`).join('')}`).join(' · ')}`);
// emoji de club con un equipo que tiene emoji y otro que no (Barça, Atleti…): media pareja
const SIN = ['Barça', 'Barcelona', 'Atlético', 'Atleti', 'Sevilla', 'Betis', 'Real Sociedad', 'la Real', 'Celta', 'Getafe', 'Espanyol', 'Alavés', 'Girona', 'Oviedo', 'Deportivo', 'Dépor', 'Real Madrid'];
p(`- tuits con emoji de club en los que sale un club sin emoji: ${conClub.filter((t) => SIN.some((n) => t.texto.includes(n) && !(n === 'Real Madrid'))).length}`);

if (fX) {
  const xs = JSON.parse(readFileSync(fX, 'utf8'));
  p(`\n## X: ${xs.length} tuits de la cuenta (con la etiqueta)`);
  const ex = xs.map((t) => [...String(t.texto).matchAll(EMOJI)].map((m) => m[0]));
  p(`- emojis por tuit: ${cuenta(ex.map((e) => e.length)).map(([k, n]) => `${k}: ${n}`).join(' · ')}`);
  p(`- cuáles: ${cuenta(ex.flat()).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  const ult = cuenta(xs.map((t) => { const ps = parrafos(t.texto); return ps.length > 1 ? tapar(ps[ps.length - 1]).slice(0, 40) : '—'; }));
  p('- último párrafo más repetido:'); for (const [k, n] of ult.slice(0, 12)) p(`  - ${n} × «${k}»`);
  const rep = xs.filter((t, i) => { const e = ex[i]; return e.length >= 2 && e[0] === e[e.length - 1] && parrafos(t.texto).length > 1; });
  p(`- con el mismo emoji arriba y en la etiqueta de abajo: ${rep.length}`);
  p(`- palabras por tuit: ${Math.round(xs.map((t) => palabras(t.texto).length).reduce((a, b) => a + b, 0) / xs.length)}`);
}
console.log(out.join('\n'));
