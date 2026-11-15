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
const out = await generar({ jugadores, equipos: { 4: 'FC Barcelona', 15: 'Real Madrid', 5: 'Real Betis', 1: 'Atlético de Madrid' }, jornada: 12, previos, ventanas: false, log: console.log,
  proximo: async (t) => ({ 4: { jornada: 12, rival: 'Valencia' }, 15: { jornada: 12, rival: 'Real Sociedad' }, 5: null }[t] || null) });
for (const t of out) { const v = validar(t.texto, { numeros: t.numeros }); if (!v.ok) fallos++; console.log(`--- ${t.clave} · ${v.ok ? 'válido' : v.errores}\n${t.texto}`); }
// desde el 3 nov, varios cambios van juntos en un tweet agrupado por lo que pasa
if (out.length !== 1 || !['Pedri', 'Vinícius', 'Isco'].every((n) => out[0].texto.includes(n)) || out.some((t) => /Suplente|Oblak/.test(t.texto))) { fallos++; console.log('FALLA: debía salir un tweet con Pedri, Vinícius e Isco, sin el suplente ni la duda'); }
const nada = await generar({ jugadores, equipos: {}, jornada: 12, previos, ventanas: true, proximo: async () => null, ahora: Date.parse('2026-11-03T02:00:00Z'), log: () => {} });
if (nada.length) { fallos++; console.log('FALLA: a las 3 de la mañana no debe salir'); }

// (16 nov) Pubill se lesiona con España contra Inglaterra y el tuit sale con el partido aún en juego (21:21): tiene que contar que se
// retiró lesionado en ese partido, no que «arrastra unas molestias desde el 15 de noviembre» (Carlos: «si el 15 es hoy y ha sido hace 2 h»)
{
  const ahora = Date.parse('2026-11-15T20:21:00Z');
  const paron = { jugada: 12, siguiente: 13, fin: Date.parse('2026-11-09T22:30:00Z'), ini: Date.parse('2026-11-20T20:00:00Z'), hasta: Date.parse('2026-11-17T20:00:00Z'), hueco: 11, activo: true };
  const pub = [J(10, 'Marc Pubill', 1, 'injured', 4.3, 51.4e6, 2)];
  const parte = [{ nombre: 'Marc Pubill', slug: 'marc-pubill', lesion: 'Molestias sin determinar', dia: 15, mes: 11, dias: null, estado: 'duda', hasta: null, jornada: 13 }];
  const P = (id, name, team, code) => ({ id, name, primaryTeamName: team, countryCode: code, performance: {} });
  const det = { header: { teams: [{ name: 'Spain', id: 6720, score: 1 }, { name: 'England', id: 8491, score: 1 }], status: { utcTime: '2026-11-15T19:45:00Z' } },
    content: { lineup: { homeTeam: { name: 'Spain', starters: [P(1323897, 'Marc Pubill', 'Atlético Madrid', 'ESP'), P(5, 'Pedri', 'Barcelona', 'ESP')], subs: [P(7, 'Óscar Mingueza', 'Celta Vigo', 'ESP')] },
      awayTeam: { name: 'England', starters: [P(8, 'Harry Kane', 'Bayern München', 'ENG')], subs: [] } },
      matchFacts: { events: { events: [{ type: 'Substitution', time: 21, injuredPlayerOut: true, swap: [{ id: 7 }, { id: 1323897 }] }] } } } };
  const pedirActas = async (url) => (/matches\?date=20261115/.test(url) ? { leagues: [{ name: 'Friendlies', matches: [{ id: 99, home: { name: 'Spain' }, away: { name: 'England' }, status: { started: true, ongoing: true, finished: false, utcTime: '2026-11-15T19:45:00Z' } }] }] }
    : /matchDetails/.test(url) ? det : { leagues: [] });
  const proximo = async () => ({ jornada: 13, rival: 'Getafe', fecha: '2026-11-22T15:00:00Z' });
  const base = { jugadores: pub, equipos: { 1: 'Atlético de Madrid' }, jornada: 13, previos: { 10: 'ok' }, ventanas: false, ahora, paron, listaPartes: parte, proximo, log: () => {} };
  const [t] = await generar({ ...base, pedirActas });
  const v = t && validar(t.texto, { numeros: t.numeros });
  console.log(`--- Pubill con España · ${v && v.ok ? 'válido' : v && v.errores}\n${t && t.texto}`);
  if (!t || !v.ok || !/minuto 21/.test(t.texto) || !/Inglaterra/.test(t.texto) || /desde el 15/.test(t.texto) || !/Inglaterra/.test(t.hechos.jugadores[0].dondeSeLesiono || '')) { fallos++; console.log('FALLA: debía contar que se retiró lesionado en el minuto 21 contra Inglaterra, sin «desde el 15»'); }
  // sin acta (FotMob no contesta): sin la fecha de hoy y con la nota de que la lesión es nueva
  const [t2] = await generar({ ...base, pedirActas: async () => null });
  console.log(`--- Pubill sin acta\n${t2 && t2.texto}`);
  if (!t2 || /desde el 15/.test(t2.texto) || /desde el 15/.test(t2.hechos.jugadores[0].motivo || '') || !/hoy/.test(t2.hechos.jugadores[0].ojo || '')) { fallos++; console.log('FALLA: una lesión de hoy no puede ir «desde el 15 de noviembre»'); }
}
console.log(fallos ? `${fallos} fallos` : 'todo bien'); process.exit(fallos ? 1 : 0);
