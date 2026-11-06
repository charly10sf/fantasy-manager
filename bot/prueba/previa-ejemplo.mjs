// La previa en tweet largo, sin red: con los datos del Osasuna-Athletic de la J12 (6 nov) sale una forma distinta según el orden del
// partido en la jornada, todas pasan el validador y ninguna se cuenta siempre «un párrafo por equipo».  node bot/prueba/previa-ejemplo.mjs
import { fijarLimite } from '../lib/texto.mjs';
import { validar } from '../lib/validar.mjs';
import { tweet } from '../lib/redactar.mjs';
import { previaLarga } from '../tipos/previa.mjs';

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
const ahora = Date.parse('2026-11-06T06:00:00Z'), m = { date: '2026-11-07T17:30:00Z' };

const formas = new Set(), cabs = new Set();
for (let k = 0; k < 8; k++) {
  const r = previaLarga({ L: 'Osasuna', V: 'Athletic', m, pos, probs, jugadores, jornada: 12, ahora, sem: 'previa108', k });
  const { texto } = tweet(r.cab, r.ideas);
  const v = validar(texto, { numeros: r.num, max: 1000 });
  console.log(`\n--- k=${k} (${texto.length} car.)\n${texto}`);
  ok(v.ok, `k=${k} pasa el validador ${v.errores.join('; ')}`);
  ok(!/undefined|NaN|\[object/.test(texto), `k=${k} sin undefined ni NaN`);
  ok(/Budimir/.test(texto) && /Gerenabarrena/.test(texto), `k=${k} sigue diciendo a Budimir y Gerenabarrena`);
  formas.add(texto.split('\n\n').slice(1).map((p) => p.split(/[ ,:;]/)[0]).join('|')); cabs.add(r.cab);
}
ok(formas.size >= 5, `8 previas seguidas, ${formas.size} esqueletos distintos`);
ok(cabs.size >= 4, `8 previas seguidas, ${cabs.size} cabeceras distintas`);
// sin Premium (280): no se usa previaLarga, nada que probar aquí
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
