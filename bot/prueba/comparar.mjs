// La comparación a ciegas (plantilla frente a redactado) para que elija Carlos. Lee la salida de ejecutar.mjs en simulacro con
// --redactar=1 (un archivo, o el log de la Action «Bot pruebas redacción» bajado con `gh run view --log`), se queda con los tuits que
// tienen las dos versiones y, para cada uno, pone A y B en un orden que sale de la clave del tuit (sin patrón fijo).
//   node bot/prueba/comparar.mjs --log=salida.txt --casos=10 --salida=/tmp/comparacion
// Deja comparacion.md (los casos, sin decir cuál es cuál) y clave.md (la solución y lo que ha costado).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { hash } from '../lib/texto.mjs';

const arg = (k, d = '') => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const crudo = readFileSync(arg('log'), 'utf8');
// el log de una Action trae delante «job\tpaso\tfecha »: se quita
const lineas = crudo.split('\n').map((l) => l.replace(/^[^\t]*\t[^\t]*\t\d{4}-\d\d-\d\dT[\d:.]+Z ?/, ''));
const casos = [];
let cur = null, modo = null;
for (const l of lineas) {
  const m = l.match(/^--- (\S+) · /);
  if (m) { cur = { clave: m[1], nuevo: [], plantilla: [], modelo: null, prensa: null }; casos.push(cur); modo = 'nuevo'; continue; }
  if (!cur) continue;
  const r = l.match(/^ {3}\(redactado por ([^;)]+?)(?: con prensa de ([^;]+))?; la plantilla decía:\)/);
  if (r) { cur.modelo = r[1]; cur.prensa = r[2] || null; modo = 'plantilla'; continue; }
  if (/^ {3}\(hechos\)/.test(l)) continue;
  if (modo === 'plantilla') { if (/^ {3}\| ?/.test(l)) { cur.plantilla.push(l.replace(/^ {3}\| ?/, '')); continue; } modo = null; cur = null; continue; }
  if (modo === 'nuevo') { if (/^(## |# Total|\s+\(|\s+tarjeta )/.test(l)) { modo = null; continue; } cur.nuevo.push(l); }
}
const dobles = casos.filter((c) => c.modelo && c.plantilla.length).map((c) => ({ ...c, nuevo: c.nuevo.join('\n').trim(), plantilla: c.plantilla.join('\n').trim() }));
const n = Number(arg('casos', '10'));
// variedad de tipos: uno de cada tipo por turno hasta llenar
const porTipo = new Map();
for (const c of dobles) { const t = c.clave.split('|')[0]; if (!porTipo.has(t)) porTipo.set(t, []); porTipo.get(t).push(c); }
const elegidos = [];
while (elegidos.length < n && [...porTipo.values()].some((xs) => xs.length)) for (const xs of porTipo.values()) if (xs.length && elegidos.length < n) elegidos.push(xs.shift());
const dir = arg('salida', '/tmp/comparacion');
mkdirSync(dir, { recursive: true });
const md = [`# Comparación a ciegas: ${elegidos.length} tuits`, '', 'En cada caso, A y B dicen lo mismo con los mismos datos. Una es la plantilla de hoy y la otra la redacción nueva, en un orden que cambia de un caso a otro. Apunta cuál prefieres en cada uno (A o B) y, si quieres, por qué.', ''];
const clave = ['# Solución', ''];
elegidos.forEach((c, i) => {
  const aNuevo = hash(`ciego:${c.clave}`) % 2 === 0;
  const [A, B] = aNuevo ? [c.nuevo, c.plantilla] : [c.plantilla, c.nuevo];
  md.push(`## ${i + 1}. ${c.clave.split('|')[0]}`, '', '**A**', '', '```', A, '```', '', '**B**', '', '```', B, '```', '');
  clave.push(`${i + 1}. ${c.clave}: la nueva es la **${aNuevo ? 'A' : 'B'}**${c.prensa ? ` (con prensa de ${c.prensa})` : ''}`);
});
const sinRedactar = casos.filter((c) => !c.modelo).length;
clave.push('', `Redactados: ${dobles.length}. Con la plantilla (no se redactaron o no pasaron el validador): ${sinRedactar}.`);
const gasto = crudo.match(/\(ia\) gasto de hoy: [^\n]+/g);
if (gasto) clave.push('', gasto[gasto.length - 1].replace(/^.*\(ia\) /, ''));
writeFileSync(`${dir}/comparacion.md`, md.join('\n'));
writeFileSync(`${dir}/clave.md`, clave.join('\n'));
console.log(`${elegidos.length} casos (de ${dobles.length} redactados; ${sinRedactar} con la plantilla) en ${dir}`);
