// La previa espera si la jornada o el partido están en el aire (lib/aire.mjs), sin red.  node bot/prueba/aire-ejemplo.mjs
import { enElAire } from '../lib/aire.mjs';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };
const ahora = Date.parse('2026-11-05T08:00:00Z');
const reg = (...es) => ({ datos: { enviados: es.map(([clave, t]) => ({ clave, tipo: 'liga', jornada: 12, t })) } });
const m = { id: 112, local: { id: 15 }, visitor: { id: 9 }, date: '2026-11-07T20:00:00Z' };
const E = (r) => enElAire(r, { jornada: 12, m, ahora }).espera;
ok(!E(reg()), 'sin noticias: sigue');
ok(E(reg(['liga|suspension|j|se_estudia|J12', '2026-11-04T12:52:03Z'])), 'se estudia suspender la jornada: espera');
ok(!enElAire(reg(['liga|suspension|j|se_estudia|J12', '2026-11-04T12:52:03Z']), { jornada: 14, m, ahora }).espera, 'dos jornadas después: sigue');
ok(enElAire(reg(['liga|suspension|j|se_estudia|J11', '2026-11-04T12:52:03Z']), { jornada: 12, m, ahora }).espera, 'publicado la semana de antes («la próxima jornada»): espera');
ok(!E(reg(['liga|suspension|j|se_estudia|J12', '2026-11-04T12:52:03Z'], ['liga|suspension|j|descartado|J12', '2026-11-05T07:00:00Z'])), 'descartado: sigue');
ok(!E(reg(['liga|suspension|j|se_estudia|J12', '2026-11-03T16:00:00Z'])), 'se estudiaba hace más de 36 h sin decisión: sigue');
ok(E(reg(['liga|aplazamiento|p15-9|se_estudia|J12', '2026-11-05T06:00:00Z'])), 'se estudia aplazar ese partido: espera');
ok(!enElAire(reg(['liga|aplazamiento|p15-9|se_estudia|J12', '2026-11-05T06:00:00Z']), { jornada: 12, m: { id: 1, local: { id: 1 }, visitor: { id: 2 }, date: m.date }, ahora }).espera, 'otro partido: sigue');
ok(!E(reg(['liga|horario|p15-9|confirmado|J12', '2026-11-05T06:00:00Z'])), 'un cambio de horario no para la previa');
ok(!E(null), 'sin registro (simulacro): sigue');
// cada tema por su último tweet (auditoría del 5 nov)
ok(E(reg(['liga|aplazamiento|p15-9|se_estudia|J12', '2026-11-05T06:00:00Z'], ['liga|suspension|j|descartado|J12', '2026-11-05T07:00:00Z'])), 'descartan suspender la jornada, pero se sigue estudiando aplazar este partido: espera');
ok(E(reg(['liga|suspension|j|confirmado|J12', '2026-11-05T06:00:00Z'], ['liga|aplazamiento|c15|descartado|J12', '2026-11-05T07:00:00Z'])), 'jornada suspendida y un «descartado» de otro tema: espera');
// confirmado: espera con la fecha de antes y sigue en cuanto cambia (aunque la nueva esté cerca)
const r1 = reg(['liga|suspension|j|confirmado|J12', '2026-11-05T07:00:00Z']);
ok(E(r1), 'confirmado, con la fecha de antes: espera');
ok(!enElAire(r1, { jornada: 12, m: { ...m, date: '2026-11-10T19:00:00Z' }, ahora }).espera, 'confirmado y el partido ya tiene fecha nueva (el lunes): sigue');
ok(!enElAire(reg(['liga|suspension|j|confirmado|J12', '2026-11-05T07:00:00Z']), { jornada: 12, m: { ...m, date: '2026-12-16T20:00:00Z' }, ahora }).espera, 'confirmado, visto ya con la fecha nueva lejana: sigue');
// registros raros
ok(!enElAire({ datos: { enviados: [null, { clave: 5 }, { clave: 'liga' }, { clave: 'liga|suspension' }] } }, { jornada: 12, m, ahora }).espera, 'entradas raras en el registro: sin excepción');
ok(!enElAire({ datos: { enviados: 'x' } }, { jornada: 12, m, ahora }).espera, 'enviados que no es una lista: sin excepción');
console.log(`\n${fallos} fallos`);
process.exit(fallos ? 1 : 0);
