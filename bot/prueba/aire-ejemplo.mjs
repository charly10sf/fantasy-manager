// La previa espera si la jornada o el partido están en el aire (lib/aire.mjs), sin red.  node bot/prueba/aire-ejemplo.mjs
import { enElAire, apuntarDecision, tocaPendiente } from '../lib/aire.mjs';
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
// con la decisión, ejecutar.mjs apunta la fecha que tenía cada partido de la jornada (apuntarDecision)
const conFecha = (r, clave, ms = [m]) => { apuntarDecision(r, clave, ms); return r; };
ok(E(conFecha(reg(['liga|suspension|j|confirmado|J12', '2026-11-05T06:00:00Z'], ['liga|aplazamiento|c15|descartado|J12', '2026-11-05T07:00:00Z']), 'liga|suspension|j|confirmado|J12')), 'jornada suspendida y un «descartado» de otro tema: espera');
// confirmado: espera con la fecha de antes y sigue en cuanto cambia (aunque la nueva esté cerca)
const r1 = conFecha(reg(['liga|suspension|j|confirmado|J12', '2026-11-05T07:00:00Z']), 'liga|suspension|j|confirmado|J12');
ok(E(r1), 'confirmado, con la fecha de antes: espera');
ok(!enElAire(r1, { jornada: 12, m: { ...m, date: '2026-11-10T19:00:00Z' }, ahora }).espera, 'confirmado y el partido ya tiene fecha nueva (el lunes): sigue');
ok(!enElAire(r1, { jornada: 12, m: { ...m, date: '2026-12-16T20:00:00Z' }, ahora }).espera, 'confirmado y fecha nueva lejana: sigue');
// aplazado a una fecha cercana: la previa lo ve por primera vez ya con la fecha nueva y sale (antes la guardaba como «la de antes» y
// esperaba hasta el saque; auditoría del 5 nov)
const r2 = conFecha(reg(['liga|aplazamiento|p15-9|confirmado|J12', '2026-11-05T07:00:00Z']), 'liga|aplazamiento|p15-9|confirmado|J12');
ok(!enElAire(r2, { jornada: 12, m: { ...m, date: '2026-11-09T19:00:00Z' }, ahora: Date.parse('2026-11-08T20:00:00Z') }).espera, 'aplazado al lunes, visto el domingo: sigue');
ok(enElAire(r2, { jornada: 12, m, ahora }).espera, 'aplazado y aún con la fecha de antes: espera');
ok(!E(reg(['liga|suspension|j|confirmado|J12', '2026-11-05T07:00:00Z'])), 'confirmado sin fecha apuntada (registro de antes): sigue');
// el tema sin la jornada: un «se estudia» de la J11 y el «descartado» de la J12 son lo mismo
ok(!E(reg(['liga|suspension|j|se_estudia|J11', '2026-11-04T12:52:03Z'], ['liga|suspension|j|descartado|J12', '2026-11-05T07:00:00Z'])), 'se estudia (J11) y descartado (J12): sigue');
// la J12 suspendida no para la J13
const r3 = conFecha(reg(['liga|suspension|j|confirmado|J12', '2026-11-05T07:00:00Z']), 'liga|suspension|j|confirmado|J12', [m, { id: 130, local: { id: 15 }, visitor: { id: 3 }, date: '2026-11-11T19:00:00Z' }]);
ok(!enElAire(r3, { jornada: 13, m: { id: 130, local: { id: 15 }, visitor: { id: 3 }, date: '2026-11-11T19:00:00Z' }, ahora }).espera, 'J12 suspendida: la previa de la J13 sale');
// apuntarDecision solo con lo confirmado y solo los partidos a los que toca
const r4 = reg(); ok(apuntarDecision(r4, 'liga|aplazamiento|p15-9|confirmado|J12', [m, { id: 1, local: { id: 1 }, visitor: { id: 2 } }]) === 1, 'apunta solo el partido aplazado');
ok(apuntarDecision(reg(), 'liga|suspension|j|se_estudia|J12', [m]) === 0 && apuntarDecision(reg(), 'liga|horario|j|confirmado|J12', [m]) === 0, 'ni «se estudia» ni horarios');
// «suspendida la J13» publicado el domingo de la J12 (clave J12): ejecutar.mjs apunta los partidos de la J13 con su jornada
const m12 = { id: 120, local: { id: 1 }, visitor: { id: 2 }, date: '2026-11-08T20:00:00Z', matchState: 1 };
const m13 = { id: 131, local: { id: 15 }, visitor: { id: 9 }, date: '2026-11-11T19:00:00Z', matchState: 1 };
const r6 = reg(['liga|suspension|j|confirmado|J12', '2026-11-08T10:00:00Z']);
apuntarDecision(r6, 'liga|suspension|j|confirmado|J12', [m13], 13);
ok(!enElAire(r6, { jornada: 12, m: m12, ahora: Date.parse('2026-11-08T12:00:00Z') }).espera, 'J13 suspendida: lo que queda de la J12 sale');
ok(enElAire(r6, { jornada: 13, m: m13, ahora: Date.parse('2026-11-09T12:00:00Z') }).espera, 'J13 suspendida: la J13 espera');
ok(tocaPendiente('liga|aplazamiento|p15-9|confirmado|J12', [m13]) && !tocaPendiente('liga|aplazamiento|p15-9|confirmado|J12', [{ ...m13, matchState: 7 }]) && !tocaPendiente('liga|aplazamiento|p15-9|confirmado|J12', [m12]), 'tocaPendiente');
// registros raros
ok(!enElAire({ datos: { enviados: [null, { clave: 5 }, { clave: 'liga' }, { clave: 'liga|suspension' }] } }, { jornada: 12, m, ahora }).espera, 'entradas raras en el registro: sin excepción');
ok(!enElAire({ datos: { enviados: 'x' } }, { jornada: 12, m, ahora }).espera, 'enviados que no es una lista: sin excepción');
ok(!enElAire({ datos: { enviados: [{ clave: 'liga|suspension|j|confirmado|J12', t: '2026-11-05T07:00:00Z' }], aire: 5 } }, { jornada: 12, m, ahora }).espera, '«aire» que no es un objeto: sin excepción');
ok(!enElAire({ datos: { enviados: [{ clave: 'liga|suspension|j|confirmado|J12', t: '2026-11-05T07:00:00Z' }], aire: { 'suspension|j|J12': 'x' } } }, { jornada: 12, m, ahora }).espera, 'una entrada de «aire» rara: sin excepción');
const r5 = { datos: { enviados: [], aire: [1] } }; apuntarDecision(r5, 'liga|suspension|j|confirmado|J12', [m]); ok(!Array.isArray(r5.datos.aire) && r5.datos.aire['suspension|j|J12'], 'apuntar con un «aire» raro');
console.log(`\n${fallos} fallos`);
process.exit(fallos ? 1 : 0);
