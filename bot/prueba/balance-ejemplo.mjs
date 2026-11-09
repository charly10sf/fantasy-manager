// Prueba sin red del balance de la temporada en el parón (tipos/balance.mjs; Carlos, 9 nov): con una liga inventada, los que más
// llevan por puesto, el once de la temporada, los chollos, el tuit y la tarjeta (validada como en el bot, sin caras).
//   node bot/prueba/balance-ejemplo.mjs
import { generar, porPuesto, onceTemporada, chollos } from '../tipos/balance.mjs';
import { svgOnceIdeal } from '../lib/tarjetas.mjs';
import { validarTarjeta, validar } from '../lib/validar.mjs';
import { PALABRAS_FIJAS } from '../lib/datos-tarjetas.mjs';
import { fijarDatos } from '../lib/datos-jugador.mjs';

let fallos = 0;
const bien = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) fallos++; };
const CLUBES = ['Real Madrid', 'FC Barcelona', 'Atlético de Madrid', 'Villarreal CF', 'Real Betis', 'Levante UD', 'Celta de Vigo', 'Sevilla FC'];
const stats = CLUBES.map((n, i) => (i % 2 ? null : { id: 100 + i, matchState: 1, date: '2026-11-20T20:00:00Z', local: { id: i + 1, mainName: n }, visitor: { id: i + 2, mainName: CLUBES[i + 1] } })).filter(Boolean);
const jugadores = [];
let id = 1;
const letras = (n) => { let x = ''; for (n += 25; n > 0; n = Math.floor((n - 1) / 26)) x = String.fromCharCode(97 + ((n - 1) % 26)) + x; return x[0].toUpperCase() + x.slice(1); };
for (const [pos, n] of [[1, 4], [2, 10], [3, 10], [4, 8]]) for (let k = 0; k < n; k++) {
  const base = 2 + ((id * 7) % 9);
  const w = Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1, points: base + ((i + id) % 4) }));
  jugadores.push({ id: String(id), nickname: `Jugador ${letras(id)}`, positionId: String(pos), teamId: String((id % 8) + 1), playerStatus: 'ok', marketValue: String((1 + (id % 13)) * 4e6), weekPoints: w, points: w.reduce((s, x) => s + x.points, 0), averagePoints: 6 });
  id++;
}
// un chollo claro: un defensa barato con muchos puntos
jugadores.push({ id: '99', nickname: 'Chollazo', positionId: '2', teamId: '3', playerStatus: 'ok', marketValue: '1500000', weekPoints: Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1, points: 7 })), points: 84, averagePoints: 7 });

const pp = porPuesto(jugadores, 12);
const once = onceTemporada(pp);
bien(once && once.once.length === 11, `once de la temporada: ${once.formacion}, ${once.pts} puntos`);
bien(once.once[0].pos === 1 && once.once.filter((x) => x.pos === 2).length === Number(once.formacion.split('-')[0]), 'el once va de portero a delanteros con la formación');
const chs = chollos(pp, 12);
bien(chs[0] && chs[0].nombre === 'Chollazo', `el chollo es el barato con muchos puntos (${chs.map((x) => x.nombre).join(', ')})`);

fijarDatos({ jugadores, hasta: 12 });
const [t] = await generar({ jugadores, stats, jornada: 13, ventanas: false, config: {}, paron: { jugada: 12, siguiente: 13, statsSiguiente: stats }, log: () => {} });
bien(t && t.clave === 'balance|12' && t.jornada === 12, 'un tuit con la clave del parón');
const v = validar(t.texto, { numeros: t.numeros, max: 1000 });
bien(v.ok, `la plantilla pasa el validador${v.ok ? '' : `: ${v.errores.join('; ')}`}`);
console.log(t.texto.replace(/^/gm, '     '));
bien(t.hechos.tipo === 'balance' && t.hechos.jugadores.some((j) => j.principal) && t.hechos.chollos.length, 'hechos con el protagonista y los chollos');
const svg = svgOnceIdeal(t.tarjeta.d);
const vt = validarTarjeta(svg, t.tarjeta.permitidos, PALABRAS_FIJAS);
bien(vt.ok, `la tarjeta pasa el validador${vt.ok ? '' : `: ${vt.errores.slice(0, 3).join('; ')}`}`);
bien(/TEMPORADA/.test(svg) && /MÁS PUNTOS/.test(svg) && !/VALOR DEL ONCE/.test(svg), 'la tarjeta dice TEMPORADA y MÁS PUNTOS, sin el valor del once');
// fuera de su hora (con ventanas y sin parón) no sale
const no = await generar({ jugadores, stats, jornada: 13, ventanas: true, config: {}, paron: null, log: () => {} });
bien(!no.length, 'sin parón no sale');
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
