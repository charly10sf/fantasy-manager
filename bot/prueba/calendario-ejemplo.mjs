// Prueba sin red del calendario después del parón (tipos/calendario.mjs; Carlos, 9 nov): con una liga inventada de 20 equipos y 4
// jornadas, quién lo tiene más fácil y más difícil, el tuit (sin mandar revisar ni cambiar el once) y la tarjeta.
//   node bot/prueba/calendario-ejemplo.mjs
import { generar, calendarios } from '../tipos/calendario.mjs';
import { tablaDe } from '../lib/info-jugador.mjs';
import { svgCalendario } from '../lib/tarjetas.mjs';
import { validarTarjeta, validar } from '../lib/validar.mjs';
import { PALABRAS_FIJAS } from '../lib/datos-tarjetas.mjs';

let fallos = 0;
const bien = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) fallos++; };
const N = ['Real Madrid', 'FC Barcelona', 'Atlético de Madrid', 'Villarreal CF', 'Real Betis', 'Athletic Club', 'Real Sociedad', 'Sevilla FC', 'Valencia CF', 'RC Celta',
  'CA Osasuna', 'Getafe CF', 'Rayo Vallecano', 'Girona FC', 'RCD Mallorca', 'Deportivo Alavés', 'RCD Espanyol', 'Levante UD', 'Elche CF', 'Real Oviedo'];
const eq = (i) => ({ id: i + 1, mainName: N[i] });
// la tabla: el 1 gana a todos los de detrás... (12 jornadas: el equipo i gana a los de índice mayor)
const jugados = [];
let mid = 1;
for (let r = 0; r < 12; r++) for (let i = 0; i < 20; i += 2) {
  const a = (i + r) % 20, b = (i + 1 + r * 3) % 20;
  if (a === b) continue;
  jugados.push({ id: mid++, matchState: 7, local: eq(a), visitor: eq(b), localScore: a < b ? 2 : 0, visitorScore: a < b ? 0 : 2 });
}
const tabla = tablaDe(jugados);
// las 4 jornadas que vienen: el último (Oviedo) contra los cuatro primeros; el 5º contra los cuatro últimos, en casa
const jornada = (k) => {
  const ms = [{ id: 1000 + k * 20, matchState: 1, date: `2026-11-${20 + k * 7}T20:00:00Z`, local: eq(k), visitor: eq(19) }, { id: 1001 + k * 20, matchState: 1, date: `2026-11-${20 + k * 7}T18:00:00Z`, local: eq(4), visitor: eq(15 + k) }];
  const libres = [...Array(20).keys()].filter((x) => ![k, 19, 4, 15 + k].includes(x));
  for (let i = 0; i + 1 < libres.length; i += 2) ms.push({ id: 1002 + k * 20 + i, matchState: 1, date: `2026-11-${20 + k * 7}T16:00:00Z`, local: eq(libres[i]), visitor: eq(libres[i + 1]) });
  return ms;
};
const semanas = [0, 1, 2, 3].map(jornada);
const cal = calendarios(semanas, tabla, [13, 14, 15, 16]);
const nombre = (e) => e.nombre;
bien(cal.length === 20, `20 equipos con calendario (${cal.length})`);
bien(nombre(cal[cal.length - 1]) === 'Real Oviedo', `el más difícil es el que juega contra los cuatro primeros (${nombre(cal[cal.length - 1])})`);
bien(cal.slice(0, 3).some((e) => e.nombre === 'Real Betis'), `entre los más fáciles, el que recibe a los cuatro últimos (${cal.slice(0, 3).map(nombre).join(', ')})`);

const pedirSemana = (n) => Promise.resolve(n >= 13 ? semanas[n - 13] || [] : jugados.filter((m) => m.id % 12 === n % 12));
const [t] = await generar({ jugadores: [], stats: semanas[0], jornada: 13, ventanas: false, config: {}, paron: { jugada: 12, siguiente: 13, statsSiguiente: semanas[0] },
  info: { tabla: () => Promise.resolve(tabla) }, pedirSemana, log: () => {} });
bien(t && t.clave === 'calendario|12', 'un tuit con la clave del parón');
const v = validar(t.texto, { numeros: t.numeros, max: 1000 });
bien(v.ok, `la plantilla pasa el validador${v.ok ? '' : `: ${v.errores.join('; ')}`}`);
console.log(t.texto.replace(/^/gm, '     '));
bien(!/revisa|cambia|alinea|tu once/i.test(t.texto) && /fichar|planific/i.test(JSON.stringify(t.hechos)), 'para fichar: ni revisar ni cambiar el once (regla #83)');
bien(t.hechos.mejorCalendario[0].partidos.length === 4, 'los hechos traen los cuatro partidos de cada uno');
const svg = svgCalendario(t.tarjeta.d);
const vt = validarTarjeta(svg, t.tarjeta.permitidos, PALABRAS_FIJAS);
bien(vt.ok, `la tarjeta pasa el validador${vt.ok ? '' : `: ${vt.errores.slice(0, 3).join('; ')}`}`);
{ const n = (svg.match(/>(CASA|FUERA)</g) || []).length, q = [...t.tarjeta.d.mejor, ...t.tarjeta.d.peor].reduce((s, f) => s + f.rivales.length, 0); bien(n === q && q >= 36, `la tarjeta lleva todos los partidos de los 10 equipos (${n})`); }
const no = await generar({ jugadores: [], stats: semanas[0], jornada: 13, ventanas: true, config: {}, paron: null, pedirSemana, log: () => {} });
bien(!no.length, 'sin parón no sale');
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
