// Prueba sin red de las revalorizaciones de la temporada en el parón (tipos/revalorizaciones.mjs; Carlos, 9 nov): con históricos de
// valor inventados, los que más suben y bajan desde el inicio, la sorpresa, el tuit y la tarjeta del mercado con otro titular.
//   node bot/prueba/revalorizaciones-ejemplo.mjs
import { generar, revalorizaciones } from '../tipos/revalorizaciones.mjs';
import { svgMercado } from '../lib/tarjetas.mjs';
import { validarTarjeta, validar } from '../lib/validar.mjs';
import { PALABRAS_FIJAS } from '../lib/datos-tarjetas.mjs';

let fallos = 0;
const bien = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) fallos++; };
const letras = (n) => { let x = ''; for (n += 25; n > 0; n = Math.floor((n - 1) / 26)) x = String.fromCharCode(97 + ((n - 1) % 26)) + x; return x[0].toUpperCase() + x.slice(1); };
const CLUBES = ['Real Madrid', 'FC Barcelona', 'Atlético de Madrid', 'Villarreal CF', 'Real Betis', 'Levante UD'];
const stats = [0, 2, 4].map((i) => ({ id: i, matchState: 1, date: '2026-11-20T20:00:00Z', local: { id: i + 1, mainName: CLUBES[i] }, visitor: { id: i + 2, mainName: CLUBES[i + 1] } }));
// 260 jugadores: el valor de inicio y el de hoy, con 100 días de histórico
const jugadores = [], hist = {};
for (let i = 1; i <= 260; i++) {
  const ini = (2 + (i % 40)) * 1e6, fin = ini * (0.5 + ((i * 37) % 100) / 60);
  jugadores.push({ id: String(i), nickname: `Jugador ${letras(i)}`, positionId: String(1 + (i % 4)), teamId: String(1 + (i % 6)), playerStatus: 'ok', marketValue: String(Math.round(fin)), weekPoints: [{ weekNumber: 1, points: 5 }] });
  hist[i] = Array.from({ length: 100 }, (_, k) => ({ marketValue: Math.round(ini + (fin - ini) * k / 99), date: new Date(Date.parse('2026-07-31T22:00:00Z') + k * 864e5).toISOString() }));
}
// el que más sube y el que más baja, claros; un fichaje sin histórico, fuera
jugadores.push({ id: '900', nickname: 'Cohete', positionId: '4', teamId: '2', playerStatus: 'ok', marketValue: '90000000', weekPoints: [] });
hist[900] = Array.from({ length: 100 }, (_, k) => ({ marketValue: 10e6 + 80e6 * k / 99, date: new Date(Date.parse('2026-07-31T22:00:00Z') + k * 864e5).toISOString() }));
jugadores.push({ id: '901', nickname: 'Desplome', positionId: '3', teamId: '1', playerStatus: 'ok', marketValue: '20000000', weekPoints: [] });
hist[901] = Array.from({ length: 100 }, (_, k) => ({ marketValue: 120e6 - 100e6 * k / 99, date: new Date(Date.parse('2026-07-31T22:00:00Z') + k * 864e5).toISOString() }));
jugadores.push({ id: '902', nickname: 'Recien', positionId: '3', teamId: '1', playerStatus: 'ok', marketValue: '50000000', weekPoints: [] });
hist[902] = [{ marketValue: 1e6, date: '2026-11-01T00:00:00Z' }, { marketValue: 50e6, date: '2026-11-08T00:00:00Z' }];

const fs = revalorizaciones(jugadores, jugadores.map((j) => hist[j.id]));
bien(!fs.some((f) => f.nombre === 'Recien'), 'sin un mes de histórico no se compara');
const [t] = await generar({ jugadores, stats, jornada: 13, ventanas: false, config: {}, paron: { jugada: 12, siguiente: 13 }, pedirValor: (id) => Promise.resolve(hist[id]), log: () => {} });
bien(t && t.clave === 'revalorizaciones|12' && t.soloConImagen, 'un tuit con la clave del parón y solo con imagen');
bien(t.hechos.queMasSube.nombre === 'Cohete' && t.hechos.queMasBaja.nombre === 'Desplome', `el que más sube (${t.hechos.queMasSube.nombre} ${t.hechos.queMasSube.cambio}) y el que más baja (${t.hechos.queMasBaja.nombre} ${t.hechos.queMasBaja.cambio})`);
const v = validar(t.texto, { numeros: t.numeros, max: 1000 });
bien(v.ok, `la plantilla pasa el validador${v.ok ? '' : `: ${v.errores.join('; ')}`}`);
console.log(t.texto.replace(/^/gm, '     '));
const svg = svgMercado(t.tarjeta.d);
const vt = validarTarjeta(svg, t.tarjeta.permitidos, PALABRAS_FIJAS);
bien(vt.ok, `la tarjeta pasa el validador${vt.ok ? '' : `: ${vt.errores.slice(0, 3).join('; ')}`}`);
bien(/REVALORIZACIÓN/.test(svg) && /SUBEN/.test(svg) && /BAJAN/.test(svg), 'la tarjeta con su titular y los dos paneles');
const no = await generar({ jugadores, stats, jornada: 13, ventanas: true, config: {}, paron: null, pedirValor: () => { throw new Error('no debería pedir nada'); }, log: () => {} });
bien(!no.length, 'sin parón no sale (ni pide nada)');
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
