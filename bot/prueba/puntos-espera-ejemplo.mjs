// Cuánto hay que esperar a los puntos definitivos de un partido acabado, con lo que pasó de verdad el 7 y el 8 nov (J12).
// Sin red: se repiten, con el reloj falso y la crearDazn de verdad, los 9 partidos de esos dos días tal como los vio el bot (una
// ejecución cada 5 min). Datos sacados de los logs de «Bot X» (las líneas «(puntos) partido N: espero: … puntos sin cambiar B de 10 min»):
// `cambios` son los minutos, contados desde que el bot vio el partido acabado, en cuyas ejecuciones los puntos de LaLiga habían cambiado
// respecto a la ejecución anterior (la primera lectura no cuenta: es la línea base). Pasado el último, ninguno volvió a moverse en horas.
//
//   partido            visto acabado   cambios (min)     último   salió (min)
//   116 Racing-Málaga  7 nov 15:01     5, 10, 20          20       34
//   117                7 nov 17:16     10                 10       20
//   115                7 nov 19:26     5, 10, 20          20       35
//   112                7 nov 22:01     5, 10              10       20
//   118 Elche-Betis    8 nov 14:56     5, 10              10       20
//   114 Real S.-Rayo   8 nov 17:16     5                   5       25
//   111 Villarreal-Get 8 nov 19:26     5                   5       25
//   119 Celta-Levante  8 nov 19:31     5                   5       25
//   120 Atlético-Barça 8 nov 21:56     5, 15, 25          25       40   (todos los cambios, a 10 min unos de otros)
//
// Lo que sale de ahí: LaLiga retoca los puntos en oleadas de cada ~10 min y en 3 de 9 partidos la última llegó a los 20-25 min del pitido
// (el Atlético-Barça, el que más pesa, el que más tarda). No hay un tiempo fijo que valga para todos: con una espera fija habría que
// llegar a 25 + margen, más que ahora. Lo que protege es la prueba de los puntos quietos, y hoy está justo al límite: la mayor distancia
// entre dos cambios seguidos fue de 10 min, que es lo que pide `minEstable`. Con `minEstable` 5 y el suelo en 20 habría salido
// provisional el Atlético-Barça, y con el suelo en 10 o 15, también el 116 y el 115: bajar esos valores deja pasar puntos a medias.
// Esta prueba comprueba que, con los valores del config, ninguno de los 9 habría salido antes de su último cambio, ni con la ejecución
// corrida unos segundos arriba o abajo, y que esos candidatos más bajos no valen.
// (Lo único que se ha recortado, sin tocar el margen: el suelo de `minTrasFinal` admite 30 s, porque las ejecuciones no caen exactas
// y tres partidos esperaron 5 min de más por llevar 19,98 min en vez de 20.)
import { crearDazn, huellaPartido } from '../lib/dazn.mjs';

let fallos = 0;
const ok = (c, txt) => { if (!c) fallos++; console.log(`${c ? 'ok   ' : 'FALLA'} ${txt}`); };

const PARTIDOS = {
  116: { cambios: [5, 10, 20], salio: 34 }, 117: { cambios: [10], salio: 20 }, 115: { cambios: [5, 10, 20], salio: 35 },
  112: { cambios: [5, 10], salio: 20 }, 118: { cambios: [5, 10], salio: 20 }, 114: { cambios: [5], salio: 25 },
  111: { cambios: [5], salio: 25 }, 119: { cambios: [5], salio: 25 }, 120: { cambios: [5, 15, 25], salio: 40 },
};
const SAQUE = Date.parse('2026-11-08T20:00:00Z');
const jug = (id, pts) => ({ id, nickname: `J${id}`, positionId: id === 1 ? 1 : 3, weekPoints: pts });
// los puntos del partido en la versión `v` (cada oleada cambia los de un jugador)
const partido = (id, v) => ({ id, date: new Date(SAQUE).toISOString(), matchState: 7, localScore: 1, visitorScore: 1,
  local: { id: 1, mainName: 'A', players: [jug(1, 5 + v), jug(2, 8), jug(3, 3)] }, visitor: { id: 2, mainName: 'B', players: [jug(4, 6), jug(5, 9 + v)] } });
const fichas = async () => ({ playerStats: [{ weekNumber: 12, stats: { mins_played: [90, 2], marca_points: [1, 3], goals_conceded: [1, -1] } }] });

/** minutos desde que el bot lo ve acabado hasta que sale, con ejecuciones cada `paso` min (más `desfase` s de retraso en cada una) */
async function repetir(cfg, { cambios, paso = 5, desfase = 0 }) {
  const registro = { datos: {} };
  let t0 = Date.parse('2026-11-08T22:00:00Z'), reloj = t0;
  const dazn = () => crearDazn({ ficha: fichas, jornada: 12, registro, ahora: () => reloj, log: () => {}, ...cfg });
  for (let k = 0; k < 200; k++) {
    const min = k * paso;
    reloj = t0 + min * 60e3 + k * desfase * 1e3;
    // versión de los puntos en este momento: una por cada cambio ya pasado
    const v = cambios.filter((c) => c <= min).length;
    // los partidos se ven acabados el minuto 0 con la versión 0 (la línea base)
    const r = await dazn()(partido(100, v));
    if (r.listo) return { min: (reloj - t0) / 60e3, ultimo: Math.max(0, ...cambios), v };
  }
  return null;
}

const CFG = { minTrasFinal: 20, minEstable: 10, esperaHoras: 6 };
// 1. los valores del config.json de verdad
{
  const { puntosFinales: pf } = JSON.parse((await import('node:fs')).readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
  ok(pf.minTrasFinal === CFG.minTrasFinal && pf.minEstable === CFG.minEstable, `config.json: minTrasFinal ${pf.minTrasFinal}, minEstable ${pf.minEstable} (los de esta prueba)`);
}
// 2. los 9 partidos: nunca sale antes de su último cambio, con 0, ±3 y ±8 s de retraso acumulado por ejecución
{
  let peorMargen = Infinity;
  for (const [id, p] of Object.entries(PARTIDOS)) {
    for (const desfase of [0, 3, -3, 8, -8]) {
      const r = await repetir(CFG, { cambios: p.cambios, desfase });
      if (!r) { ok(false, `partido ${id}: no sale nunca`); continue; }
      // sale con todas las oleadas ya vistas y con la última tan vieja como mínimo
      const margen = r.min - r.ultimo;
      peorMargen = Math.min(peorMargen, margen);
      if (!(r.v === p.cambios.length && margen >= 9.5)) ok(false, `partido ${id} (desfase ${desfase} s): sale a los ${r.min.toFixed(1)} min con ${r.v} de ${p.cambios.length} oleadas (último cambio a los ${r.ultimo})`);
    }
  }
  ok(peorMargen >= 9.5, `los 9 partidos salen con todas las oleadas vistas y ≥10 min de puntos quietos (peor margen ${peorMargen.toFixed(1)} min)`);
}
// 3. y cuánto tardan: entre 20 y 40 min desde que el bot los ve acabados (lo que dicen los logs)
{
  const tiempos = {};
  for (const [id, p] of Object.entries(PARTIDOS)) tiempos[id] = (await repetir(CFG, { cambios: p.cambios })).min;
  const lista = Object.entries(tiempos).map(([id, m]) => `${id}: ${m.toFixed(0)}`).join(' · ');
  console.log(`      salen a los (min) ${lista}`);
  ok(Math.min(...Object.values(tiempos)) >= 20 && Math.max(...Object.values(tiempos)) <= 40, 'entre 20 y 40 min desde que se ve acabado, como en los logs');
}
// 4. bajar los valores deja salir puntos a medias: con estos candidatos, algún partido de los 9 sale antes de su último cambio
{
  const candidatos = [{ minTrasFinal: 20, minEstable: 5 }, { minTrasFinal: 10, minEstable: 5 }, { minTrasFinal: 15, minEstable: 5 }, { minTrasFinal: 10, minEstable: 0 }];
  for (const c of candidatos) {
    let mal = [];
    for (const [id, p] of Object.entries(PARTIDOS)) {
      const r = await repetir({ ...CFG, ...c }, { cambios: p.cambios });
      if (r && r.v < p.cambios.length) mal.push(id);
    }
    ok(mal.length > 0, `minTrasFinal ${c.minTrasFinal} + minEstable ${c.minEstable}: saldría con puntos a medias en ${mal.length} de 9 (${mal.join(', ')})`);
  }
}
// 4b. el suelo admite 30 s: a los 19,7 min ya vale, a los 19 no
{
  const t0 = Date.parse('2026-11-08T22:00:00Z');
  const reg = { datos: { puntosPartido: { '12|100': { h: huellaPartido(partido(100, 1)), desde: t0 - 5 * 60e3, fin: t0 } } } };
  const en = (min) => crearDazn({ ficha: fichas, jornada: 12, registro: reg, minTrasFinal: 20, minEstable: 10, esperaHoras: 6, ahora: () => t0 + min * 60e3, log: () => {} })(partido(100, 1));
  ok(!(await en(19)).listo, 'a los 19 min del final todavía espera');
  ok((await en(19.7)).listo, 'a los 19,7 min (19,98 en la práctica) ya sale');
}
// 5. Telegram (soloLeer): mira lo que apuntó X, no apunta nada y no suelta antes que X
{
  const t0 = Date.parse('2026-11-08T22:00:00Z');
  const registroX = (v, desdeMin, finMin) => ({ datos: { puntosPartido: { [`12|100`]: { h: huellaPartido(partido(100, v)), desde: t0 + desdeMin * 60e3, fin: t0 + finMin * 60e3 } } } });
  const tg = (reg, min, v) => crearDazn({ ficha: fichas, jornada: 12, registro: reg, soloLeer: true, minTrasFinal: 20, minEstable: 10, esperaHoras: 6, ahora: () => t0 + min * 60e3, log: () => {} })(partido(100, v));
  // visto acabado el minuto 0, último cambio el minuto 25 (como el Atlético-Barça)
  let reg = registroX(3, 25, 0);
  const antes = JSON.stringify(reg);
  ok(!(await tg(reg, 30, 3)).listo, 'Telegram, 5 min tras el último cambio: espera (antes salía a los 20 min del final estimado)');
  ok((await tg(reg, 36, 3)).listo, 'Telegram, 11 min con los puntos quietos y 36 desde el final: listo');
  ok(!(await tg(reg, 36, 4)).listo, 'Telegram ve unos puntos distintos de los que apuntó X: espera');
  ok(!(await tg({ datos: {} }, 60, 3)).listo, 'Telegram, X aún no ha visto el partido acabado: espera');
  ok(JSON.stringify(reg) === antes, 'Telegram no toca el registro de X');
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
