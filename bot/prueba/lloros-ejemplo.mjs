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

const ts = escribir(cs, { jornada: 11 });
for (const t of ts) { const v = validar(t.texto, { numeros: t.numeros }); if (!v.ok) falla(`${t.clave}: ${v.errores.join('; ')}`); console.log(`--- ${t.clave} · peso ${v.peso}\n${t.texto}`); }
if (!/Vivian se quedó en 58 minutos con el Athletic sin encajar: 4 puntos menos/.test(ts[0].texto)) falla('línea del caso de minutos');
if (!/el Celta encajó en el 90\+2' y se le van 3 puntos/.test(ts[0].texto)) falla('línea del gol tardío');
const uno = escribir(cs.slice(0, 1), { jornada: 11 })[0];
console.log(`--- uno solo\n${uno.texto}`);
if (!/El defensa se quedó en 58/.test(uno.texto)) falla('uno solo: por su puesto');

// el minuto del gol encajado, de los detalles de ESPN
const espn = async () => ({ c: { details: [
  { scoringPlay: true, team: { id: 'C' }, clock: { value: 1200, displayValue: "20'" } },
  { scoringPlay: true, team: { id: 'S' }, clock: { value: 5520, displayValue: "90'+2'" } }] }, casa: { team: { id: 'C' } }, fuera: { team: { id: 'S' } } });
igual(await minutoGolEncajado(partidos[1], true, { espn }), { min: 90, extra: 2 }, 'minuto del gol encajado por el local');
igual(await minutoGolEncajado(partidos[1], false, { espn }), { min: 20, extra: 0 }, 'y por el visitante');

console.log(`\n${fallos ? `${fallos} fallos` : '0 fallos'}`);
process.exit(fallos ? 1 : 0);
