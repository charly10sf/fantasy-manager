// Onces confirmados de ESPN (6 nov, Sevilla-Alavés de la J12): «Isaac Romero» casó con Rafa Romero, portero del Sevilla, y la tarjeta
// salió con dos porteros y un «4-2-3». Comprueba el casado (nombre entero antes que el apellido suelto, nunca un portero con uno de
// campo) y las líneas del dibujo de ESPN con los `formationPlace` de Opta.   node bot/prueba/onces-espn-ejemplo.mjs
import assert from 'node:assert/strict';
import { casarJugador } from '../tipos/directo.mjs';
import { lineasEspn, dibujo, OPTA } from '../lib/formacion.mjs';

// la plantilla del Sevilla tal como la da LaLiga (Isaac sale sin apellido; Rafa Romero es portero)
const sevilla = { players: [
  ['Vlachodimos', 1], ['Rafa Romero', 1], ['Kike Salas', 2], ['Juan Iglesias', 2], ['Sangante', 2], ['Suazo', 2], ['Agoumé', 3],
  ['Fofana', 3], ['Vargas', 4], ['Félix Correia', 4], ['Isaac', 4], ['Stassin', 4],
].map(([n, p], i) => ({ id: i + 1, nickname: n, name: n, positionId: p })) };
const nom = (x) => (x ? x.nickname : null);
assert.equal(nom(casarJugador('Isaac Romero', sevilla, { portero: false })), 'Isaac');
assert.equal(nom(casarJugador('Isaac Romero', sevilla)), 'Isaac');                      // aun sin saber el puesto
assert.equal(nom(casarJugador('Enrique Salas', sevilla, { portero: false })), 'Kike Salas');   // el apellido suelto sigue valiendo
assert.equal(nom(casarJugador('Odisseas Vlachodimos', sevilla, { portero: true })), 'Vlachodimos');
// sin Isaac en la plantilla, un delantero «Romero» no casa con el portero
const sinIsaac = { players: sevilla.players.filter((p) => p.nickname !== 'Isaac') };
assert.equal(casarJugador('Isaac Romero', sinIsaac, { portero: false }), null);
// iniciales: «C. Romero» es «Cristian Romero»
assert.equal(nom(casarJugador('Cristian Romero', { players: [{ id: 1, nickname: 'C. Romero', positionId: 2 }, { id: 2, nickname: 'Rafa Romero', positionId: 1 }] })), 'C. Romero');

// el once de ESPN del Sevilla (4-2-3-1) en su orden, con su formationPlace
const tits = [['Vlachodimos', 1], ['Salas', 6], ['Iglesias', 2], ['Sangante', 5], ['Suazo', 3], ['Agoumé', 8], ['Fofana', 4], ['Vargas', 7],
  ['Correia', 11], ['Isaac', 10], ['Stassin', 9]].map(([n, f]) => ({ n, formationPlace: String(f) }));
const l = lineasEspn(tits, '4-2-3-1');
assert.equal(l.formacion, '4-2-3-1');
assert.deepEqual(l.filas.map((f) => f.map((i) => tits[i].n)), [['Vlachodimos'], ['Suazo', 'Salas', 'Sangante', 'Iglesias'], ['Fofana', 'Agoumé'], ['Correia', 'Isaac', 'Vargas'], ['Stassin']]);
assert.equal(lineasEspn(tits, '4-2-3-2'), null);                                          // no suma 10
assert.equal(lineasEspn(tits.map((x, i) => (i === 3 ? { ...x, formationPlace: '2' } : x)), '4-2-3-1'), null);   // puesto repetido
assert.equal(dibujo('4231'), '4-2-3-1');
// la tabla: cada dibujo suma 10 y usa los puestos del 2 al 11 una vez
for (const [f, filas] of Object.entries(OPTA)) {
  assert.deepEqual(filas.map((x) => x.length), f.split('-').map(Number), f);
  assert.deepEqual(filas.flat().sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], f);
}
// 7 nov, Osasuna-Athletic: LaLiga abrevia «Aitor Fdez» y ESPN dice «Aitor Fernández» (salió sin cara)
{
  const { casarJugador } = await import('../tipos/directo.mjs');
  const { faltaEnPalabras } = await import('../tipos/previa.mjs');
  const { revisar } = await import('../lib/redaccion.mjs');
  const lado = { players: [{ id: 204, positionId: 1, name: 'Aitor Fdez', nickname: 'Aitor Fdez' }, { id: 644, positionId: 1, name: 'Sergio Herrera', nickname: 'Sergio Herrera' }] };
  assert.equal(casarJugador('Aitor Fernández', lado, { portero: true }).id, 204);
  assert.equal(casarJugador('Sergio Herrera', lado, { portero: true }).id, 644);
  assert.equal(faltaEnPalabras(62 * 60000), 'en una hora o así');
  assert.equal(faltaEnPalabras(5 * 3600000), null);
  const h = { tipo: 'onces', jornada: 12, partido: { partido: 'Osasuna-Athletic', local: 'Osasuna', visitante: 'Athletic', estadio: 'El Sadar' }, equipos: [{ club: 'Osasuna', formacion: '4-3-3' }, { club: 'Athletic', formacion: '4-2-3-1' }], sinSorpresas: true, jugadores: [], clubes: { Osasuna: { nombres: ['el Osasuna'] }, Athletic: { nombres: ['el Athletic'] } } };
  const e = revisar('👀 Ya hay onces en El Sadar: el Osasuna sale con un 4-3-3, y a las 18:30 arranca el partido.', { hechos: h, recientes: ['👀 Ya hay onces confirmados en La Rosaleda.'] });
  assert.ok(e.some((x) => x.includes('hora del reloj')) && e.some((x) => x.includes('«Ya hay onces')), e.join(' | '));
}
console.log('onces-espn-ejemplo: bien');
