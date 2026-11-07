// Reparto de los posibles onces, sin red: se recorre el tiempo de 5 en 5 minutos (como el cron) y se mira cuándo saldría cada uno.
//   node bot/prueba/escalonar-ejemplo.mjs
import { tocaPosible } from '../lib/escalonar.mjs';
import { horaMadrid } from '../lib/horario.mjs';

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };
const hm = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const config = { previaPosibles: { abreHoras: 84, separacionMin: 120, porDia: 3, sinTopeHoras: 24 } };
const enHora = (t) => horaMadrid(t) >= 9 && horaMadrid(t) < 23;

/** una semana: partidos (ms) de la jornada objetivo, desde `desde` hasta el primer partido; devuelve cuándo sale cada previa */
function simular({ saques, desde, hasta = Math.min(...saques) + 6 * 3600e3 }) {
  const salidos = [], pendientes = [...saques].sort((a, b) => a - b), publicadas = [];
  const primero = Math.min(...saques);
  for (let ahora = desde; ahora < hasta; ahora += 5 * 60e3) {
    if (!enHora(ahora) || !pendientes.length) continue;
    if (!tocaPosible({ primero, ahora, config, salidos }).ok) continue;
    const i = pendientes.findIndex((s) => s - ahora > 3 * 3600e3);   // los que empiezan en menos de 3 h ya van con el once confirmado
    if (i < 0) continue;
    const [s] = pendientes.splice(i, 1);
    salidos.push(ahora); publicadas.push({ ahora, saque: s });
  }
  return { publicadas, pendientes };
}
const T = (s) => Date.parse(s);
const mostrar = (r) => r.publicadas.forEach((p, i) => console.log(`   ${i + 1}. sale ${hm.format(p.ahora)} (partido ${hm.format(p.saque)})`));

// 1) el caso de hoy: sábado 7 nov, 09:00, la J12 empezó el viernes 21:00 → ningún posible once de la J12
console.log('Sábado 7 nov, 09:00: J12 empezó el viernes 21:00');
const hoy = tocaPosible({ primero: T('2026-11-06T20:00:00Z'), ahora: T('2026-11-07T08:00:00Z'), config, salidos: [] });
ok(!hoy.ok && /cerradas/.test(hoy.motivo), `no sale ninguno (${hoy.motivo})`);

// 2) la J13 empieza el viernes 13 nov a las 21:00 y tiene 10 partidos hasta el lunes: del sábado 7 al viernes 13
const J13 = ['2026-11-13T20:00:00Z', '2026-11-14T13:00:00Z', '2026-11-14T15:15:00Z', '2026-11-14T17:30:00Z', '2026-11-14T20:00:00Z', '2026-11-15T13:00:00Z',
  '2026-11-15T15:15:00Z', '2026-11-15T17:30:00Z', '2026-11-15T20:00:00Z', '2026-11-16T20:00:00Z'].map(T);
console.log('J13 (primer partido, viernes 13 a las 21:00), de sábado 7 a viernes 13:');
const r = simular({ saques: J13, desde: T('2026-11-07T08:00:00Z') });
mostrar(r);
const dias = {}; r.publicadas.forEach((p) => { const d = hm.format(p.ahora).split(',')[0] + hm.format(p.ahora).slice(0, 6); dias[d] = (dias[d] || 0) + 1; });
ok(r.pendientes.length === 0, 'salen los 10 antes de que empiece la jornada');
ok(r.publicadas[0].ahora >= T('2026-11-10T08:00:00Z'), 'no sale ninguno antes del martes 10 de noviembre (84 h antes: martes 09:00)');
ok(r.publicadas.every((p, i) => i === 0 || p.ahora - r.publicadas[i - 1].ahora >= 60 * 60e3), 'nunca dos con menos de 60 min');
const porDia = {}; r.publicadas.forEach((p) => { const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(p.ahora); porDia[d] = (porDia[d] || 0) + 1; });
console.log('   por día:', JSON.stringify(porDia));
ok(Math.max(...Object.values(porDia)) <= 4, 'como mucho 4 en un día (3 y el apretón de las últimas 24 h)');
ok(r.publicadas.slice(0, 3).every((p, i, a) => i === 0 || p.ahora - a[i - 1].ahora >= 120 * 60e3), 'los del martes, separados 2 h');

// 3) jornada entre semana (martes a las 21:00) con 6 partidos y el lunes por la tarde la anterior ya acabada
console.log('Jornada de entre semana (martes 21:00, 6 partidos), desde el lunes 9:00:');
const MS = ['2026-12-01T20:00:00Z', '2026-12-01T20:00:00Z', '2026-12-02T18:00:00Z', '2026-12-02T20:00:00Z', '2026-12-02T20:30:00Z', '2026-12-03T20:00:00Z'].map(T);
const r2 = simular({ saques: MS, desde: T('2026-11-30T08:00:00Z') });
mostrar(r2);
ok(r2.pendientes.length <= 1, 'con poco tiempo salen casi todos (queda como mucho uno, que va con el once confirmado)');

// 4) reglas sueltas
const base = T('2026-11-10T09:00:00Z'), prim = T('2026-11-13T20:00:00Z');
ok(!tocaPosible({ primero: prim, ahora: T('2026-11-09T20:00:00Z'), config }).ok, 'lunes por la noche (a 96 h) aún no');
ok(!tocaPosible({ primero: prim, ahora: base, config, salidos: [base - 30 * 60e3] }).ok, 'con otro salido hace 30 min, espera');
ok(!tocaPosible({ primero: prim, ahora: base + 8 * 3600e3, config, salidos: [base - 3 * 3600e3, base - 2 * 3600e3, base] }).ok, 'tres ya hoy: espera a mañana');
ok(tocaPosible({ primero: prim, ahora: T('2026-11-13T10:00:00Z'), config, salidos: [T('2026-11-13T06:00:00Z'), T('2026-11-13T07:00:00Z'), T('2026-11-13T08:00:00Z')] }).ok, 'a menos de 24 h del primer partido no hay tope por día');
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
