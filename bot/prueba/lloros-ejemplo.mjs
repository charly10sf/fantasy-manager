// Prueba de «Lloros Fantasy» sin red: los dos casos (se queda en menos de 60 minutos con su equipo a cero; gol encajado a partir
// del 85'), lo que no es un lloro y el texto.
//   node bot/prueba/lloros-ejemplo.mjs
import { casos, escribir, minutoGolEncajado, BONUS } from '../tipos/lloros.mjs';
import { validar } from '../lib/validar.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };
const igual = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falla(`${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

const J = (id, nickname, positionId, averagePoints = 5, marketValue = 10e6) => ({ id, nickname, positionId, averagePoints, marketValue });
const jugadores = [J(1, 'Unai Simón', 1), J(2, 'Vivian', 2), J(3, 'Yuri', 2), J(4, 'Sancet', 3), J(5, 'Guruzeta', 4), J(6, 'Suplente', 2, 1, 1e6),
  J(11, 'Soria', 1), J(12, 'Djené', 2, 6), J(13, 'Arambarri', 3)];
const P = (id) => ({ id });
// Athletic 2-0 Getafe; Real Madrid 2-1 Osasuna no está; Getafe encaja… no: el Getafe pierde 2-0 (no hay lloro suyo)
// Partido 2: Celta 1-1 Sevilla con el gol del Sevilla en el 90+2: los del Celta con 60 o más pierden la portería a cero
const partidos = [
  { id: 100, date: '2026-11-01T15:00:00Z', localScore: 2, visitorScore: 0, local: { mainName: 'Athletic Club', players: [P(1), P(2), P(3), P(4), P(5), P(6)] }, visitor: { mainName: 'Getafe CF', players: [P(11)] } },
  { id: 200, date: '2026-11-01T17:00:00Z', localScore: 1, visitorScore: 1, local: { mainName: 'RC Celta', players: [P(12), P(13)] }, visitor: { mainName: 'Sevilla FC', players: [] } },
];
// (para la prueba, Djené y Arambarri son del Celta)
const st = (min, gc, extra = {}) => ({ playerStats: [{ weekNumber: 11, stats: { mins_played: [min, min >= 60 ? 2 : 1], goals_conceded: [gc, 0], ...extra } }] });
const fichas = {
  1: st(90, 0),            // portero a cero los 90: no es lloro
  2: st(58, 0),            // defensa en 58 con el equipo a cero: lloro de 4 (3 + 1)
  3: st(45, 0),            // cambiado en el descanso: no es «por muy poco», fuera
  4: st(59, 0),            // centrocampista en 59: lloro de 3 (2 + 1)
  5: st(55, 0),            // delantero: fuera (solo porteros, defensas y centrocampistas)
  6: st(50, 0),            // no pesa: fuera
  12: st(90, 1),           // defensa del Celta con el gol del 90+2: lloro de 3
  13: st(75, 0),           // lo cambiaron antes del gol: tiene su portería a cero, no es lloro
};
const golTarde = { '200|l': { min: 90, extra: 2 } };
const cs = casos({ partidos, jornada: 11, jugadores, fichas, golTarde });
igual(cs.map((x) => [x.nombre, x.caso, x.pierde]), [['Vivian', 'minutos', 4], ['Djené', 'gol', 3], ['Sancet', 'minutos', 3]], 'casos');
igual(BONUS, { 1: 4, 2: 3, 3: 2, 4: 1 }, 'portería a cero por posición');
// un gol en el 80': no es tardío
igual(casos({ partidos, jornada: 11, jugadores, fichas, golTarde: { '200|l': { min: 80, extra: 0 } } }).map((x) => x.nombre), ['Vivian', 'Sancet'], 'gol en el 80');
// con roja no es un lloro
igual(casos({ partidos, jornada: 11, jugadores, fichas: { ...fichas, 2: st(58, 0, { red_card: [1, -3] }) }, golTarde }).map((x) => x.nombre), ['Djené', 'Sancet'], 'expulsado');

import { fijarLimite } from '../lib/texto.mjs';
import { lineaLloro, lineasLloros } from '../tipos/lloros.mjs';
for (const max of [280, 1000]) {
  fijarLimite(max);
  const ts = escribir(cs, { jornada: 11 });
  for (const t of ts) { const v = validar(t.texto, { numeros: t.numeros }); if (!v.ok) falla(`${max} ${t.clave}: ${v.errores.join('; ')}`); console.log(`--- ${max} ${t.clave} · peso ${v.peso}\n${t.texto}`); }
  if (!/Vivian/.test(ts[0].texto) || !/\b58\b/.test(ts[0].texto) || !/\b4\b/.test(ts[0].texto)) falla(`${max}: línea del caso de minutos`);
  if (!/Djené/.test(ts[0].texto) || !/90\+2'/.test(ts[0].texto) || !/3 puntos/.test(ts[0].texto)) falla(`${max}: línea del gol tardío`);
  // con tweets largos caben los tres, y Vivian y Sancet (los dos por minutos) no salen con la misma frase
  if (max > 280 && !/Sancet/.test(ts[0].texto)) falla('largo: caben los tres');
  const uno = escribir(cs.slice(0, 1), { jornada: 11 })[0];
  console.log(`--- ${max} uno solo\n${uno.texto}`);
  if (!/(El|Al) defensa/.test(uno.texto) || /Vivian.*Vivian/s.test(uno.texto)) falla(`${max} uno solo: por su puesto`);
}
fijarLimite(280);
// las formas de cada caso: todas distintas, con sus cifras y sin «a el»
const molde = (l, x) => l.replace(x.nombre, 'N').replace(/\d+/g, '#');
for (const x of cs) {
  const ls = [0, 1, 2].map((v) => lineaLloro(x, false, v));
  if (new Set(ls.map((l) => molde(l, x))).size !== 3) falla(`${x.nombre}: formas repetidas`);
  for (const v of [0, 1, 2]) { const l = lineaLloro(x, true, v); if (/\ba el\b|\bA el\b/.test(l)) falla(`«a el» en ${l}`); }
  for (const l of ls) { const v = validar(l, { numeros: [11, ...(x.caso === 'minutos' ? [x.pierde, x.min, 60, 60 - x.min] : [x.pierde, x.gol.min, x.gol.extra])] }); if (!v.ok) falla(`${l}: ${v.errores.join('; ')}`); }
}
// los dos del Athletic van juntos en una frase
fijarLimite(1000);
const t3 = escribir(cs, { jornada: 11 })[0].texto;
if (!/El Athletic acabó a cero, pero Vivian \(58 minutos\) y Sancet \(59\) no llegaron a los 60: 4 y 3 puntos menos/.test(t3)) falla(`grupo del Athletic: ${t3}`);
// dos por minutos de equipos distintos: frases distintas, sea cual sea la jornada
const otro = { ...cs[0], nombre: 'Mingueza', equipo: 'Celta', min: 57, pierde: 3, pos: 2 };
const molde2 = (l) => l.replace(/Vivian|Mingueza/, 'N').replace(/el Athletic|el Celta/, 'E').replace(/\d+/g, '#');
for (const j of [9, 10, 11, 12, 13, 14]) {
  const [a, b] = lineasLloros([cs[0], otro], { jornada: j });
  if (molde2(a) === molde2(b)) falla(`J${j}: calcados: ${a} / ${b}`);
}
// el mismo gol en un equipo: juntos y «cada uno» si pierden lo mismo
const g2 = [{ ...cs[1] }, { ...cs[1], nombre: 'Aidoo', id: 99 }];
const lg = lineasLloros(g2, { jornada: 11 });
if (lg.length !== 1 || !/El Celta encajó en el 90\+2' y lo pagan Djené y Aidoo: 3 puntos menos cada uno/.test(lg[0])) falla(`grupo del gol: ${lg}`);
// seis en un tweet largo: del cuarto en adelante, juntos por caso; y «le faltó un minuto» con 59
fijarLimite(1000);
const seis = [
  { nombre: 'Lejeune', caso: 'minutos', min: 59, pierde: 4, equipo: 'Rayo', pos: 2 }, { nombre: 'Kounde', caso: 'minutos', min: 54, pierde: 4, equipo: 'Barça', pos: 2 },
  { nombre: 'Djené', caso: 'gol', gol: { min: 90, extra: 2 }, pierde: 3, equipo: 'Getafe', pos: 2 }, { nombre: 'Bartra', caso: 'minutos', min: 56, pierde: 4, equipo: 'Betis', pos: 2 },
  { nombre: 'Catena', caso: 'minutos', min: 52, pierde: 4, equipo: 'Osasuna', pos: 2 }, { nombre: 'Parejo', caso: 'gol', gol: { min: 88, extra: 0 }, pierde: 2, equipo: 'Villarreal', pos: 3 }];
const l6 = lineasLloros(seis, { jornada: 12 });
if (l6.length !== 5 || !/Bartra \(56\) y Catena \(52\) tampoco llegaron a los 60 con su equipo a cero: 4 puntos menos cada uno/.test(l6[3]) || !/A Parejo \(88'\) también le quitó la portería a cero un gol al final: 2 puntos menos/.test(l6[4])) falla(`seis: ${l6.join(' | ')}`);
const t6 = escribir(seis, { jornada: 12 })[0];
const v6 = validar(t6.texto, { numeros: t6.numeros }); if (!v6.ok || !/Parejo/.test(t6.texto)) falla(`seis en el tweet: ${v6.errores.join('; ')} ${t6.texto}`);
console.log(`--- seis · peso ${v6.peso}\n${t6.texto}`);
for (let v = 0; v < 3; v++) { const l = lineaLloro({ ...seis[0] }, false, v); if (/1 minutos/.test(l)) falla(l); }
if (!/le faltó un minuto/.test([0, 1, 2].map((v) => lineaLloro(seis[0], false, v)).join(' '))) falla('«le faltó un minuto»');
fijarLimite(280);

// el minuto del gol encajado, de los detalles de ESPN
const espn = async () => ({ c: { details: [
  { scoringPlay: true, team: { id: 'C' }, clock: { value: 1200, displayValue: "20'" } },
  { scoringPlay: true, team: { id: 'S' }, clock: { value: 5520, displayValue: "90'+2'" } }] }, casa: { team: { id: 'C' } }, fuera: { team: { id: 'S' } } });
igual(await minutoGolEncajado(partidos[1], true, { espn }), { min: 90, extra: 2 }, 'minuto del gol encajado por el local');
igual(await minutoGolEncajado(partidos[1], false, { espn }), { min: 20, extra: 0 }, 'y por el visitante');

console.log(`\n${fallos ? `${fallos} fallos` : '0 fallos'}`);
process.exit(fallos ? 1 : 0);
