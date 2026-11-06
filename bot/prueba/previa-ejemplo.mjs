// La previa en tweet largo, sin red: con los datos del Osasuna-Athletic de la J12 (6 nov) sale una forma distinta según el orden del
// partido en la jornada, todas pasan el validador y ninguna se cuenta siempre «un párrafo por equipo».  node bot/prueba/previa-ejemplo.mjs
import { fijarLimite } from '../lib/texto.mjs';
import { validar } from '../lib/validar.mjs';
import { tweet } from '../lib/redactar.mjs';
import { previaLarga } from '../tipos/previa.mjs';
import { valoracionFinal } from '../tipos/final.mjs';

fijarLimite(1000);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };

const J = (id, nickname, med) => ({ id, nickname, averagePoints: med });
const jugadores = [J(1, 'Budimir', 7.5), J(2, 'Unai Simón', 5.2), J(3, 'Herrando', 4.1), J(4, 'Aimar', 3.9), J(5, 'Maroan', 5.4), J(6, 'Guruzeta', 4.8), J(7, 'Egiluz', 4.0),
  J(8, 'Dubasin', 3.1), J(9, 'Iker Muñoz', 3.6), J(10, 'Sergio Herrera', 3.4), J(11, 'Gerenabarrena', 3.0)];
const x = (id, nombre, p, pos = 'MED', estado = 'ok') => ({ id, nombre, p, pos, estado });
const probs = {
  L: Object.fromEntries([x(1, 'Budimir', 0.91, 'DEL'), x(3, 'Herrando', 0, 'DEF', 'injured'), x(4, 'Aimar', 0, 'MED', 'injured'), x(8, 'Dubasin', 0.58, 'DEL'), x(9, 'Iker Muñoz', 0.56, 'MED'), x(10, 'Sergio Herrera', 0.52, 'POR')].map((y) => [y.id, y])),
  V: Object.fromEntries([x(2, 'Unai Simón', 0.9, 'POR'), x(5, 'Maroan', 0, 'DEL', 'injured'), x(6, 'Guruzeta', 0, 'DEL', 'injured'), x(7, 'Egiluz', 0, 'DEF', 'injured'), x(11, 'Gerenabarrena', 0.53, 'MED')].map((y) => [y.id, y])),
};
const pos = { L: { once: [probs.L[1], probs.L[8], probs.L[9], probs.L[10]] }, V: { once: [probs.V[2], probs.V[11]] } };
const ahora = Date.parse('2026-11-06T06:00:00Z'), m = { date: '2026-11-07T17:30:00Z', local: { id: '10' }, visitor: { id: '20' } };
// la tabla (como la de lib/info-jugador.mjs): el Athletic 3º y el que más marca; el Osasuna 9º y de los que más encajan
const fila = (id, pos, pts, gf, gc, rgf, rgc) => ({ id, pos, pj: 11, pts, gf, gc, rgf, rgc });
const tabla = { n: 20, mediaPts: 1.4, mediaGoles: 1.3, porId: { 10: fila('10', 9, 14, 11, 18, 14, 3), 20: fila('20', 3, 22, 19, 10, 2, 15) } };

const formas = new Set(), cabs = new Set();
for (let k = 0; k < 8; k++) {
  const r = previaLarga({ L: 'Osasuna', V: 'Athletic', m, pos, probs, jugadores, jornada: 12, ahora, sem: 'previa108', k, tabla });
  const { texto } = tweet(r.cab, r.ideas);
  const v = validar(texto, { numeros: r.num, max: 1000 });
  console.log(`\n--- k=${k} (${texto.length} car.)\n${texto}`);
  ok(v.ok, `k=${k} pasa el validador ${v.errores.join('; ')}`);
  ok(!/undefined|NaN|\[object/.test(texto), `k=${k} sin undefined ni NaN`);
  ok(!/fantasy/i.test(texto), `k=${k} sin «fantasy» a la fuerza`);
  ok(/3º|9º/.test(texto) && /1,6|1,7|1,8|1,9|1,0/.test(texto), `k=${k} lleva la valoración (puestos y goles)`);
  ok(/Budimir/.test(texto) && /Gerenabarrena/.test(texto), `k=${k} sigue diciendo a Budimir y Gerenabarrena`);
  // con artículo, como se habla: «el Osasuna», no «Osasuna» (Carlos, 6 nov), salvo en el nombre del partido («Osasuna-Athletic»)
  ok(!/(\b(en|de|a|con|ante|sin)|[.:;] ?|^) ?Osasuna(?!-)/m.test(texto.replace(/\n/g, ' ').replace(/^🗓️[^\n]*\n/, '')) || /el Osasuna/.test(texto), `k=${k} «el Osasuna» con artículo`);
  ok(!/(^|[ ,.;:])Athletic(?!-)/.test(texto.split('\n\n').slice(1).join(' ').replace(/el Athletic/gi, '')), `k=${k} «el Athletic» con artículo`);
  formas.add(texto.split('\n\n').slice(1).map((p) => p.split(/[ ,:;]/)[0]).join('|')); cabs.add(r.cab);
}
ok(formas.size >= 5, `8 previas seguidas, ${formas.size} esqueletos distintos`);
ok(cabs.size >= 4, `8 previas seguidas, ${cabs.size} cabeceras distintas`);
// la valoración del final: sorpresa, favorito que cumple, y nada si no hay diferencia o es empate
const f = (gl, gv, a, b) => valoracionFinal({ gl, gv, L: 'Osasuna', V: 'Athletic', rl: fila('10', a, 0, 0, 0, 0, 0), rv: fila('20', b, 0, 0, 0, 0, 0) });
const s1 = f(2, 0, 14, 3), s2 = f(0, 2, 14, 3), s3 = f(1, 1, 14, 3), s4 = f(1, 0, 9, 7);
ok(s1 && /Sorpresa|inesperado/.test(s1.t) && /el Osasuna/.test(s1.t) && /al Athletic|ante el Athletic/.test(s1.t) && validar(s1.t, { numeros: s1.num }).ok, `sorpresa: ${s1 && s1.t}`);
ok(s2 && /favorito|normal/.test(s2.t) && validar(s2.t, { numeros: s2.num }).ok, `cumple el favorito: ${s2 && s2.t}`);
ok(!s3 && !s4, 'empate o poca diferencia: nada que valorar');
// sin Premium (280): no se usa previaLarga, nada que probar aquí
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
