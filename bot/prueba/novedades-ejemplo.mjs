// Prueba de las novedades de jugadores con datos inventados: node bot/prueba/novedades-ejemplo.mjs
import { generar } from '../tipos/novedades.mjs';
import { validar } from '../lib/validar.mjs';
const J = (id, nickname, teamId, playerStatus, averagePoints, marketValue = 20e6, positionId = 3) => ({ id, nickname, teamId, playerStatus, averagePoints, marketValue, positionId });
const jugadores = [J(1, 'Pedri', 4, 'injured', 7.1), J(2, 'Vinícius', 15, 'ok', 8.4, 150e6, 4), J(3, 'Isco', 5, 'suspended', 6.2), J(4, 'Suplente', 4, 'injured', 1.2, 1e6), J(5, 'Oblak', 1, 'doubtful', 5.5, 30e6, 1)];
const previos = { 1: 'ok', 2: 'injured', 3: 'ok', 4: 'ok', 5: 'ok' };
const registro = { claves: new Set(), datos: {}, guardar() {} };
let fallos = 0;
const prim = await generar({ jugadores, equipos: { 4: 'FC Barcelona', 15: 'Real Madrid', 5: 'Real Betis', 1: 'Atlético de Madrid' }, jornada: 12, registro, ventanas: false, log: () => {} });
if (prim.length) { fallos++; console.log('FALLA: la primera vez no debe publicar'); }
const out = await generar({ jugadores, equipos: { 4: 'FC Barcelona', 15: 'Real Madrid', 5: 'Real Betis', 1: 'Atlético de Madrid' }, jornada: 12, previos, ventanas: false, log: console.log });
for (const t of out) { const v = validar(t.texto, { numeros: t.numeros }); if (!v.ok) fallos++; console.log(`--- ${t.clave} · ${v.ok ? 'válido' : v.errores}\n${t.texto}`); }
if (out.length !== 1 || /Suplente|Oblak/.test(out[0].texto)) { fallos++; console.log('FALLA: debía salir un tweet con Pedri, Vinícius e Isco, sin el suplente ni la duda'); }
const nada = await generar({ jugadores, equipos: {}, jornada: 12, previos, ventanas: true, ahora: Date.parse('2026-11-03T02:00:00Z'), log: () => {} });
if (nada.length) { fallos++; console.log('FALLA: a las 3 de la mañana no debe salir'); }
console.log(fallos ? `${fallos} fallos` : 'todo bien'); process.exit(fallos ? 1 : 0);
