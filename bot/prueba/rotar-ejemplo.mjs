// Prueba de `turno`/`rotar` (bot/lib/texto.mjs): las formas de los finales y MVP de una jornada rotan por el orden del partido, sin
// repetir forma en dos seguidos y con todas las formas en cada tanda de n.
//   node bot/prueba/rotar-ejemplo.mjs
import { turno, rotar, ordenJornada } from '../lib/texto.mjs';
import { formaMejor } from '../tipos/final.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };

for (const n of [2, 3, 4, 5]) for (const sem of ['mvp11', 'lect12', 'det13', 'cierre14', 'peor15', 'x']) {
  const xs = Array.from({ length: 40 }, (_, k) => turno(n, sem, k));
  if (xs.some((x) => !(x >= 0 && x < n))) falla(`${sem} n=${n}: fuera de rango`);
  for (let k = 1; k < xs.length; k++) if (xs[k] === xs[k - 1]) falla(`${sem} n=${n}: k=${k} repite la de antes`);
  for (let b = 0; b + n <= xs.length; b += n) if (new Set(xs.slice(b, b + n)).size !== n) falla(`${sem} n=${n}: la tanda ${b / n} no tiene todas`);
  // repetible: la misma semilla y el mismo k, la misma forma
  if (turno(n, sem, 7) !== turno(n, sem, 7)) falla('no es repetible');
}
// dos jornadas no salen con la misma secuencia
const seq = (j) => Array.from({ length: 10 }, (_, k) => formaMejor(j, k)).join('');
if (seq(11) === seq(12) && seq(12) === seq(13)) falla(`las jornadas 11, 12 y 13 salen iguales: ${seq(11)}`);
console.log(`J11 ${seq(11)} · J12 ${seq(12)} · J13 ${seq(13)}`);
if (rotar(['a'], 's', 5) !== 'a') falla('una sola forma');
// el orden de la jornada: por hora y, a la misma hora, por id
const o = ordenJornada([{ id: 3, date: '2026-11-08T20:00:00Z' }, { id: 2, date: '2026-11-07T15:00:00Z' }, { id: 1, date: '2026-11-08T20:00:00Z' }]);
if (o.join() !== '2,1,3') falla(`orden: ${o}`);

console.log(`\n${fallos ? `${fallos} fallos` : '0 fallos'}`);
process.exit(fallos ? 1 : 0);
